// Renew — the daily databank renewal job, run inside refreshDaily (midnight
// ET + the 6 AM re-refresh) and safe to run twice a day.
//
// Order:
//   (a) ingest fresh game logs for the tracked pool
//   (b) snapshot today's model picks — by mirroring the tracker's
//       modelSnapshots (the existing snapshot path; the model is not
//       duplicated here) — plus the chat-sourced seed picks
//   (c) grade all ungraded picks whose games are final
//   (d) recompute the rolling rates
//   (e) run the learning cycle (weekly-gated inside; prop pairs from the
//       databank now feed the Platt fit alongside game winners)
//   (f) write the databank_renewals audit row — always, even on failure
//
// Status rules: a run is "success" only when every sport with a tracked
// pool ingested rows. A sport that returned 0 rows is a partial (or failed,
// if everything failed) — never a success — and the previous good copy
// stays, because ingest never deletes. A databank failure never fails the
// whole refreshDaily: the caller wraps this in try/catch.

import { eq } from "drizzle-orm";
import type { Ctx } from "../actions.js";
import * as schema from "../schema.js";
import { runLearningCycle } from "../learning.js";
import { ingestAllGameLogs } from "./ingest.js";
import { gradeUngradedPicks, recomputeRates } from "./grade.js";
import { seedChatPicks } from "./seed.js";

export interface RenewalResult {
  status: "success" | "partial" | "failed";
  rowsIngested: number;
  rowsSeen: number;
  picksSnapshot: number;
  picksGraded: number;
  ratesRecomputed: number;
  note: string | null;
  errors: string[];
}

// Mirror the tracker's live game-winner snapshots into databank_picks so
// the learning layer sees them through the same ledger as the props. The
// tracker already did the model work; this only copies the stated belief.
// Dedupe is in code: winner picks carry a null line, and SQLite treats
// NULLs as distinct in unique indexes, so the index alone can't dedupe them.
async function mirrorWinnerPicks(db: Ctx["db"]): Promise<number> {
  const snaps = await db.select().from(schema.modelSnapshots).where(eq(schema.modelSnapshots.source, "live"));
  const existing = await db.select().from(schema.databankPicks).where(eq(schema.databankPicks.pickKind, "winner"));
  const seen = new Set(existing.map((p) => `${p.sport}|${p.team}|${p.market}|${p.gameDate}`));
  let inserted = 0;
  for (const s of snaps) {
    if (!s.modelPick) continue;
    const prob = s.modelPick === "away" ? s.modelAway : s.modelPick === "home" ? s.modelHome : s.modelDraw;
    const price = s.modelPick === "away" ? s.bookAwayPrice : s.modelPick === "home" ? s.bookHomePrice : s.bookDrawPrice;
    if (prob === null) continue;
    const team = s.modelPick === "away" ? s.awayTeam : s.modelPick === "home" ? s.homeTeam : s.awayTeam;
    const opponent = s.modelPick === "away" ? s.homeTeam : s.modelPick === "home" ? s.awayTeam : s.homeTeam;
    const key = `${s.sport}|${team}|moneyline|${s.gameDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await db.insert(schema.databankPicks).values({
      sport: s.sport, pickKind: "winner", playerName: null, playerId: null, team,
      market: "moneyline", line: null, statedProbability: prob, price,
      gameDate: s.gameDate, opponent, snapshotAt: s.snapshotAt, source: "live", note: null,
    });
    inserted += 1;
  }
  return inserted;
}

export async function runDatabankRenewal(ctx: Ctx): Promise<RenewalResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  const notes: string[] = [];
  let rowsSeen = 0;
  let rowsInserted = 0;
  let picksSnapshot = 0;
  let picksGraded = 0;
  let ratesRecomputed = 0;
  let status: "success" | "partial" | "failed" = "success";
  try {
    // (a) Ingest fresh game logs.
    const ing = await ingestAllGameLogs(ctx.db);
    rowsSeen = ing.rowsSeen;
    rowsInserted = ing.rowsInserted;
    if (ing.failedSports.length > 0) {
      status = "partial";
      notes.push(`ingest failed for ${ing.failedSports.join(", ")} — previous good copy kept`);
      errors.push(...ing.errors);
    }
    // (b) Snapshot today's model picks + the chat seed picks.
    picksSnapshot = (await mirrorWinnerPicks(ctx.db)) + (await seedChatPicks(ctx.db));
    // (c) Grade everything whose game is final.
    const g = await gradeUngradedPicks(ctx.db);
    picksGraded = g.graded;
    if (g.errors.length > 0) errors.push(...g.errors);
    if (g.dnps > 0) notes.push(`${g.dnps} pick${g.dnps === 1 ? "" : "s"} graded DNP (did not play — never a miss)`);
    // (d) Recompute rolling rates.
    ratesRecomputed = (await recomputeRates(ctx.db)).recomputed;
    // (e) Learning cycle — weekly-gated inside; prop pairs now included.
    try {
      const lc = await runLearningCycle();
      if (lc.ran) notes.push("learning cycle ran");
    } catch (e) {
      console.error("[databank] learning cycle failed:", e instanceof Error ? e.message : e);
    }
  } catch (e) {
    status = "failed";
    errors.push(e instanceof Error ? e.message : String(e));
    console.error("[databank] renewal failed:", e instanceof Error ? e.message : e);
  }
  // Never a success when nothing was ingested at all.
  if (rowsSeen === 0 && status === "success") status = "failed";
  const note = notes.length > 0 ? notes.join(" · ") : null;
  const errorMessage = errors.length > 0 ? errors.slice(0, 5).join(" · ") : null;
  const finishedAt = new Date();
  // (f) Audit row — always written, even on failure. This is the trail
  // that proves the bank renewed (or says plainly why it didn't).
  try {
    await ctx.db.insert(schema.databankRenewals).values({
      startedAt, finishedAt, status, rowsIngested: rowsSeen,
      picksSnapshot, picksGraded, ratesRecomputed, errorMessage, note,
    });
  } catch (e) {
    console.error("[databank] could not write renewal audit row:", e instanceof Error ? e.message : e);
  }
  console.log(`[databank] renewal ${status}: seen=${rowsSeen} inserted=${rowsInserted} picks=${picksSnapshot} graded=${picksGraded} rates=${ratesRecomputed}`);
  return { status, rowsIngested: rowsSeen, rowsSeen, picksSnapshot, picksGraded, ratesRecomputed, note, errors };
}
