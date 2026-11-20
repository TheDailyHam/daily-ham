// Grade — grade ungraded databank picks against the banked game logs and
// final scoreboards, then recompute the rolling rates.
//
// Standing rules:
//   - A pick grades only once its game is FINAL (scoreboard-confirmed). A
//     game that hasn't been played yet stays ungraded, never guessed.
//   - DNP is never a miss. If the game is final and the player has no game
//     log row for it — and the absence is real (the bank's log for that
//     player extends past the game date, or the log was refreshed by a
//     recent ingest), not a stale feed — the pick grades "dnp". Dorofeyev
//     (Nov 16) and Avdija (Nov 17) were both missed as DNPs in pregame
//     grades; the bank must not repeat that.
//   - Rates count only decided picks (hit + miss). DNP and void never enter
//     a rate, and the sample size (games) is always stored beside it.
//
// Game-script shading (the Nov 19 lesson): when a player's team is a
// blowout favorite (spread -10 or more), pass-attempt and kicker-FG props
// dry up — the favorite runs out the clock. applyGameScriptShade() multiplies
// the stated probability by 0.85 for those markets and records the shading
// in the pick's note. The shaded value is the model's effective belief, so
// it is what the learning layer sees; the note preserves the original.

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Ctx } from "../actions.js";
import * as schema from "../schema.js";

const NHL_API = "https://api-web.nhle.com/v1";
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports";

// The sport enum as the schema types it — drizzle's eq() needs the narrow
// union, not a plain string, when comparing against an enum column.
type Sport = typeof schema.databankPicks.$inferSelect.sport;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetries(url: string, retries = 2): Promise<unknown | null> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (response.ok) return (await response.json()) as unknown;
    } catch { /* transient — retry */ }
    if (attempt < retries) await sleep(500 * (attempt + 1));
  }
  return null;
}

export interface FinalGame {
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
}

function scoreNum(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Final games for one (sport, date). Returns null when the scoreboard itself
// can't be read — callers treat that as "unknown", never as "not played".
async function fetchFinalGames(sport: string, gameDate: string): Promise<FinalGame[] | null> {
  if (sport === "nhl") {
    const payload = await fetchJsonWithRetries(`${NHL_API}/score/${gameDate}`);
    if (payload === null) return null;
    const games = (payload as { games?: unknown }).games;
    if (!Array.isArray(games)) return null;
    const out: FinalGame[] = [];
    for (const g of games as Array<Record<string, unknown>>) {
      if (g.gameState !== "OFF") continue;
      const away = g.awayTeam as Record<string, unknown> | undefined;
      const home = g.homeTeam as Record<string, unknown> | undefined;
      if (typeof away?.abbrev !== "string" || typeof home?.abbrev !== "string") continue;
      out.push({
        away: away.abbrev as string, home: home.abbrev as string,
        awayScore: scoreNum(away.score), homeScore: scoreNum(home.score),
      });
    }
    return out;
  }
  const league = sport === "nba" ? "basketball/nba" : "football/nfl";
  const dates = gameDate.replaceAll("-", "");
  const payload = await fetchJsonWithRetries(`${ESPN_SCOREBOARD}/${league}/scoreboard?dates=${dates}`);
  if (payload === null) return null;
  const events = (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return null;
  const out: FinalGame[] = [];
  for (const ev of events as Array<Record<string, unknown>>) {
    const competitions = ev.competitions as Array<Record<string, unknown>> | undefined;
    const comp = competitions?.[0];
    if (!comp) continue;
    const status = comp.status as Record<string, unknown> | undefined;
    const type = status?.type as Record<string, unknown> | undefined;
    // ESPN scoreboard competitors are [home, away] in every sport.
    if (type?.state !== "post") continue;
    const competitors = comp.competitors as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(competitors) || competitors.length < 2) continue;
    const home = competitors[0];
    const away = competitors[1];
    const homeTeam = home?.team as Record<string, unknown> | undefined;
    const awayTeam = away?.team as Record<string, unknown> | undefined;
    if (typeof homeTeam?.abbreviation !== "string" || typeof awayTeam?.abbreviation !== "string") continue;
    out.push({
      away: awayTeam.abbreviation as string, home: homeTeam.abbreviation as string,
      awayScore: scoreNum(away?.score), homeScore: scoreNum(home?.score),
    });
  }
  return out;
}

function findGame(games: FinalGame[], team: string | null, opponent: string | null): FinalGame | null {
  if (!team) return null;
  for (const g of games) {
    if ((g.home === team || g.away === team) && (!opponent || g.home === opponent || g.away === opponent)) return g;
  }
  return null;
}

type PropResult = { outcome: "hit" | "miss" | "void"; actual: string | null };

function evaluateProp(market: string, line: number | null, stats: Record<string, number | null>): PropResult {
  const v = (key: string): number | null => (typeof stats[key] === "number" ? stats[key] : null);
  const over = (key: string): PropResult => {
    const value = v(key);
    if (value === null || line === null) return { outcome: "void", actual: value === null ? null : String(value) };
    return { outcome: value > line ? "hit" : "miss", actual: String(value) };
  };
  const atLeast = (key: string, n: number): PropResult => {
    const value = v(key);
    if (value === null) return { outcome: "void", actual: null };
    return { outcome: value >= n ? "hit" : "miss", actual: String(value) };
  };
  switch (market) {
    case "anytime_td": return atLeast("tdTotal", 1);
    case "anytime_goal": return atLeast("goals", 1);
    case "shots_2plus": return atLeast("shots", 2);
    case "shots_3plus": return atLeast("shots", 3);
    case "points_1plus": return atLeast("points", 1);
    case "points_over": return over("points");
    case "rebounds_over": return over("rebounds");
    case "assists_over": return over("assists");
    case "threes_over": return over("threes");
    case "attempts_over": return over("attempts");
    case "fg_over": return over("fgMade");
    default: return { outcome: "void", actual: null };
  }
}

export interface GradeResult {
  graded: number;
  hits: number;
  misses: number;
  dnps: number;
  skipped: number;
  errors: string[];
}

export async function gradeUngradedPicks(db: Ctx["db"]): Promise<GradeResult> {
  const ungraded = await db.select({ pick: schema.databankPicks })
    .from(schema.databankPicks)
    .leftJoin(schema.databankGrades, eq(schema.databankGrades.pickId, schema.databankPicks.id))
    .where(isNull(schema.databankGrades.id));
  let graded = 0;
  let hits = 0;
  let misses = 0;
  let dnps = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Finality per (sport, date), fetched once per distinct date.
  const finalsCache = new Map<string, FinalGame[] | null>();
  const finalsFor = async (sport: string, date: string): Promise<FinalGame[] | null> => {
    const key = `${sport}|${date}`;
    if (!finalsCache.has(key)) finalsCache.set(key, await fetchFinalGames(sport, date));
    return finalsCache.get(key) ?? null;
  };

  // Per-player log cache: gameDate -> stats, plus the latest logged date
  // and a freshness flag. The DNP guard needs both:
  //   - maxDate >= gameDate: the bank's log for this player extends past
  //     the game, so an absence on that date is a real DNP.
  //   - fresh: the log was refreshed by a recent ingest (ingested_at within
  //     the last 36h), so a fresh full-season fetch with no row for a final
  //     game is also a real DNP — the player simply didn't appear.
  // Without either, the feed may not have caught up, and the pick stays
  // ungraded rather than being mislabeled.
  const logCache = new Map<string, { byDate: Map<string, Record<string, number | null>>; maxDate: string | null; fresh: boolean }>();
  const logsFor = async (sport: Sport, playerId: string): Promise<{ byDate: Map<string, Record<string, number | null>>; maxDate: string | null; fresh: boolean }> => {
    const key = `${sport}|${playerId}`;
    const cached = logCache.get(key);
    if (cached) return cached;
    const rows = await db.select().from(schema.databankGameLogs).where(and(
      eq(schema.databankGameLogs.sport, sport),
      eq(schema.databankGameLogs.playerId, playerId),
    ));
    const byDate = new Map<string, Record<string, number | null>>();
    let maxDate: string | null = null;
    let fresh = false;
    const freshCutoff = Date.now() - 36 * 3600 * 1000;
    for (const r of rows) {
      try {
        byDate.set(r.gameDate, JSON.parse(r.statsJson) as Record<string, number | null>);
      } catch { /* a corrupt row is skipped, never fatal */ }
      if (maxDate === null || r.gameDate > maxDate) maxDate = r.gameDate;
      if (r.ingestedAt && r.ingestedAt.getTime() >= freshCutoff) fresh = true;
    }
    const entry = { byDate, maxDate, fresh };
    logCache.set(key, entry);
    return entry;
  };

  for (const { pick } of ungraded) {
    const games = await finalsFor(pick.sport, pick.gameDate);
    if (games === null) {
      skipped += 1;
      errors.push(`${pick.sport} ${pick.gameDate}: scoreboard unreadable — pick left ungraded`);
      continue;
    }
    const game = findGame(games, pick.team, pick.opponent);
    if (!game) { skipped += 1; continue; } // Not final yet (or not on that slate).

    let outcome: "hit" | "miss" | "dnp" | "void";
    let actual: string | null = null;
    if (pick.pickKind === "winner") {
      if (game.homeScore === null || game.awayScore === null) { outcome = "void"; }
      else {
        const winner = game.homeScore > game.awayScore ? game.home : game.awayScore > game.homeScore ? game.away : null;
        outcome = winner === null ? "void" : pick.team === winner ? "hit" : "miss";
      }
      actual = game.awayScore !== null && game.homeScore !== null ? `${game.awayScore}-${game.homeScore}` : null;
    } else if (pick.pickKind === "total") {
      if (game.homeScore === null || game.awayScore === null || pick.line === null) {
        outcome = "void";
      } else {
        const total = game.homeScore + game.awayScore;
        actual = String(total);
        if (pick.market === "total_over") outcome = total > pick.line ? "hit" : "miss";
        else if (pick.market === "total_under") outcome = total < pick.line ? "hit" : "miss";
        else outcome = "void";
      }
    } else {
      // Prop: the player's banked game log decides it.
      if (!pick.playerId) { outcome = "void"; }
      else {
        const logs = await logsFor(pick.sport, pick.playerId);
        const stats = logs.byDate.get(pick.gameDate);
        if (!stats) {
          // No row for a final game. Only a DNP when the absence is real:
          // the bank's log for this player extends past the game date, or
          // the log was refreshed by a recent ingest. Otherwise the feed
          // may simply not have caught up, and the pick stays ungraded.
          if ((logs.maxDate !== null && logs.maxDate >= pick.gameDate) || logs.fresh) outcome = "dnp";
          else { skipped += 1; continue; }
        } else {
          const res = evaluateProp(pick.market, pick.line, stats);
          outcome = res.outcome;
          actual = res.actual;
        }
      }
    }
    await db.insert(schema.databankGrades).values({
      pickId: pick.id, outcome, actualValue: actual, gradedAt: new Date(),
    }).onConflictDoNothing().run();
    graded += 1;
    if (outcome === "hit") hits += 1;
    else if (outcome === "miss") misses += 1;
    else if (outcome === "dnp") dnps += 1;
  }
  return { graded, hits, misses, dnps, skipped, errors };
}

// Blowout-script shading. A favorite of -10 or more runs out the clock:
// pass attempts and kicker field goals dry up, so the stated probability
// for those markets is shaded down by 0.85. Returns the effective
// probability plus the note that records the original.
export function applyGameScriptShade(statedProbability: number, market: string, spread: number | null): {
  shaded: number;
  applied: boolean;
  note: string | null;
} {
  const shadedMarkets = new Set(["attempts_over", "fg_over"]);
  if (spread === null || spread > -10 || !shadedMarkets.has(market)) {
    return { shaded: statedProbability, applied: false, note: null };
  }
  const shaded = Math.round(statedProbability * 0.85 * 1000) / 1000;
  return {
    shaded,
    applied: true,
    note: `Blowout script: team -${Math.abs(spread)} favorite — stated ${statedProbability}, shaded to ${shaded} (attempts/FG props dry up when the favorite runs out the clock).`,
  };
}

export async function recomputeRates(db: Ctx["db"]): Promise<{ recomputed: number }> {
  const rows = await db.select({
    sport: schema.databankPicks.sport,
    playerName: schema.databankPicks.playerName,
    playerId: schema.databankPicks.playerId,
    market: schema.databankPicks.market,
    line: schema.databankPicks.line,
    outcome: schema.databankGrades.outcome,
    gameDate: schema.databankPicks.gameDate,
  })
    .from(schema.databankPicks)
    .innerJoin(schema.databankGrades, eq(schema.databankGrades.pickId, schema.databankPicks.id))
    .where(and(
      eq(schema.databankPicks.pickKind, "prop"),
      isNotNull(schema.databankPicks.playerId),
    ));
  // Group by (sport, playerId, market, line) in code — the line can be null
  // (anytime_td / anytime_goal), and SQLite treats NULLs as distinct in
  // unique indexes, so grouping in SQL would split those groups.
  interface RateGroup {
    sport: Sport;
    playerName: string | null;
    playerId: string;
    market: string;
    line: number | null;
    outcomes: Array<{ outcome: string; gameDate: string }>;
  }
  const groups = new Map<string, RateGroup>();
  for (const r of rows) {
    const key = `${r.sport}|${r.playerId}|${r.market}|${r.line === null ? "null" : r.line}`;
    const g = groups.get(key) ?? {
      sport: r.sport, playerName: r.playerName, playerId: r.playerId ?? "",
      market: r.market, line: r.line, outcomes: [] as Array<{ outcome: string; gameDate: string }>,
    };
    g.outcomes.push({ outcome: r.outcome, gameDate: r.gameDate });
    groups.set(key, g);
  }
  let recomputed = 0;
  for (const g of groups.values()) {
    const decided = g.outcomes.filter((o) => o.outcome === "hit" || o.outcome === "miss");
    // No decided picks yet (only DNP/void so far) — no rate to quote.
    if (decided.length === 0) continue;
    const hits = decided.filter((o) => o.outcome === "hit").length;
    const games = decided.length;
    const rate = games > 0 ? Math.round((hits / games) * 1000) / 1000 : 0;
    const lastGameDate = g.outcomes.reduce((max, o) => (o.gameDate > max ? o.gameDate : max), "");
    // Volume behind the rate, from the banked logs of the decided games.
    const volume: Record<string, number | boolean> = {};
    const dates = [...new Set(decided.map((o) => o.gameDate))];
    if (dates.length > 0) {
      const logs = await db.select().from(schema.databankGameLogs).where(and(
        eq(schema.databankGameLogs.sport, g.sport),
        eq(schema.databankGameLogs.playerId, g.playerId),
        sql`${schema.databankGameLogs.gameDate} IN (${sql.join(dates.map((d) => sql`${d}`), sql`, `)})`,
      ));
      const targets: number[] = [];
      const shots: number[] = [];
      for (const log of logs) {
        try {
          const stats = JSON.parse(log.statsJson) as Record<string, number | null>;
          if (typeof stats.targets === "number") targets.push(stats.targets);
          if (typeof stats.shots === "number") shots.push(stats.shots);
        } catch { /* skip corrupt rows */ }
      }
      if (targets.length > 0) {
        const avg = Math.round((targets.reduce((a, b) => a + b, 0) / targets.length) * 10) / 10;
        volume.targetsPerGame = avg;
        if (avg < 3) volume.thinVolume = true;
      }
      if (shots.length > 0) {
        const avg = Math.round((shots.reduce((a, b) => a + b, 0) / shots.length) * 10) / 10;
        volume.shotsPerGame = avg;
        if (avg < 2) volume.thinVolume = true;
      }
    }
    const volumeJson = Object.keys(volume).length > 0 ? JSON.stringify(volume) : null;
    const now = new Date();
    // Null-safe identity match: `IS` compares NULLs as equal, `=` does not.
    const existing = await db.select({ id: schema.databankRates.id }).from(schema.databankRates).where(sql`
      ${schema.databankRates.sport} = ${g.sport}
      AND ${schema.databankRates.playerId} = ${g.playerId}
      AND ${schema.databankRates.market} = ${g.market}
      AND ${schema.databankRates.line} IS ${g.line}
    `).limit(1);
    if (existing[0]) {
      await db.update(schema.databankRates).set({
        playerName: g.playerName ?? "", hits, games, rate, volumeJson,
        lastGameDate: lastGameDate || null, updatedAt: now,
      }).where(eq(schema.databankRates.id, existing[0].id));
    } else {
      await db.insert(schema.databankRates).values({
        sport: g.sport, playerName: g.playerName ?? "", playerId: g.playerId,
        market: g.market, line: g.line, hits, games, rate, volumeJson,
        lastGameDate: lastGameDate || null, updatedAt: now,
      });
    }
    recomputed += 1;
  }
  return { recomputed };
}
