// ---------------------------------------------------------------------------
// The learning layer — the platform's brain, layer 4.
//
// Layers 1–3 (snapshot every pregame pick, grade it against finals, publish
// calibration) make the model accountable. This layer closes the loop: it
// measures the model's systematic bias per sport from the GRADED ledger and
// fits a bounded correction (Platt scaling on the stated probabilities) that
// is applied where model percentages are produced — standings/board Flip %,
// matchup season-model inputs, soccer's Poisson three-way, and therefore the
// snapshots the tracker grades. The ledger always grades the model's CURRENT
// (corrected) belief; history is never rewritten.
//
// Guardrails (deliberate — a model that rewires itself on noise learns noise):
//   - A sport needs >= 20 graded picks before a fit is even computed, and the
//     fit is regularized toward "the model is already calibrated" (a=1, b=0).
//   - The correction only ACTIVATES (weight > 0) once a sport has >= 50
//     graded picks AND the global ledger has >= 200. Weight then ramps as
//     min(1, sportN / 200). Below that, the cycle still runs and LOGS what it
//     measured ("measuring" status) — it just doesn't touch the calls yet.
//   - Applied shift is capped at ±0.08 probability per reading, probabilities
//     clamped to [0.02, 0.98].
//   - The cycle runs at most weekly (checked inside the daily refresh) and
//     every run is written to a public audit log with a plain-language
//     headline: what bias was found, how big, and whether it's adjusting.
//   - If anything fails, the cache simply stays empty and every percentage
//     passes through uncorrected — the safe failure mode is NO correction,
//     never a wrong one.
// ---------------------------------------------------------------------------

import { and, eq, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "./db.js";
import * as schema from "./schema.js";

export const LEARNING_SPORTS = ["nhl", "nfl", "nba", "soccer", "ncaaf"] as const;
export type LearningSport = (typeof LEARNING_SPORTS)[number];

const SPORT_LABEL: Record<LearningSport, string> = {
  nhl: "NHL", nfl: "NFL", nba: "NBA", soccer: "Soccer", ncaaf: "College football",
};

export interface CalibrationParams { a: number; b: number; weight: number; gradedN: number }
const IDENTITY: CalibrationParams = { a: 1, b: 0, weight: 0, gradedN: 0 };

let cache: Map<LearningSport, CalibrationParams> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const logit = (p: number): number => Math.log(p / (1 - p));
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

// Synchronous on purpose: modelWinPct and the soccer probability builder are
// pure sync functions. Reads only the in-memory cache; identity when cold.
export function applyCalibration(sport: string | undefined, p: number | null): number | null {
  if (p === null || !sport || !cache) return p;
  const params = cache.get(sport as LearningSport);
  if (!params || params.weight <= 0) return p;
  const pc = clamp(p, 0.02, 0.98);
  const q = sigmoid(params.a * logit(pc) + params.b);
  const shifted = pc + params.weight * (q - pc);
  const capped = clamp(shifted, pc - 0.08, pc + 0.08);
  return Math.round(clamp(capped, 0.02, 0.98) * 1000) / 1000;
}

async function ensureLearningTables(): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`model_calibration\` (\`sport\` text PRIMARY KEY NOT NULL, \`a\` real NOT NULL, \`b\` real NOT NULL, \`weight\` real NOT NULL, \`graded_n\` integer NOT NULL, \`updated_at\` integer NOT NULL)`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`model_learning_runs\` (\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL, \`created_at\` integer NOT NULL, \`sport\` text NOT NULL, \`graded_n\` integer NOT NULL, \`a\` real, \`b\` real, \`weight\` real NOT NULL, \`status\` text NOT NULL, \`headline\` text NOT NULL, \`buckets\` text NOT NULL)`);
}

async function reloadCache(): Promise<void> {
  const rows = (await db.all(sql`SELECT \`sport\`, \`a\`, \`b\`, \`weight\`, \`graded_n\` FROM \`model_calibration\``)) as Array<Record<string, unknown>>;
  const map = new Map<LearningSport, CalibrationParams>();
  for (const s of LEARNING_SPORTS) map.set(s, { ...IDENTITY });
  for (const r of rows) {
    const sport = String(r.sport) as LearningSport;
    if ((LEARNING_SPORTS as readonly string[]).includes(sport)) {
      map.set(sport, { a: Number(r.a), b: Number(r.b), weight: Number(r.weight), gradedN: Number(r.graded_n) });
    }
  }
  cache = map;
  cacheLoadedAt = Date.now();
}

export async function ensureCalibrationLoaded(): Promise<void> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return;
  try {
    await ensureLearningTables();
    await reloadCache();
  } catch (e) {
    console.error("[learning] calibration load failed (continuing uncorrected):", e instanceof Error ? e.message : e);
  }
}

interface PickPair { p: number; y: number }

async function gradedPairs(sport: LearningSport): Promise<PickPair[]> {
  const rows = await db.select().from(schema.modelSnapshots).where(
    and(
      eq(schema.modelSnapshots.sport, sport),
      eq(schema.modelSnapshots.source, "live"),
      isNotNull(schema.modelSnapshots.gradedAt),
    ),
  );
  const pairs: PickPair[] = [];
  for (const r of rows) {
    if (r.modelPick === null || r.modelCorrect === null) continue;
    const p = r.modelPick === "away" ? r.modelAway : r.modelPick === "home" ? r.modelHome : r.modelDraw;
    if (p === null || p <= 0.01 || p >= 0.99) continue;
    pairs.push({ p, y: r.modelCorrect });
  }
  return pairs;
}

// Platt scaling fit by Newton's method on regularized log-loss. The prior is
// "the model is calibrated" (a=1, b=0); the ridge pulls toward it so small
// samples produce small corrections.
function fitPlatt(pairs: PickPair[]): { a: number; b: number } {
  let a = 1;
  let b = 0;
  const L = 5;
  for (let iter = 0; iter < 60; iter++) {
    let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
    for (const { p, y } of pairs) {
      const x = logit(clamp(p, 0.02, 0.98));
      const q = sigmoid(a * x + b);
      const d = q - y;
      const w = Math.max(q * (1 - q), 1e-6);
      ga += d * x; gb += d;
      haa += w * x * x; hab += w * x; hbb += w;
    }
    ga += 2 * L * (a - 1); gb += 2 * L * b; haa += 2 * L; hbb += 2 * L;
    const det = haa * hbb - hab * hab;
    if (Math.abs(det) < 1e-9) break;
    const da = (ga * hbb - gb * hab) / det;
    const dbn = (haa * gb - hab * ga) / det;
    a -= da; b -= dbn;
    if (Math.abs(da) < 1e-7 && Math.abs(dbn) < 1e-7) break;
  }
  return { a: clamp(a, 0.2, 3), b: clamp(b, -2, 2) };
}

const BINS = [
  { lo: 0.5, hi: 0.6, label: "50–60%" },
  { lo: 0.6, hi: 0.7, label: "60–70%" },
  { lo: 0.7, hi: 0.8, label: "70–80%" },
  { lo: 0.8, hi: 1.01, label: "80%+" },
] as const;

interface Bucket { label: string; n: number; stated: number | null; actual: number | null }

function bucketize(pairs: PickPair[]): Bucket[] {
  return BINS.map((bin) => {
    const inBin = pairs.filter(({ p }) => p >= bin.lo && p < bin.hi);
    if (inBin.length === 0) return { label: bin.label, n: 0, stated: null, actual: null };
    return {
      label: bin.label,
      n: inBin.length,
      stated: Math.round((inBin.reduce((s, x) => s + x.p, 0) / inBin.length) * 100),
      actual: Math.round((inBin.reduce((s, x) => s + x.y, 0) / inBin.length) * 100),
    };
  });
}

function biasHeadline(sport: LearningSport, buckets: Bucket[], n: number, status: string): string {
  const label = SPORT_LABEL[sport];
  let worst: (Bucket & { gap: number }) | null = null;
  for (const b of buckets) {
    if (b.n >= 10 && b.stated !== null && b.actual !== null) {
      const gap = Math.abs(b.actual - b.stated);
      if (!worst || gap > worst.gap) worst = { ...b, gap };
    }
  }
  if (worst && worst.gap >= 7 && worst.stated !== null && worst.actual !== null) {
    const direction = worst.actual < worst.stated ? "overconfident" : "underconfident";
    const action = status === "adjusting"
      ? "Those reads are now shaded toward reality until the numbers say otherwise."
      : "Noted — the correction starts applying once the sample is big enough to trust.";
    return `${label}: on ${n} graded picks, the reads priced ${worst.label} actually won ${worst.actual}% (stated ${worst.stated}%) — the model is ${direction} there. ${action}`;
  }
  return `${label}: across ${n} graded picks, no systematic bias bigger than noise — stated confidence and actual results line up, so no adjustment is earned yet.`;
}

export async function runLearningCycle(): Promise<{ ran: boolean; reason?: string }> {
  await ensureLearningTables();
  const last = (await db.all(sql`SELECT \`created_at\` FROM \`model_learning_runs\` ORDER BY \`created_at\` DESC LIMIT 1`)) as Array<Record<string, unknown>>;
  const now = Date.now();
  if (last.length > 0 && now - Number(last[0]?.created_at ?? 0) < 7 * 24 * 3600 * 1000) {
    await reloadCache();
    return { ran: false, reason: "last cycle ran within 7 days" };
  }
  const perSport = new Map<LearningSport, PickPair[]>();
  let globalN = 0;
  for (const s of LEARNING_SPORTS) {
    const pairs = await gradedPairs(s);
    perSport.set(s, pairs);
    globalN += pairs.length;
  }
  for (const s of LEARNING_SPORTS) {
    const pairs = perSport.get(s) ?? [];
    const n = pairs.length;
    const buckets = bucketize(pairs);
    let a: number | null = null;
    let b: number | null = null;
    let weight = 0;
    let status = "waiting";
    let headline: string;
    if (n === 0) {
      headline = `${SPORT_LABEL[s]}: no graded picks yet — the brain is listening, not learning.`;
    } else if (n < 20) {
      status = "measuring";
      headline = `${SPORT_LABEL[s]}: only ${n} graded picks so far — too few to trust any pattern. Measuring only.`;
    } else {
      const fit = fitPlatt(pairs);
      a = fit.a; b = fit.b;
      weight = globalN >= 200 && n >= 50 ? Math.min(1, n / 200) : 0;
      status = weight > 0 ? "adjusting" : "measuring";
      headline = biasHeadline(s, buckets, n, status);
    }
    await db.run(sql`INSERT INTO \`model_learning_runs\` (\`created_at\`, \`sport\`, \`graded_n\`, \`a\`, \`b\`, \`weight\`, \`status\`, \`headline\`, \`buckets\`) VALUES (${now}, ${s}, ${n}, ${a}, ${b}, ${weight}, ${status}, ${headline}, ${JSON.stringify(buckets)})`);
    await db.run(sql`INSERT INTO \`model_calibration\` (\`sport\`, \`a\`, \`b\`, \`weight\`, \`graded_n\`, \`updated_at\`) VALUES (${s}, ${a ?? 1}, ${b ?? 0}, ${weight}, ${n}, ${now}) ON CONFLICT(\`sport\`) DO UPDATE SET \`a\` = excluded.\`a\`, \`b\` = excluded.\`b\`, \`weight\` = excluded.\`weight\`, \`graded_n\` = excluded.\`graded_n\`, \`updated_at\` = excluded.\`updated_at\``);
  }
  await reloadCache();
  console.log(`[learning] cycle complete: ${globalN} graded live picks across ${LEARNING_SPORTS.length} sports`);
  return { ran: true };
}

export async function getLearningLogData(): Promise<{
  runs: Array<{ id: number; createdAt: string; sport: string; gradedPicks: number; weight: number; status: string; headline: string }>;
  sports: Array<{ sport: string; gradedPicks: number; weight: number; status: string }>;
}> {
  await ensureCalibrationLoaded();
  const rows = (await db.all(sql`SELECT \`id\`, \`created_at\`, \`sport\`, \`graded_n\`, \`weight\`, \`status\`, \`headline\` FROM \`model_learning_runs\` ORDER BY \`created_at\` DESC, \`id\` DESC LIMIT 15`)) as Array<Record<string, unknown>>;
  const statusOf = (p: CalibrationParams): string => (p.weight > 0 ? "adjusting" : p.gradedN > 0 ? "measuring" : "waiting");
  return {
    runs: rows.map((r) => ({
      id: Number(r.id),
      createdAt: new Date(Number(r.created_at)).toISOString(),
      sport: String(r.sport),
      gradedPicks: Number(r.graded_n),
      weight: Number(r.weight),
      status: String(r.status),
      headline: String(r.headline),
    })),
    sports: LEARNING_SPORTS.map((s) => {
      const p = cache?.get(s) ?? IDENTITY;
      return { sport: s, gradedPicks: p.gradedN, weight: p.weight, status: statusOf(p) };
    }),
  };
}
