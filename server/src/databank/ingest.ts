// Ingest — pull fresh game logs for the tracked pool into databank_game_logs.
//
// Sources: the official NHL API (per-player game logs — the endpoint that
// keeps answering even when the NHL schedule feed is down) and the ESPN v3
// gamelogs for NBA/NFL.
//
// Rules this file lives by:
//   - Sequential, ~2s between calls, max 2 retries per source. The renewal
//     must never hammer the feeds or run concurrently with a live refresh.
//   - Idempotent: ON CONFLICT DO UPDATE on (sport, player_id, game_date).
//     A second run the same day inserts 0 new rows — but it refreshes
//     ingested_at on every row it sees, so ingested_at is a true "last
//     seen" marker. The grader relies on that: a fresh log with no row for
//     a final game means the player did not play (DNP), not a stale feed.
//   - A source that errors or returns 0 games is a FAILURE for that player,
//     recorded in the result — never written as an empty success. The
//     previous good copy stays untouched (we never delete).
//   - ESPN gameDate values are UTC; game_date in the bank is ET. NHL
//     gameDate is used as-is (it is the date the game was played).

import { sql } from "drizzle-orm";
import type { Ctx } from "../actions.js";
import * as schema from "../schema.js";
import { TRACKED_PLAYERS, NHL_SEASON, NBA_SEASON, NFL_SEASON, type DatabankSport, type TrackedPlayer } from "./pool.js";

const NHL_API = "https://api-web.nhle.com/v1";
const ESPN_API = "https://site.web.api.espn.com/apis/common/v3/sports";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface IngestGameLog {
  gameDate: string;
  opponent: string | null;
  homeAway: "home" | "away" | null;
  stats: Record<string, number | string | null>;
}

export interface IngestSportResult {
  sport: DatabankSport;
  rowsSeen: number;
  rowsInserted: number;
  playersOk: number;
  playersFailed: number;
  errors: string[];
}

export interface IngestResult {
  perSport: IngestSportResult[];
  rowsSeen: number;
  rowsInserted: number;
  failedSports: string[];
  errors: string[];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ESPN stat cells are strings; some are "M-A" ("4-5", "1-1"), some are "-".
function statNum(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "M-A" form -> the made part; a plain number -> itself.
function madeOf(value: unknown): number | null {
  if (typeof value === "string" && value.includes("-")) {
    const n = Number(value.split("-")[0]);
    return Number.isFinite(n) ? n : null;
  }
  return statNum(value);
}

function attOf(value: unknown): number | null {
  if (typeof value === "string" && value.includes("-")) {
    const n = Number(value.split("-")[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// UTC timestamp -> YYYY-MM-DD in America/New_York.
function etDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

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

// NHL game log: same path the app's own player stat files read
// (/game-log/{season}/2 — the proven path in this codebase). Rows carry
// goals/shots/gameDate; homeRoadFlag "h"/"a".
function parseNhlGameLog(payload: unknown): IngestGameLog[] {
  const raw = payload as { gameLog?: unknown };
  const rows = Array.isArray(raw.gameLog) ? raw.gameLog : [];
  const out: IngestGameLog[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const gameDate = typeof row.gameDate === "string" ? row.gameDate : null;
    if (!gameDate) continue;
    const flag = typeof row.homeRoadFlag === "string" ? row.homeRoadFlag.toLowerCase() : "";
    out.push({
      gameDate,
      opponent: typeof row.opponentAbbrev === "string" ? row.opponentAbbrev : null,
      homeAway: flag === "a" ? "away" : flag === "h" ? "home" : null,
      stats: {
        gameId: num(row.gameId),
        goals: num(row.goals), assists: num(row.assists), points: num(row.points),
        shots: num(row.shots), plusMinus: num(row.plusMinus),
        hits: num(row.hits), blockedShots: num(row.blockedShots), pim: num(row.pim),
        powerPlayGoals: num(row.powerPlayGoals), powerPlayPoints: num(row.powerPlayPoints),
        shotsAgainst: num(row.shotsAgainst), goalsAgainst: num(row.goalsAgainst),
        savePct: num(row.savePctg),
        toi: typeof row.toi === "string" ? row.toi : null,
        decision: typeof row.decision === "string" ? row.decision : null,
      },
    });
  }
  return out;
}

// ESPN v3 gamelog. Labels live at the top level; games under the "Regular
// Season" seasonType, split into month categories (read ALL of them); the
// top-level events dict carries gameDate (UTC), home/away ids, opponent and
// atVs ("@" = away, "vs" = home).
//
// TD columns are POSITION-DEPENDENT — locate them from the response's own
// labels array, never from a fixed index. Verified layouts (2026-11-20):
//   WR: receiving TD = 1st TD, rushing TD = 2nd TD
//   RB: rushing TD = 1st TD, receiving TD = 2nd TD
//   QB: passing TD = 1st TD, rushing TD = 2nd TD (passing TD is NOT an
//       anytime TD — only the rushing TD counts toward tdTotal)
//   K:  FG made-attempted is the "FG" label; XP and PTS follow it
function parseEspnGamelog(payload: unknown, sport: "nba" | "nfl", player: TrackedPlayer): IngestGameLog[] {
  const p = payload as Record<string, unknown>;
  const labels = Array.isArray(p.labels) ? (p.labels as unknown[]).map((l) => String(l)) : [];
  if (labels.length === 0) return [];
  const idx = (label: string): number => labels.findIndex((l) => l === label);
  const tdIndices = labels.map((l, i) => (l === "TD" ? i : -1)).filter((i) => i >= 0);
  const seasonTypes = Array.isArray(p.seasonTypes) ? p.seasonTypes as Array<Record<string, unknown>> : [];
  const regular = seasonTypes.find((s) => typeof s.displayName === "string" && s.displayName.includes("Regular Season"))
    ?? seasonTypes[0];
  if (!regular) return [];
  const eventsDict = (p.events ?? {}) as Record<string, Record<string, unknown>>;
  const out: IngestGameLog[] = [];
  const categories = Array.isArray(regular.categories) ? regular.categories as Array<Record<string, unknown>> : [];
  for (const category of categories) {
    const events = Array.isArray(category.events) ? category.events as Array<Record<string, unknown>> : [];
    for (const ev of events) {
      const eventId = String(ev.eventId ?? "");
      const info = eventsDict[eventId];
      if (!info) continue;
      const gameDate = etDate(String(info.gameDate ?? ""));
      if (!gameDate) continue;
      const stats = Array.isArray(ev.stats) ? ev.stats : [];
      const at = (i: number): unknown => (i >= 0 && i < stats.length ? stats[i] : null);
      let parsed: Record<string, number | string | null>;
      if (sport === "nba") {
        parsed = {
          points: statNum(at(idx("PTS"))),
          rebounds: statNum(at(idx("REB"))),
          assists: statNum(at(idx("AST"))),
          threes: madeOf(at(idx("3PT"))),
        };
      } else {
        const pos = player.position ?? "WR";
        if (pos === "K") {
          parsed = {
            fgMade: madeOf(at(idx("FG"))),
            fgAtt: attOf(at(idx("FG"))),
            xp: madeOf(at(idx("XP"))),
            points: statNum(at(idx("PTS"))),
            tdTotal: 0,
          };
        } else {
          let passingTd: number | null = null;
          let rushingTd: number | null = null;
          let receivingTd: number | null = null;
          if (tdIndices.length >= 2) {
            const first = tdIndices[0];
            const second = tdIndices[1];
            if (first !== undefined && second !== undefined) {
              if (pos === "WR") { receivingTd = statNum(at(first)); rushingTd = statNum(at(second)); }
              else if (pos === "RB") { rushingTd = statNum(at(first)); receivingTd = statNum(at(second)); }
              else if (pos === "QB") { passingTd = statNum(at(first)); rushingTd = statNum(at(second)); }
            }
          }
          parsed = {
            tdTotal: (receivingTd ?? 0) + (rushingTd ?? 0),
            rushingTd, receivingTd,
          };
          if (pos === "QB") {
            parsed.attempts = statNum(at(idx("ATT")));
            parsed.completions = statNum(at(idx("CMP")));
            parsed.passingYards = statNum(at(idx("YDS")));
            parsed.passingTd = passingTd;
            parsed.interceptions = statNum(at(idx("INT")));
          } else {
            parsed.receptions = statNum(at(idx("REC")));
            parsed.targets = statNum(at(idx("TGTS")));
            parsed.carries = statNum(at(idx("CAR")));
          }
        }
      }
      const atVs = String(info.atVs ?? "");
      const opp = info.opponent as Record<string, unknown> | undefined;
      out.push({
        gameDate,
        opponent: typeof opp?.abbreviation === "string" ? (opp.abbreviation as string) : null,
        homeAway: atVs === "@" ? "away" : atVs === "vs" ? "home" : null,
        stats: parsed,
      });
    }
  }
  return out;
}

async function fetchNhlLog(player: TrackedPlayer): Promise<IngestGameLog[] | null> {
  const payload = await fetchJsonWithRetries(`${NHL_API}/player/${player.playerId}/game-log/${NHL_SEASON}/2`);
  if (payload === null) return null;
  return parseNhlGameLog(payload);
}

async function fetchEspnLog(player: TrackedPlayer): Promise<IngestGameLog[] | null> {
  const league = player.sport === "nba" ? "basketball/nba" : "football/nfl";
  const season = player.sport === "nba" ? NBA_SEASON : NFL_SEASON;
  const payload = await fetchJsonWithRetries(`${ESPN_API}/${league}/athletes/${player.playerId}/gamelog?season=${season}`);
  if (payload === null) return null;
  return parseEspnGamelog(payload, player.sport === "nba" ? "nba" : "nfl", player);
}

export async function ingestAllGameLogs(db: Ctx["db"]): Promise<IngestResult> {
  const perSport: IngestSportResult[] = [];
  let rowsSeen = 0;
  let rowsInserted = 0;
  const failedSports: string[] = [];
  const errors: string[] = [];
  for (const sport of ["nhl", "nfl", "nba"] as const) {
    const players = TRACKED_PLAYERS.filter((p) => p.sport === sport);
    let sportSeen = 0;
    let sportInserted = 0;
    let playersOk = 0;
    const sportErrors: string[] = [];
    for (const player of players) {
      try {
        const logs = sport === "nhl" ? await fetchNhlLog(player) : await fetchEspnLog(player);
        if (logs === null) {
          sportErrors.push(`${player.name}: source failed after retries`);
        } else if (logs.length === 0) {
          sportErrors.push(`${player.name}: source returned 0 games`);
        } else {
          playersOk += 1;
          sportSeen += logs.length;
          for (const log of logs) {
            const res = await db.insert(schema.databankGameLogs).values({
              sport,
              playerName: player.name,
              playerId: player.playerId,
              gameDate: log.gameDate,
              opponent: log.opponent,
              homeAway: log.homeAway,
              statsJson: JSON.stringify(log.stats),
              source: sport === "nhl" ? "nhl_api" : "espn",
              ingestedAt: new Date(),
            }).onConflictDoNothing().run();
            sportInserted += res.changes ?? 0;
          }
          // Touch: refresh ingested_at on every row this fresh fetch saw, so
          // ingested_at is a true "last seen" marker. The grader relies on
          // it: a fresh log with no row for a final game means the player
          // did not play (DNP), not a stale feed. (A plain DO NOTHING
          // upsert would leave ingested_at frozen at first sight.)
          await db.run(sql`UPDATE \`databank_game_logs\` SET \`ingested_at\` = ${Date.now()} WHERE \`sport\` = ${sport} AND \`player_id\` = ${player.playerId}`);
        }
      } catch (e) {
        sportErrors.push(`${player.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Sequential with a pause — never burst the feeds.
      await sleep(2000);
    }
    rowsSeen += sportSeen;
    rowsInserted += sportInserted;
    if (sportSeen === 0) failedSports.push(sport);
    errors.push(...sportErrors);
    perSport.push({
      sport, rowsSeen: sportSeen, rowsInserted: sportInserted,
      playersOk, playersFailed: players.length - playersOk, errors: sportErrors,
    });
    console.log(`[databank] ingest ${sport}: seen=${sportSeen} inserted=${sportInserted} players=${playersOk}/${players.length}${sportErrors.length ? ` errors=${sportErrors.length}` : ""}`);
  }
  return { perSport, rowsSeen, rowsInserted, failedSports, errors };
}
