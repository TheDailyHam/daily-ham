import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// Admin gate: key management and manual sportsbook refreshes require the
// ADMIN_TOKEN environment variable. This keeps public visitors from
// replacing/removing the owner's provider keys or burning provider quota.
// Fail closed: with no ADMIN_TOKEN set, the gated actions refuse to run.
const adminTokenSchema = z.string().optional();
function requireAdmin(args: { adminToken?: string }): void {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) throw new Error("Admin access is not configured on this server.");
  const provided = Buffer.from(args.adminToken ?? "");
  const want = Buffer.from(expected);
  if (provided.length !== want.length || !timingSafeEqual(provided, want)) {
    throw new Error("Admin access required.");
  }
}

// Standalone context: plain object holding the drizzle better-sqlite3 instance.
// (Replaces the Muse platform Ctx; ctx.db becomes ctx.db,
// ctx.executePrivileged() becomes direct provider.* calls, and
// ctx.invalidateQueries() is dropped — the React client invalidates its own
// queries via @tanstack/react-query.)
export type Ctx = { db: BetterSQLite3Database<typeof schema> };

function defineAction<Req extends z.ZodTypeAny, Res extends z.ZodTypeAny>(opts: {
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>>;
}) {
  return opts;
}
import { fetchSportsGameOddsEvents, validateSportsGameOddsKey } from "./provider.js";
import { fetchOddsApiEvents, fetchOddsApiSoccerEvents, parseOddsApiPayload, validateOddsApiKey } from "./oddsapi.js";
import {
  NFL_SEASON, NFL_TEAM_CODES, enrichFirstScores, fetchNflGameSummary, fetchNflRoster,
  fetchNflScoreboard, fetchNflStandings, fetchNflTeamGames, nflDivision, nflTeamMeta,
  type NflGame, type NflTeamGame,
} from "./nfl.js";
import {
  NBA_SEASON, NBA_TEAM_CODES, enrichNbaGameDetails, fetchNbaGameSummary, fetchNbaRoster,
  fetchNbaScoreboard, fetchNbaStandings, fetchNbaTeamGames, nbaTeamMeta,
  type NbaTeamGame,
} from "./nba.js";
import {
  SOCCER_SEASON, fetchSoccerGameSummary, fetchSoccerRoster,
  fetchSoccerScoreboard, fetchSoccerTeamGames, fetchSoccerTeamLeaders, fetchSoccerTeamRecord,
  regressedRate, soccerLeagueLabel, soccerMatchProbabilities, soccerSportsGameOddsLeague,
  soccerTeamMeta, soccerTeams,
  type SoccerGame, type SoccerStanding, type SoccerTeamGame,
} from "./soccer.js";
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import * as schema from "./schema.js";

const sports = ["nhl", "nfl", "nba", "soccer"] as const;
type Sport = (typeof sports)[number];
// Soccer leagues bundled under the "soccer" sport (verified 2026-10-11).
const soccerLeagues = ["mls", "epl"] as const;
type SoccerLeagueParam = (typeof soccerLeagues)[number];
const teamCodes = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"] as const;
// ESPN NFL abbreviations (verified 2026-10-08). Note BUF/DAL/PIT collide
// with NHL codes — the two sports never share a schema or action.
const nflTeamCodes = ["ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH"] as const;
// ESPN NBA abbreviations (verified 2026-10-11). Note NY/UTAH and several
// codes that collide with NHL/NFL (ATL, BOS, CHI, DAL, DET, MIA, MIL, MIN,
// PHI, WSH) — the three sports never share a schema or action.
const nbaTeamCodes = ["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS", "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NO", "NY", "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH"] as const;
const SOURCE_URL = "https://api.flashodds.live/api/v1/sample";
const DOCS_URL = "https://api.flashodds.live/docs";
const NHL_API = "https://api-web.nhle.com/v1";
const NHL_SEASON = "20262027";

type FlashRow = { player?: unknown; stat?: unknown; market?: unknown; line?: unknown; overOdds?: unknown; underOdds?: unknown; eventId?: unknown; game?: unknown; startTime?: unknown };
type FlashResponse = { fetchedAt?: unknown; totalAvailable?: unknown; rows?: unknown; note?: unknown };
type Localized = { default?: unknown };
type RosterPlayer = { id?: unknown; firstName?: unknown; lastName?: unknown; sweaterNumber?: unknown; positionCode?: unknown; shootsCatches?: unknown; heightInInches?: unknown; weightInPounds?: unknown };
type RosterPayload = { forwards?: unknown; defensemen?: unknown; goalies?: unknown };
type StatPlayer = { playerId?: unknown; gamesPlayed?: unknown; goals?: unknown; assists?: unknown; points?: unknown; shots?: unknown; avgTimeOnIcePerGame?: unknown; savePercentage?: unknown; goalsAgainstAverage?: unknown; wins?: unknown; losses?: unknown; shotsAgainst?: unknown; saves?: unknown };
type StatsPayload = { skaters?: unknown; goalies?: unknown };
type GameLogRow = { gameId?: unknown; gameDate?: unknown; teamAbbrev?: unknown; opponentAbbrev?: unknown; homeRoadFlag?: unknown; goals?: unknown; assists?: unknown; points?: unknown; plusMinus?: unknown; powerPlayGoals?: unknown; powerPlayPoints?: unknown; shorthandedGoals?: unknown; shorthandedPoints?: unknown; gameWinningGoals?: unknown; shots?: unknown; hits?: unknown; blockedShots?: unknown; shifts?: unknown; pim?: unknown; toi?: unknown; gamesStarted?: unknown; decision?: unknown; shotsAgainst?: unknown; goalsAgainst?: unknown; savePctg?: unknown; shutouts?: unknown };
type GameLogPayload = { gameLog?: unknown };
type ClubSchedulePayload = { games?: unknown };
type PremiumOdd = { oddID?: unknown; marketName?: unknown; statID?: unknown; statEntityID?: unknown; playerID?: unknown; periodID?: unknown; betTypeID?: unknown; sideID?: unknown; fairOdds?: unknown; bookOdds?: unknown; fairOverUnder?: unknown; bookOverUnder?: unknown; fairSpread?: unknown; bookSpread?: unknown; byBookmaker?: unknown };
type PremiumEvent = { eventID?: unknown; startTime?: unknown; startsAt?: unknown; status?: unknown; teams?: unknown; players?: unknown; odds?: unknown };
type PremiumPayload = { data?: unknown; items?: unknown; nextCursor?: unknown };

function nyDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function americanProbability(odds: number): number { return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100); }
function normalizedLean(overOdds: number | null, underOdds: number | null) {
  if (overOdds === null || underOdds === null) return { lean: "over" as const, probability: null };
  const over = americanProbability(overOdds); const under = americanProbability(underOdds); const total = over + under; const value = total > 0 ? over / total : 0.5;
  return value >= 0.5 ? { lean: "over" as const, probability: value } : { lean: "under" as const, probability: 1 - value };
}
function num(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function localized(value: unknown): string {
  if (value && typeof value === "object" && "default" in value) {
    const text = (value as Localized).default;
    return typeof text === "string" ? text : "";
  }
  return "";
}

async function refresh(ctx: Ctx) {
  const db = ctx.db;
  const startedAt = new Date();
  const runRows = await db.insert(schema.refreshRuns).values({ startedAt, status: "running", message: "Refreshing boards", rowCount: 0 }).returning({ id: schema.refreshRuns.id });
  const runId = runRows[0]?.id;
  if (!runId) throw new Error("Refresh could not start");
  const snapshotDate = nyDate(startedAt);
  const sourceNotes: string[] = [];
  let insertedCount = 0; let failures = 0;

  for (const sport of sports) {
    // The Flash Props sample feed carries no soccer markets; the soccer
    // board is built from the sportsbook odds providers instead.
    if (sport === "soccer") { sourceNotes.push("SOCCER: via sportsbook odds providers"); continue; }
    try {
      const response = await fetch(`${SOURCE_URL}?sport=${sport}`, { headers: { Accept: "application/json" } });
      if (!response.ok) { failures += 1; sourceNotes.push(`${sport.toUpperCase()}: source returned ${response.status}`); continue; }
      const payload = (await response.json()) as FlashResponse;
      const rawRows = Array.isArray(payload.rows) ? payload.rows as FlashRow[] : [];
      const fetchedAt = typeof payload.fetchedAt === "number" ? new Date(payload.fetchedAt) : new Date();
      const validRows = rawRows.flatMap((row) => {
        if (typeof row.player !== "string" || typeof row.stat !== "string" || typeof row.market !== "string" || typeof row.line !== "number" || typeof row.eventId !== "string" || typeof row.game !== "string" || typeof row.startTime !== "string") return [];
        const startsAt = new Date(row.startTime); if (Number.isNaN(startsAt.getTime())) return [];
        const overOdds = typeof row.overOdds === "number" ? row.overOdds : null;
        const underOdds = typeof row.underOdds === "number" ? row.underOdds : null;
        const lean = normalizedLean(overOdds, underOdds);
        return [{ sport, player: row.player, market: row.market, statKey: row.stat, line: row.line, projectionValue: null, overOdds, underOdds, lean: lean.lean, leanProbability: lean.probability, edgeText: null, rationale: "Two-way market prices normalized to remove the sportsbook margin.", eventId: row.eventId, game: row.game, startsAt, sourceName: "Flash Props", sourceUrl: SOURCE_URL, sourceKind: "market" as const, fetchedAt, snapshotDate }];
      });
      await db.delete(schema.projections).where(and(eq(schema.projections.sport, sport), eq(schema.projections.snapshotDate, snapshotDate)));
      if (validRows.length > 0) { await db.insert(schema.projections).values(validRows); insertedCount += validRows.length; }
      const total = typeof payload.totalAvailable === "number" ? payload.totalAvailable : 0;
      sourceNotes.push(validRows.length > 0 ? `${sport.toUpperCase()}: ${validRows.length} shown of ${total} source markets` : `${sport.toUpperCase()}: no board posted`);
    } catch { failures += 1; sourceNotes.push(`${sport.toUpperCase()}: refresh delayed`); }
  }
  const status: "success" | "partial" | "failed" = failures === 0 ? "success" : failures < sports.length ? "partial" : "failed";
  const message = sourceNotes.join(" · ");
  await db.update(schema.refreshRuns).set({ completedAt: new Date(), status, message, rowCount: insertedCount }).where(eq(schema.refreshRuns.id, runId));
  if (insertedCount > 0) { const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 45); await db.delete(schema.projections).where(lt(schema.projections.fetchedAt, cutoff)); }
  return { status, message, rowCount: insertedCount, snapshotDate };
}

const projectionSchema = z.object({ id: z.number(), sport: z.enum(sports), player: z.string(), market: z.string(), statKey: z.string(), line: z.number(), projectionValue: z.number().nullable(), overOdds: z.number().nullable(), underOdds: z.number().nullable(), lean: z.enum(["over", "under"]), leanProbability: z.number().nullable(), edgeText: z.string().nullable(), rationale: z.string().nullable(), game: z.string(), startsAt: z.string(), sourceName: z.string(), sourceUrl: z.string(), sourceKind: z.enum(["market", "analyst"]), fetchedAt: z.string() });
const dashboardResponse = z.object({ sport: z.enum(sports), snapshotDate: z.string().nullable(), projections: z.array(projectionSchema), history: z.array(z.object({ snapshotDate: z.string(), probability: z.number() })), refresh: z.object({ status: z.string(), message: z.string(), completedAt: z.string().nullable() }).nullable(), source: z.object({ name: z.string(), docsUrl: z.string(), limitation: z.string() }) });

const rosterPlayerSchema = z.object({ id: z.number(), name: z.string(), number: z.number().nullable(), position: z.string(), shoots: z.string().nullable(), height: z.number().nullable(), weight: z.number().nullable(), games: z.number().nullable(), goals: z.number().nullable(), assists: z.number().nullable(), points: z.number().nullable(), shots: z.number().nullable(), toiSeconds: z.number().nullable(), savePct: z.number().nullable(), gaa: z.number().nullable(), wins: z.number().nullable(), losses: z.number().nullable(), shotsAgainst: z.number().nullable(), saves: z.number().nullable() });
const rosterResponse = z.object({ team: z.enum(teamCodes), season: z.string(), fetchedAt: z.string(), sourceUrl: z.string(), players: z.array(rosterPlayerSchema), groups: z.object({ forwards: z.number(), defensemen: z.number(), goalies: z.number() }) });
const gameLogRowSchema = z.object({
  gameId: z.number(), gameDate: z.string(), opponent: z.string(), homeRoad: z.enum(["home", "away"]),
  goals: z.number().nullable(), assists: z.number().nullable(), points: z.number().nullable(), plusMinus: z.number().nullable(),
  powerPlayGoals: z.number().nullable(), powerPlayPoints: z.number().nullable(), shorthandedGoals: z.number().nullable(), shorthandedPoints: z.number().nullable(),
  gameWinningGoals: z.number().nullable(), shots: z.number().nullable(), hits: z.number().nullable(), blockedShots: z.number().nullable(), shifts: z.number().nullable(), pim: z.number().nullable(), toi: z.string().nullable(),
  started: z.boolean().nullable(), decision: z.string().nullable(), shotsAgainst: z.number().nullable(), goalsAgainst: z.number().nullable(), savePct: z.number().nullable(), shutouts: z.number().nullable(),
});
const gameLogResponse = z.object({ playerId: z.number(), season: z.string(), fetchedAt: z.string(), sourceUrl: z.string(), games: z.array(gameLogRowSchema) });

async function loadDashboard(ctx: Ctx, sport: Sport): Promise<z.infer<typeof dashboardResponse>> {
  const db = ctx.db;
  let latest = await db.select().from(schema.projections).where(eq(schema.projections.sport, sport)).orderBy(desc(schema.projections.fetchedAt)).limit(1);
  const newest = latest[0];
  if (!newest || Date.now() - newest.fetchedAt.getTime() > 24 * 60 * 60 * 1000) {
    await refresh(ctx);
    latest = await db.select().from(schema.projections).where(eq(schema.projections.sport, sport)).orderBy(desc(schema.projections.fetchedAt)).limit(1);
  }
  const snapshotDate = latest[0]?.snapshotDate ?? null;
  const rows = snapshotDate ? await db.select().from(schema.projections).where(and(eq(schema.projections.sport, sport), eq(schema.projections.snapshotDate, snapshotDate))).orderBy(desc(schema.projections.leanProbability), schema.projections.player) : [];
  const lead = rows[0];
  const history = lead ? await db.select({ snapshotDate: schema.projections.snapshotDate, probability: schema.projections.leanProbability }).from(schema.projections).where(and(eq(schema.projections.sport, sport), eq(schema.projections.player, lead.player), eq(schema.projections.statKey, lead.statKey), gte(schema.projections.fetchedAt, new Date(Date.now() - 45 * 86400000)))).orderBy(schema.projections.fetchedAt) : [];
  const lastRun = await db.select().from(schema.refreshRuns).orderBy(desc(schema.refreshRuns.id)).limit(1); const run = lastRun[0];
  return { sport, snapshotDate, projections: rows.map((row) => ({ id: row.id, sport: row.sport, player: row.player, market: row.market, statKey: row.statKey, line: row.line, projectionValue: row.projectionValue, overOdds: row.overOdds, underOdds: row.underOdds, lean: row.lean, leanProbability: row.leanProbability, edgeText: row.edgeText, rationale: row.rationale, game: row.game, startsAt: row.startsAt.toISOString(), sourceName: row.sourceName, sourceUrl: row.sourceUrl, sourceKind: row.sourceKind, fetchedAt: row.fetchedAt.toISOString() })), history: history.flatMap((point) => point.probability === null ? [] : [{ snapshotDate: point.snapshotDate, probability: point.probability }]), refresh: run ? { status: run.status, message: run.message, completedAt: run.completedAt?.toISOString() ?? null } : null, source: { name: "Flash Props", docsUrl: DOCS_URL, limitation: "The public feed exposes only a small live sample. Full sportsbook depth needs a licensed feed; roster and season stats below come directly from NHL data." } };
}

async function loadRoster(team: (typeof teamCodes)[number]): Promise<z.infer<typeof rosterResponse>> {
  const rosterResponseRaw = await fetch(`${NHL_API}/roster/${team}/current`, { headers: { Accept: "application/json" } });
  if (!rosterResponseRaw.ok) throw new Error("Official NHL roster is temporarily unavailable");
  const statsResponseRaw = await fetch(`${NHL_API}/club-stats/${team}/${NHL_SEASON}/2`, { headers: { Accept: "application/json" } });
  const roster = await rosterResponseRaw.json() as RosterPayload;
  const stats = statsResponseRaw.ok ? await statsResponseRaw.json() as StatsPayload : {};
  const forwards = Array.isArray(roster.forwards) ? roster.forwards as RosterPlayer[] : [];
  const defensemen = Array.isArray(roster.defensemen) ? roster.defensemen as RosterPlayer[] : [];
  const goalies = Array.isArray(roster.goalies) ? roster.goalies as RosterPlayer[] : [];
  const skaterStats = Array.isArray(stats.skaters) ? stats.skaters as StatPlayer[] : [];
  const goalieStats = Array.isArray(stats.goalies) ? stats.goalies as StatPlayer[] : [];
  const statsById = new Map<number, StatPlayer>();
  for (const row of [...skaterStats, ...goalieStats]) { const id = num(row.playerId); if (id !== null) statsById.set(id, row); }
  const players = [...forwards, ...defensemen, ...goalies].flatMap((player) => {
    const id = num(player.id); if (id === null) return [];
    const stat = statsById.get(id);
    return [{ id, name: `${localized(player.firstName)} ${localized(player.lastName)}`.trim(), number: num(player.sweaterNumber), position: typeof player.positionCode === "string" ? player.positionCode : "—", shoots: typeof player.shootsCatches === "string" ? player.shootsCatches : null, height: num(player.heightInInches), weight: num(player.weightInPounds), games: num(stat?.gamesPlayed), goals: num(stat?.goals), assists: num(stat?.assists), points: num(stat?.points), shots: num(stat?.shots), toiSeconds: num(stat?.avgTimeOnIcePerGame), savePct: num(stat?.savePercentage), gaa: num(stat?.goalsAgainstAverage), wins: num(stat?.wins), losses: num(stat?.losses), shotsAgainst: num(stat?.shotsAgainst), saves: num(stat?.saves) }];
  });
  return { team, season: NHL_SEASON, fetchedAt: new Date().toISOString(), sourceUrl: rosterResponseRaw.url, players, groups: { forwards: forwards.length, defensemen: defensemen.length, goalies: goalies.length } };
}

async function loadNhlPlayerGameLog(playerId: number): Promise<z.infer<typeof gameLogResponse>> {
  const response = await fetch(`${NHL_API}/player/${playerId}/game-log/${NHL_SEASON}/2`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("This player's official game log is temporarily unavailable");
  const payload = await response.json() as GameLogPayload;
  const rows = Array.isArray(payload.gameLog) ? payload.gameLog as GameLogRow[] : [];
  const games = rows.flatMap((row) => {
    const gameId = num(row.gameId);
    const gameDate = textValue(row.gameDate);
    if (gameId === null || gameDate === null) return [];
    const road = textValue(row.homeRoadFlag)?.toLowerCase();
    return [{
      gameId,
      gameDate,
      opponent: textValue(row.opponentAbbrev) ?? "—",
      homeRoad: road === "a" || road === "away" ? "away" as const : "home" as const,
      goals: num(row.goals), assists: num(row.assists), points: num(row.points), plusMinus: num(row.plusMinus),
      powerPlayGoals: num(row.powerPlayGoals), powerPlayPoints: num(row.powerPlayPoints), shorthandedGoals: num(row.shorthandedGoals), shorthandedPoints: num(row.shorthandedPoints),
      gameWinningGoals: num(row.gameWinningGoals), shots: num(row.shots), hits: num(row.hits), blockedShots: num(row.blockedShots), shifts: num(row.shifts), pim: num(row.pim), toi: textValue(row.toi),
      started: row.gamesStarted === undefined ? null : num(row.gamesStarted) === 1,
      decision: textValue(row.decision), shotsAgainst: num(row.shotsAgainst), goalsAgainst: num(row.goalsAgainst), savePct: num(row.savePctg), shutouts: num(row.shutouts),
    }];
  }).sort((a, b) => b.gameDate.localeCompare(a.gameDate));
  return { playerId, season: NHL_SEASON, fetchedAt: new Date().toISOString(), sourceUrl: response.url, games };
}

const premiumOfferSchema = z.object({
  eventId: z.string(), matchup: z.string(), startsAt: z.string().nullable(), oddId: z.string(),
  stat: z.string(), marketName: z.string(), entity: z.string(), entityType: z.enum(["player", "team", "event"]), period: z.string(), betType: z.string(), side: z.string(),
  book: z.string(), odds: z.string().nullable(), fairOdds: z.string().nullable(), line: z.string().nullable(), openingOdds: z.string().nullable(), openingLine: z.string().nullable(),
  // Which soccer league this offer belongs to ("mls" | "epl"); null for the
  // single-league sports. Lets the client split the soccer board per league.
  league: z.string().nullable().default(null),
});
const premiumResponse = z.object({ sport: z.enum(sports), fetchedAt: z.string(), eventCount: z.number(), marketCount: z.number(), offerCount: z.number(), offers: z.array(premiumOfferSchema), cacheStatus: z.enum(["fresh", "stale"]), healthMessage: z.string() });
const premiumRefreshResponse = z.object({ status: z.enum(["success", "partial", "failed"]), refreshedAt: z.string(), refreshedSports: z.number(), message: z.string() });

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function teamName(team: unknown): string {
  if (!team || typeof team !== "object") return "";
  const record = team as Record<string, unknown>;
  const names = record.names;
  if (names && typeof names === "object") {
    const named = names as Record<string, unknown>;
    return textValue(named.long) ?? textValue(named.medium) ?? textValue(named.short) ?? "";
  }
  return textValue(record.name) ?? textValue(record.teamID) ?? "";
}
function eventMatchup(event: PremiumEvent): string {
  if (!event.teams || typeof event.teams !== "object") return textValue(event.eventID) ?? "Game";
  const teams = event.teams as Record<string, unknown>;
  const away = teamName(teams.away); const home = teamName(teams.home);
  return away && home ? `${away} @ ${home}` : textValue(event.eventID) ?? "Game";
}
function eventStart(event: PremiumEvent): string | null {
  if (event.status && typeof event.status === "object") {
    const status = event.status as Record<string, unknown>;
    const start = textValue(status.startsAt);
    if (start) return start;
  }
  return textValue(event.startTime) ?? textValue(event.startsAt);
}
function eventEntity(event: PremiumEvent, odd: PremiumOdd): string {
  const entityId = textValue(odd.playerID) ?? textValue(odd.statEntityID);
  if (!entityId) return "All";
  if (event.players && typeof event.players === "object") {
    const players = event.players as Record<string, unknown>;
    const player = players[entityId];
    if (player && typeof player === "object") {
      const record = player as Record<string, unknown>;
      const name = textValue(record.name) ?? [textValue(record.firstName), textValue(record.lastName)].filter(Boolean).join(" ");
      if (name) return name;
    }
  }
  if (event.teams && typeof event.teams === "object") {
    const teams = event.teams as Record<string, unknown>;
    const team = entityId === "home" ? teamName(teams.home) : entityId === "away" ? teamName(teams.away) : "";
    if (team) return team;
  }
  return entityId.replaceAll("_", " ");
}

type OddsProviderName = "sportsgameodds" | "theoddsapi";
type OddsProvider = { name: OddsProviderName; apiKey: string };

function providerError(result: { status: number; reason: "missing" | "rejected" | "rate_limited" | "provider_error"; detail?: string | null }, provider: OddsProviderName = "sportsgameodds"): Error {
  if (result.reason === "missing") return new Error("Add a SportsGameOdds or The Odds API key in Settings to unlock Pro Odds.");
  const detail = result.detail ? ` — ${result.detail}` : "";
  if (provider === "theoddsapi") {
    if (result.reason === "rejected") return new Error("The Odds API rejected the saved key. Replace it in Settings.");
    if (result.reason === "rate_limited") return new Error("The Odds API is temporarily unavailable. Your last successful board will remain available.");
    return new Error(`The Odds API returned ${result.status}${detail}`);
  }
  if (result.reason === "rejected") return new Error("SportsGameOdds rejected the saved key. Replace it in Settings.");
  if (result.reason === "rate_limited") return new Error("The live odds provider is temporarily unavailable. Your last successful board will remain available.");
  return new Error(`SportsGameOdds returned ${result.status}`);
}

async function loadProviderKey(ctx: Ctx): Promise<string> {
  // The SPORTSGAMEODDS_KEY environment variable takes precedence over the
  // key saved through the Settings UI (provider_credentials table fallback).
  const envKey = process.env.SPORTSGAMEODDS_KEY?.trim();
  if (envKey) return envKey;
  const rows = await ctx.db.select({ secretValue: schema.providerCredentials.secretValue }).from(schema.providerCredentials).where(eq(schema.providerCredentials.provider, "sportsgameodds")).limit(1);
  const apiKey = rows[0]?.secretValue.trim();
  if (!apiKey) throw providerError({ status: 503, reason: "missing" });
  return apiKey;
}

function parsePremiumPayload(sport: Sport, raw: unknown, fetchedAt: Date): z.infer<typeof premiumResponse> {
  const payload = raw as PremiumPayload;
  const events = Array.isArray(payload.data) ? payload.data as PremiumEvent[] : Array.isArray(payload.items) ? payload.items as PremiumEvent[] : [];
  const offers: z.infer<typeof premiumOfferSchema>[] = [];
  let marketCount = 0;
  for (const event of events) {
    const eventId = textValue(event.eventID) ?? "event";
    const startsAt = eventStart(event);
    const oddsRecord = event.odds && typeof event.odds === "object" ? event.odds as Record<string, unknown> : {};
    marketCount += Object.keys(oddsRecord).length;
    for (const [oddKey, oddValue] of Object.entries(oddsRecord)) {
      if (!oddValue || typeof oddValue !== "object") continue;
      const odd = oddValue as PremiumOdd;
      const books = odd.byBookmaker && typeof odd.byBookmaker === "object" ? odd.byBookmaker as Record<string, unknown> : {};
      for (const [book, bookValue] of Object.entries(books)) {
        if (!bookValue || typeof bookValue !== "object") continue;
        const value = bookValue as Record<string, unknown>;
        if (value.available === false) continue;
        const line = textValue(value.overUnder) ?? textValue(value.spread) ?? textValue(odd.bookOverUnder) ?? textValue(odd.bookSpread);
        const openingLine = textValue(value.openOverUnder) ?? textValue(value.openingOverUnder) ?? textValue(value.openSpread) ?? textValue(value.openingSpread);
        offers.push({ eventId, matchup: eventMatchup(event), startsAt, oddId: textValue(odd.oddID) ?? oddKey, stat: textValue(odd.statID) ?? "market", marketName: textValue(odd.marketName) ?? textValue(odd.statID) ?? "Market", entity: eventEntity(event, odd), entityType: textValue(odd.playerID) ? "player" : textValue(odd.statEntityID) === "home" || textValue(odd.statEntityID) === "away" ? "team" : "event", period: textValue(odd.periodID) ?? "game", betType: textValue(odd.betTypeID) ?? "—", side: textValue(odd.sideID) ?? "—", book, odds: textValue(value.odds) ?? textValue(odd.bookOdds), fairOdds: textValue(odd.fairOdds), line, openingOdds: textValue(value.openOdds) ?? textValue(value.openingOdds), openingLine, league: null });
      }
    }
  }
  return { sport, fetchedAt: fetchedAt.toISOString(), eventCount: events.length, marketCount, offerCount: offers.length, offers, cacheStatus: "fresh", healthMessage: "Odds updated successfully" };
}

async function loadOddsProvider(ctx: Ctx): Promise<OddsProvider> {
  // The ODDS_API_KEY environment variable takes precedence, then a The Odds
  // API key saved through the Settings UI (provider_credentials table).
  // Otherwise fall back to the SportsGameOdds key (env var or saved key).
  const envKey = process.env.ODDS_API_KEY?.trim();
  if (envKey) return { name: "theoddsapi", apiKey: envKey };
  const rows = await ctx.db.select({ secretValue: schema.providerCredentials.secretValue }).from(schema.providerCredentials).where(eq(schema.providerCredentials.provider, "theoddsapi")).limit(1);
  const dbKey = rows[0]?.secretValue.trim();
  if (dbKey) return { name: "theoddsapi", apiKey: dbKey };
  const apiKey = await loadProviderKey(ctx);
  return { name: "sportsgameodds", apiKey };
}

// Soccer odds cover two leagues (MLS + EPL): one provider request per
// league per refresh (~2/day total), merged into a single "soccer" board
// with each offer tagged by league so the client can split the view.
async function fetchSoccerPremiumAndCache(provider: OddsProvider, fetchedAt: Date): Promise<z.infer<typeof premiumResponse>> {
  const offers: z.infer<typeof premiumOfferSchema>[] = [];
  let eventCount = 0;
  let marketCount = 0;
  const notes: string[] = [];
  for (const league of soccerLeagues) {
    try {
      if (provider.name === "theoddsapi") {
        const result = await fetchOddsApiSoccerEvents({ apiKey: provider.apiKey, league });
        if (!result.ok) throw providerError(result, "theoddsapi");
        const mapped = parseOddsApiPayload(result.payload.data, { marketNames: result.payload.marketNames });
        eventCount += mapped.eventCount;
        marketCount += mapped.marketCount;
        for (const o of mapped.offers) offers.push({ ...o, league });
      } else {
        const sgLeague = soccerSportsGameOddsLeague(league);
        let result = await fetchSportsGameOddsEvents({ apiKey: provider.apiKey, league: sgLeague });
        if (!result.ok && result.reason === "provider_error") result = await fetchSportsGameOddsEvents({ apiKey: provider.apiKey, league: sgLeague });
        if (!result.ok) throw providerError(result);
        const parsed = parsePremiumPayload("soccer", result.payload, fetchedAt);
        eventCount += parsed.eventCount;
        marketCount += parsed.marketCount;
        for (const o of parsed.offers) offers.push({ ...o, league });
      }
      notes.push(soccerLeagueLabel(league));
    } catch (error) {
      notes.push(`${soccerLeagueLabel(league)}: ${error instanceof Error ? error.message : "refresh failed"}`);
    }
  }
  const providerLabel = provider.name === "theoddsapi" ? "The Odds API" : "SportsGameOdds";
  return {
    sport: "soccer", fetchedAt: fetchedAt.toISOString(),
    eventCount, marketCount, offerCount: offers.length, offers,
    cacheStatus: "fresh",
    healthMessage: `Odds updated successfully (${providerLabel} · ${notes.join(" + ")})`,
  };
}

async function fetchPremiumAndCache(ctx: Ctx, sport: Sport, provider: OddsProvider): Promise<z.infer<typeof premiumResponse>> {
  const fetchedAt = new Date();
  let parsed: z.infer<typeof premiumResponse>;
  if (sport === "soccer") {
    parsed = await fetchSoccerPremiumAndCache(provider, fetchedAt);
  } else if (provider.name === "theoddsapi") {
    // One request carries every game, market and bookmaker.
    const result = await fetchOddsApiEvents({ apiKey: provider.apiKey, sport });
    if (!result.ok) throw providerError(result, "theoddsapi");
    const mapped = parseOddsApiPayload(result.payload.data, { sport, marketNames: result.payload.marketNames });
    const leagueLabel = sport === "nfl" ? "NFL" : sport === "nba" ? "NBA" : "NHL";
    parsed = { sport, fetchedAt: fetchedAt.toISOString(), eventCount: mapped.eventCount, marketCount: mapped.marketCount, offerCount: mapped.offerCount, offers: mapped.offers.map((o) => ({ ...o, league: null as string | null })), cacheStatus: "fresh", healthMessage: `Odds updated successfully (The Odds API · ${leagueLabel})` };
  } else {
    const league = sport === "nfl" ? "NFL" as const : sport === "nba" ? "NBA" as const : "NHL" as const;
    let result = await fetchSportsGameOddsEvents({ apiKey: provider.apiKey, league });
    if (!result.ok && result.reason === "provider_error") result = await fetchSportsGameOddsEvents({ apiKey: provider.apiKey, league });
    if (!result.ok) throw providerError(result);
    parsed = parsePremiumPayload(sport, result.payload, fetchedAt);
  }
  // The board is cached for ~22 hours: visitor page loads almost never trigger
  // a provider request. The scheduled daily refresh (scripts/refresh.js via
  // cron-job.org) performs the one real fetch per day, keeping the free
  // provider quota shared across all visitors instead of per visit.
  const expiresAt = new Date(fetchedAt.getTime() + 22 * 60 * 60 * 1000);
  const db = ctx.db;
  await db.delete(schema.premiumOddsCache).where(eq(schema.premiumOddsCache.sport, sport));
  await db.insert(schema.premiumOddsCache).values({ sport, payloadJson: JSON.stringify(parsed), fetchedAt, expiresAt, status: "fresh", message: parsed.healthMessage });
  return parsed;
}

async function loadPremium(ctx: Ctx, sport: Sport): Promise<z.infer<typeof premiumResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.premiumOddsCache).where(eq(schema.premiumOddsCache.sport, sport)).limit(1);
  const cached = cachedRows[0];
  if (cached && cached.expiresAt.getTime() > Date.now()) return premiumResponse.parse(JSON.parse(cached.payloadJson));
  try {
    const provider = await loadOddsProvider(ctx);
    return await fetchPremiumAndCache(ctx, sport, provider);
  } catch (error) {
    if (!cached) throw error;
    const parsed = premiumResponse.parse(JSON.parse(cached.payloadJson));
    return { ...parsed, cacheStatus: "stale", healthMessage: error instanceof Error ? `${error.message} Showing the last successful update.` : "Refresh failed. Showing the last successful update." };
  }
}

// ---------------------------------------------------------------------------
// Transparent model-vs-books track record.
// Every pregame model pick is snapshotted with the books' best prices, then
// graded against the final result. The public "Record" tab reads this table.
// Snapshots refresh with the daily odds job; grading resolves from the free
// official feeds. Nothing here burns extra provider quota.
// ---------------------------------------------------------------------------

function americanToDecimal(odds: number): number | null {
  if (!Number.isFinite(odds) || odds === 0) return null;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function decimalToAmerican(dec: number): number | null {
  if (!Number.isFinite(dec) || dec <= 1) return null;
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

// Strip the sportsbook margin: normalize inverse decimal odds to sum to 1.
function vigFreeProbs(decimals: (number | null)[]): (number | null)[] {
  const inv: (number | null)[] = decimals.map((d) => (d !== null && d > 1 ? 1 / d : null));
  let total = 0;
  for (const v of inv) {
    if (v === null) return decimals.map(() => null);
    total += v;
  }
  if (total <= 0) return decimals.map(() => null);
  return inv.map((v) => (v === null ? null : v / total));
}

type FlipRow = {
  team: string;
  wins: number;
  losses: number;
  ties?: number;
  gamesPlayed?: number;
  modelWinPct?: number | null;
};

// Exact server mirror of the client's flipProbability (Flip % v2): prefers the
// server's modelWinPct when present (NFL/NBA), falls back to W/L record.
function flipTwoWay(awayRow: FlipRow | null, homeRow: FlipRow | null): { away: number; home: number } | null {
  if (!awayRow || !homeRow || awayRow.team === homeRow.team) return null;
  const pct = (row: FlipRow): number | null => {
    if (row.modelWinPct !== undefined && row.modelWinPct !== null) return row.modelWinPct;
    const gp = row.gamesPlayed ?? row.wins + row.losses + (row.ties ?? 0);
    if (!gp) return null;
    return (row.wins + (row.ties ?? 0) / 2) / gp;
  };
  const awayPct = pct(awayRow);
  const homePct = pct(homeRow);
  if (awayPct === null || homePct === null) return null;
  const awayRaw = (awayPct + (1 - homePct)) / 2;
  const homeRaw = (homePct + (1 - awayPct)) / 2;
  const total = awayRaw + homeRaw;
  if (total <= 0) return null;
  return { away: awayRaw / total, home: homeRaw / total };
}

type TrackGame = {
  awayAbbrev: string;
  awayName: string;
  homeAbbrev: string;
  homeName: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  awayScore: number | null;
  homeScore: number | null;
  modelAway: number | null;
  modelHome: number | null;
  modelDraw: number | null;
};

function trackGameWinner(g: TrackGame): "away" | "home" | "draw" | null {
  if (!g.completed || g.awayScore === null || g.homeScore === null) return null;
  if (g.awayScore > g.homeScore) return "away";
  if (g.homeScore > g.awayScore) return "home";
  return "draw";
}

type BoardOffer = { matchup: string; entity: string; marketName: string; odds: string | null };

function bestDec(offer: BoardOffer): number | null {
  return offer.odds === null ? null : americanToDecimal(Number(offer.odds));
}

type Pick3 = "away" | "home" | "draw" | null;
function topPick(probs: { away: number | null; home: number | null; draw?: number | null }): Pick3 {
  const entries: [Pick3, number | null][] = [
    ["away", probs.away],
    ["home", probs.home],
    ["draw", probs.draw ?? null],
  ];
  let best: Pick3 = null;
  let bestVal = -1;
  for (const [side, v] of entries) {
    if (v !== null && v > bestVal) { bestVal = v; best = side; }
  }
  // Require a strict winner; ties mean no pick.
  const tied = entries.filter(([, v]) => v !== null && v === bestVal).length > 1;
  return tied ? null : best;
}

async function upsertSnapshot(ctx: Ctx, row: {
  sport: Sport; league: string; awayTeam: string; homeTeam: string; gameDate: string;
  modelAway: number | null; modelHome: number | null; modelDraw: number | null;
  modelPick: Pick3; bookAwayPrice: number | null; bookHomePrice: number | null; bookDrawPrice: number | null;
  bookAwayProb: number | null; bookHomeProb: number | null; bookDrawProb: number | null;
  bookPick: Pick3; now: Date;
}): Promise<boolean> {
  const t = schema.modelSnapshots;
  const values = {
    sport: row.sport, league: row.league, awayTeam: row.awayTeam, homeTeam: row.homeTeam,
    gameDate: row.gameDate, startsAt: null, snapshotAt: row.now, updatedAt: row.now,
    modelAway: row.modelAway, modelHome: row.modelHome, modelDraw: row.modelDraw,
    modelPick: row.modelPick, bookAwayPrice: row.bookAwayPrice, bookHomePrice: row.bookHomePrice,
    bookDrawPrice: row.bookDrawPrice, bookAwayProb: row.bookAwayProb, bookHomeProb: row.bookHomeProb,
    bookDrawProb: row.bookDrawProb, bookPick: row.bookPick, source: "live" as const,
  };
  await ctx.db.insert(t).values(values).onConflictDoUpdate({
    target: [t.sport, t.league, t.awayTeam, t.homeTeam, t.gameDate],
    set: {
      updatedAt: row.now,
      modelAway: row.modelAway, modelHome: row.modelHome, modelDraw: row.modelDraw,
      modelPick: row.modelPick, bookAwayPrice: row.bookAwayPrice, bookHomePrice: row.bookHomePrice,
      bookDrawPrice: row.bookDrawPrice, bookAwayProb: row.bookAwayProb, bookHomeProb: row.bookHomeProb,
      bookDrawProb: row.bookDrawProb, bookPick: row.bookPick,
    },
  });
  return true;
}

async function gradePendingSnapshots(
  ctx: Ctx, sport: Sport, league: string, games: TrackGame[], now: Date,
): Promise<number> {
  const completed = new Map<string, "away" | "home" | "draw">();
  for (const g of games) {
    const w = trackGameWinner(g);
    if (w) completed.set(`${g.awayAbbrev}|${g.homeAbbrev}|${g.date}`, w);
  }
  if (completed.size === 0) return 0;
  const pending = await ctx.db.select().from(schema.modelSnapshots).where(
    and(
      eq(schema.modelSnapshots.sport, sport),
      eq(schema.modelSnapshots.league, league),
      isNull(schema.modelSnapshots.gradedAt),
    ),
  );
  let graded = 0;
  for (const row of pending) {
    const w = completed.get(`${row.awayTeam}|${row.homeTeam}|${row.gameDate}`);
    if (!w) continue;
    await ctx.db.update(schema.modelSnapshots).set({
      winner: w,
      gradedAt: now,
      modelCorrect: row.modelPick === null ? null : (row.modelPick === w ? 1 : 0),
      bookCorrect: row.bookPick === null ? null : (row.bookPick === w ? 1 : 0),
    }).where(eq(schema.modelSnapshots.id, row.id));
    graded += 1;
  }
  return graded;
}

async function snapshotTwoWaySport(
  ctx: Ctx, sport: "nhl" | "nfl" | "nba", standings: FlipRow[], games: TrackGame[],
  offers: BoardOffer[], now: Date,
): Promise<number> {
  const ml = offers.filter((o) => o.marketName === "Moneyline");
  const byMatchup = new Map<string, BoardOffer[]>();
  for (const o of ml) {
    const list = byMatchup.get(o.matchup) ?? [];
    list.push(o);
    byMatchup.set(o.matchup, list);
  }
  const gameByNames = new Map<string, TrackGame>();
  for (const g of games) gameByNames.set(`${g.awayName.toLowerCase()}|${g.homeName.toLowerCase()}`, g);
  let count = 0;
  for (const [matchup, list] of byMatchup) {
    const parts = matchup.split(" @ ");
    const awayName = parts[0]?.trim().toLowerCase();
    const homeName = parts[1]?.trim().toLowerCase();
    if (!awayName || !homeName) continue;
    const g = gameByNames.get(`${awayName}|${homeName}`);
    if (!g || g.completed) continue;
    const flip = flipTwoWay(
      standings.find((r) => r.team === g.awayAbbrev) ?? null,
      standings.find((r) => r.team === g.homeAbbrev) ?? null,
    );
    let awayDec: number | null = null;
    let homeDec: number | null = null;
    for (const o of list) {
      const dec = bestDec(o);
      if (dec === null) continue;
      const e = o.entity.trim().toLowerCase();
      if (e === g.awayName.toLowerCase()) awayDec = awayDec === null ? dec : Math.max(awayDec, dec);
      else if (e === g.homeName.toLowerCase()) homeDec = homeDec === null ? dec : Math.max(homeDec, dec);
    }
    if (awayDec === null || homeDec === null) continue;
    const vf = vigFreeProbs([awayDec, homeDec]);
    const vfAway = vf[0] ?? null;
    const vfHome = vf[1] ?? null;
    // No selectivity gate: the model always shows its read, even when unsure.
    // When confidence is low or the model disagrees with the books, the
    // Book Read deep dive explains what the books might be seeing.
    const rawPick: Pick3 = flip === null ? null : topPick({ away: flip.away, home: flip.home });
    const modelPick: Pick3 = rawPick;
    const bookPick: Pick3 = topPick({ away: vfAway, home: vfHome });
    await upsertSnapshot(ctx, {
      sport, league: "", awayTeam: g.awayAbbrev, homeTeam: g.homeAbbrev, gameDate: g.date,
      modelAway: flip?.away ?? null, modelHome: flip?.home ?? null, modelDraw: null, modelPick,
      bookAwayPrice: decimalToAmerican(awayDec), bookHomePrice: decimalToAmerican(homeDec), bookDrawPrice: null,
      bookAwayProb: vfAway, bookHomeProb: vfHome, bookDrawProb: null, bookPick, now,
    });
    count += 1;
  }
  return count;
}

async function snapshotSoccerLeague(
  ctx: Ctx, league: string, games: TrackGame[], offers: BoardOffer[], now: Date,
): Promise<number> {
  const ml = offers.filter((o) => o.marketName === "Moneyline");
  const byMatchup = new Map<string, BoardOffer[]>();
  for (const o of ml) {
    const list = byMatchup.get(o.matchup) ?? [];
    list.push(o);
    byMatchup.set(o.matchup, list);
  }
  const gameByNames = new Map<string, TrackGame>();
  for (const g of games) gameByNames.set(`${g.awayName.toLowerCase()}|${g.homeName.toLowerCase()}`, g);
  let count = 0;
  for (const [matchup, list] of byMatchup) {
    const parts = matchup.split(" @ ");
    const awayName = parts[0]?.trim().toLowerCase();
    const homeName = parts[1]?.trim().toLowerCase();
    if (!awayName || !homeName) continue;
    const g = gameByNames.get(`${awayName}|${homeName}`);
    if (!g || g.completed) continue;
    let awayDec: number | null = null;
    let homeDec: number | null = null;
    let drawDec: number | null = null;
    for (const o of list) {
      const dec = bestDec(o);
      if (dec === null) continue;
      const e = o.entity.trim().toLowerCase();
      if (e === g.awayName.toLowerCase()) awayDec = awayDec === null ? dec : Math.max(awayDec, dec);
      else if (e === g.homeName.toLowerCase()) homeDec = homeDec === null ? dec : Math.max(homeDec, dec);
      else if (e === "draw") drawDec = drawDec === null ? dec : Math.max(drawDec, dec);
    }
    if (awayDec === null || homeDec === null || drawDec === null) continue;
    const vf = vigFreeProbs([awayDec, homeDec, drawDec]);
    const vfAway = vf[0] ?? null;
    const vfHome = vf[1] ?? null;
    const vfDraw = vf[2] ?? null;
    const modelPick = topPick({ away: g.modelAway, home: g.modelHome, draw: g.modelDraw });
    const bookPick = topPick({ away: vfAway, home: vfHome, draw: vfDraw });
    await upsertSnapshot(ctx, {
      sport: "soccer", league, awayTeam: g.awayAbbrev, homeTeam: g.homeAbbrev, gameDate: g.date,
      modelAway: g.modelAway, modelHome: g.modelHome, modelDraw: g.modelDraw, modelPick,
      bookAwayPrice: decimalToAmerican(awayDec), bookHomePrice: decimalToAmerican(homeDec),
      bookDrawPrice: decimalToAmerican(drawDec),
      bookAwayProb: vfAway, bookHomeProb: vfHome, bookDrawProb: vfDraw, bookPick, now,
    });
    count += 1;
  }
  return count;
}

function nhlTrackGames(overview: { games: { away: { abbrev: string; name: string; score: number | null }; home: { abbrev: string; name: string; score: number | null }; date: string; state: string }[] }): TrackGame[] {
  return overview.games.map((g) => ({
    awayAbbrev: g.away.abbrev, awayName: g.away.name, homeAbbrev: g.home.abbrev, homeName: g.home.name,
    date: g.date.slice(0, 10),
    completed: g.state === "FINAL" || g.state === "OFF",
    awayScore: g.away.score, homeScore: g.home.score,
    modelAway: null, modelHome: null, modelDraw: null,
  }));
}

function espnTrackGames(overview: { games: { away: { abbrev: string; name: string; score: number | null }; home: { abbrev: string; name: string; score: number | null }; date: string; state: string }[] }): TrackGame[] {
  return overview.games.map((g) => ({
    awayAbbrev: g.away.abbrev, awayName: g.away.name, homeAbbrev: g.home.abbrev, homeName: g.home.name,
    date: g.date.slice(0, 10),
    completed: g.state === "final",
    awayScore: g.away.score, homeScore: g.home.score,
    modelAway: null, modelHome: null, modelDraw: null,
  }));
}

function soccerTrackGames(overview: { games: { away: { abbrev: string; name: string; score: number | null }; home: { abbrev: string; name: string; score: number | null }; date: string; state: string; modelThreeWay: { home: number; draw: number; away: number } | null }[] }): TrackGame[] {
  return overview.games.map((g) => ({
    awayAbbrev: g.away.abbrev, awayName: g.away.name, homeAbbrev: g.home.abbrev, homeName: g.home.name,
    date: g.date.slice(0, 10),
    completed: g.state === "final",
    awayScore: g.away.score, homeScore: g.home.score,
    modelAway: g.modelThreeWay?.away ?? null, modelHome: g.modelThreeWay?.home ?? null,
    modelDraw: g.modelThreeWay?.draw ?? null,
  }));
}

async function snapshotTrackRecord(ctx: Ctx): Promise<{ snapshotted: number; graded: number }> {
  await ensureBacktestSeed(ctx);
  const now = new Date();
  let snapshotted = 0;
  let graded = 0;
  const run = async (fn: () => Promise<void>) => {
    try { await fn(); } catch { /* track record never breaks the refresh */ }
  };
  await run(async () => {
    const overview = await loadNhlOverview();
    const board = await loadPremium(ctx, "nhl");
    snapshotted += await snapshotTwoWaySport(ctx, "nhl", overview.standings, nhlTrackGames(overview), board.offers, now);
    graded += await gradePendingSnapshots(ctx, "nhl", "", nhlTrackGames(overview), now);
  });
  await run(async () => {
    const overview = await loadNflOverview(undefined, ctx);
    const board = await loadPremium(ctx, "nfl");
    snapshotted += await snapshotTwoWaySport(ctx, "nfl", overview.standings, espnTrackGames(overview), board.offers, now);
    graded += await gradePendingSnapshots(ctx, "nfl", "", espnTrackGames(overview), now);
  });
  await run(async () => {
    const overview = await loadNbaOverview(ctx);
    const board = await loadPremium(ctx, "nba");
    snapshotted += await snapshotTwoWaySport(ctx, "nba", overview.standings, espnTrackGames(overview), board.offers, now);
    graded += await gradePendingSnapshots(ctx, "nba", "", espnTrackGames(overview), now);
  });
  await run(async () => {
    const board = await loadPremium(ctx, "soccer");
    for (const league of soccerLeagues) {
      const overview = await loadSoccerOverview(ctx, league);
      const leagueOffers = board.offers.filter((o) => (o.league ?? "") === league);
      const games = soccerTrackGames(overview);
      snapshotted += await snapshotSoccerLeague(ctx, league, games, leagueOffers, now);
      graded += await gradePendingSnapshots(ctx, "soccer", league, games, now);
    }
  });
  return { snapshotted, graded };
}

async function ensureBacktestSeed(ctx: Ctx): Promise<void> {
  const existing = await ctx.db.select({ id: schema.modelSnapshots.id }).from(schema.modelSnapshots).limit(1);
  if (existing.length > 0) return;
  const { BACKTEST_SEED } = await import("./trackRecordSeed.js");
  const now = new Date();
  for (const row of BACKTEST_SEED) {
    await ctx.db.insert(schema.modelSnapshots).values({
      sport: row.sport, league: "", awayTeam: row.away, homeTeam: row.home,
      gameDate: row.date, startsAt: null, snapshotAt: now, updatedAt: now,
      modelAway: row.modelAway, modelHome: row.modelHome, modelDraw: null,
      modelPick: row.pick, bookAwayPrice: null, bookHomePrice: null, bookDrawPrice: null,
      bookAwayProb: null, bookHomeProb: null, bookDrawProb: null, bookPick: null,
      source: "backtest",
      winner: row.winner, gradedAt: now,
      modelCorrect: row.pick === row.winner ? 1 : 0, bookCorrect: null,
    });
  }
}

async function refreshAllPremium(ctx: Ctx): Promise<z.infer<typeof premiumRefreshResponse>> {
  const refreshedAt = new Date();
  let provider: OddsProvider;
  try { provider = await loadOddsProvider(ctx); }
  catch (error) { return { status: "failed", refreshedAt: refreshedAt.toISOString(), refreshedSports: 0, message: error instanceof Error ? error.message : "Sportsbook connection is not configured." }; }
  let refreshedSports = 0;
  const failures: string[] = [];
  for (const sport of sports) {
    try { await fetchPremiumAndCache(ctx, sport, provider); refreshedSports += 1; }
    catch (error) { failures.push(`${sport.toUpperCase()}: ${error instanceof Error ? error.message : "refresh failed"}`); }
  }
  // Transparent track record: snapshot pregame model picks + book prices and
  // grade newly completed games. Runs on the fresh odds above; never throws.
  try { await snapshotTrackRecord(ctx); } catch { /* tracker is best-effort */ }
  return { status: refreshedSports === sports.length ? "success" : refreshedSports > 0 ? "partial" : "failed", refreshedAt: refreshedAt.toISOString(), refreshedSports, message: failures.length ? failures.join(" · ") : "All sportsbook boards updated." };
}

const goalieIndicatorSchema = z.object({ status: z.enum(["confirmed", "watch", "unavailable"]), names: z.array(z.string()) });
const nhlGameSchema = z.object({
  id: z.number(), date: z.string(), startsAt: z.string(), state: z.string(), venue: z.string(),
  away: z.object({ abbrev: z.string(), name: z.string(), score: z.number().nullable(), goalie: goalieIndicatorSchema }),
  home: z.object({ abbrev: z.string(), name: z.string(), score: z.number().nullable(), goalie: goalieIndicatorSchema }),
  broadcasts: z.array(z.string()),
});
const standingSchema = z.object({
  team: z.string(), name: z.string(), conference: z.string(), division: z.string(), gamesPlayed: z.number(), wins: z.number(), losses: z.number(), otLosses: z.number(), points: z.number(), pointPct: z.number(), goalsFor: z.number(), goalsAgainst: z.number(), streak: z.string().nullable(),
});
const nhlOverviewResponse = z.object({ date: z.string(), fetchedAt: z.string(), scheduleSourceUrl: z.string(), standingsSourceUrl: z.string(), games: z.array(nhlGameSchema), standings: z.array(standingSchema) });

const firstGoalTeamSchema = z.object({
  team: z.enum(teamCodes), games: z.number(), firstGoalGames: z.number(), scoredFirst: z.number(), allowedFirst: z.number(), scoredFirstPct: z.number().nullable(), allowedFirstPct: z.number().nullable(), venueGames: z.number(), venueScoredFirst: z.number(), venueScoredFirstPct: z.number().nullable(),
  firstPeriodUnder25: z.number(), firstPeriodUnder25Pct: z.number().nullable(), venueFirstPeriodUnder25Pct: z.number().nullable(),
  blowouts: z.number(), blowoutPct: z.number().nullable(), venueBlowoutPct: z.number().nullable(),
  bothTeamsTwo: z.number(), bothTeamsTwoPct: z.number().nullable(), venueBothTeamsTwoPct: z.number().nullable(),
  regulationDraws: z.number(), regulationDrawPct: z.number().nullable(), venueRegulationDrawPct: z.number().nullable(),
  wins: z.number(), winPct: z.number().nullable(), venueWins: z.number(), venueWinPct: z.number().nullable(),
});
const firstGoalMatchupResponse = z.object({
  away: firstGoalTeamSchema, home: firstGoalTeamSchema,
  awayProbability: z.number().nullable(), homeProbability: z.number().nullable(), edgeTeam: z.enum(teamCodes).nullable(), edgePoints: z.number().nullable(),
  awayWinProbability: z.number().nullable(), homeWinProbability: z.number().nullable(), winnerTeam: z.enum(teamCodes).nullable(), winnerEdgePoints: z.number().nullable(),
  firstPeriodUnder25Probability: z.number().nullable(), blowoutProbability: z.number().nullable(), bothTeamsTwoProbability: z.number().nullable(), regulationDrawProbability: z.number().nullable(),
  headToHead: z.object({ games: z.number(), awayScoredFirst: z.number(), homeScoredFirst: z.number() }),
  fetchedAt: z.string(), sourceUrl: z.string(), sampleNote: z.string(),
});

const hotGameSchema = z.object({ gameId: z.number(), date: z.string(), opponent: z.string(), goals: z.number(), assists: z.number(), points: z.number(), shots: z.number(), saves: z.number().nullable(), savePct: z.number().nullable() });
const hotPlayerSchema = z.object({
  playerId: z.number(), name: z.string(), team: z.enum(teamCodes), position: z.string(), pointStreak: z.number(), goalStreak: z.number(), lastFivePoints: z.number(), lastFiveGoals: z.number(), lastFiveSavePct: z.number().nullable(), games: z.array(hotGameSchema), heatScore: z.number(),
});
const hotStreaksResponse = z.object({ fetchedAt: z.string(), sourceUrl: z.string(), windowStart: z.string(), windowEnd: z.string(), players: z.array(hotPlayerSchema) });

const coldTeamSchema = z.object({ team: z.string(), name: z.string(), streak: z.string(), losses: z.number(), gamesPlayed: z.number() });
const coldPlayerSchema = z.object({
  playerId: z.number(), name: z.string(), team: z.enum(teamCodes), position: z.string(),
  scorelessStreak: z.number(), goallessStreak: z.number(), lastFivePoints: z.number(), lastFiveGoals: z.number(),
  lastFiveSavePct: z.number().nullable(), games: z.array(hotGameSchema), coldScore: z.number(),
});
const coldStreaksResponse = z.object({ fetchedAt: z.string(), sourceUrl: z.string(), windowStart: z.string(), windowEnd: z.string(), players: z.array(coldPlayerSchema), teams: z.array(coldTeamSchema) });

type JsonRecord = Record<string, unknown>;
function objectValue(value: unknown): JsonRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function shortTeam(value: unknown): string { const row = objectValue(value); return textValue(row?.abbrev) ?? "—"; }
function fullTeam(value: unknown): string {
  const row = objectValue(value); const place = localized(row?.placeName); const common = localized(row?.commonName);
  return [place, common].filter(Boolean).join(" ") || shortTeam(value);
}
function goalieWatch(payload: unknown, side: "awayTeam" | "homeTeam"): string[] {
  const root = objectValue(payload); const matchup = objectValue(root?.matchup); const comparison = objectValue(matchup?.goalieComparison); const team = objectValue(comparison?.[side]);
  return arrayValue(team?.leaders).flatMap((value) => { const row = objectValue(value); const name = localized(row?.name); return name ? [name] : []; });
}
function confirmedGoalies(payload: unknown, side: "awayTeam" | "homeTeam"): string[] {
  const root = objectValue(payload); const stats = objectValue(root?.playerByGameStats); const team = objectValue(stats?.[side]);
  return arrayValue(team?.goalies).flatMap((value) => { const row = objectValue(value); return row?.starter === true ? [localized(row.name)] : []; }).filter(Boolean);
}

async function loadNhlOverview(): Promise<z.infer<typeof nhlOverviewResponse>> {
  const date = nyDate(new Date());
  const scheduleUrl = `${NHL_API}/schedule/${date}`;
  const standingsUrl = `${NHL_API}/standings/${date}`;
  const [scheduleResponse, standingsResponse] = await Promise.all([fetch(scheduleUrl, { headers: { Accept: "application/json" } }), fetch(standingsUrl, { headers: { Accept: "application/json" } })]);
  if (!scheduleResponse.ok) throw new Error("The official NHL schedule is temporarily unavailable");
  const schedulePayload = await scheduleResponse.json() as unknown;
  const standingsPayload = standingsResponse.ok ? await standingsResponse.json() as unknown : {};
  const gameRows = arrayValue(objectValue(schedulePayload)?.gameWeek).flatMap((weekValue) => {
    const week = objectValue(weekValue); const gameDate = textValue(week?.date) ?? date;
    return arrayValue(week?.games).map((game) => ({ gameDate, game: objectValue(game) })).filter((item): item is { gameDate: string; game: JsonRecord } => item.game !== null);
  });
  const detailPairs = await Promise.all(gameRows.filter((item) => item.gameDate === date).map(async (item) => {
    const id = num(item.game.id); if (id === null) return [0, null] as const;
    const state = textValue(item.game.gameState) ?? "FUT";
    const endpoint = state === "FUT" || state === "PRE" ? "landing" : "boxscore";
    try { const response = await fetch(`${NHL_API}/gamecenter/${id}/${endpoint}`, { headers: { Accept: "application/json" } }); return [id, response.ok ? await response.json() as unknown : null] as const; }
    catch { return [id, null] as const; }
  }));
  const details = new Map<number, unknown>(detailPairs);
  const games = gameRows.flatMap(({ gameDate, game }) => {
    const id = num(game.id); const startsAt = textValue(game.startTimeUTC); if (id === null || !startsAt) return [];
    const awayRaw = objectValue(game.awayTeam); const homeRaw = objectValue(game.homeTeam); if (!awayRaw || !homeRaw) return [];
    const detail = details.get(id); const state = textValue(game.gameState) ?? "FUT";
    const awayConfirmed = confirmedGoalies(detail, "awayTeam"); const homeConfirmed = confirmedGoalies(detail, "homeTeam");
    const awayWatch = goalieWatch(detail, "awayTeam"); const homeWatch = goalieWatch(detail, "homeTeam");
    const indicator = (confirmed: string[], watch: string[]) => confirmed.length ? { status: "confirmed" as const, names: confirmed } : watch.length ? { status: "watch" as const, names: watch } : { status: "unavailable" as const, names: [] };
    return [{ id, date: gameDate, startsAt, state, venue: localized(game.venue) || "Venue unavailable", away: { abbrev: shortTeam(awayRaw), name: fullTeam(awayRaw), score: num(awayRaw.score), goalie: indicator(awayConfirmed, awayWatch) }, home: { abbrev: shortTeam(homeRaw), name: fullTeam(homeRaw), score: num(homeRaw.score), goalie: indicator(homeConfirmed, homeWatch) }, broadcasts: arrayValue(game.tvBroadcasts).flatMap((value) => { const network = textValue(objectValue(value)?.network); return network ? [network] : []; }) }];
  });
  const standings = arrayValue(objectValue(standingsPayload)?.standings).flatMap((value) => {
    const row = objectValue(value); if (!row) return [];
    const team = localized(row.teamAbbrev); if (!team) return [];
    const name = localized(row.teamName) || team;
    return [{ team, name, conference: textValue(row.conferenceName) ?? "", division: textValue(row.divisionName) ?? "", gamesPlayed: num(row.gamesPlayed) ?? 0, wins: num(row.wins) ?? 0, losses: num(row.losses) ?? 0, otLosses: num(row.otLosses) ?? 0, points: num(row.points) ?? 0, pointPct: num(row.pointPctg) ?? 0, goalsFor: num(row.goalFor) ?? 0, goalsAgainst: num(row.goalAgainst) ?? 0, streak: textValue(row.streakCode) }];
  }).sort((a, b) => b.points - a.points || b.pointPct - a.pointPct);
  return { date, fetchedAt: new Date().toISOString(), scheduleSourceUrl: scheduleResponse.url, standingsSourceUrl: standingsResponse.ok ? standingsResponse.url : standingsUrl, games, standings };
}

type FirstGoalGame = { id: number; date: string; away: (typeof teamCodes)[number]; home: (typeof teamCodes)[number]; awayScore: number | null; homeScore: number | null };
type FirstGoalResult = FirstGoalGame & { firstTeam: (typeof teamCodes)[number] | null; firstPeriodGoals: number; regulationDraw: boolean; sourceUrl: string };

function isTeamCode(value: string): value is (typeof teamCodes)[number] { return teamCodes.includes(value as (typeof teamCodes)[number]); }

async function loadClubSchedule(team: (typeof teamCodes)[number]): Promise<{ games: FirstGoalGame[]; sourceUrl: string }> {
  const seasons = [NHL_SEASON, "20252026"];
  const responses = await Promise.all(seasons.map((season) => fetch(`${NHL_API}/club-schedule-season/${team}/${season}`, { headers: { Accept: "application/json" } })));
  const games: FirstGoalGame[] = [];
  let sourceUrl: string | null = null;
  for (const response of responses) {
    if (!response.ok) continue;
    sourceUrl = response.url;
    const payload = await response.json() as ClubSchedulePayload;
    for (const value of arrayValue(payload.games)) {
      const row = objectValue(value); if (!row) continue;
      const id = num(row.id); const date = textValue(row.gameDate); const state = textValue(row.gameState); const gameType = num(row.gameType);
      const away = shortTeam(row.awayTeam); const home = shortTeam(row.homeTeam);
      if (id === null || !date || gameType !== 2 || (state !== "FINAL" && state !== "OFF") || !isTeamCode(away) || !isTeamCode(home)) continue;
      games.push({ id, date, away, home, awayScore: num(objectValue(row.awayTeam)?.score), homeScore: num(objectValue(row.homeTeam)?.score) });
    }
  }
  if (!sourceUrl) throw new Error(`The official NHL schedule for ${team} is temporarily unavailable`);
  const deduped = new Map<number, FirstGoalGame>();
  for (const game of games.sort((a, b) => b.date.localeCompare(a.date))) if (!deduped.has(game.id)) deduped.set(game.id, game);
  return { games: Array.from(deduped.values()).slice(0, 20), sourceUrl };
}

async function fetchFirstGoalResult(game: FirstGoalGame): Promise<FirstGoalResult | null> {
  try {
    const response = await fetch(`${NHL_API}/gamecenter/${game.id}/play-by-play`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json() as unknown;
    const awayId = num(objectValue(objectValue(payload)?.awayTeam)?.id);
    const homeId = num(objectValue(objectValue(payload)?.homeTeam)?.id);
    let firstTeam: (typeof teamCodes)[number] | null = null;
    let firstPeriodGoals = 0;
    let awayRegulationGoals = 0;
    let homeRegulationGoals = 0;
    for (const value of arrayValue(objectValue(payload)?.plays)) {
      const play = objectValue(value); if (textValue(play?.typeDescKey)?.toLowerCase() !== "goal") continue;
      const period = num(objectValue(play?.periodDescriptor)?.number);
      const owner = num(objectValue(play?.details)?.eventOwnerTeamId);
      if (period === 1) firstPeriodGoals += 1;
      if (period !== null && period <= 3) {
        if (owner !== null && owner === awayId) awayRegulationGoals += 1;
        if (owner !== null && owner === homeId) homeRegulationGoals += 1;
      }
      if (firstTeam === null) firstTeam = owner !== null && owner === awayId ? game.away : owner !== null && owner === homeId ? game.home : null;
    }
    return { ...game, firstTeam, firstPeriodGoals, regulationDraw: awayRegulationGoals === homeRegulationGoals, sourceUrl: response.url };
  } catch { return null; }
}

function teamFirstGoalStats(team: (typeof teamCodes)[number], venue: "away" | "home", results: FirstGoalResult[]): z.infer<typeof firstGoalTeamSchema> {
  const games = results.filter((game) => game.away === team || game.home === team);
  const firstGoalGames = games.filter((game) => game.firstTeam !== null);
  const venueGames = games.filter((game) => game[venue] === team);
  const venueFirstGoalGames = venueGames.filter((game) => game.firstTeam !== null);
  const scoredFirst = firstGoalGames.filter((game) => game.firstTeam === team).length;
  const venueScoredFirst = venueFirstGoalGames.filter((game) => game.firstTeam === team).length;
  const firstPeriodUnder25 = games.filter((game) => game.firstPeriodGoals <= 2).length;
  const blowouts = games.filter((game) => game.awayScore !== null && game.homeScore !== null && Math.abs(game.awayScore - game.homeScore) >= 3).length;
  const scoredTwo = games.filter((game) => game.awayScore !== null && game.homeScore !== null && game.awayScore >= 2 && game.homeScore >= 2).length;
  const venueUnder = venueGames.filter((game) => game.firstPeriodGoals <= 2).length;
  const venueBlowouts = venueGames.filter((game) => game.awayScore !== null && game.homeScore !== null && Math.abs(game.awayScore - game.homeScore) >= 3).length;
  const venueScoredTwo = venueGames.filter((game) => game.awayScore !== null && game.homeScore !== null && game.awayScore >= 2 && game.homeScore >= 2).length;
  const regulationDraws = games.filter((game) => game.regulationDraw).length;
  const venueRegulationDraws = venueGames.filter((game) => game.regulationDraw).length;
  const scoredGames = games.filter((game) => game.awayScore !== null && game.homeScore !== null);
  const venueScoredGames = venueGames.filter((game) => game.awayScore !== null && game.homeScore !== null);
  const won = (game: FirstGoalResult) => game.awayScore !== null && game.homeScore !== null && (game.away === team ? game.awayScore > game.homeScore : game.homeScore > game.awayScore);
  const wins = scoredGames.filter(won).length;
  const venueWins = venueScoredGames.filter(won).length;
  return {
    team, games: games.length, firstGoalGames: firstGoalGames.length, scoredFirst, allowedFirst: firstGoalGames.length - scoredFirst,
    scoredFirstPct: firstGoalGames.length ? scoredFirst / firstGoalGames.length : null,
    allowedFirstPct: firstGoalGames.length ? (firstGoalGames.length - scoredFirst) / firstGoalGames.length : null,
    venueGames: venueGames.length, venueScoredFirst,
    venueScoredFirstPct: venueFirstGoalGames.length ? venueScoredFirst / venueFirstGoalGames.length : null,
    firstPeriodUnder25, firstPeriodUnder25Pct: games.length ? firstPeriodUnder25 / games.length : null,
    venueFirstPeriodUnder25Pct: venueGames.length ? venueUnder / venueGames.length : null,
    blowouts, blowoutPct: games.length ? blowouts / games.length : null,
    venueBlowoutPct: venueGames.length ? venueBlowouts / venueGames.length : null,
    bothTeamsTwo: scoredTwo, bothTeamsTwoPct: games.length ? scoredTwo / games.length : null,
    venueBothTeamsTwoPct: venueGames.length ? venueScoredTwo / venueGames.length : null,
    regulationDraws, regulationDrawPct: games.length ? regulationDraws / games.length : null,
    venueRegulationDrawPct: venueGames.length ? venueRegulationDraws / venueGames.length : null,
    wins, winPct: scoredGames.length ? wins / scoredGames.length : null,
    venueWins, venueWinPct: venueScoredGames.length ? venueWins / venueScoredGames.length : null,
  };
}

async function loadFirstGoalMatchup(ctx: Ctx, awayTeam: (typeof teamCodes)[number], homeTeam: (typeof teamCodes)[number], force: boolean): Promise<z.infer<typeof firstGoalMatchupResponse>> {
  const cacheKey = `matchup-v2:${awayTeam}:${homeTeam}`;
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return firstGoalMatchupResponse.parse(JSON.parse(cached.payloadJson));
  const [awaySchedule, homeSchedule] = await Promise.all([loadClubSchedule(awayTeam), loadClubSchedule(homeTeam)]);
  const selected = new Map<number, FirstGoalGame>();
  for (const game of [...awaySchedule.games, ...homeSchedule.games]) if (!selected.has(game.id)) selected.set(game.id, game);
  const pending = Array.from(selected.values());
  const results: FirstGoalResult[] = [];
  for (let index = 0; index < pending.length; index += 4) {
    const batch = await Promise.all(pending.slice(index, index + 4).map(fetchFirstGoalResult));
    results.push(...batch.filter((row): row is FirstGoalResult => row !== null));
  }
  const away = teamFirstGoalStats(awayTeam, "away", results);
  const home = teamFirstGoalStats(homeTeam, "home", results);
  const awayOwn = away.venueGames >= 5 ? (away.venueScoredFirstPct ?? away.scoredFirstPct) : away.scoredFirstPct;
  const homeOwn = home.venueGames >= 5 ? (home.venueScoredFirstPct ?? home.scoredFirstPct) : home.scoredFirstPct;
  const awayRaw = awayOwn !== null && home.allowedFirstPct !== null ? (awayOwn + home.allowedFirstPct) / 2 : null;
  const homeRaw = homeOwn !== null && away.allowedFirstPct !== null ? (homeOwn + away.allowedFirstPct) / 2 : null;
  const total = awayRaw !== null && homeRaw !== null ? awayRaw + homeRaw : null;
  const awayProbability = awayRaw !== null && total !== null && total > 0 ? awayRaw / total : null;
  const homeProbability = homeRaw !== null && total !== null && total > 0 ? homeRaw / total : null;
  const venueBlend = (overall: number | null, venueRate: number | null, venueGames: number): number | null => overall === null ? null : venueGames >= 5 && venueRate !== null ? overall * .4 + venueRate * .6 : overall;
  const mean = (a: number | null, b: number | null): number | null => a !== null && b !== null ? (a + b) / 2 : a ?? b;
  const awayWinForm = venueBlend(away.winPct, away.venueWinPct, away.venueGames);
  const homeWinForm = venueBlend(home.winPct, home.venueWinPct, home.venueGames);
  const awayWinRaw = awayWinForm !== null && homeWinForm !== null ? (awayWinForm + (1 - homeWinForm)) / 2 : null;
  const homeWinRaw = awayWinForm !== null && homeWinForm !== null ? (homeWinForm + (1 - awayWinForm)) / 2 : null;
  const winTotal = awayWinRaw !== null && homeWinRaw !== null ? awayWinRaw + homeWinRaw : null;
  const awayWinProbability = awayWinRaw !== null && winTotal !== null && winTotal > 0 ? awayWinRaw / winTotal : null;
  const homeWinProbability = homeWinRaw !== null && winTotal !== null && winTotal > 0 ? homeWinRaw / winTotal : null;
  const winnerTeam = awayWinProbability === null || homeWinProbability === null ? null : awayWinProbability >= homeWinProbability ? awayTeam : homeTeam;
  const winnerEdgePoints = awayWinProbability === null || homeWinProbability === null ? null : Math.abs(awayWinProbability - homeWinProbability) * 100;
  const firstPeriodUnder25Probability = mean(venueBlend(away.firstPeriodUnder25Pct, away.venueFirstPeriodUnder25Pct, away.venueGames), venueBlend(home.firstPeriodUnder25Pct, home.venueFirstPeriodUnder25Pct, home.venueGames));
  const blowoutProbability = mean(venueBlend(away.blowoutPct, away.venueBlowoutPct, away.venueGames), venueBlend(home.blowoutPct, home.venueBlowoutPct, home.venueGames));
  const bothTeamsTwoProbability = mean(venueBlend(away.bothTeamsTwoPct, away.venueBothTeamsTwoPct, away.venueGames), venueBlend(home.bothTeamsTwoPct, home.venueBothTeamsTwoPct, home.venueGames));
  const regulationDrawProbability = mean(venueBlend(away.regulationDrawPct, away.venueRegulationDrawPct, away.venueGames), venueBlend(home.regulationDrawPct, home.venueRegulationDrawPct, home.venueGames));
  const headGames = results.filter((game) => (game.away === awayTeam && game.home === homeTeam) || (game.away === homeTeam && game.home === awayTeam));
  const edgeTeam = awayProbability === null || homeProbability === null ? null : awayProbability >= homeProbability ? awayTeam : homeTeam;
  const edgePoints = awayProbability === null || homeProbability === null ? null : Math.abs(awayProbability - homeProbability) * 100;
  const response: z.infer<typeof firstGoalMatchupResponse> = {
    away, home, awayProbability, homeProbability, edgeTeam, edgePoints, awayWinProbability, homeWinProbability, winnerTeam, winnerEdgePoints, firstPeriodUnder25Probability, blowoutProbability, bothTeamsTwoProbability, regulationDrawProbability,
    headToHead: { games: headGames.length, awayScoredFirst: headGames.filter((game) => game.firstTeam === awayTeam).length, homeScoredFirst: headGames.filter((game) => game.firstTeam === homeTeam).length },
    fetchedAt: new Date().toISOString(), sourceUrl: results[0]?.sourceUrl ?? awaySchedule.sourceUrl,
    sampleNote: `Recent ${away.games} ${awayTeam} and ${home.games} ${homeTeam} completed regular-season games, using 2026–27 first and 2025–26 when needed.`,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
  await db.insert(schema.nhlInsightCache).values({ key: cacheKey, payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) });
  return response;
}

type NhlRecentGame = z.infer<typeof hotGameSchema>;
type NhlPlayerAcc = { playerId: number; name: string; team: (typeof teamCodes)[number]; position: string; games: NhlRecentGame[] };

async function collectNhlRecentGames(): Promise<{ byPlayer: Map<number, NhlPlayerAcc>; dates: string[]; start: Date; now: Date }> {
  const now = new Date(); const start = new Date(now.getTime() - 21 * 86400000);
  const dates = [0, 7, 14, 21].map((days) => nyDate(new Date(now.getTime() - days * 86400000)));
  const schedulePayloads = await Promise.all(dates.map(async (date) => { const response = await fetch(`${NHL_API}/schedule/${date}`, { headers: { Accept: "application/json" } }); return response.ok ? await response.json() as unknown : {}; }));
  const gameMap = new Map<number, { date: string; away: string; home: string }>();
  for (const payload of schedulePayloads) for (const weekValue of arrayValue(objectValue(payload)?.gameWeek)) {
    const week = objectValue(weekValue); const gameDate = textValue(week?.date); if (!gameDate || gameDate < nyDate(start) || gameDate > nyDate(now)) continue;
    for (const gameValue of arrayValue(week?.games)) { const game = objectValue(gameValue); const id = num(game?.id); const state = textValue(game?.gameState); if (id !== null && (state === "FINAL" || state === "OFF")) gameMap.set(id, { date: gameDate, away: shortTeam(game?.awayTeam), home: shortTeam(game?.homeTeam) }); }
  }
  const boxes: Array<{ game: { date: string; away: string; home: string }; id: number; payload: unknown }> = [];
  const games = Array.from(gameMap.entries());
  for (let index = 0; index < games.length; index += 10) {
    const batch = games.slice(index, index + 10);
    const rows = await Promise.all(batch.map(async ([id, game]) => { try { const response = await fetch(`${NHL_API}/gamecenter/${id}/boxscore`, { headers: { Accept: "application/json" } }); return response.ok ? { game, id, payload: await response.json() as unknown } : null; } catch { return null; } }));
    boxes.push(...rows.filter((row): row is { game: { date: string; away: string; home: string }; id: number; payload: unknown } => row !== null));
  }
  const byPlayer = new Map<number, NhlPlayerAcc>();
  for (const box of boxes) {
    const root = objectValue(box.payload); const stats = objectValue(root?.playerByGameStats);
    for (const side of ["awayTeam", "homeTeam"] as const) {
      const teamCode = (side === "awayTeam" ? box.game.away : box.game.home) as (typeof teamCodes)[number]; if (!teamCodes.includes(teamCode)) continue;
      const opponent = side === "awayTeam" ? box.game.home : box.game.away; const team = objectValue(stats?.[side]);
      for (const group of ["forwards", "defense", "goalies"] as const) for (const playerValue of arrayValue(team?.[group])) {
        const player = objectValue(playerValue); const playerId = num(player?.playerId); const name = localized(player?.name); if (playerId === null || !name) continue;
        if (group === "goalies" && textValue(player?.toi) === "00:00") continue;
        const goals = num(player?.goals) ?? 0; const assists = num(player?.assists) ?? 0; const shotsAgainst = num(player?.shotsAgainst); const saves = num(player?.saves); const savePct = shotsAgainst !== null && shotsAgainst > 0 && saves !== null ? saves / shotsAgainst : num(player?.savePctg);
        const game = { gameId: box.id, date: box.game.date, opponent, goals, assists, points: num(player?.points) ?? goals + assists, shots: num(player?.sog) ?? num(player?.shots) ?? 0, saves, savePct };
        const acc = byPlayer.get(playerId) ?? { playerId, name, team: teamCode, position: textValue(player?.position) ?? (group === "goalies" ? "G" : group === "defense" ? "D" : "F"), games: [] };
        acc.games.push(game); byPlayer.set(playerId, acc);
      }
    }
  }
  return { byPlayer, dates, start, now };
}

async function fetchHotStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof hotStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "hot-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return hotStreaksResponse.parse(JSON.parse(cached.payloadJson));
  const { byPlayer, dates, start, now } = await collectNhlRecentGames();
  const players = Array.from(byPlayer.values()).flatMap((player) => {
    const recent = player.games.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5); if (recent.length < 2) return [];
    let pointStreak = 0; for (const game of recent) { if (game.points <= 0) break; pointStreak += 1; }
    let goalStreak = 0; for (const game of recent) { if (game.goals <= 0) break; goalStreak += 1; }
    const lastFivePoints = recent.reduce((sum, game) => sum + game.points, 0); const lastFiveGoals = recent.reduce((sum, game) => sum + game.goals, 0);
    const goalieGames = recent.filter((game) => game.savePct !== null); const lastFiveSavePct = goalieGames.length >= 2 ? goalieGames.reduce((sum, game) => sum + (game.savePct ?? 0), 0) / goalieGames.length : null;
    const hot = pointStreak >= 2 || goalStreak >= 2 || lastFivePoints >= 5 || lastFiveGoals >= 3 || (lastFiveSavePct !== null && lastFiveSavePct >= .92); if (!hot) return [];
    const heatScore = pointStreak * 3 + goalStreak * 4 + lastFivePoints + lastFiveGoals * 1.5 + (lastFiveSavePct === null ? 0 : Math.max(0, lastFiveSavePct - .9) * 100);
    return [{ ...player, games: recent, pointStreak, goalStreak, lastFivePoints, lastFiveGoals, lastFiveSavePct, heatScore }];
  }).sort((a, b) => b.heatScore - a.heatScore || b.lastFivePoints - a.lastFivePoints);
  const response: z.infer<typeof hotStreaksResponse> = { fetchedAt: new Date().toISOString(), sourceUrl: `${NHL_API}/schedule/${dates[0] ?? nyDate(now)}`, windowStart: nyDate(start), windowEnd: nyDate(now), players };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "hot-streaks"));
  await db.insert(schema.nhlInsightCache).values({ key: "hot-streaks", payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return response;
}

async function fetchColdStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof coldStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "cold-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return coldStreaksResponse.parse(JSON.parse(cached.payloadJson));
  const { byPlayer, dates, start, now } = await collectNhlRecentGames();
  const players = Array.from(byPlayer.values()).flatMap((player) => {
    const recent = player.games.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5); if (recent.length < 2) return [];
    const isGoalie = player.position === "G";
    let scorelessStreak = 0; for (const game of recent) { if (game.points > 0) break; scorelessStreak += 1; }
    let goallessStreak = 0; for (const game of recent) { if (game.goals > 0) break; goallessStreak += 1; }
    const lastFivePoints = recent.reduce((sum, game) => sum + game.points, 0);
    const lastFiveGoals = recent.reduce((sum, game) => sum + game.goals, 0);
    const lastFiveShots = recent.reduce((sum, game) => sum + game.shots, 0);
    const goalieGames = recent.filter((game) => game.savePct !== null);
    const lastFiveSavePct = goalieGames.length >= 2 ? goalieGames.reduce((sum, game) => sum + (game.savePct ?? 0), 0) / goalieGames.length : null;
    // Skaters need real shot volume: getting chances but not converting, not healthy scratches.
    const involved = isGoalie || lastFiveShots >= 6;
    const cold = involved && (isGoalie
      ? (lastFiveSavePct !== null && lastFiveSavePct < .88)
      : (scorelessStreak >= 3 || goallessStreak >= 4 || (recent.length >= 3 && lastFivePoints <= 1)));
    if (!cold) return [];
    const coldScore = scorelessStreak * 3 + goallessStreak * 2 + Math.max(0, 5 - lastFivePoints) + (lastFiveSavePct === null ? 0 : Math.max(0, .9 - lastFiveSavePct) * 200);
    return [{ ...player, games: recent, scorelessStreak, goallessStreak, lastFivePoints, lastFiveGoals, lastFiveSavePct, coldScore }];
  }).sort((a, b) => b.coldScore - a.coldScore || a.lastFivePoints - b.lastFivePoints);
  let teams: z.infer<typeof coldTeamSchema>[] = [];
  try {
    const overview = await loadNhlOverview();
    teams = overview.standings.flatMap((row) => {
      const match = /^L(\d+)$/.exec(row.streak ?? "");
      const losses = match ? Number(match[1]) : 0;
      if (losses < 3) return [];
      return [{ team: row.team, name: row.name, streak: row.streak ?? `L${losses}`, losses, gamesPlayed: row.gamesPlayed }];
    }).sort((a, b) => b.losses - a.losses);
  } catch { /* team slumps are best-effort */ }
  const response: z.infer<typeof coldStreaksResponse> = { fetchedAt: new Date().toISOString(), sourceUrl: `${NHL_API}/schedule/${dates[0] ?? nyDate(now)}`, windowStart: nyDate(start), windowEnd: nyDate(now), players, teams };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "cold-streaks"));
  await db.insert(schema.nhlInsightCache).values({ key: "cold-streaks", payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return response;
}

const providerStatusResponse = z.object({ configured: z.boolean(), updatedAt: z.string().nullable() });
const removedResponse = z.object({ configured: z.literal(false), updatedAt: z.null() });

async function getProviderStatus(ctx: Ctx, provider: string): Promise<z.infer<typeof providerStatusResponse>> {
  const rows = await ctx.db.select({ updatedAt: schema.providerCredentials.updatedAt }).from(schema.providerCredentials).where(eq(schema.providerCredentials.provider, provider)).limit(1);
  const credential = rows[0];
  return { configured: credential !== undefined, updatedAt: credential?.updatedAt.toISOString() ?? null };
}

async function upsertProviderKey(ctx: Ctx, provider: string, apiKey: string): Promise<z.infer<typeof providerStatusResponse>> {
  const db = ctx.db;
  const existing = await db.select({ createdAt: schema.providerCredentials.createdAt }).from(schema.providerCredentials).where(eq(schema.providerCredentials.provider, provider)).limit(1);
  const now = new Date();
  if (existing[0]) {
    await db.update(schema.providerCredentials).set({ secretValue: apiKey, updatedAt: now }).where(eq(schema.providerCredentials.provider, provider));
  } else {
    await db.insert(schema.providerCredentials).values({ provider, secretValue: apiKey, createdAt: now, updatedAt: now });
  }
  await db.delete(schema.premiumOddsCache);
  return { configured: true, updatedAt: now.toISOString() };
}

async function removeProviderKey(ctx: Ctx, provider: string): Promise<z.infer<typeof removedResponse>> {
  const db = ctx.db;
  await db.delete(schema.providerCredentials).where(eq(schema.providerCredentials.provider, provider));
  await db.delete(schema.premiumOddsCache);
  return { configured: false, updatedAt: null };
}

// ---------------------------------------------------------------------------
// NFL (ESPN keyless feeds). Mirrors the NHL insight sections: overview,
// matchup calculator, hot streaks, rosters and player game logs.
// ---------------------------------------------------------------------------

const ESPN_SITE_NFL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

const nflGameSideSchema = z.object({ abbrev: z.string(), name: z.string(), score: z.number().nullable(), winner: z.boolean() });
const nflGameSchema = z.object({
  id: z.number(), week: z.number(), date: z.string(), startsAt: z.string(), state: z.string(), detail: z.string(),
  shortName: z.string(), away: nflGameSideSchema, home: nflGameSideSchema,
});
const nflStandingSchema = z.object({
  team: z.string(), name: z.string(), conference: z.string(), division: z.string(),
  wins: z.number(), losses: z.number(), ties: z.number(),
  pointsFor: z.number(), pointsAgainst: z.number(),
  streak: z.string().nullable(), playoffSeed: z.number().nullable(),
  // Flip % v2: Pythagorean expectation blended with last-5 form, regressed
  // toward .500 early in the season. Null when the sample is too thin.
  // Always a model estimate, never a sportsbook price.
  modelWinPct: z.number().nullable(),
});
const nflOverviewResponse = z.object({
  week: z.number(), weeks: z.array(z.number()), season: z.number(), fetchedAt: z.string(),
  scheduleSourceUrl: z.string(), standingsSourceUrl: z.string(),
  games: z.array(nflGameSchema), standings: z.array(nflStandingSchema),
});

const nflMatchupTeamSchema = z.object({
  team: z.string(), games: z.number(),
  wins: z.number(), winPct: z.number().nullable(), venueGames: z.number(), venueWins: z.number(), venueWinPct: z.number().nullable(),
  firstScoreGames: z.number(), firstScore: z.number(), firstScorePct: z.number().nullable(),
  venueFirstScoreGames: z.number(), venueFirstScore: z.number(), venueFirstScorePct: z.number().nullable(),
  firstHalfUnder245: z.number(), firstHalfUnder245Pct: z.number().nullable(), venueFirstHalfUnder245Pct: z.number().nullable(),
  blowouts: z.number(), blowoutPct: z.number().nullable(), venueBlowoutPct: z.number().nullable(),
  bothTeams20: z.number(), bothTeams20Pct: z.number().nullable(), venueBothTeams20Pct: z.number().nullable(),
  overtimes: z.number(), overtimePct: z.number().nullable(), venueOvertimePct: z.number().nullable(),
  avgPointsFor: z.number().nullable(), avgPointsAgainst: z.number().nullable(),
});
const nflMatchupResponse = z.object({
  away: nflMatchupTeamSchema, home: nflMatchupTeamSchema,
  awayWinProbability: z.number().nullable(), homeWinProbability: z.number().nullable(),
  winnerTeam: z.string().nullable(), winnerEdgePoints: z.number().nullable(),
  firstScoreAwayProbability: z.number().nullable(), firstScoreHomeProbability: z.number().nullable(),
  firstScoreEdgeTeam: z.string().nullable(), firstScoreEdgePoints: z.number().nullable(),
  firstHalfUnder245Probability: z.number().nullable(), blowoutProbability: z.number().nullable(),
  bothTeams20Probability: z.number().nullable(), overtimeProbability: z.number().nullable(),
  headToHead: z.object({ games: z.number(), awayWins: z.number(), homeWins: z.number() }),
  fetchedAt: z.string(), sourceUrl: z.string(), sampleNote: z.string(),
});

const nflHotGameSchema = z.object({
  gameId: z.number(), week: z.number(), date: z.string(), opponent: z.string(),
  passYards: z.number(), passTds: z.number(), rushYards: z.number(), rushTds: z.number(),
  recYards: z.number(), recTds: z.number(), scrimmageYards: z.number(), totalTds: z.number(),
});
const nflHotPlayerSchema = z.object({
  playerId: z.number(), name: z.string(), team: z.string(), position: z.string(),
  tdStreak: z.number(), yardStreak: z.number(),
  lastThreeTds: z.number(), lastThreeYards: z.number(),
  games: z.array(nflHotGameSchema), heatScore: z.number(),
});
const nflHotStreaksResponse = z.object({
  fetchedAt: z.string(), sourceUrl: z.string(), windowStart: z.string(), windowEnd: z.string(),
  players: z.array(nflHotPlayerSchema),
});
const nflColdPlayerSchema = z.object({
  playerId: z.number(), name: z.string(), team: z.string(), position: z.string(),
  tdDrought: z.number(), lastThreeTds: z.number(), lastThreeYards: z.number(),
  games: z.array(nflHotGameSchema), coldScore: z.number(),
});
const nflColdStreaksResponse = z.object({
  fetchedAt: z.string(), sourceUrl: z.string(), windowStart: z.string(), windowEnd: z.string(),
  players: z.array(nflColdPlayerSchema), teams: z.array(coldTeamSchema),
});

const nflRosterPlayerSchema = z.object({
  id: z.number(), name: z.string(), jersey: z.string().nullable(), position: z.string(), group: z.string(),
  games: z.number().nullable(),
  passYards: z.number().nullable(), passTds: z.number().nullable(), interceptions: z.number().nullable(),
  rushYards: z.number().nullable(), rushTds: z.number().nullable(),
  receptions: z.number().nullable(), recYards: z.number().nullable(), recTds: z.number().nullable(),
});
const nflRosterResponse = z.object({
  team: z.string(), season: z.number(), fetchedAt: z.string(), sourceUrl: z.string(),
  players: z.array(nflRosterPlayerSchema), groups: z.record(z.string(), z.number()),
});

const nflGameLogRowSchema = z.object({
  gameId: z.number(), week: z.number(), gameDate: z.string(), opponent: z.string(), homeRoad: z.enum(["home", "away"]),
  result: z.string().nullable(), teamScore: z.number().nullable(), oppScore: z.number().nullable(),
  completions: z.number().nullable(), attempts: z.number().nullable(), passYards: z.number().nullable(),
  passTds: z.number().nullable(), interceptions: z.number().nullable(),
  rushAttempts: z.number().nullable(), rushYards: z.number().nullable(), rushTds: z.number().nullable(),
  receptions: z.number().nullable(), targets: z.number().nullable(), recYards: z.number().nullable(), recTds: z.number().nullable(),
});
const nflGameLogResponse = z.object({
  playerId: z.number(), team: z.string(), season: z.number(), fetchedAt: z.string(), sourceUrl: z.string(),
  games: z.array(nflGameLogRowSchema),
});

// ---------------------------------------------------------------------------
// Flip % v2 model engine (NFL + NBA; the NHL side keeps its existing model).
//
// modelWinPct blends three signals, all from keyless official feeds:
//   1. Pythagorean expectation from points for/against (exp 2.37 NFL, 13.91 NBA)
//   2. Last-5-games form (cached league-wide; see warmNflForm/warmNbaForm)
//   3. Regression toward .500 until 8 games are played
// Null when fewer than 2 games are logged. The form term is skipped when
// fewer than 3 games are logged (or the form cache is unavailable), in which
// case the regressed Pythagorean value stands alone. Always a model
// estimate — never presented as a sportsbook price.
// ---------------------------------------------------------------------------

async function pool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

function modelWinPct(opts: {
  pointsFor: number; pointsAgainst: number;
  wins: number; losses: number; ties?: number;
  exponent: number;
  form: { wins: number; games: number } | null;
}): number | null {
  const games = opts.wins + opts.losses + (opts.ties ?? 0);
  if (games < 2) return null;
  const pf = Math.max(0, opts.pointsFor);
  const pa = Math.max(0, opts.pointsAgainst);
  const pfExp = Math.pow(pf, opts.exponent);
  const paExp = Math.pow(pa, opts.exponent);
  const pythag = pfExp + paExp > 0 ? pfExp / (pfExp + paExp) : 0.5;
  const w = Math.min(games, 8);
  const blended = (pythag * w + 0.5 * (8 - w)) / 8;
  const f = opts.form;
  const formPct = f && f.games >= 3 && games >= 3 ? f.wins / f.games : null;
  const value = formPct === null ? blended : 0.7 * blended + 0.3 * formPct;
  return Math.round(value * 1000) / 1000;
}

type TeamForm = { wins: number; games: number };
const FORM_TTL_MS = 12 * 60 * 60 * 1000;

async function readLeagueForm(ctx: Ctx, sport: "nfl" | "nba"): Promise<Record<string, TeamForm> | null> {
  try {
    const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, `${sport}-team-form`)).limit(1);
    const row = rows[0];
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    const parsed = JSON.parse(row.payloadJson) as Record<string, TeamForm>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeLeagueForm(ctx: Ctx, sport: "nfl" | "nba", form: Record<string, TeamForm>): Promise<void> {
  const key = `${sport}-team-form`;
  await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, key));
  await ctx.db.insert(schema.nhlInsightCache).values({
    key, payloadJson: JSON.stringify(form),
    fetchedAt: new Date(), expiresAt: new Date(Date.now() + FORM_TTL_MS),
  });
}

// NFL form, derived efficiently: fetch each recent week's scoreboard once and
// attribute results to all 32 teams, instead of one schedule scan per team.
async function warmNflForm(ctx: Ctx): Promise<void> {
  const current = await fetchNflScoreboard();
  const weeks: number[] = [];
  for (let w = current.week; w >= Math.max(1, current.week - 6); w--) weeks.push(w);
  const boards = new Map<number, NflGame[]>();
  await pool(weeks, 3, async (w) => {
    boards.set(w, w === current.week ? current.games : (await fetchNflScoreboard(w)).games);
  });
  const form: Record<string, TeamForm> = {};
  for (const code of NFL_TEAM_CODES) {
    const recent: { date: string; won: boolean }[] = [];
    for (const w of weeks) {
      for (const g of boards.get(w) ?? []) {
        if (g.state !== "final") continue;
        const isAway = g.away.abbr === code;
        const isHome = g.home.abbr === code;
        if (!isAway && !isHome) continue;
        recent.push({ date: g.date, won: (isAway ? g.away : g.home).winner });
      }
    }
    recent.sort((a, b) => b.date.localeCompare(a.date));
    const sample = recent.slice(0, 5);
    form[code] = { wins: sample.filter((r) => r.won).length, games: sample.length };
  }
  await writeLeagueForm(ctx, "nfl", form);
}

// NBA form: one team-schedule fetch per club (30 keyless requests), each
// already sorted most-recent-first by the data client.
async function warmNbaForm(ctx: Ctx): Promise<void> {
  const form: Record<string, TeamForm> = {};
  await pool(NBA_TEAM_CODES, 5, async (code) => {
    try {
      const { games } = await fetchNbaTeamGames(code, 5);
      const sample = games.slice(0, 5);
      form[code] = { wins: sample.filter((g) => g.won).length, games: sample.length };
    } catch {
      // One club's form never breaks the league map.
    }
  });
  await writeLeagueForm(ctx, "nba", form);
}

// Stale-while-revalidate for the overview: use the cached form when fresh;
// otherwise fall back to the regressed Pythagorean value and refresh the
// cache in the background so the next load has form.
async function formForOverview(ctx: Ctx, sport: "nfl" | "nba"): Promise<Record<string, TeamForm> | null> {
  const form = await readLeagueForm(ctx, sport);
  if (!form) {
    (sport === "nfl" ? warmNflForm(ctx) : warmNbaForm(ctx)).catch(() => {});
  }
  return form;
}

async function loadNflOverview(week?: number, ctx?: Ctx): Promise<z.infer<typeof nflOverviewResponse>> {
  const board = await fetchNflScoreboard(week);
  const formMap = ctx ? await formForOverview(ctx, "nfl") : null;
  let standings: z.infer<typeof nflStandingSchema>[] = [];
  let standingsUrl = "";
  try {
    const data = await fetchNflStandings();
    standingsUrl = data.sourceUrl;
    standings = data.standings.map((s) => ({
      ...s,
      division: s.division || nflDivision(s.team),
      modelWinPct: modelWinPct({
        pointsFor: s.pointsFor, pointsAgainst: s.pointsAgainst,
        wins: s.wins, losses: s.losses, ties: s.ties, exponent: 2.37,
        form: formMap?.[s.team] ?? null,
      }),
    }));
  } catch { /* schedule still renders without standings */ }
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const games = board.games.map((g) => ({
    id: g.id, week: g.week, date: g.date.slice(0, 10), startsAt: g.date, state: g.state, detail: g.detail,
    shortName: g.shortName,
    away: { abbrev: g.away.abbr, name: g.away.name, score: g.away.score, winner: g.away.winner },
    home: { abbrev: g.home.abbr, name: g.home.name, score: g.home.score, winner: g.home.winner },
  }));
  return {
    week: board.week, weeks, season: board.season, fetchedAt: new Date().toISOString(),
    scheduleSourceUrl: `${ESPN_SITE_NFL}/scoreboard?week=${board.week}`, standingsSourceUrl: standingsUrl,
    games, standings,
  };
}

type NflPlayerGameStats = {
  completions: number | null; attempts: number | null; passYards: number | null; passTds: number | null; interceptions: number | null;
  rushAttempts: number | null; rushYards: number | null; rushTds: number | null;
  receptions: number | null; targets: number | null; recYards: number | null; recTds: number | null;
};
function parseStatNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function parseNflAthleteStats(categories: { category: string; athletes: { id: number; stats: Record<string, string> }[] }[], athleteId: number): NflPlayerGameStats {
  const out: NflPlayerGameStats = {
    completions: null, attempts: null, passYards: null, passTds: null, interceptions: null,
    rushAttempts: null, rushYards: null, rushTds: null,
    receptions: null, targets: null, recYards: null, recTds: null,
  };
  for (const cat of categories) {
    const row = cat.athletes.find((a) => a.id === athleteId);
    if (!row) continue;
    const s = row.stats;
    if (cat.category === "passing") {
      const comp = s["completions/passingAttempts"] ?? s["completions/completionAttempts"];
      if (comp && comp.includes("/")) {
        const [c, a] = comp.split("/");
        out.completions = parseStatNumber(c);
        out.attempts = parseStatNumber(a);
      }
      out.passYards = parseStatNumber(s["passingYards"]);
      out.passTds = parseStatNumber(s["passingTouchdowns"]);
      out.interceptions = parseStatNumber(s["interceptions"]);
    } else if (cat.category === "rushing") {
      out.rushAttempts = parseStatNumber(s["rushingAttempts"]);
      out.rushYards = parseStatNumber(s["rushingYards"]);
      out.rushTds = parseStatNumber(s["rushingTouchdowns"]);
    } else if (cat.category === "receiving") {
      out.receptions = parseStatNumber(s["receptions"]);
      out.targets = parseStatNumber(s["receivingTargets"]);
      out.recYards = parseStatNumber(s["receivingYards"]);
      out.recTds = parseStatNumber(s["receivingTouchdowns"]);
    }
  }
  return out;
}

type NflLoggedGame = {
  gameId: number; week: number; date: string; opponent: string; homeRoad: "home" | "away";
  teamScore: number; oppScore: number; won: boolean; stats: NflPlayerGameStats;
};
type NflTeamLogs = { players: { id: number; name: string; position: string; games: NflLoggedGame[] }[]; fetchedAt: string; sourceUrl: string };

// Per-team per-player game logs, built from ESPN game summaries and cached
// 24h. Powers the NFL roster aggregates, player files and (indirectly) the
// matchup first-score enrichment.
async function nflTeamPlayerLogs(ctx: Ctx, team: (typeof nflTeamCodes)[number]): Promise<NflTeamLogs> {
  const cacheKey = `nfl-team-logs:${team}`;
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
  const cached = cachedRows[0];
  if (cached && cached.expiresAt.getTime() > Date.now()) return JSON.parse(cached.payloadJson) as NflTeamLogs;

  const meta = nflTeamMeta(team);
  if (!meta) throw new Error(`Unknown NFL team ${team}`);
  const [roster, schedule] = await Promise.all([fetchNflRoster(team), fetchNflTeamGames(team, 18)]);
  const posById = new Map<number, string>();
  const nameById = new Map<number, string>();
  for (const p of roster.players) { posById.set(p.id, p.position); nameById.set(p.id, p.name); }

  const byPlayer = new Map<number, { id: number; name: string; position: string; games: NflLoggedGame[] }>();
  const sourceUrl = `${ESPN_SITE_NFL}/summary`;
  for (let i = 0; i < schedule.games.length; i += 4) {
    const batch = schedule.games.slice(i, i + 4);
    const summaries = await Promise.all(batch.map(async (g) => {
      try { return { game: g, summary: await fetchNflGameSummary(g.gameId) }; }
      catch { return { game: g, summary: null }; }
    }));
    for (const { game, summary } of summaries) {
      if (!summary) continue;
      const box = summary.teams.find((t) => t.abbr === team);
      if (!box) continue;
      const seen = new Set<number>();
      for (const cat of box.categories) {
        for (const ath of cat.athletes) {
          if (seen.has(ath.id)) continue;
          seen.add(ath.id);
          const stats = parseNflAthleteStats(box.categories, ath.id);
          const meaningful = stats.passYards !== null || stats.rushYards !== null || stats.recYards !== null;
          if (!meaningful) continue;
          const entry = byPlayer.get(ath.id) ?? { id: ath.id, name: nameById.get(ath.id) ?? ath.name, position: posById.get(ath.id) ?? "—", games: [] };
          entry.games.push({
            gameId: game.gameId, week: game.week, date: game.date.slice(0, 10), opponent: game.opponent,
            homeRoad: game.homeAway, teamScore: game.teamScore, oppScore: game.oppScore, won: game.won, stats,
          });
          byPlayer.set(ath.id, entry);
        }
      }
    }
  }
  const logs: NflTeamLogs = {
    players: Array.from(byPlayer.values()).map((p) => ({ ...p, games: p.games.sort((a, b) => b.date.localeCompare(a.date)) })),
    fetchedAt: new Date().toISOString(), sourceUrl,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
  await db.insert(schema.nhlInsightCache).values({ key: cacheKey, payloadJson: JSON.stringify(logs), fetchedAt: new Date(logs.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return logs;
}

async function loadNflRoster(ctx: Ctx, team: (typeof nflTeamCodes)[number]): Promise<z.infer<typeof nflRosterResponse>> {
  const [roster, logs] = await Promise.all([fetchNflRoster(team), nflTeamPlayerLogs(ctx, team).catch(() => null)]);
  const totalsById = new Map<number, { games: number; passYards: number; passTds: number; interceptions: number; rushYards: number; rushTds: number; receptions: number; recYards: number; recTds: number }>();
  if (logs) {
    for (const p of logs.players) {
      const t = { games: p.games.length, passYards: 0, passTds: 0, interceptions: 0, rushYards: 0, rushTds: 0, receptions: 0, recYards: 0, recTds: 0 };
      for (const g of p.games) {
        t.passYards += g.stats.passYards ?? 0; t.passTds += g.stats.passTds ?? 0; t.interceptions += g.stats.interceptions ?? 0;
        t.rushYards += g.stats.rushYards ?? 0; t.rushTds += g.stats.rushTds ?? 0;
        t.receptions += g.stats.receptions ?? 0; t.recYards += g.stats.recYards ?? 0; t.recTds += g.stats.recTds ?? 0;
      }
      totalsById.set(p.id, t);
    }
  }
  const players = roster.players
    .filter((p) => p.group === "offense" || p.group === "specialTeam")
    .map((p) => {
      const t = totalsById.get(p.id);
      const has = (v: number) => (t && (t.games > 0 || v > 0) ? v : null);
      return {
        id: p.id, name: p.name, jersey: p.jersey, position: p.position, group: p.group,
        games: t ? t.games : null,
        passYards: has(t?.passYards ?? 0), passTds: has(t?.passTds ?? 0), interceptions: has(t?.interceptions ?? 0),
        rushYards: has(t?.rushYards ?? 0), rushTds: has(t?.rushTds ?? 0),
        receptions: has(t?.receptions ?? 0), recYards: has(t?.recYards ?? 0), recTds: has(t?.recTds ?? 0),
      };
    })
    .sort((a, b) => (b.passYards ?? 0) + (b.rushYards ?? 0) + (b.recYards ?? 0) - ((a.passYards ?? 0) + (a.rushYards ?? 0) + (a.recYards ?? 0)));
  return { team, season: NFL_SEASON, fetchedAt: roster.fetchedAt, sourceUrl: roster.sourceUrl, players, groups: roster.groups };
}

async function loadNflPlayerGameLog(ctx: Ctx, team: (typeof nflTeamCodes)[number], playerId: number): Promise<z.infer<typeof nflGameLogResponse>> {
  const logs = await nflTeamPlayerLogs(ctx, team);
  const player = logs.players.find((p) => p.id === playerId);
  if (!player) throw new Error("No game log found for this player yet this season.");
  return {
    playerId, team, season: NFL_SEASON, fetchedAt: logs.fetchedAt, sourceUrl: logs.sourceUrl,
    games: player.games.map((g) => ({
      gameId: g.gameId, week: g.week, gameDate: g.date, opponent: g.opponent, homeRoad: g.homeRoad,
      result: g.won ? "W" : "L", teamScore: g.teamScore, oppScore: g.oppScore,
      completions: g.stats.completions, attempts: g.stats.attempts, passYards: g.stats.passYards,
      passTds: g.stats.passTds, interceptions: g.stats.interceptions,
      rushAttempts: g.stats.rushAttempts, rushYards: g.stats.rushYards, rushTds: g.stats.rushTds,
      receptions: g.stats.receptions, targets: g.stats.targets, recYards: g.stats.recYards, recTds: g.stats.recTds,
    })),
  };
}

function nflTeamMatchupStats(team: (typeof nflTeamCodes)[number], venue: "away" | "home", games: NflTeamGame[]): z.infer<typeof nflMatchupTeamSchema> {
  const venueGames = games.filter((g) => g.homeAway === venue);
  const wins = games.filter((g) => g.won).length;
  const venueWins = venueGames.filter((g) => g.won).length;
  const scored = games.filter((g) => g.firstScoringTeam !== null);
  const venueScored = venueGames.filter((g) => g.firstScoringTeam !== null);
  const firstScore = scored.filter((g) => g.firstScoringTeam === team).length;
  const venueFirstScore = venueScored.filter((g) => g.firstScoringTeam === team).length;
  const under = games.filter((g) => g.firstHalfFor + g.firstHalfAgainst <= 24).length;
  const venueUnder = venueGames.filter((g) => g.firstHalfFor + g.firstHalfAgainst <= 24).length;
  const blowouts = games.filter((g) => g.margin >= 14).length;
  const venueBlowouts = venueGames.filter((g) => g.margin >= 14).length;
  const both20 = games.filter((g) => g.teamScore >= 20 && g.oppScore >= 20).length;
  const venueBoth20 = venueGames.filter((g) => g.teamScore >= 20 && g.oppScore >= 20).length;
  const overtimes = games.filter((g) => g.overtime).length;
  const venueOvertimes = venueGames.filter((g) => g.overtime).length;
  const pct = (n: number, d: number) => d > 0 ? n / d : null;
  return {
    team, games: games.length,
    wins, winPct: pct(wins, games.length), venueGames: venueGames.length, venueWins, venueWinPct: pct(venueWins, venueGames.length),
    firstScoreGames: scored.length, firstScore, firstScorePct: pct(firstScore, scored.length),
    venueFirstScoreGames: venueScored.length, venueFirstScore, venueFirstScorePct: pct(venueFirstScore, venueScored.length),
    firstHalfUnder245: under, firstHalfUnder245Pct: pct(under, games.length), venueFirstHalfUnder245Pct: pct(venueUnder, venueGames.length),
    blowouts, blowoutPct: pct(blowouts, games.length), venueBlowoutPct: pct(venueBlowouts, venueGames.length),
    bothTeams20: both20, bothTeams20Pct: pct(both20, games.length), venueBothTeams20Pct: pct(venueBoth20, venueGames.length),
    overtimes, overtimePct: pct(overtimes, games.length), venueOvertimePct: pct(venueOvertimes, venueGames.length),
    avgPointsFor: games.length ? games.reduce((s, g) => s + g.teamScore, 0) / games.length : null,
    avgPointsAgainst: games.length ? games.reduce((s, g) => s + g.oppScore, 0) / games.length : null,
  };
}

async function loadNflMatchup(ctx: Ctx, awayTeam: (typeof nflTeamCodes)[number], homeTeam: (typeof nflTeamCodes)[number], force: boolean): Promise<z.infer<typeof nflMatchupResponse>> {
  const cacheKey = `nfl-matchup:${awayTeam}:${homeTeam}`;
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nflMatchupResponse.parse(JSON.parse(cached.payloadJson));

  const [awayData, homeData] = await Promise.all([fetchNflTeamGames(awayTeam, 8), fetchNflTeamGames(homeTeam, 8)]);
  const seen = new Map<number, NflTeamGame>();
  for (const g of [...awayData.games, ...homeData.games]) if (!seen.has(g.gameId)) seen.set(g.gameId, g);
  await enrichFirstScores(Array.from(seen.values()));

  const away = nflTeamMatchupStats(awayTeam, "away", awayData.games);
  const home = nflTeamMatchupStats(homeTeam, "home", homeData.games);
  // NFL samples are small (one game a week): trust venue splits at 3+ games.
  const venueBlend = (overall: number | null, venueRate: number | null, venueGames: number): number | null =>
    overall === null ? null : venueGames >= 3 && venueRate !== null ? overall * .4 + venueRate * .6 : overall;
  const mean = (a: number | null, b: number | null): number | null => a !== null && b !== null ? (a + b) / 2 : a ?? b;

  const awayWinForm = venueBlend(away.winPct, away.venueWinPct, away.venueGames);
  const homeWinForm = venueBlend(home.winPct, home.venueWinPct, home.venueGames);
  const awayWinRaw = awayWinForm !== null && homeWinForm !== null ? (awayWinForm + (1 - homeWinForm)) / 2 : null;
  const homeWinRaw = awayWinForm !== null && homeWinForm !== null ? (homeWinForm + (1 - awayWinForm)) / 2 : null;
  const winTotal = awayWinRaw !== null && homeWinRaw !== null ? awayWinRaw + homeWinRaw : null;
  const awayWinProbability = awayWinRaw !== null && winTotal !== null && winTotal > 0 ? awayWinRaw / winTotal : null;
  const homeWinProbability = homeWinRaw !== null && winTotal !== null && winTotal > 0 ? homeWinRaw / winTotal : null;
  const winnerTeam = awayWinProbability === null || homeWinProbability === null ? null : awayWinProbability >= homeWinProbability ? awayTeam : homeTeam;
  const winnerEdgePoints = awayWinProbability === null || homeWinProbability === null ? null : Math.abs(awayWinProbability - homeWinProbability) * 100;

  const awayFirstForm = venueBlend(away.firstScorePct, away.venueFirstScorePct, away.venueFirstScoreGames);
  const homeFirstForm = venueBlend(home.firstScorePct, home.venueFirstScorePct, home.venueFirstScoreGames);
  const awayFirstAllowed = home.firstScoreGames > 0 ? 1 - (home.firstScore / home.firstScoreGames) : null;
  const homeFirstAllowed = away.firstScoreGames > 0 ? 1 - (away.firstScore / away.firstScoreGames) : null;
  const awayFirstRaw = awayFirstForm !== null && awayFirstAllowed !== null ? (awayFirstForm + awayFirstAllowed) / 2 : null;
  const homeFirstRaw = homeFirstForm !== null && homeFirstAllowed !== null ? (homeFirstForm + homeFirstAllowed) / 2 : null;
  const firstTotal = awayFirstRaw !== null && homeFirstRaw !== null ? awayFirstRaw + homeFirstRaw : null;
  const firstScoreAwayProbability = awayFirstRaw !== null && firstTotal !== null && firstTotal > 0 ? awayFirstRaw / firstTotal : null;
  const firstScoreHomeProbability = homeFirstRaw !== null && firstTotal !== null && firstTotal > 0 ? homeFirstRaw / firstTotal : null;
  const firstScoreEdgeTeam = firstScoreAwayProbability === null || firstScoreHomeProbability === null ? null : firstScoreAwayProbability >= firstScoreHomeProbability ? awayTeam : homeTeam;
  const firstScoreEdgePoints = firstScoreAwayProbability === null || firstScoreHomeProbability === null ? null : Math.abs(firstScoreAwayProbability - firstScoreHomeProbability) * 100;

  const firstHalfUnder245Probability = mean(venueBlend(away.firstHalfUnder245Pct, away.venueFirstHalfUnder245Pct, away.venueGames), venueBlend(home.firstHalfUnder245Pct, home.venueFirstHalfUnder245Pct, home.venueGames));
  const blowoutProbability = mean(venueBlend(away.blowoutPct, away.venueBlowoutPct, away.venueGames), venueBlend(home.blowoutPct, home.venueBlowoutPct, home.venueGames));
  const bothTeams20Probability = mean(venueBlend(away.bothTeams20Pct, away.venueBothTeams20Pct, away.venueGames), venueBlend(home.bothTeams20Pct, home.venueBothTeams20Pct, home.venueGames));
  const overtimeProbability = mean(venueBlend(away.overtimePct, away.venueOvertimePct, away.venueGames), venueBlend(home.overtimePct, home.venueOvertimePct, home.venueGames));

  // Head-to-head from the two teams' game lists: games where they played each other.
  const h2h = awayData.games.filter((g) => g.opponent === homeTeam);
  const response: z.infer<typeof nflMatchupResponse> = {
    away, home, awayWinProbability, homeWinProbability, winnerTeam, winnerEdgePoints,
    firstScoreAwayProbability, firstScoreHomeProbability, firstScoreEdgeTeam, firstScoreEdgePoints,
    firstHalfUnder245Probability, blowoutProbability, bothTeams20Probability, overtimeProbability,
    headToHead: { games: h2h.length, awayWins: h2h.filter((g) => g.won).length, homeWins: h2h.filter((g) => !g.won).length },
    fetchedAt: new Date().toISOString(), sourceUrl: awayData.sourceUrl,
    sampleNote: `Last ${away.games} ${awayTeam} and ${home.games} ${homeTeam} completed regular-season games from the official ESPN scoreboard.`,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
  await db.insert(schema.nhlInsightCache).values({ key: cacheKey, payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) });
  return response;
}

type NflRecentGame = z.infer<typeof nflHotGameSchema>;
type NflPlayerAcc = { playerId: number; name: string; team: string; games: NflRecentGame[] };

async function collectNflRecentGames(): Promise<{ byPlayer: Map<number, NflPlayerAcc> }> {
  const current = await fetchNflScoreboard();
  const weeks = [current.week, current.week - 1, current.week - 2, current.week - 3].filter((w) => w >= 1);
  const gameIds = new Map<number, { week: number; date: string; away: string; home: string }>();
  for (const week of weeks) {
    const board = week === current.week ? current : await fetchNflScoreboard(week);
    for (const g of board.games) {
      if (g.state !== "final") continue;
      gameIds.set(g.id, { week: g.week, date: g.date.slice(0, 10), away: g.away.abbr, home: g.home.abbr });
    }
  }
  const byPlayer = new Map<number, NflPlayerAcc>();
  const ids = Array.from(gameIds.entries());
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const summaries = await Promise.all(batch.map(async ([id, meta]) => {
      try { return { id, meta, summary: await fetchNflGameSummary(id) }; }
      catch { return { id, meta, summary: null }; }
    }));
    for (const { id, meta, summary } of summaries) {
      if (!summary) continue;
      for (const teamBox of summary.teams) {
        const opponent = teamBox.abbr === meta.away ? meta.home : meta.away;
        const seen = new Set<number>();
        for (const cat of teamBox.categories) {
          for (const ath of cat.athletes) {
            if (seen.has(ath.id)) continue;
            seen.add(ath.id);
            const stats = parseNflAthleteStats(teamBox.categories, ath.id);
            const passYards = stats.passYards ?? 0; const passTds = stats.passTds ?? 0;
            const rushYards = stats.rushYards ?? 0; const rushTds = stats.rushTds ?? 0;
            const recYards = stats.recYards ?? 0; const recTds = stats.recTds ?? 0;
            const scrimmage = rushYards + recYards;
            const totalTds = passTds + rushTds + recTds;
            if (passYards === 0 && scrimmage === 0 && totalTds === 0) continue;
            const acc = byPlayer.get(ath.id) ?? { playerId: ath.id, name: ath.name, team: teamBox.abbr, games: [] };
            acc.games.push({ gameId: id, week: meta.week, date: meta.date, opponent, passYards, passTds, rushYards, rushTds, recYards, recTds, scrimmageYards: scrimmage, totalTds });
            byPlayer.set(ath.id, acc);
          }
        }
      }
    }
  }
  return { byPlayer };
}

async function fetchNflHotStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof nflHotStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nfl-hot-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nflHotStreaksResponse.parse(JSON.parse(cached.payloadJson));
  const { byPlayer } = await collectNflRecentGames();
  const players = Array.from(byPlayer.values()).flatMap((player) => {
    const recent = player.games.sort((a, b) => b.date.localeCompare(a.date) || b.week - a.week).slice(0, 3);
    if (recent.length < 2) return [];
    let tdStreak = 0;
    for (const g of recent) { if (g.totalTds <= 0) break; tdStreak += 1; }
    let yardStreak = 0;
    for (const g of recent) { if (g.scrimmageYards < 100 && g.passYards < 250) break; yardStreak += 1; }
    const lastThreeTds = recent.reduce((s, g) => s + g.totalTds, 0);
    const lastThreeYards = recent.reduce((s, g) => s + g.scrimmageYards + g.passYards, 0);
    const hot = tdStreak >= 2 || yardStreak >= 2 || lastThreeTds >= 4 || lastThreeYards >= 600;
    if (!hot) return [];
    const heatScore = tdStreak * 8 + yardStreak * 6 + lastThreeTds * 3 + lastThreeYards / 50;
    return [{ playerId: player.playerId, name: player.name, team: player.team, position: "—", tdStreak, yardStreak, lastThreeTds, lastThreeYards, games: recent, heatScore }];
  }).sort((a, b) => b.heatScore - a.heatScore);
  const response: z.infer<typeof nflHotStreaksResponse> = {
    fetchedAt: new Date().toISOString(), sourceUrl: `${ESPN_SITE_NFL}/scoreboard`,
    windowStart: `${NFL_SEASON}-09-01`, windowEnd: new Date().toISOString().slice(0, 10), players,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nfl-hot-streaks"));
  await db.insert(schema.nhlInsightCache).values({ key: "nfl-hot-streaks", payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return response;
}

async function fetchNflColdStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof nflColdStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nfl-cold-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nflColdStreaksResponse.parse(JSON.parse(cached.payloadJson));
  const { byPlayer } = await collectNflRecentGames();
  const players = Array.from(byPlayer.values()).flatMap((player) => {
    const recent = player.games.sort((a, b) => b.date.localeCompare(a.date) || b.week - a.week).slice(0, 3);
    if (recent.length < 2) return [];
    let tdDrought = 0;
    for (const g of recent) { if (g.totalTds > 0) break; tdDrought += 1; }
    const lastThreeTds = recent.reduce((sum, g) => sum + g.totalTds, 0);
    const lastThreeYards = recent.reduce((sum, g) => sum + g.scrimmageYards + g.passYards, 0);
    const lastThreePassYards = recent.reduce((sum, g) => sum + g.passYards, 0);
    // Only real contributors: need meaningful recent workload, not benchwarmers.
    const involved = lastThreeYards >= 120 || lastThreePassYards >= 400;
    const cold = involved && (tdDrought >= 2 || (recent.length >= 3 && lastThreeTds === 0 && lastThreeYards < 200));
    if (!cold) return [];
    const coldScore = tdDrought * 8 + Math.max(0, 300 - lastThreeYards) / 25 + (lastThreeTds === 0 ? 6 : 0);
    return [{ playerId: player.playerId, name: player.name, team: player.team, position: "—", tdDrought, lastThreeTds, lastThreeYards, games: recent, coldScore }];
  }).sort((a, b) => b.coldScore - a.coldScore);
  let teams: z.infer<typeof coldTeamSchema>[] = [];
  try {
    const { standings } = await fetchNflStandings();
    teams = standings.flatMap((row) => {
      const match = /^L(\d+)$/.exec(row.streak ?? "");
      const losses = match ? Number(match[1]) : 0;
      if (losses < 2) return [];
      return [{ team: row.team, name: row.name, streak: row.streak ?? `L${losses}`, losses, gamesPlayed: row.wins + row.losses + row.ties }];
    }).sort((a, b) => b.losses - a.losses);
  } catch { /* team slumps are best-effort */ }
  const response: z.infer<typeof nflColdStreaksResponse> = {
    fetchedAt: new Date().toISOString(), sourceUrl: `${ESPN_SITE_NFL}/scoreboard`,
    windowStart: `${NFL_SEASON}-09-01`, windowEnd: new Date().toISOString().slice(0, 10), players, teams,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nfl-cold-streaks"));
  await db.insert(schema.nhlInsightCache).values({ key: "nfl-cold-streaks", payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return response;
}

// ---------------------------------------------------------------------------
// NBA (ESPN keyless feeds). Mirrors the NFL insight sections: overview,
// matchup calculator, hot streaks, rosters and player game logs.
// ---------------------------------------------------------------------------

const ESPN_SITE_NBA = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const nbaGameSideSchema = z.object({ abbrev: z.string(), name: z.string(), score: z.number().nullable(), winner: z.boolean() });
const nbaGameSchema = z.object({
  id: z.number(), date: z.string(), startsAt: z.string(), state: z.string(), detail: z.string(),
  shortName: z.string(), away: nbaGameSideSchema, home: nbaGameSideSchema,
});
const nbaStandingSchema = z.object({
  team: z.string(), name: z.string(), conference: z.string(), division: z.string(),
  wins: z.number(), losses: z.number(),
  pointsFor: z.number(), pointsAgainst: z.number(),
  streak: z.string().nullable(), playoffSeed: z.number().nullable(),
  // Flip % v2: Pythagorean expectation blended with last-5 form, regressed
  // toward .500 early in the season. Null when the sample is too thin.
  // Always a model estimate, never a sportsbook price.
  modelWinPct: z.number().nullable(),
});
const nbaOverviewResponse = z.object({
  season: z.number(), fetchedAt: z.string(),
  scheduleSourceUrl: z.string(), standingsSourceUrl: z.string(),
  games: z.array(nbaGameSchema), standings: z.array(nbaStandingSchema),
});

const nbaMatchupTeamSchema = z.object({
  team: z.string(), games: z.number(),
  wins: z.number(), losses: z.number(), winPct: z.number().nullable(),
  venueGames: z.number(), venueWins: z.number(), venueWinPct: z.number().nullable(),
  seasonWins: z.number(), seasonLosses: z.number(), seasonWinPct: z.number().nullable(),
  firstBasketGames: z.number(), firstBasket: z.number(), firstBasketPct: z.number().nullable(),
  venueFirstBasketGames: z.number(), venueFirstBasket: z.number(), venueFirstBasketPct: z.number().nullable(),
  firstHalfOver115: z.number(), firstHalfOver115Pct: z.number().nullable(), venueFirstHalfOver115Pct: z.number().nullable(),
  blowouts: z.number(), blowoutPct: z.number().nullable(), venueBlowoutPct: z.number().nullable(),
  bothTeams110: z.number(), bothTeams110Pct: z.number().nullable(), venueBothTeams110Pct: z.number().nullable(),
  overtimes: z.number(), overtimePct: z.number().nullable(), venueOvertimePct: z.number().nullable(),
  avgPointsFor: z.number().nullable(), avgPointsAgainst: z.number().nullable(),
});
const nbaMatchupResponse = z.object({
  away: nbaMatchupTeamSchema, home: nbaMatchupTeamSchema,
  awayWinProbability: z.number().nullable(), homeWinProbability: z.number().nullable(),
  winnerTeam: z.string().nullable(), winnerEdgePoints: z.number().nullable(),
  firstBasketAwayProbability: z.number().nullable(), firstBasketHomeProbability: z.number().nullable(),
  firstBasketEdgeTeam: z.string().nullable(), firstBasketEdgePoints: z.number().nullable(),
  firstHalfOver115Probability: z.number().nullable(), blowoutProbability: z.number().nullable(),
  bothTeams110Probability: z.number().nullable(), overtimeProbability: z.number().nullable(),
  headToHead: z.object({ games: z.number(), awayWins: z.number(), homeWins: z.number() }),
  fetchedAt: z.string(), sourceUrl: z.string(), sampleNote: z.string(),
});

const nbaHotGameSchema = z.object({
  gameId: z.number(), date: z.string(), opponent: z.string(),
  points: z.number(), rebounds: z.number(), assists: z.number(),
  steals: z.number(), blocks: z.number(), turnovers: z.number(), minutes: z.number().nullable(),
  doubleDouble: z.boolean(),
});
const nbaHotPlayerSchema = z.object({
  playerId: z.number(), name: z.string(), team: z.string(), position: z.string(),
  pointStreak: z.number(), doubleDoubleStreak: z.number(),
  lastFivePoints: z.number(), lastFiveRebounds: z.number(), lastFiveAssists: z.number(),
  games: z.array(nbaHotGameSchema), heatScore: z.number(),
});
const nbaHotStreaksResponse = z.object({
  fetchedAt: z.string(), sourceUrl: z.string(), windowStart: z.string(), windowEnd: z.string(),
  players: z.array(nbaHotPlayerSchema),
});
const nbaColdPlayerSchema = z.object({
  playerId: z.number(), name: z.string(), team: z.string(), position: z.string(),
  scoringDrought: z.number(), lastFivePoints: z.number(), lastFiveMinutes: z.number().nullable(),
  games: z.array(nbaHotGameSchema), coldScore: z.number(),
});
const nbaColdStreaksResponse = z.object({
  fetchedAt: z.string(), sourceUrl: z.string(), windowStart: z.string(), windowEnd: z.string(),
  players: z.array(nbaColdPlayerSchema), teams: z.array(coldTeamSchema),
});

const nbaRosterPlayerSchema = z.object({
  id: z.number(), name: z.string(), jersey: z.string().nullable(), position: z.string(), group: z.string(),
  games: z.number().nullable(),
  points: z.number().nullable(), rebounds: z.number().nullable(), assists: z.number().nullable(),
  steals: z.number().nullable(), blocks: z.number().nullable(), turnovers: z.number().nullable(),
  minutes: z.number().nullable(),
});
const nbaRosterResponse = z.object({
  team: z.string(), season: z.number(), fetchedAt: z.string(), sourceUrl: z.string(),
  players: z.array(nbaRosterPlayerSchema), groups: z.record(z.string(), z.number()),
});

const nbaGameLogRowSchema = z.object({
  gameId: z.number(), gameDate: z.string(), opponent: z.string(), homeRoad: z.enum(["home", "away"]),
  result: z.string().nullable(), teamScore: z.number().nullable(), oppScore: z.number().nullable(),
  minutes: z.number().nullable(), points: z.number().nullable(), rebounds: z.number().nullable(),
  assists: z.number().nullable(), steals: z.number().nullable(), blocks: z.number().nullable(),
  turnovers: z.number().nullable(),
  fieldGoalsMade: z.number().nullable(), fieldGoalsAttempted: z.number().nullable(),
  threePointMade: z.number().nullable(), threePointAttempted: z.number().nullable(),
  freeThrowsMade: z.number().nullable(), freeThrowsAttempted: z.number().nullable(),
});
const nbaGameLogResponse = z.object({
  playerId: z.number(), team: z.string(), season: z.number(), fetchedAt: z.string(), sourceUrl: z.string(),
  games: z.array(nbaGameLogRowSchema),
});

async function loadNbaOverview(ctx?: Ctx): Promise<z.infer<typeof nbaOverviewResponse>> {
  const board = await fetchNbaScoreboard();
  const formMap = ctx ? await formForOverview(ctx, "nba") : null;
  let standings: z.infer<typeof nbaStandingSchema>[] = [];
  let standingsUrl = "";
  try {
    const data = await fetchNbaStandings();
    standingsUrl = data.sourceUrl;
    standings = data.standings.map((s) => ({
      ...s,
      modelWinPct: modelWinPct({
        pointsFor: s.pointsFor, pointsAgainst: s.pointsAgainst,
        wins: s.wins, losses: s.losses, exponent: 13.91,
        form: formMap?.[s.team] ?? null,
      }),
    }));
  } catch { /* schedule still renders without standings */ }
  const games = board.games.map((g) => ({
    id: g.id, date: g.date.slice(0, 10), startsAt: g.date, state: g.state, detail: g.detail,
    shortName: g.shortName,
    away: { abbrev: g.away.abbr, name: g.away.name, score: g.away.score, winner: g.away.winner },
    home: { abbrev: g.home.abbr, name: g.home.name, score: g.home.score, winner: g.home.winner },
  }));
  return {
    season: board.season, fetchedAt: new Date().toISOString(),
    scheduleSourceUrl: `${ESPN_SITE_NBA}/scoreboard`, standingsSourceUrl: standingsUrl,
    games, standings,
  };
}

type NbaPlayerGameStats = {
  minutes: number | null; points: number | null; rebounds: number | null; assists: number | null;
  steals: number | null; blocks: number | null; turnovers: number | null;
  fieldGoalsMade: number | null; fieldGoalsAttempted: number | null;
  threePointMade: number | null; threePointAttempted: number | null;
  freeThrowsMade: number | null; freeThrowsAttempted: number | null;
};
function parseNbaMinutes(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  if (raw.includes(":")) {
    const [m, s] = raw.split(":");
    const mins = Number(m);
    const secs = Number(s);
    if (!Number.isFinite(mins)) return null;
    return mins + (Number.isFinite(secs) ? secs / 60 : 0);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function parseNbaSplit(raw: string | undefined): [number | null, number | null] {
  if (!raw || !raw.includes("-")) return [null, null];
  const [made, att] = raw.split("-");
  const m = parseStatNumber(made);
  const a = parseStatNumber(att);
  return [m, a];
}
function parseNbaAthleteStats(categories: { keys: string[]; athletes: { id: number; stats: Record<string, string> }[] }[], athleteId: number): NbaPlayerGameStats {
  const out: NbaPlayerGameStats = {
    minutes: null, points: null, rebounds: null, assists: null,
    steals: null, blocks: null, turnovers: null,
    fieldGoalsMade: null, fieldGoalsAttempted: null,
    threePointMade: null, threePointAttempted: null,
    freeThrowsMade: null, freeThrowsAttempted: null,
  };
  for (const cat of categories) {
    const row = cat.athletes.find((a) => a.id === athleteId);
    if (!row) continue;
    const s = row.stats;
    if (s["points"] === undefined) continue; // not the main stat line
    out.minutes = parseNbaMinutes(s["minutes"]);
    out.points = parseStatNumber(s["points"]);
    out.rebounds = parseStatNumber(s["rebounds"]);
    out.assists = parseStatNumber(s["assists"]);
    out.steals = parseStatNumber(s["steals"]);
    out.blocks = parseStatNumber(s["blocks"]);
    out.turnovers = parseStatNumber(s["turnovers"]);
    const [fgm, fga] = parseNbaSplit(s["fieldGoalsMade-fieldGoalsAttempted"]);
    const [tpm, tpa] = parseNbaSplit(s["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]);
    const [ftm, fta] = parseNbaSplit(s["freeThrowsMade-freeThrowsAttempted"]);
    out.fieldGoalsMade = fgm; out.fieldGoalsAttempted = fga;
    out.threePointMade = tpm; out.threePointAttempted = tpa;
    out.freeThrowsMade = ftm; out.freeThrowsAttempted = fta;
    break;
  }
  return out;
}

type NbaLoggedGame = {
  gameId: number; date: string; opponent: string; homeRoad: "home" | "away";
  teamScore: number; oppScore: number; won: boolean; stats: NbaPlayerGameStats;
};
type NbaTeamLogs = { players: { id: number; name: string; position: string; games: NbaLoggedGame[] }[]; fetchedAt: string; sourceUrl: string };

// Per-team per-player game logs, built from ESPN game summaries and cached
// 24h. Powers the NBA roster aggregates, player files and likely scorers.
async function nbaTeamPlayerLogs(ctx: Ctx, team: (typeof nbaTeamCodes)[number]): Promise<NbaTeamLogs> {
  const cacheKey = `nba-team-logs:${team}`;
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
  const cached = cachedRows[0];
  if (cached && cached.expiresAt.getTime() > Date.now()) return JSON.parse(cached.payloadJson) as NbaTeamLogs;

  const meta = nbaTeamMeta(team);
  if (!meta) throw new Error(`Unknown NBA team ${team}`);
  const [roster, schedule] = await Promise.all([fetchNbaRoster(team), fetchNbaTeamGames(team, 12)]);
  const posById = new Map<number, string>();
  const nameById = new Map<number, string>();
  for (const p of roster.players) { posById.set(p.id, p.position); nameById.set(p.id, p.name); }

  const byPlayer = new Map<number, { id: number; name: string; position: string; games: NbaLoggedGame[] }>();
  const sourceUrl = `${ESPN_SITE_NBA}/summary`;
  for (let i = 0; i < schedule.games.length; i += 4) {
    const batch = schedule.games.slice(i, i + 4);
    const summaries = await Promise.all(batch.map(async (g) => {
      try { return { game: g, summary: await fetchNbaGameSummary(g.gameId) }; }
      catch { return { game: g, summary: null }; }
    }));
    for (const { game, summary } of summaries) {
      if (!summary) continue;
      const box = summary.teams.find((t) => t.abbr === team);
      if (!box) continue;
      const seen = new Set<number>();
      for (const cat of box.categories) {
        for (const ath of cat.athletes) {
          if (seen.has(ath.id)) continue;
          seen.add(ath.id);
          const stats = parseNbaAthleteStats(box.categories, ath.id);
          if (stats.points === null && stats.minutes === null) continue;
          const entry = byPlayer.get(ath.id) ?? { id: ath.id, name: nameById.get(ath.id) ?? ath.name, position: posById.get(ath.id) ?? "—", games: [] };
          entry.games.push({
            gameId: game.gameId, date: game.date.slice(0, 10), opponent: game.opponent,
            homeRoad: game.homeAway, teamScore: game.teamScore, oppScore: game.oppScore, won: game.won, stats,
          });
          byPlayer.set(ath.id, entry);
        }
      }
    }
  }
  const logs: NbaTeamLogs = {
    players: Array.from(byPlayer.values()).map((p) => ({ ...p, games: p.games.sort((a, b) => b.date.localeCompare(a.date)) })),
    fetchedAt: new Date().toISOString(), sourceUrl,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
  await db.insert(schema.nhlInsightCache).values({ key: cacheKey, payloadJson: JSON.stringify(logs), fetchedAt: new Date(logs.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return logs;
}

async function loadNbaRoster(ctx: Ctx, team: (typeof nbaTeamCodes)[number]): Promise<z.infer<typeof nbaRosterResponse>> {
  const [roster, logs] = await Promise.all([fetchNbaRoster(team), nbaTeamPlayerLogs(ctx, team).catch(() => null)]);
  const totalsById = new Map<number, { games: number; points: number; rebounds: number; assists: number; steals: number; blocks: number; turnovers: number; minutes: number }>();
  if (logs) {
    for (const p of logs.players) {
      const t = { games: p.games.length, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, minutes: 0 };
      for (const g of p.games) {
        t.points += g.stats.points ?? 0; t.rebounds += g.stats.rebounds ?? 0; t.assists += g.stats.assists ?? 0;
        t.steals += g.stats.steals ?? 0; t.blocks += g.stats.blocks ?? 0; t.turnovers += g.stats.turnovers ?? 0;
        t.minutes += g.stats.minutes ?? 0;
      }
      totalsById.set(p.id, t);
    }
  }
  const players = roster.players
    .map((p) => {
      const t = totalsById.get(p.id);
      const has = (v: number) => (t && t.games > 0 ? v : null);
      return {
        id: p.id, name: p.name, jersey: p.jersey, position: p.position, group: p.group,
        games: t ? t.games : null,
        points: has(t?.points ?? 0), rebounds: has(t?.rebounds ?? 0), assists: has(t?.assists ?? 0),
        steals: has(t?.steals ?? 0), blocks: has(t?.blocks ?? 0), turnovers: has(t?.turnovers ?? 0),
        minutes: t ? Math.round((t.minutes ?? 0) * 10) / 10 : null,
      };
    })
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  return { team, season: NBA_SEASON, fetchedAt: roster.fetchedAt, sourceUrl: roster.sourceUrl, players, groups: roster.groups };
}

async function loadNbaPlayerGameLog(ctx: Ctx, team: (typeof nbaTeamCodes)[number], playerId: number): Promise<z.infer<typeof nbaGameLogResponse>> {
  const logs = await nbaTeamPlayerLogs(ctx, team);
  const player = logs.players.find((p) => p.id === playerId);
  if (!player) throw new Error("No game log found for this player yet this season.");
  return {
    playerId, team, season: NBA_SEASON, fetchedAt: logs.fetchedAt, sourceUrl: logs.sourceUrl,
    games: player.games.map((g) => ({
      gameId: g.gameId, gameDate: g.date, opponent: g.opponent, homeRoad: g.homeRoad,
      result: g.won ? "W" : "L", teamScore: g.teamScore, oppScore: g.oppScore,
      minutes: g.stats.minutes, points: g.stats.points, rebounds: g.stats.rebounds,
      assists: g.stats.assists, steals: g.stats.steals, blocks: g.stats.blocks,
      turnovers: g.stats.turnovers,
      fieldGoalsMade: g.stats.fieldGoalsMade, fieldGoalsAttempted: g.stats.fieldGoalsAttempted,
      threePointMade: g.stats.threePointMade, threePointAttempted: g.stats.threePointAttempted,
      freeThrowsMade: g.stats.freeThrowsMade, freeThrowsAttempted: g.stats.freeThrowsAttempted,
    })),
  };
}

// ---------------------------------------------------------------------------
// SOCCER leg — two leagues (MLS + EPL) bundled under one "soccer" sport.
//
// Every action takes { league: "mls" | "epl" }. Draws are first-class: the
// model is a three-way Poisson goal model (home/draw/away), never binary.
// All data is keyless ESPN; only sportsbook odds touch the quota providers.
// ---------------------------------------------------------------------------

const soccerGameSideSchema = z.object({ abbrev: z.string(), name: z.string(), score: z.number().nullable(), winner: z.boolean() });
const soccerThreeWaySchema = z.object({ home: z.number(), draw: z.number(), away: z.number() });
const soccerGameSchema = z.object({
  id: z.number(), date: z.string(), startsAt: z.string(), state: z.string(), detail: z.string(),
  shortName: z.string(), away: soccerGameSideSchema, home: soccerGameSideSchema,
  // Model three-way for this fixture (Poisson goal model, regressed).
  // Null when either side's sample is too thin. Always a model estimate.
  modelThreeWay: soccerThreeWaySchema.nullable(),
});
const soccerStandingSchema = z.object({
  team: z.string(), name: z.string(),
  played: z.number(), wins: z.number(), draws: z.number(), losses: z.number(), points: z.number(),
  goalsFor: z.number(), goalsAgainst: z.number(), goalDifference: z.number(),
  streak: z.string().nullable(),
  // Regressed goals for/against per game — the model's team ratings.
  attackRating: z.number().nullable(), defenseRating: z.number().nullable(),
  // The club's three-way split vs a league-average opponent at a neutral
  // venue: a like-for-like "Flip %" for soccer. Null when thin.
  modelHome: z.number().nullable(), modelDraw: z.number().nullable(), modelAway: z.number().nullable(),
});
const soccerOverviewResponse = z.object({
  league: z.enum(soccerLeagues), season: z.number(), fetchedAt: z.string(),
  scheduleSourceUrl: z.string(), standingsSourceUrl: z.string(),
  games: z.array(soccerGameSchema), standings: z.array(soccerStandingSchema),
});

const SOCCER_STANDINGS_TTL_MS = 24 * 60 * 60 * 1000;
async function loadSoccerStandings(ctx: Ctx, league: SoccerLeagueParam): Promise<{ standings: SoccerStanding[]; fetchedAt: string; sourceUrl: string }> {
  const cacheKey = `soccer-standings-${league}`;
  try {
    const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
    const row = rows[0];
    if (row && row.expiresAt.getTime() > Date.now()) {
      return JSON.parse(row.payloadJson) as { standings: SoccerStanding[]; fetchedAt: string; sourceUrl: string };
    }
  } catch { /* fall through to live fetch */ }
  const teams = soccerTeams(league);
  // 50 keyless record requests at concurrency 8; one club never breaks it.
  const records = await pool(teams, 8, async (t) => {
    try { return await fetchSoccerTeamRecord(league, t.abbr); }
    catch { return null; }
  });
  const standings = records.filter((r): r is SoccerStanding => r !== null);
  standings.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  const payload = { standings, fetchedAt: new Date().toISOString(), sourceUrl: `${siteBasePublic(league)}/standings` };
  try {
    await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
    await ctx.db.insert(schema.nhlInsightCache).values({
      key: cacheKey, payloadJson: JSON.stringify(payload),
      fetchedAt: new Date(payload.fetchedAt), expiresAt: new Date(Date.now() + SOCCER_STANDINGS_TTL_MS),
    });
  } catch { /* cache is best-effort */ }
  return payload;
}
function siteBasePublic(league: SoccerLeagueParam): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${league === "mls" ? "usa.1" : "eng.1"}`;
}

// League scoring context for the Poisson model, derived from the standings.
function soccerLeagueContext(standings: SoccerStanding[]): { avgGoals: number; avgHome: number; avgAway: number } {
  let gf = 0, played = 0;
  for (const s of standings) { gf += s.goalsFor; played += s.played; }
  const avgGoals = played > 0 ? gf / played : 1.35;
  // Home/away split: home sides outscore away sides by ~35% across world
  // football; fixed factors keep the model honest about the assumption.
  return { avgGoals, avgHome: avgGoals * 1.175, avgAway: avgGoals * 0.825 };
}

function soccerRatings(s: SoccerStanding, avgGoals: number): { attack: number; defense: number } {
  return {
    attack: regressedRate(s.goalsFor, s.played, avgGoals),
    defense: regressedRate(s.goalsAgainst, s.played, avgGoals),
  };
}

async function loadSoccerOverview(ctx: Ctx, league: SoccerLeagueParam): Promise<z.infer<typeof soccerOverviewResponse>> {
  const board = await fetchSoccerScoreboard(league);
  let standings: SoccerStanding[] = [];
  try {
    const data = await loadSoccerStandings(ctx, league);
    standings = data.standings;
  } catch { /* schedule still renders without standings */ }
  const ratingsByTeam = new Map<string, { attack: number; defense: number }>();
  let leagueCtx = { avgGoals: 1.35, avgHome: 1.35 * 1.175, avgAway: 1.35 * 0.825 };
  if (standings.length >= 10) {
    leagueCtx = soccerLeagueContext(standings);
    for (const s of standings) ratingsByTeam.set(s.team, soccerRatings(s, leagueCtx.avgGoals));
  }
  const games = board.games.map((g) => {
    const homeR = ratingsByTeam.get(g.home.abbr);
    const awayR = ratingsByTeam.get(g.away.abbr);
    let modelThreeWay: z.infer<typeof soccerThreeWaySchema> | null = null;
    if (homeR && awayR) {
      const probs = soccerMatchProbabilities(homeR.attack, homeR.defense, awayR.attack, awayR.defense, leagueCtx.avgHome, leagueCtx.avgAway);
      modelThreeWay = { home: probs.home, draw: probs.draw, away: probs.away };
    }
    return {
      id: g.id, date: g.date.slice(0, 10), startsAt: g.date, state: g.state, detail: g.detail,
      shortName: g.shortName,
      away: { abbrev: g.away.abbr, name: g.away.name, score: g.away.score, winner: g.away.winner },
      home: { abbrev: g.home.abbr, name: g.home.name, score: g.home.score, winner: g.home.winner },
      modelThreeWay,
    };
  });
  const standingRows = standings.map((s) => {
    const r = soccerRatings(s, leagueCtx.avgGoals);
    // Three-way vs a league-average opponent at a neutral venue.
    const probs = soccerMatchProbabilities(r.attack, r.defense, leagueCtx.avgGoals, leagueCtx.avgGoals, leagueCtx.avgGoals, leagueCtx.avgGoals);
    const thin = s.played < 2;
    return {
      ...s,
      attackRating: thin ? null : Math.round(r.attack * 1000) / 1000,
      defenseRating: thin ? null : Math.round(r.defense * 1000) / 1000,
      modelHome: thin ? null : probs.home, modelDraw: thin ? null : probs.draw, modelAway: thin ? null : probs.away,
    };
  });
  return {
    league, season: board.season, fetchedAt: new Date().toISOString(),
    scheduleSourceUrl: `${siteBasePublic(league)}/scoreboard`,
    standingsSourceUrl: `${siteBasePublic(league)}/standings`,
    games, standings: standingRows,
  };
}

const soccerMatchupTeamSchema = z.object({
  team: z.string(), games: z.number(),
  wins: z.number(), draws: z.number(), losses: z.number(),
  venueGames: z.number(), venueWins: z.number(), venueDraws: z.number(), venueLosses: z.number(),
  goalsFor: z.number(), goalsAgainst: z.number(),
  avgGoalsFor: z.number().nullable(), avgGoalsAgainst: z.number().nullable(),
  venueGoalsFor: z.number(), venueGoalsAgainst: z.number(),
  cleanSheets: z.number(), failedToScore: z.number(),
  form: z.string().nullable(), // last-5 as e.g. "W D W L D"
});
const soccerMatchupResponse = z.object({
  league: z.enum(soccerLeagues),
  away: soccerMatchupTeamSchema, home: soccerMatchupTeamSchema,
  // Three-way model probabilities (Poisson goal model, regressed, venue-aware).
  homeWinProbability: z.number().nullable(), drawProbability: z.number().nullable(), awayWinProbability: z.number().nullable(),
  edgeTeam: z.string().nullable(), edgeProbability: z.number().nullable(),
  over25Probability: z.number().nullable(), bttsProbability: z.number().nullable(), margin3PlusProbability: z.number().nullable(),
  homeExpectedGoals: z.number().nullable(), awayExpectedGoals: z.number().nullable(),
  headToHead: z.object({ games: z.number(), homeWins: z.number(), draws: z.number(), awayWins: z.number() }),
  fetchedAt: z.string(), sourceUrl: z.string(), sampleNote: z.string(),
});

function soccerMatchupTeamStats(team: string, venue: "away" | "home", games: SoccerTeamGame[]): z.infer<typeof soccerMatchupTeamSchema> {
  const venueGames = games.filter((g) => g.homeAway === venue);
  const wins = games.filter((g) => g.result === "W").length;
  const draws = games.filter((g) => g.result === "D").length;
  const losses = games.filter((g) => g.result === "L").length;
  const venueWins = venueGames.filter((g) => g.result === "W").length;
  const venueDraws = venueGames.filter((g) => g.result === "D").length;
  const venueLosses = venueGames.filter((g) => g.result === "L").length;
  const goalsFor = games.reduce((s, g) => s + g.teamScore, 0);
  const goalsAgainst = games.reduce((s, g) => s + g.oppScore, 0);
  const venueGoalsFor = venueGames.reduce((s, g) => s + g.teamScore, 0);
  const venueGoalsAgainst = venueGames.reduce((s, g) => s + g.oppScore, 0);
  const form = games.slice(0, 5).map((g) => g.result).join(" ");
  return {
    team, games: games.length, wins, draws, losses,
    venueGames: venueGames.length, venueWins, venueDraws, venueLosses,
    goalsFor, goalsAgainst,
    avgGoalsFor: games.length ? Math.round((goalsFor / games.length) * 100) / 100 : null,
    avgGoalsAgainst: games.length ? Math.round((goalsAgainst / games.length) * 100) / 100 : null,
    venueGoalsFor, venueGoalsAgainst,
    cleanSheets: games.filter((g) => g.oppScore === 0).length,
    failedToScore: games.filter((g) => g.teamScore === 0).length,
    form: form || null,
  };
}

async function loadSoccerMatchup(ctx: Ctx, league: SoccerLeagueParam, awayTeam: string, homeTeam: string, force: boolean): Promise<z.infer<typeof soccerMatchupResponse>> {
  const cacheKey = `soccer-matchup:${league}:${awayTeam}:${homeTeam}`;
  const db = ctx.db;
  if (!force) {
    try {
      const rows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
      const row = rows[0];
      if (row && row.expiresAt.getTime() > Date.now()) return soccerMatchupResponse.parse(JSON.parse(row.payloadJson));
    } catch { /* fall through to live compute */ }
  }
  const [awayData, homeData, standingsData] = await Promise.all([
    fetchSoccerTeamGames(league, awayTeam, 30),
    fetchSoccerTeamGames(league, homeTeam, 30),
    loadSoccerStandings(ctx, league).catch(() => null),
  ]);
  // Form/venue stats use the last 12; head-to-head scans the full season.
  const awayRecent = { ...awayData, games: awayData.games.slice(0, 12) };
  const homeRecent = { ...homeData, games: homeData.games.slice(0, 12) };
  const away = soccerMatchupTeamStats(awayTeam, "away", awayRecent.games);
  const home = soccerMatchupTeamStats(homeTeam, "home", homeRecent.games);
  // Head-to-head from both clubs' recent schedules, deduped by game id.
  const h2hSeen = new Set<number>();
  let h2hGames = 0, h2hHomeWins = 0, h2hDraws = 0, h2hAwayWins = 0;
  for (const g of [...homeData.games, ...awayData.games]) {
    const involves =
      (g.opponent === awayTeam && homeData.games.includes(g)) ||
      (g.opponent === homeTeam && awayData.games.includes(g));
    if (!involves || h2hSeen.has(g.gameId)) continue;
    h2hSeen.add(g.gameId);
    h2hGames += 1;
    // Normalize to the current home/away perspective: g is from the
    // perspective of the team whose schedule it came from.
    const isHomeSchedule = homeData.games.includes(g);
    const homeScore = isHomeSchedule ? g.teamScore : g.oppScore;
    const awayScore = isHomeSchedule ? g.oppScore : g.teamScore;
    if (homeScore > awayScore) h2hHomeWins += 1;
    else if (homeScore === awayScore) h2hDraws += 1;
    else h2hAwayWins += 1;
  }
  // Model: regressed attack/defense ratings blended with venue scoring.
  let probs: ReturnType<typeof soccerMatchProbabilities> | null = null;
  let leagueCtx = { avgGoals: 1.35, avgHome: 1.35 * 1.175, avgAway: 1.35 * 0.825 };
  if (standingsData && standingsData.standings.length >= 10) {
    leagueCtx = soccerLeagueContext(standingsData.standings);
    const find = (t: string) => standingsData.standings.find((s) => s.team === t) ?? null;
    const hs = find(homeTeam);
    const as = find(awayTeam);
    if (hs && as && hs.played >= 2 && as.played >= 2) {
      const hr = soccerRatings(hs, leagueCtx.avgGoals);
      const ar = soccerRatings(as, leagueCtx.avgGoals);
      // Blend season ratings with venue scoring (60/40) when 3+ venue games.
      const venueBlend = (season: number, venueFor: number, venueAgainst: number, venueGames: number, isAttack: boolean) => {
        if (venueGames < 3) return season;
        const venueRate = isAttack ? venueFor / venueGames : venueAgainst / venueGames;
        return 0.6 * season + 0.4 * regressedRate(venueRate * venueGames, venueGames, leagueCtx.avgGoals);
      };
      const homeAttack = venueBlend(hr.attack, home.venueGoalsFor, home.venueGoalsAgainst, home.venueGames, true);
      const homeDefense = venueBlend(hr.defense, home.venueGoalsFor, home.venueGoalsAgainst, home.venueGames, false);
      const awayAttack = venueBlend(ar.attack, away.venueGoalsFor, away.venueGoalsAgainst, away.venueGames, true);
      const awayDefense = venueBlend(ar.defense, away.venueGoalsFor, away.venueGoalsAgainst, away.venueGames, false);
      probs = soccerMatchProbabilities(homeAttack, homeDefense, awayAttack, awayDefense, leagueCtx.avgHome, leagueCtx.avgAway);
    }
  }
  const p = probs ?? { home: 0, draw: 0, away: 0 };
  const edgeOptions: [string, number, string][] = [["home", p.home, homeTeam], ["draw", p.draw, "Draw"], ["away", p.away, awayTeam]];
  edgeOptions.sort((a, b) => b[1] - a[1]);
  const edge = probs ? edgeOptions[0]! : null;
  const response: z.infer<typeof soccerMatchupResponse> = {
    league, away, home,
    homeWinProbability: probs?.home ?? null, drawProbability: probs?.draw ?? null, awayWinProbability: probs?.away ?? null,
    edgeTeam: edge?.[2] === "Draw" ? null : edge?.[2] ?? null, edgeProbability: edge?.[1] ?? null,
    over25Probability: probs?.over25 ?? null, bttsProbability: probs?.btts ?? null, margin3PlusProbability: probs?.margin3Plus ?? null,
    homeExpectedGoals: probs?.homeXg ?? null, awayExpectedGoals: probs?.awayXg ?? null,
    headToHead: { games: h2hGames, homeWins: h2hHomeWins, draws: h2hDraws, awayWins: h2hAwayWins },
    fetchedAt: new Date().toISOString(), sourceUrl: siteBasePublic(league),
    sampleNote: "Model estimate from official scoring data — not a sportsbook price. Draws are modeled explicitly via a Poisson goal model.",
  };
  try {
    await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
    await db.insert(schema.nhlInsightCache).values({
      key: cacheKey, payloadJson: JSON.stringify(response),
      fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });
  } catch { /* cache is best-effort */ }
  return response;
}

const soccerStreakPlayerSchema = z.object({
  name: z.string(), team: z.string(), position: z.string().nullable(),
  goals: z.number(), games: z.number(), braces: z.number(),
});
const soccerHotStreaksResponse = z.object({
  league: z.enum(soccerLeagues), fetchedAt: z.string(), sourceUrl: z.string(),
  windowStart: z.string(), windowEnd: z.string(),
  players: z.array(soccerStreakPlayerSchema),
  teams: z.array(z.object({ team: z.string(), name: z.string(), streak: z.string(), points: z.number() })),
});
const soccerColdStreaksResponse = z.object({
  league: z.enum(soccerLeagues), fetchedAt: z.string(), sourceUrl: z.string(),
  windowStart: z.string(), windowEnd: z.string(),
  players: z.array(z.object({
    name: z.string(), team: z.string(), seasonGoals: z.number(), appearances: z.number(),
  })),
  teams: z.array(z.object({ team: z.string(), name: z.string(), streak: z.string(), points: z.number() })),
});

const SOCCER_STREAK_TTL_MS = 24 * 60 * 60 * 1000;
const STREAK_WINDOW_DAYS = 7;
function yyyymmdd(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

// Trailing-7-day completed games league-wide (bounded; one slate per day).
async function soccerStreakWindowGames(league: SoccerLeagueParam): Promise<{ games: SoccerGame[]; windowStart: string; windowEnd: string }> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const boards = await pool([7, 6, 5, 4, 3, 2, 1], 4, async (offset) => {
    try { return await fetchSoccerScoreboard(league, yyyymmdd(now - offset * dayMs)); }
    catch { return null; }
  });
  const seen = new Set<number>();
  const games: SoccerGame[] = [];
  for (const board of boards) {
    if (!board) continue;
    for (const g of board.games) {
      if (g.state !== "final" || seen.has(g.id)) continue;
      seen.add(g.id);
      games.push(g);
    }
  }
  return {
    games: games.slice(0, 40),
    windowStart: new Date(now - STREAK_WINDOW_DAYS * dayMs).toISOString().slice(0, 10),
    windowEnd: new Date(now - dayMs).toISOString().slice(0, 10),
  };
}

async function fetchSoccerHotStreaks(ctx: Ctx, league: SoccerLeagueParam, force: boolean): Promise<z.infer<typeof soccerHotStreaksResponse>> {
  const cacheKey = `soccer-hot-${league}`;
  if (!force) {
    try {
      const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
      const row = rows[0];
      if (row && row.expiresAt.getTime() > Date.now()) return soccerHotStreaksResponse.parse(JSON.parse(row.payloadJson));
    } catch { /* fall through to live compute */ }
  }
  const { games, windowStart, windowEnd } = await soccerStreakWindowGames(league);
  const summaries = await pool(games, 4, async (g) => {
    try { return await fetchSoccerGameSummary(league, g.id); }
    catch { return null; }
  });
  // goals per player across the window
  const byPlayer = new Map<string, { name: string; team: string; goals: number; gameIds: Set<number>; braces: number }>();
  const goalsByGame = new Map<number, Map<string, number>>();
  summaries.forEach((summary, i) => {
    if (!summary) return;
    const gameId = games[i]!.id;
    for (const goal of summary.goals) {
      const key = `${goal.teamAbbr}|${goal.scorer}`;
      const entry = byPlayer.get(key) ?? { name: goal.scorer, team: goal.teamAbbr, goals: 0, gameIds: new Set<number>(), braces: 0 };
      entry.goals += 1;
      entry.gameIds.add(gameId);
      byPlayer.set(key, entry);
      const gm = goalsByGame.get(gameId) ?? new Map<string, number>();
      gm.set(key, (gm.get(key) ?? 0) + 1);
      goalsByGame.set(gameId, gm);
    }
  });
  for (const gm of goalsByGame.values()) {
    for (const [key, n] of gm) {
      if (n >= 2) { const e = byPlayer.get(key); if (e) e.braces += 1; }
    }
  }
  const players = [...byPlayer.values()]
    .filter((p) => p.goals >= 2)
    .map((p) => ({ name: p.name, team: p.team, position: null, goals: p.goals, games: p.gameIds.size, braces: p.braces }))
    .sort((a, b) => b.goals - a.goals || b.braces - a.braces || a.name.localeCompare(b.name))
    .slice(0, 15);
  // In-form clubs: computed from the window's games (points, then GD).
  // The record endpoint's streak field is unreliable; this is transparent.
  const table = new Map<string, { team: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number }>();
  for (const g of games) {
    for (const [side, opp] of [["home", g.away], ["away", g.home]] as const) {
      const t = side === "home" ? g.home : g.away;
      const o = opp;
      if (t.score === null || o.score === null) continue;
      const row = table.get(t.abbr) ?? { team: t.abbr, name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      row.p += 1; row.gf += t.score; row.ga += o.score;
      if (t.score > o.score) row.w += 1;
      else if (t.score === o.score) row.d += 1;
      else row.l += 1;
      table.set(t.abbr, row);
    }
  }
  const formTeams: z.infer<typeof soccerHotStreaksResponse>["teams"] = [...table.values()]
    .filter((r) => r.p >= 2 && r.w >= 2)
    .sort((a, b) => (b.w * 3 + b.d) - (a.w * 3 + a.d) || (b.gf - b.ga) - (a.gf - a.ga))
    .slice(0, 8)
    .map((r) => ({ team: r.team, name: r.name, streak: `${r.w}W-${r.d}D-${r.l}L in window`, points: r.w * 3 + r.d }));
  const response: z.infer<typeof soccerHotStreaksResponse> = {
    league, fetchedAt: new Date().toISOString(), sourceUrl: siteBasePublic(league),
    windowStart, windowEnd, players, teams: formTeams,
  };
  try {
    await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
    await ctx.db.insert(schema.nhlInsightCache).values({
      key: cacheKey, payloadJson: JSON.stringify(response),
      fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + SOCCER_STREAK_TTL_MS),
    });
  } catch { /* cache is best-effort */ }
  return response;
}

async function fetchSoccerColdStreaks(ctx: Ctx, league: SoccerLeagueParam, force: boolean): Promise<z.infer<typeof soccerColdStreaksResponse>> {
  const cacheKey = `soccer-cold-${league}`;
  if (!force) {
    try {
      const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
      const row = rows[0];
      if (row && row.expiresAt.getTime() > Date.now()) return soccerColdStreaksResponse.parse(JSON.parse(row.payloadJson));
    } catch { /* fall through to live compute */ }
  }
  const { games, windowStart, windowEnd } = await soccerStreakWindowGames(league);
  const windowTeams = [...new Set(games.flatMap((g) => [g.home.abbr, g.away.abbr]))].slice(0, 14);
  // Proven scorers (3+ season goals) gone quiet in the window.
  const scorersInWindow = new Set<string>();
  const summaries = await pool(games.slice(0, 30), 4, async (g) => {
    try { return await fetchSoccerGameSummary(league, g.id); }
    catch { return null; }
  });
  for (const summary of summaries) {
    if (!summary) continue;
    for (const goal of summary.goals) scorersInWindow.add(`${goal.teamAbbr}|${goal.scorer}`);
  }
  const leaderLists = await pool(windowTeams, 4, async (team) => {
    try { return await fetchSoccerTeamLeaders(league, team); }
    catch { return null; }
  });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const scoredInWindow = (team: string, name: string): boolean => {
    const target = norm(name);
    for (const k of scorersInWindow) {
      const pipe = k.indexOf("|");
      if (pipe < 0) continue;
      if (k.slice(0, pipe) !== team) continue;
      if (norm(k.slice(pipe + 1)) === target) return true;
    }
    return false;
  };
  const players = leaderLists.flatMap((list) => {
    if (!list) return [];
    return list.leaders
      .filter((l) => l.goals >= 3 && l.appearances >= 2 && l.name)
      .filter((l) => !scoredInWindow(list.team, l.name ?? ""))
      .map((l) => ({ name: l.name ?? "Unknown", team: list.team, seasonGoals: l.goals, appearances: l.appearances }));
  }).sort((a, b) => b.seasonGoals - a.seasonGoals || a.name.localeCompare(b.name)).slice(0, 15);
  // Clubs gone cold: winless across 2+ games in the window.
  const table = new Map<string, { team: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number }>();
  for (const g of games) {
    for (const [side, opp] of [["home", g.away], ["away", g.home]] as const) {
      const t = side === "home" ? g.home : g.away;
      const o = opp;
      if (t.score === null || o.score === null) continue;
      const row = table.get(t.abbr) ?? { team: t.abbr, name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
      row.p += 1; row.gf += t.score; row.ga += o.score;
      if (t.score > o.score) row.w += 1;
      else if (t.score === o.score) row.d += 1;
      else row.l += 1;
      table.set(t.abbr, row);
    }
  }
  const coldTeams: z.infer<typeof soccerColdStreaksResponse>["teams"] = [...table.values()]
    .filter((r) => r.p >= 2 && r.w === 0)
    .sort((a, b) => (a.d - b.d) || (a.gf - a.ga) - (b.gf - b.ga))
    .slice(0, 8)
    .map((r) => ({ team: r.team, name: r.name, streak: `${r.l}L-${r.d}D winless in window`, points: r.d }));
  const response: z.infer<typeof soccerColdStreaksResponse> = {
    league, fetchedAt: new Date().toISOString(), sourceUrl: siteBasePublic(league),
    windowStart, windowEnd, players, teams: coldTeams,
  };
  try {
    await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
    await ctx.db.insert(schema.nhlInsightCache).values({
      key: cacheKey, payloadJson: JSON.stringify(response),
      fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + SOCCER_STREAK_TTL_MS),
    });
  } catch { /* cache is best-effort */ }
  return response;
}

const soccerRosterPlayerSchema = z.object({
  id: z.number(), name: z.string(), jersey: z.string().nullable(), position: z.string(),
  games: z.number().nullable(), goals: z.number().nullable(), assists: z.number().nullable(),
});
const soccerRosterResponse = z.object({
  league: z.enum(soccerLeagues), team: z.string(), season: z.number(),
  fetchedAt: z.string(), sourceUrl: z.string(),
  players: z.array(soccerRosterPlayerSchema),
});

async function loadSoccerRoster(ctx: Ctx, league: SoccerLeagueParam, team: string): Promise<z.infer<typeof soccerRosterResponse>> {
  const [roster, leaders] = await Promise.all([
    fetchSoccerRoster(league, team),
    fetchSoccerTeamLeaders(league, team).catch(() => null),
  ]);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const leaderByName = new Map<string, { goals: number; appearances: number }>();
  if (leaders) {
    for (const l of leaders.leaders) {
      if (l.name) leaderByName.set(norm(l.name), { goals: l.goals, appearances: l.appearances });
    }
  }
  void ctx;
  return {
    league, team, season: SOCCER_SEASON, fetchedAt: roster.fetchedAt, sourceUrl: roster.sourceUrl,
    players: roster.players.map((p) => {
      const hit = leaderByName.get(norm(p.name));
      return {
        id: p.id, name: p.name, jersey: p.jersey, position: p.position,
        games: hit?.appearances ?? null, goals: hit?.goals ?? null, assists: null,
      };
    }),
  };
}

const soccerGameLogRowSchema = z.object({
  gameId: z.number(), gameDate: z.string(), opponent: z.string(), homeRoad: z.enum(["home", "away"]),
  result: z.enum(["W", "D", "L"]), teamScore: z.number(), oppScore: z.number(),
  goals: z.number(), assists: z.number(), appearances: z.number(),
});
const soccerGameLogResponse = z.object({
  league: z.enum(soccerLeagues), playerId: z.number(), playerName: z.string().nullable(),
  team: z.string(), season: z.number(), fetchedAt: z.string(), sourceUrl: z.string(),
  games: z.array(soccerGameLogRowSchema),
});

async function loadSoccerPlayerGameLog(ctx: Ctx, league: SoccerLeagueParam, team: string, playerId: number): Promise<z.infer<typeof soccerGameLogResponse>> {
  const cacheKey = `soccer-gamelog:${league}:${team}:${playerId}`;
  if (true) {
    try {
      const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
      const row = rows[0];
      if (row && row.expiresAt.getTime() > Date.now()) return soccerGameLogResponse.parse(JSON.parse(row.payloadJson));
    } catch { /* fall through to live compute */ }
  }
  const [roster, schedule] = await Promise.all([
    fetchSoccerRoster(league, team).catch(() => null),
    fetchSoccerTeamGames(league, team, 12),
  ]);
  const rosterPlayer = roster?.players.find((p) => p.id === playerId) ?? null;
  const playerName = rosterPlayer?.name ?? null;
  const summaries = await pool(schedule.games, 4, async (g) => {
    try { return { game: g, summary: await fetchSoccerGameSummary(league, g.gameId) }; }
    catch { return { game: g, summary: null }; }
  });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const rows: z.infer<typeof soccerGameLogRowSchema>[] = [];
  for (const { game, summary } of summaries) {
    if (!summary) continue;
    const match = summary.players.find((p) =>
      p.athleteId === playerId || (playerName !== null && norm(p.name) === norm(playerName)));
    if (!match) continue;
    rows.push({
      gameId: game.gameId, gameDate: game.date, opponent: game.opponent, homeRoad: game.homeAway,
      result: game.result, teamScore: game.teamScore, oppScore: game.oppScore,
      // ESPN soccer summary stat keys: "totalGoals" and "goalAssists"
      // (verified 2026-10-11); fall back to generic keys if they change.
      goals: Math.trunc(match.stats["totalGoals"] ?? match.stats["goals"] ?? 0),
      assists: Math.trunc(match.stats["goalAssists"] ?? match.stats["assists"] ?? 0),
      appearances: Math.trunc(match.stats["appearances"] ?? 1),
    });
  }
  if (!rows.length && !playerName) throw new Error("No game log found for this player yet this season.");
  rows.sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
  const response: z.infer<typeof soccerGameLogResponse> = {
    league, playerId, playerName, team, season: SOCCER_SEASON,
    fetchedAt: new Date().toISOString(), sourceUrl: `${siteBasePublic(league)}/summary`,
    games: rows,
  };
  try {
    await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
    await ctx.db.insert(schema.nhlInsightCache).values({
      key: cacheKey, payloadJson: JSON.stringify(response),
      fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + SOCCER_STREAK_TTL_MS),
    });
  } catch { /* cache is best-effort */ }
  return response;
}

type NbaSeasonRec = { wins: number; losses: number } | null;
function nbaTeamMatchupStats(team: (typeof nbaTeamCodes)[number], venue: "away" | "home", games: NbaTeamGame[], season: NbaSeasonRec): z.infer<typeof nbaMatchupTeamSchema> {
  const venueGames = games.filter((g) => g.homeAway === venue);
  const wins = games.filter((g) => g.won).length;
  const losses = games.length - wins;
  const venueWins = venueGames.filter((g) => g.won).length;
  const seasonWins = season?.wins ?? 0;
  const seasonLosses = season?.losses ?? 0;
  const seasonGames = seasonWins + seasonLosses;
  const pct = (n: number, d: number) => d > 0 ? n / d : null;
  // Win probability base: the season record (falls back to recent form when
  // the season record is empty, e.g. preseason), venue-blended at 3+ games.
  const seasonWinPct = pct(seasonWins, seasonGames);
  const scored = games.filter((g) => g.firstScoringTeam !== null);
  const venueScored = venueGames.filter((g) => g.firstScoringTeam !== null);
  const firstBasket = scored.filter((g) => g.firstScoringTeam === team).length;
  const venueFirstBasket = venueScored.filter((g) => g.firstScoringTeam === team).length;
  const halfGames = games.filter((g) => g.firstHalfFor !== null && g.firstHalfAgainst !== null);
  const venueHalfGames = venueGames.filter((g) => g.firstHalfFor !== null && g.firstHalfAgainst !== null);
  const over115 = halfGames.filter((g) => (g.firstHalfFor ?? 0) + (g.firstHalfAgainst ?? 0) > 115).length;
  const venueOver115 = venueHalfGames.filter((g) => (g.firstHalfFor ?? 0) + (g.firstHalfAgainst ?? 0) > 115).length;
  const blowouts = games.filter((g) => g.margin >= 15).length;
  const venueBlowouts = venueGames.filter((g) => g.margin >= 15).length;
  const both110 = games.filter((g) => g.teamScore >= 110 && g.oppScore >= 110).length;
  const venueBoth110 = venueGames.filter((g) => g.teamScore >= 110 && g.oppScore >= 110).length;
  const otGames = games.filter((g) => g.overtime !== null);
  const venueOtGames = venueGames.filter((g) => g.overtime !== null);
  const overtimes = otGames.filter((g) => g.overtime === true).length;
  const venueOvertimes = venueOtGames.filter((g) => g.overtime === true).length;
  return {
    team, games: games.length,
    wins, losses, winPct: pct(wins, games.length),
    venueGames: venueGames.length, venueWins, venueWinPct: pct(venueWins, venueGames.length),
    seasonWins, seasonLosses, seasonWinPct,
    firstBasketGames: scored.length, firstBasket, firstBasketPct: pct(firstBasket, scored.length),
    venueFirstBasketGames: venueScored.length, venueFirstBasket, venueFirstBasketPct: pct(venueFirstBasket, venueScored.length),
    firstHalfOver115: over115, firstHalfOver115Pct: pct(over115, halfGames.length), venueFirstHalfOver115Pct: pct(venueOver115, venueHalfGames.length),
    blowouts, blowoutPct: pct(blowouts, games.length), venueBlowoutPct: pct(venueBlowouts, venueGames.length),
    bothTeams110: both110, bothTeams110Pct: pct(both110, games.length), venueBothTeams110Pct: pct(venueBoth110, venueGames.length),
    overtimes, overtimePct: pct(overtimes, otGames.length), venueOvertimePct: pct(venueOvertimes, venueOtGames.length),
    avgPointsFor: games.length ? games.reduce((s, g) => s + g.teamScore, 0) / games.length : null,
    avgPointsAgainst: games.length ? games.reduce((s, g) => s + g.oppScore, 0) / games.length : null,
  };
}

async function loadNbaMatchup(ctx: Ctx, awayTeam: (typeof nbaTeamCodes)[number], homeTeam: (typeof nbaTeamCodes)[number], force: boolean): Promise<z.infer<typeof nbaMatchupResponse>> {
  const cacheKey = `nba-matchup:${awayTeam}:${homeTeam}`;
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nbaMatchupResponse.parse(JSON.parse(cached.payloadJson));

  const [awayData, homeData, standingsData] = await Promise.all([
    fetchNbaTeamGames(awayTeam, 8),
    fetchNbaTeamGames(homeTeam, 8),
    fetchNbaStandings().catch(() => null),
  ]);
  const seen = new Map<number, NbaTeamGame>();
  for (const g of [...awayData.games, ...homeData.games]) if (!seen.has(g.gameId)) seen.set(g.gameId, g);
  await enrichNbaGameDetails(Array.from(seen.values()));

  const seasonRec = (team: string): NbaSeasonRec => {
    const row = standingsData?.standings.find((s) => s.team === team);
    return row ? { wins: row.wins, losses: row.losses } : null;
  };
  const away = nbaTeamMatchupStats(awayTeam, "away", awayData.games, seasonRec(awayTeam));
  const home = nbaTeamMatchupStats(homeTeam, "home", homeData.games, seasonRec(homeTeam));
  // Trust venue splits at 3+ games; otherwise lean on the season record.
  const venueBlend = (overall: number | null, venueRate: number | null, venueGames: number): number | null =>
    overall === null ? null : venueGames >= 3 && venueRate !== null ? overall * .4 + venueRate * .6 : overall;
  const mean = (a: number | null, b: number | null): number | null => a !== null && b !== null ? (a + b) / 2 : a ?? b;
  const baseWin = (t: z.infer<typeof nbaMatchupTeamSchema>) => t.seasonWinPct ?? t.winPct;

  const awayWinForm = venueBlend(baseWin(away), away.venueWinPct, away.venueGames);
  const homeWinForm = venueBlend(baseWin(home), home.venueWinPct, home.venueGames);
  const awayWinRaw = awayWinForm !== null && homeWinForm !== null ? (awayWinForm + (1 - homeWinForm)) / 2 : null;
  const homeWinRaw = awayWinForm !== null && homeWinForm !== null ? (homeWinForm + (1 - awayWinForm)) / 2 : null;
  const winTotal = awayWinRaw !== null && homeWinRaw !== null ? awayWinRaw + homeWinRaw : null;
  const awayWinProbability = awayWinRaw !== null && winTotal !== null && winTotal > 0 ? awayWinRaw / winTotal : null;
  const homeWinProbability = homeWinRaw !== null && winTotal !== null && winTotal > 0 ? homeWinRaw / winTotal : null;
  const winnerTeam = awayWinProbability === null || homeWinProbability === null ? null : awayWinProbability >= homeWinProbability ? awayTeam : homeTeam;
  const winnerEdgePoints = awayWinProbability === null || homeWinProbability === null ? null : Math.abs(awayWinProbability - homeWinProbability) * 100;

  const awayFirstForm = venueBlend(away.firstBasketPct, away.venueFirstBasketPct, away.venueFirstBasketGames);
  const homeFirstForm = venueBlend(home.firstBasketPct, home.venueFirstBasketPct, home.venueFirstBasketGames);
  const awayFirstAllowed = home.firstBasketGames > 0 ? 1 - (home.firstBasket / home.firstBasketGames) : null;
  const homeFirstAllowed = away.firstBasketGames > 0 ? 1 - (away.firstBasket / away.firstBasketGames) : null;
  const awayFirstRaw = awayFirstForm !== null && awayFirstAllowed !== null ? (awayFirstForm + awayFirstAllowed) / 2 : null;
  const homeFirstRaw = homeFirstForm !== null && homeFirstAllowed !== null ? (homeFirstForm + homeFirstAllowed) / 2 : null;
  const firstTotal = awayFirstRaw !== null && homeFirstRaw !== null ? awayFirstRaw + homeFirstRaw : null;
  const firstBasketAwayProbability = awayFirstRaw !== null && firstTotal !== null && firstTotal > 0 ? awayFirstRaw / firstTotal : null;
  const firstBasketHomeProbability = homeFirstRaw !== null && firstTotal !== null && firstTotal > 0 ? homeFirstRaw / firstTotal : null;
  const firstBasketEdgeTeam = firstBasketAwayProbability === null || firstBasketHomeProbability === null ? null : firstBasketAwayProbability >= firstBasketHomeProbability ? awayTeam : homeTeam;
  const firstBasketEdgePoints = firstBasketAwayProbability === null || firstBasketHomeProbability === null ? null : Math.abs(firstBasketAwayProbability - firstBasketHomeProbability) * 100;

  const firstHalfOver115Probability = mean(venueBlend(away.firstHalfOver115Pct, away.venueFirstHalfOver115Pct, away.venueGames), venueBlend(home.firstHalfOver115Pct, home.venueFirstHalfOver115Pct, home.venueGames));
  const blowoutProbability = mean(venueBlend(away.blowoutPct, away.venueBlowoutPct, away.venueGames), venueBlend(home.blowoutPct, home.venueBlowoutPct, home.venueGames));
  const bothTeams110Probability = mean(venueBlend(away.bothTeams110Pct, away.venueBothTeams110Pct, away.venueGames), venueBlend(home.bothTeams110Pct, home.venueBothTeams110Pct, home.venueGames));
  const overtimeProbability = mean(venueBlend(away.overtimePct, away.venueOvertimePct, away.venueGames), venueBlend(home.overtimePct, home.venueOvertimePct, home.venueGames));

  const h2h = awayData.games.filter((g) => g.opponent === homeTeam);
  const seasonLabel = awayData.seasonLabel || homeData.seasonLabel;
  const response: z.infer<typeof nbaMatchupResponse> = {
    away, home, awayWinProbability, homeWinProbability, winnerTeam, winnerEdgePoints,
    firstBasketAwayProbability, firstBasketHomeProbability, firstBasketEdgeTeam, firstBasketEdgePoints,
    firstHalfOver115Probability, blowoutProbability, bothTeams110Probability, overtimeProbability,
    headToHead: { games: h2h.length, awayWins: h2h.filter((g) => g.won).length, homeWins: h2h.filter((g) => !g.won).length },
    fetchedAt: new Date().toISOString(), sourceUrl: awayData.sourceUrl,
    sampleNote: `Last ${away.games} ${awayTeam} and ${home.games} ${homeTeam} completed ${seasonLabel} games from the official ESPN scoreboard. Win probabilities start from season records, venue-blended. All figures are model estimates.`,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
  await db.insert(schema.nhlInsightCache).values({ key: cacheKey, payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) });
  return response;
}

type NbaRecentGame = z.infer<typeof nbaHotGameSchema>;
type NbaPlayerAcc = { playerId: number; name: string; team: string; position: string; games: NbaRecentGame[] };

function nbaDateKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function collectNbaRecentGames(): Promise<{ byPlayer: Map<number, NbaPlayerAcc> }> {
  // Scan the last 7 days of scoreboards (one request per day), then pull box
  // scores for the most recent finals. Capped so one refresh stays bounded.
  const gameIds = new Map<number, { date: string; away: string; home: string }>();
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    try {
      const board = await fetchNbaScoreboard(nbaDateKey(daysAgo));
      for (const g of board.games) {
        if (g.state !== "final") continue;
        gameIds.set(g.id, { date: g.date.slice(0, 10), away: g.away.abbr, home: g.home.abbr });
      }
    } catch { /* a bad day never kills the scan */ }
  }
  const ids = Array.from(gameIds.entries())
    .sort((a, b) => b[1].date.localeCompare(a[1].date))
    .slice(0, 24);
  const byPlayer = new Map<number, NbaPlayerAcc>();
  for (let i = 0; i < ids.length; i += 6) {
    const batch = ids.slice(i, i + 6);
    const summaries = await Promise.all(batch.map(async ([id, meta]) => {
      try { return { id, meta, summary: await fetchNbaGameSummary(id) }; }
      catch { return { id, meta, summary: null }; }
    }));
    for (const { id, meta, summary } of summaries) {
      if (!summary) continue;
      for (const teamBox of summary.teams) {
        const opponent = teamBox.abbr === meta.away ? meta.home : meta.away;
        const seen = new Set<number>();
        for (const cat of teamBox.categories) {
          for (const ath of cat.athletes) {
            if (seen.has(ath.id)) continue;
            seen.add(ath.id);
            const stats = parseNbaAthleteStats(teamBox.categories, ath.id);
            const points = stats.points ?? 0;
            if (points === 0 && (stats.minutes ?? 0) === 0) continue;
            const rebounds = stats.rebounds ?? 0;
            const assists = stats.assists ?? 0;
            const doubleDouble = points >= 10 && (rebounds >= 10 || assists >= 10);
            const acc: NbaPlayerAcc = byPlayer.get(ath.id) ?? { playerId: ath.id, name: ath.name, team: teamBox.abbr, position: "—", games: [] };
            acc.games.push({
              gameId: id, date: meta.date, opponent,
              points, rebounds, assists,
              steals: stats.steals ?? 0, blocks: stats.blocks ?? 0, turnovers: stats.turnovers ?? 0,
              minutes: stats.minutes, doubleDouble,
            });
            byPlayer.set(ath.id, acc);
          }
        }
      }
    }
  }
  return { byPlayer };
}

async function fetchNbaHotStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof nbaHotStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nba-hot-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nbaHotStreaksResponse.parse(JSON.parse(cached.payloadJson));
  const { byPlayer } = await collectNbaRecentGames();
  const players = Array.from(byPlayer.values()).flatMap((player) => {
    const recent = player.games.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    if (recent.length < 2) return [];
    let pointStreak = 0;
    for (const g of recent) { if (g.points < 15) break; pointStreak += 1; }
    let doubleDoubleStreak = 0;
    for (const g of recent) { if (!g.doubleDouble) break; doubleDoubleStreak += 1; }
    const lastFivePoints = recent.reduce((s, g) => s + g.points, 0);
    const lastFiveRebounds = recent.reduce((s, g) => s + g.rebounds, 0);
    const lastFiveAssists = recent.reduce((s, g) => s + g.assists, 0);
    const hot = pointStreak >= 2 || doubleDoubleStreak >= 2 || lastFivePoints >= 125;
    if (!hot) return [];
    const heatScore = pointStreak * 8 + doubleDoubleStreak * 10 + lastFivePoints / 10;
    return [{ playerId: player.playerId, name: player.name, team: player.team, position: player.position, pointStreak, doubleDoubleStreak, lastFivePoints, lastFiveRebounds, lastFiveAssists, games: recent, heatScore }];
  }).sort((a, b) => b.heatScore - a.heatScore);
  const response: z.infer<typeof nbaHotStreaksResponse> = {
    fetchedAt: new Date().toISOString(), sourceUrl: `${ESPN_SITE_NBA}/scoreboard`,
    windowStart: nbaDateKey(7).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), windowEnd: new Date().toISOString().slice(0, 10), players,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nba-hot-streaks"));
  await db.insert(schema.nhlInsightCache).values({ key: "nba-hot-streaks", payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return response;
}

async function fetchNbaColdStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof nbaColdStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nba-cold-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nbaColdStreaksResponse.parse(JSON.parse(cached.payloadJson));
  const { byPlayer } = await collectNbaRecentGames();
  const players = Array.from(byPlayer.values()).flatMap((player) => {
    const recent = player.games.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    if (recent.length < 3) return [];
    let scoringDrought = 0;
    for (const g of recent) { if (g.points >= 10) break; scoringDrought += 1; }
    const lastFivePoints = recent.reduce((sum, g) => sum + g.points, 0);
    const minutes = recent.map((g) => g.minutes ?? 0);
    const avgMinutes = minutes.reduce((s, m) => s + m, 0) / minutes.length;
    const lastFiveMinutes = minutes.reduce((s, m) => s + m, 0);
    // Only real rotation players: need meaningful recent minutes, not deep bench.
    const involved = avgMinutes >= 20;
    const cold = involved && (scoringDrought >= 2 || lastFivePoints < 50);
    if (!cold) return [];
    const coldScore = scoringDrought * 8 + Math.max(0, 75 - lastFivePoints) / 5 + (lastFivePoints < 50 ? 6 : 0);
    return [{ playerId: player.playerId, name: player.name, team: player.team, position: player.position, scoringDrought, lastFivePoints, lastFiveMinutes: Math.round(lastFiveMinutes * 10) / 10, games: recent, coldScore }];
  }).sort((a, b) => b.coldScore - a.coldScore);
  let teams: z.infer<typeof coldTeamSchema>[] = [];
  try {
    const { standings } = await fetchNbaStandings();
    teams = standings.flatMap((row) => {
      const match = /^L(\d+)$/.exec(row.streak ?? "");
      const losses = match ? Number(match[1]) : 0;
      if (losses < 2) return [];
      return [{ team: row.team, name: row.name, streak: row.streak ?? `L${losses}`, losses, gamesPlayed: row.wins + row.losses }];
    }).sort((a, b) => b.losses - a.losses);
  } catch { /* team slumps are best-effort */ }
  const response: z.infer<typeof nbaColdStreaksResponse> = {
    fetchedAt: new Date().toISOString(), sourceUrl: `${ESPN_SITE_NBA}/scoreboard`,
    windowStart: nbaDateKey(7).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), windowEnd: new Date().toISOString().slice(0, 10), players, teams,
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nba-cold-streaks"));
  await db.insert(schema.nhlInsightCache).values({ key: "nba-cold-streaks", payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return response;
}

const likelyScorerSchema = z.object({
  name: z.string(),
  team: z.string(),
  stat: z.number(),
  games: z.number(),
  rate: z.number(),
});
const likelyScorersResponse = z.object({
  sport: z.enum(sports),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  teams: z.record(z.string(), z.array(likelyScorerSchema)),
});
type ClubStatSkater = StatPlayer & { firstName?: unknown; lastName?: unknown };

async function fetchLikelyScorers(ctx: Ctx, sport: (typeof sports)[number], force: boolean, league?: SoccerLeagueParam): Promise<z.infer<typeof likelyScorersResponse>> {
  const db = ctx.db;
  const key = sport === "soccer" ? `likely-scorers-soccer-${league ?? "mls"}` : `likely-scorers-${sport}`;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, key)).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return likelyScorersResponse.parse(JSON.parse(cached.payloadJson));
  const teams: Record<string, z.infer<typeof likelyScorerSchema>[]> = {};
  if (sport === "nhl") {
    const codes = [...teamCodes];
    for (let index = 0; index < codes.length; index += 8) {
      const batch = codes.slice(index, index + 8);
      const rows = await Promise.all(batch.map(async (team) => {
        try {
          const response = await fetch(`${NHL_API}/club-stats/${team}/${NHL_SEASON}/2`, { headers: { Accept: "application/json" } });
          if (!response.ok) return null;
          const payload = await response.json() as { skaters?: ClubStatSkater[] };
          const skaters = Array.isArray(payload.skaters) ? payload.skaters : [];
          const ranked = skaters.flatMap((skater) => {
            const goals = num(skater.goals) ?? 0;
            const games = num(skater.gamesPlayed) ?? 0;
            const name = `${localized(skater.firstName)} ${localized(skater.lastName)}`.trim();
            if (goals <= 0 || games < 2 || !name) return [];
            return [{ name, team, stat: goals, games, rate: goals / games }];
          }).sort((a, b) => b.rate - a.rate || b.stat - a.stat || a.name.localeCompare(b.name)).slice(0, 4);
          return { team, ranked };
        } catch { return null; }
      }));
      for (const row of rows) if (row && row.ranked.length > 0) teams[row.team] = row.ranked;
    }
  } else if (sport === "nfl") {
    const codes = [...nflTeamCodes];
    for (let index = 0; index < codes.length; index += 4) {
      const batch = codes.slice(index, index + 4);
      const rows = await Promise.all(batch.map(async (team) => {
        try {
          const logs = await nflTeamPlayerLogs(ctx, team);
          const ranked = logs.players.flatMap((player) => {
            let touchdowns = 0;
            for (const game of player.games) touchdowns += (game.stats.rushTds ?? 0) + (game.stats.recTds ?? 0);
            const games = player.games.length;
            if (touchdowns <= 0 || games < 2 || !player.name) return [];
            return [{ name: player.name, team, stat: touchdowns, games, rate: touchdowns / games }];
          }).sort((a, b) => b.rate - a.rate || b.stat - a.stat || a.name.localeCompare(b.name)).slice(0, 4);
          return { team, ranked };
        } catch { return null; }
      }));
      for (const row of rows) if (row && row.ranked.length > 0) teams[row.team] = row.ranked;
    }
  } else if (sport === "nba") {
    // NBA: top scorers by points per game (min 2 GP) from official boxscores.
    const codes = [...nbaTeamCodes];
    for (let index = 0; index < codes.length; index += 4) {
      const batch = codes.slice(index, index + 4);
      const rows = await Promise.all(batch.map(async (team) => {
        try {
          const logs = await nbaTeamPlayerLogs(ctx, team);
          const ranked = logs.players.flatMap((player) => {
            let points = 0;
            for (const game of player.games) points += game.stats.points ?? 0;
            const games = player.games.length;
            if (points <= 0 || games < 2 || !player.name) return [];
            return [{ name: player.name, team, stat: points, games, rate: points / games }];
          }).sort((a, b) => b.rate - a.rate || b.stat - a.stat || a.name.localeCompare(b.name)).slice(0, 4);
          return { team, ranked };
        } catch { return null; }
      }));
      for (const row of rows) if (row && row.ranked.length > 0) teams[row.team] = row.ranked;
    }
  }
  if (sport === "soccer") {
    // Soccer: top scorers by goals per game (min 2 apps) from the official
    // team leaders feed. One request per club + athlete name lookups.
    const lg = league ?? "mls";
    const codes = soccerTeams(lg).map((t) => t.abbr);
    for (let index = 0; index < codes.length; index += 5) {
      const batch = codes.slice(index, index + 5);
      const rows = await Promise.all(batch.map(async (team) => {
        try {
          const data = await fetchSoccerTeamLeaders(lg, team);
          const ranked = data.leaders.flatMap((l) => {
            if (!l.name || l.goals <= 0 || l.appearances < 2) return [];
            return [{ name: l.name, team, stat: l.goals, games: l.appearances, rate: l.goals / l.appearances }];
          }).sort((a, b) => b.rate - a.rate || b.stat - a.stat || a.name.localeCompare(b.name)).slice(0, 4);
          return { team, ranked };
        } catch { return null; }
      }));
      for (const row of rows) if (row && row.ranked.length > 0) teams[row.team] = row.ranked;
    }
  }
  const response: z.infer<typeof likelyScorersResponse> = { sport, fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), teams };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, key));
  await db.insert(schema.nhlInsightCache).values({ key, payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(response.expiresAt) });
  return response;
}

// ---------------------------------------------------------------------------
// Matchup scorers: who owns THIS matchup. Season scoring rate blended with
// head-to-head production vs the specific opponent (75/25). The head-to-head
// sample is small by nature, so every row shows both numbers and the meeting
// count — the rating is a descriptive blend, never a probability.
// ---------------------------------------------------------------------------

const matchupScorerSchema = z.object({
  name: z.string(),
  seasonStat: z.number(), seasonGames: z.number(), seasonRate: z.number(),
  h2hStat: z.number(), h2hGames: z.number(), h2hRate: z.number().nullable(),
  matchupRating: z.number(),
});
const matchupScorersResponse = z.object({
  sport: z.enum(sports),
  away: z.string(), home: z.string(),
  teams: z.record(z.string(), z.array(matchupScorerSchema)),
  blendNote: z.string(),
  fetchedAt: z.string(), expiresAt: z.string(),
});

// Book Read: deep dive into why the books favor their side, for games where
// the model is unsure or disagrees. Every factor is grounded in real data.
const bookReadFactorSchema = z.object({
  side: z.enum(["away", "home", "neutral"]),
  icon: z.string(),
  label: z.string(),
  detail: z.string(),
  strength: z.enum(["strong", "notable"]),
});
const bookReadResponse = z.object({
  sport: z.enum(sports),
  awayTeam: z.string(), homeTeam: z.string(), league: z.string().nullable(),
  modelAway: z.number().nullable(), modelHome: z.number().nullable(), modelDraw: z.number().nullable(),
  modelPick: z.string().nullable(), modelConfidence: z.number().nullable(),
  bookAway: z.number().nullable(), bookHome: z.number().nullable(), bookDraw: z.number().nullable(),
  bookPick: z.string().nullable(),
  bookAwayPrice: z.number().nullable(), bookHomePrice: z.number().nullable(), bookDrawPrice: z.number().nullable(),
  status: z.enum(["agree", "unsure", "disagree", "no-book", "no-model"]),
  factors: z.array(bookReadFactorSchema),
  read: z.string(),
  fetchedAt: z.string(),
});

function normScorerName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

type H2hMap = Map<string, { stat: number; games: number }>;

async function matchupH2h(ctx: Ctx, sport: (typeof sports)[number], team: string, opp: string, league?: SoccerLeagueParam): Promise<H2hMap> {
  const map: H2hMap = new Map();
  if (sport === "nhl") {
    const { byPlayer } = await collectNhlRecentGames();
    for (const acc of byPlayer.values()) {
      if (acc.team !== team) continue;
      const meetings = acc.games.filter((g) => g.opponent === opp);
      if (meetings.length === 0) continue;
      map.set(normScorerName(acc.name), { stat: meetings.reduce((s, g) => s + g.goals, 0), games: meetings.length });
    }
  } else if (sport === "nfl") {
    const logs = await nflTeamPlayerLogs(ctx, team as (typeof nflTeamCodes)[number]);
    for (const player of logs.players) {
      const meetings = player.games.filter((g) => g.opponent === opp);
      if (meetings.length === 0) continue;
      map.set(normScorerName(player.name), {
        stat: meetings.reduce((s, g) => s + (g.stats.rushTds ?? 0) + (g.stats.recTds ?? 0), 0),
        games: meetings.length,
      });
    }
  } else if (sport === "nba") {
    const logs = await nbaTeamPlayerLogs(ctx, team as (typeof nbaTeamCodes)[number]);
    for (const player of logs.players) {
      const meetings = player.games.filter((g) => g.opponent === opp);
      if (meetings.length === 0) continue;
      map.set(normScorerName(player.name), {
        stat: meetings.reduce((s, g) => s + (g.stats.points ?? 0), 0),
        games: meetings.length,
      });
    }
  } else if (sport === "soccer") {
    const lg = league ?? "mls";
    const { games } = await fetchSoccerTeamGames(lg, team, 12);
    const meetings = games.filter((g) => g.opponent === opp);
    const perScorer = new Map<string, { stat: number; gameIds: Set<number> }>();
    await pool(meetings, 3, async (g) => {
      try {
        const summary = await fetchSoccerGameSummary(lg, g.gameId);
        for (const goal of summary.goals) {
          if (goal.teamAbbr !== team) continue;
          const key = normScorerName(goal.scorer);
          const entry = perScorer.get(key) ?? { stat: 0, gameIds: new Set<number>() };
          entry.stat += 1; entry.gameIds.add(g.gameId); perScorer.set(key, entry);
        }
      } catch { /* One bad summary never breaks the matchup. */ }
    });
    for (const [key, entry] of perScorer) map.set(key, { stat: entry.stat, games: entry.gameIds.size });
  }
  return map;
}

async function fetchMatchupScorers(ctx: Ctx, sport: (typeof sports)[number], away: string, home: string, league?: SoccerLeagueParam): Promise<z.infer<typeof matchupScorersResponse>> {
  const db = ctx.db;
  const key = `matchup-scorers:${sport}:${league ?? "-"}:${away}:${home}`;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, key)).limit(1);
  const cached = cachedRows[0];
  if (cached && cached.expiresAt.getTime() > Date.now()) return matchupScorersResponse.parse(JSON.parse(cached.payloadJson));

  // Candidates: top season scorers per team (already cached daily).
  const season = await fetchLikelyScorers(ctx, sport, false, league);
  const sides: { team: string; opp: string }[] = [{ team: away, opp: home }, { team: home, opp: away }];
  const blended: { team: string; rows: (z.infer<typeof matchupScorerSchema> & { blend: number })[] }[] = [];
  let maxBlend = 0;
  for (const { team, opp } of sides) {
    const candidates = (season.teams[team] ?? []).slice(0, 6);
    let h2h: H2hMap = new Map();
    try { h2h = await matchupH2h(ctx, sport, team, opp, league); } catch { /* Head-to-head falls back to season-only. */ }
    const rows = candidates.map((c) => {
      const h = h2h.get(normScorerName(c.name));
      const h2hStat = h?.stat ?? 0;
      const h2hGames = h?.games ?? 0;
      const h2hRate = h2hGames > 0 ? h2hStat / h2hGames : null;
      const blend = 0.75 * c.rate + 0.25 * (h2hRate ?? c.rate);
      if (blend > maxBlend) maxBlend = blend;
      return { name: c.name, seasonStat: c.stat, seasonGames: c.games, seasonRate: c.rate, h2hStat, h2hGames, h2hRate, matchupRating: 0, blend };
    });
    blended.push({ team, rows });
  }
  const teams: Record<string, z.infer<typeof matchupScorerSchema>[]> = {};
  for (const { team, rows } of blended) {
    teams[team] = rows
      .map((r) => ({ ...r, matchupRating: maxBlend > 0 ? Math.round((100 * r.blend) / maxBlend) : 0 }))
      .sort((a, b) => b.matchupRating - a.matchupRating || b.seasonRate - a.seasonRate)
      .slice(0, 2)
      .map(({ blend: _blend, ...rest }) => rest);
  }
  const unit = sport === "nhl" ? "goals" : sport === "nfl" ? "TDs" : sport === "nba" ? "points" : "goals";
  const response: z.infer<typeof matchupScorersResponse> = {
    sport, away, home, teams,
    blendNote: `75% season ${unit} per game, 25% head-to-head vs this opponent. The rating is relative to the best in this matchup — a descriptive blend, not a probability.`,
    fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
  await db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, key));
  await db.insert(schema.nhlInsightCache).values({ key, payloadJson: JSON.stringify(response), fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(response.expiresAt) });
  return response;
}

// ---------------------------------------------------------------------------
// Book Read: deep dive into why the books favor their side.
// When the model is unsure (<55%) or disagrees with the books, this analyzes
// the book's position using real data — venue, form, injuries, head-to-head —
// and gives an honest read. The model always shows its numbers; this explains
// what the books might be seeing that the model doesn't fully capture.

const NHL_TEAM_NAMES: Record<string, string> = {
  ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CAR: "Carolina Hurricanes",
  CBJ: "Columbus Blue Jackets", CGY: "Calgary Flames", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche",
  DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers",
  LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NJD: "New Jersey Devils",
  NSH: "Nashville Predators", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators",
  PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SEA: "Seattle Kraken", SJS: "San Jose Sharks",
  STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth",
  VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WPG: "Winnipeg Jets", WSH: "Washington Capitals",
};

function bookReadTeamName(sport: string, code: string): string {
  const c = code.toUpperCase();
  if (sport === "nhl") return NHL_TEAM_NAMES[c] ?? c;
  if (sport === "nfl") return nflTeamMeta(c)?.name ?? c;
  if (sport === "nba") return nbaTeamMeta(c)?.name ?? c;
  if (sport === "soccer") {
    for (const l of ["mls", "epl"] as const) {
      const m = soccerTeamMeta(l, c);
      if (m) return m.name;
    }
    return c;
  }
  return c;
}

type BookReadOdds = {
  awayProb: number | null; homeProb: number | null; drawProb: number | null;
  awayPrice: number | null; homePrice: number | null; drawPrice: number | null;
};

async function bookReadOdds(ctx: Ctx, sport: Sport, awayName: string, homeName: string, league: string | null): Promise<BookReadOdds> {
  const empty: BookReadOdds = { awayProb: null, homeProb: null, drawProb: null, awayPrice: null, homePrice: null, drawPrice: null };
  try {
    const board = await loadPremium(ctx, sport);
    const awayLower = awayName.toLowerCase();
    const homeLower = homeName.toLowerCase();
    // Find moneyline offers for this matchup. Match on the matchup string
    // containing both team names, then filter to moneyline market.
    const ml = board.offers.filter((o) => {
      if (o.marketName !== "Moneyline") return false;
      if (league && o.league && o.league !== league) return false;
      const m = o.matchup.toLowerCase();
      return m.includes(awayLower) || m.includes(homeLower);
    });
    if (!ml.length) return empty;
    // Group by matchup to find the one with both teams, prefer exact match.
    const byMatchup = new Map<string, typeof ml>();
    for (const o of ml) {
      const list = byMatchup.get(o.matchup) ?? [];
      list.push(o);
      byMatchup.set(o.matchup, list);
    }
    let best: typeof ml | null = null;
    for (const [matchup, list] of byMatchup) {
      const m = matchup.toLowerCase();
      if (m.includes(awayLower) && m.includes(homeLower)) { best = list; break; }
      if (!best && (m.includes(awayLower) || m.includes(homeLower))) best = list;
    }
    if (!best) return empty;
    let awayDec: number | null = null, homeDec: number | null = null, drawDec: number | null = null;
    for (const o of best) {
      const dec = bestDec(o);
      if (dec === null) continue;
      const e = o.entity.trim().toLowerCase();
      if (e === awayLower) awayDec = awayDec === null ? dec : Math.max(awayDec, dec);
      else if (e === homeLower) homeDec = homeDec === null ? dec : Math.max(homeDec, dec);
      else if (e === "draw") drawDec = drawDec === null ? dec : Math.max(drawDec, dec);
    }
    if (awayDec === null || homeDec === null) return empty;
    const probs = drawDec !== null ? vigFreeProbs([awayDec, homeDec, drawDec]) : vigFreeProbs([awayDec, homeDec]);
    return {
      awayProb: probs[0] ?? null, homeProb: probs[1] ?? null, drawProb: drawDec !== null ? (probs[2] ?? null) : null,
      awayPrice: decimalToAmerican(awayDec), homePrice: decimalToAmerican(homeDec),
      drawPrice: drawDec !== null ? decimalToAmerican(drawDec) : null,
    };
  } catch {
    return empty;
  }
}

type BookReadTeamStats = {
  wins: number; games: number; winPct: number | null;
  venueWins: number; venueGames: number; venueWinPct: number | null;
  avgFor: number | null; avgAgainst: number | null;
};

async function loadBookRead(
  ctx: Ctx, sport: Sport, awayTeam: string, homeTeam: string, league: string | null,
): Promise<z.infer<typeof bookReadResponse>> {
  const awayName = bookReadTeamName(sport, awayTeam);
  const homeName = bookReadTeamName(sport, homeTeam);
  const factors: z.infer<typeof bookReadFactorSchema>[] = [];

  // --- Model probabilities from the sport's matchup loader ---
  let modelAway: number | null = null, modelHome: number | null = null, modelDraw: number | null = null;
  let awayStats: BookReadTeamStats | null = null, homeStats: BookReadTeamStats | null = null;
  let h2hAwayWins = 0, h2hHomeWins = 0, h2hGames = 0, h2hDraws = 0;
  try {
    if (sport === "nhl") {
      const m = await loadFirstGoalMatchup(ctx, awayTeam as (typeof teamCodes)[number], homeTeam as (typeof teamCodes)[number], false);
      modelAway = m.awayWinProbability; modelHome = m.homeWinProbability;
      awayStats = { wins: m.away.wins, games: m.away.games, winPct: m.away.winPct, venueWins: m.away.venueWins, venueGames: m.away.venueGames, venueWinPct: m.away.venueWinPct, avgFor: null, avgAgainst: null };
      homeStats = { wins: m.home.wins, games: m.home.games, winPct: m.home.winPct, venueWins: m.home.venueWins, venueGames: m.home.venueGames, venueWinPct: m.home.venueWinPct, avgFor: null, avgAgainst: null };
      h2hGames = m.headToHead.games; h2hAwayWins = 0; h2hHomeWins = 0; // NHL H2H tracks first-goal, not wins
    } else if (sport === "nfl") {
      const m = await loadNflMatchup(ctx, awayTeam as (typeof nflTeamCodes)[number], homeTeam as (typeof nflTeamCodes)[number], false);
      modelAway = m.awayWinProbability; modelHome = m.homeWinProbability;
      awayStats = { wins: m.away.wins, games: m.away.games, winPct: m.away.winPct, venueWins: m.away.venueWins, venueGames: m.away.venueGames, venueWinPct: m.away.venueWinPct, avgFor: m.away.avgPointsFor, avgAgainst: m.away.avgPointsAgainst };
      homeStats = { wins: m.home.wins, games: m.home.games, winPct: m.home.winPct, venueWins: m.home.venueWins, venueGames: m.home.venueGames, venueWinPct: m.home.venueWinPct, avgFor: m.home.avgPointsFor, avgAgainst: m.home.avgPointsAgainst };
      h2hGames = m.headToHead.games; h2hAwayWins = m.headToHead.awayWins; h2hHomeWins = m.headToHead.homeWins;
    } else if (sport === "nba") {
      const m = await loadNbaMatchup(ctx, awayTeam as (typeof nbaTeamCodes)[number], homeTeam as (typeof nbaTeamCodes)[number], false);
      modelAway = m.awayWinProbability; modelHome = m.homeWinProbability;
      awayStats = { wins: m.away.wins, games: m.away.games, winPct: m.away.winPct, venueWins: m.away.venueWins, venueGames: m.away.venueGames, venueWinPct: m.away.venueWinPct, avgFor: m.away.avgPointsFor, avgAgainst: m.away.avgPointsAgainst };
      homeStats = { wins: m.home.wins, games: m.home.games, winPct: m.home.winPct, venueWins: m.home.venueWins, venueGames: m.home.venueGames, venueWinPct: m.home.venueWinPct, avgFor: m.home.avgPointsFor, avgAgainst: m.home.avgPointsAgainst };
      h2hGames = m.headToHead.games; h2hAwayWins = m.headToHead.awayWins; h2hHomeWins = m.headToHead.homeWins;
    } else {
      const m = await loadSoccerMatchup(ctx, (league ?? "epl") as SoccerLeagueParam, awayTeam, homeTeam, false);
      modelAway = m.awayWinProbability; modelHome = m.homeWinProbability; modelDraw = m.drawProbability;
      const awayWinPct = m.away.games > 0 ? m.away.wins / m.away.games : null;
      const awayVenueWinPct = m.away.venueGames > 0 ? m.away.venueWins / m.away.venueGames : null;
      const homeWinPct = m.home.games > 0 ? m.home.wins / m.home.games : null;
      const homeVenueWinPct = m.home.venueGames > 0 ? m.home.venueWins / m.home.venueGames : null;
      awayStats = { wins: m.away.wins, games: m.away.games, winPct: awayWinPct, venueWins: m.away.venueWins, venueGames: m.away.venueGames, venueWinPct: awayVenueWinPct, avgFor: m.away.avgGoalsFor, avgAgainst: m.away.avgGoalsAgainst };
      homeStats = { wins: m.home.wins, games: m.home.games, winPct: homeWinPct, venueWins: m.home.venueWins, venueGames: m.home.venueGames, venueWinPct: homeVenueWinPct, avgFor: m.home.avgGoalsFor, avgAgainst: m.home.avgGoalsAgainst };
      h2hGames = m.headToHead.games; h2hAwayWins = m.headToHead.awayWins; h2hHomeWins = m.headToHead.homeWins; h2hDraws = m.headToHead.draws;
    }
  } catch { /* Model data unavailable — factors will note it. */ }

  const modelPick = modelAway !== null && modelHome !== null
    ? (modelDraw !== null && modelDraw >= modelAway && modelDraw >= modelHome ? "draw" : modelAway >= modelHome ? "away" : "home")
    : null;
  const modelConfidence = modelPick === "away" ? modelAway : modelPick === "home" ? modelHome : modelPick === "draw" ? modelDraw : null;

  // --- Book probabilities from cached odds ---
  const book = await bookReadOdds(ctx, sport, awayName, homeName, league);
  const bookPick = book.awayProb !== null && book.homeProb !== null
    ? (book.drawProb !== null && book.drawProb >= book.awayProb && book.drawProb >= book.homeProb ? "draw" : book.awayProb >= book.homeProb ? "away" : "home")
    : null;

  // --- Status ---
  let status: z.infer<typeof bookReadResponse>["status"];
  if (modelPick === null) status = "no-model";
  else if (bookPick === null) status = "no-book";
  else if (modelPick !== bookPick) status = "disagree";
  else if ((modelConfidence ?? 0) < 0.55) status = "unsure";
  else status = "agree";

  const pct = (n: number | null) => n === null ? "—" : `${Math.round(n * 100)}%`;
  const pickName = (p: string | null) => p === "away" ? awayName : p === "home" ? homeName : p === "draw" ? "Draw" : "—";

  // --- Factor 1: Venue edge ---
  if (homeStats && awayStats && homeStats.venueGames >= 2 && awayStats.venueGames >= 2
      && homeStats.venueWinPct !== null && awayStats.venueWinPct !== null) {
    const homeEdge = homeStats.venueWinPct - awayStats.venueWinPct;
    if (homeEdge >= 0.25) {
      factors.push({ side: "home", icon: "🏠", label: "Home dominance",
        detail: `${homeName} are ${homeStats.venueWins}-${homeStats.venueGames - homeStats.venueWins} at home (${pct(homeStats.venueWinPct)}); ${awayName} are ${awayStats.venueWins}-${awayStats.venueGames - awayStats.venueWins} on the road (${pct(awayStats.venueWinPct)}).`,
        strength: "strong" });
    } else if (homeEdge <= -0.25) {
      factors.push({ side: "away", icon: "✈️", label: "Road warriors",
        detail: `${awayName} are ${awayStats.venueWins}-${awayStats.venueGames - awayStats.venueWins} on the road (${pct(awayStats.venueWinPct)}); ${homeName} are just ${homeStats.venueWins}-${homeStats.venueGames - homeStats.venueWins} at home (${pct(homeStats.venueWinPct)}).`,
        strength: "strong" });
    } else if (homeStats.venueWinPct >= 0.7 && homeStats.venueGames >= 3) {
      factors.push({ side: "home", icon: "🏠", label: "Strong at home",
        detail: `${homeName} are ${homeStats.venueWins}-${homeStats.venueGames - homeStats.venueWins} at home this season.`,
        strength: "notable" });
    }
  }

  // --- Factor 2: Overall form gap ---
  if (awayStats && homeStats && awayStats.winPct !== null && homeStats.winPct !== null
      && awayStats.games >= 3 && homeStats.games >= 3) {
    const gap = homeStats.winPct - awayStats.winPct;
    if (gap >= 0.3) {
      factors.push({ side: "home", icon: "📈", label: "Better overall form",
        detail: `${homeName} (${awayStats.wins}-${awayStats.games - awayStats.wins} → ${homeStats.wins}-${homeStats.games - homeStats.wins}) have the clearly better record at ${pct(homeStats.winPct)} vs ${pct(awayStats.winPct)}.`,
        strength: "strong" });
    } else if (gap <= -0.3) {
      factors.push({ side: "away", icon: "📈", label: "Better overall form",
        detail: `${awayName} have the clearly better record at ${pct(awayStats.winPct)} vs ${pct(homeStats.winPct)}.`,
        strength: "strong" });
    }
  }

  // --- Factor 3: Scoring margin ---
  if (awayStats && homeStats && awayStats.avgFor !== null && awayStats.avgAgainst !== null
      && homeStats.avgFor !== null && homeStats.avgAgainst !== null
      && awayStats.games >= 3 && homeStats.games >= 3) {
    const awayMargin = awayStats.avgFor - awayStats.avgAgainst;
    const homeMargin = homeStats.avgFor - homeStats.avgAgainst;
    const marginGap = homeMargin - awayMargin;
    if (marginGap >= 0.5) {
      factors.push({ side: "home", icon: "⚡", label: "Outscoring opponents",
        detail: `${homeName} outscore opponents by ${homeMargin.toFixed(1)}/game vs ${awayMargin >= 0 ? "+" : ""}${awayMargin.toFixed(1)} for ${awayName}.`,
        strength: "notable" });
    } else if (marginGap <= -0.5) {
      factors.push({ side: "away", icon: "⚡", label: "Outscoring opponents",
        detail: `${awayName} outscore opponents by ${awayMargin.toFixed(1)}/game vs ${homeMargin >= 0 ? "+" : ""}${homeMargin.toFixed(1)} for ${homeName}.`,
        strength: "notable" });
    }
  }

  // --- Factor 4: Head-to-head this season ---
  if (h2hGames > 0) {
    if (h2hHomeWins === h2hGames) {
      factors.push({ side: "home", icon: "🔁", label: "Owns the matchup",
        detail: `${homeName} won ${h2hGames === 1 ? "the meeting" : `all ${h2hGames} meetings`} vs ${awayName} this season.`,
        strength: "strong" });
    } else if (h2hAwayWins === h2hGames) {
      factors.push({ side: "away", icon: "🔁", label: "Owns the matchup",
        detail: `${awayName} won ${h2hGames === 1 ? "the meeting" : `all ${h2hGames} meetings`} vs ${homeName} this season.`,
        strength: "strong" });
    } else if (h2hGames >= 2) {
      const leader = h2hHomeWins > h2hAwayWins ? "home" : h2hAwayWins > h2hHomeWins ? "away" : "neutral";
      if (leader !== "neutral") {
        factors.push({ side: leader, icon: "🔁", label: "Season series edge",
          detail: `${leader === "home" ? homeName : awayName} lead the season series ${Math.max(h2hHomeWins, h2hAwayWins)}-${Math.min(h2hHomeWins, h2hAwayWins)}${h2hDraws ? `-${h2hDraws}` : ""}.`,
          strength: "notable" });
      }
    }
  }

  // --- Factor 5: Key injuries ---
  try {
    const injuries = await fetchKeyInjuries(ctx, sport, false, sport === "soccer" ? ((league ?? "epl") as SoccerLeagueParam) : undefined);
    const findHits = (teamName: string) => {
      const t = (injuries.teams ?? []).find((tm: { team: string }) => tm.team.toLowerCase() === teamName.toLowerCase());
      return (t?.players ?? []).slice(0, 2);
    };
    for (const p of findHits(awayName)) {
      factors.push({ side: "home", icon: "🏥", label: `${awayName} shorthanded`,
        detail: `${p.name} (${p.status}) — ${p.note}. Books often shade against shorthanded teams.`,
        strength: "strong" });
    }
    for (const p of findHits(homeName)) {
      factors.push({ side: "away", icon: "🏥", label: `${homeName} shorthanded`,
        detail: `${p.name} (${p.status}) — ${p.note}. Books often shade against shorthanded teams.`,
        strength: "strong" });
    }
  } catch { /* Injuries unavailable — skip. */ }

  // --- The honest read ---
  let read: string;
  if (status === "no-model") {
    read = `Not enough model data on this one yet. ${bookPick ? `The books favor ${pickName(bookPick)} (${pct(bookPick === "away" ? book.awayProb : bookPick === "home" ? book.homeProb : book.drawProb)} vig-free) — treat their price as the best available read until the sample grows.` : "No book price either — this is a pass."}`;
  } else if (status === "no-book") {
    read = `No book price posted yet. Model leans ${pickName(modelPick)} at ${pct(modelConfidence)} — a pure model read, no market to check it against.`;
  } else if (status === "agree") {
    read = `Model and books agree on ${pickName(modelPick)} — model ${pct(modelConfidence)}, books ${pct(bookPick === "away" ? book.awayProb : bookPick === "home" ? book.homeProb : book.drawProb)} vig-free. ${factors.length ? "The factors below line up behind it." : "Clean agreement, no red flags in the data."}`;
  } else if (status === "unsure") {
    const bookSide = pickName(bookPick);
    const agreeingFactors = factors.filter((f) => (f.side === "away" && bookPick === "away") || (f.side === "home" && bookPick === "home"));
    read = `The model only leans ${pickName(modelPick)} (${pct(modelConfidence)}) — a coin flip it won't pretend is an edge. The books favor ${bookSide} (${pct(bookPick === "away" ? book.awayProb : bookPick === "home" ? book.homeProb : book.drawProb)} vig-free)${agreeingFactors.length ? `, and the data backs them: ${agreeingFactors.slice(0, 2).map((f) => f.detail).join(" ")}` : "."} Honest read: lean ${bookSide} with the books, but keep it small — the model sees this as too close to call.`;
  } else {
    // disagree
    const bookSide = pickName(bookPick);
    const modelSide = pickName(modelPick);
    const bookFactors = factors.filter((f) => (f.side === "away" && bookPick === "away") || (f.side === "home" && bookPick === "home"));
    const modelFactors = factors.filter((f) => (f.side === "away" && modelPick === "away") || (f.side === "home" && modelPick === "home"));
    read = `Genuine disagreement: model says ${modelSide} (${pct(modelConfidence)}), books say ${bookSide} (${pct(bookPick === "away" ? book.awayProb : bookPick === "home" ? book.homeProb : book.drawProb)} vig-free).${bookFactors.length ? ` Why the books might be right: ${bookFactors.slice(0, 2).map((f) => f.detail).join(" ")}` : ""}${modelFactors.length ? ` Why the model might be right: ${modelFactors.slice(0, 1).map((f) => f.detail).join(" ")}` : ""} Honest read: ${bookFactors.length >= modelFactors.length ? `the books' case is stronger on the data — lean ${bookSide}` : `the model has a real case for ${modelSide}, but respect the market`} — either way, this is not a spot to force.`;
  }

  return {
    sport, awayTeam, homeTeam, league,
    modelAway, modelHome, modelDraw, modelPick, modelConfidence,
    bookAway: book.awayProb, bookHome: book.homeProb, bookDraw: book.drawProb, bookPick,
    bookAwayPrice: book.awayPrice, bookHomePrice: book.homePrice, bookDrawPrice: book.drawPrice,
    status, factors, read,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Key-player injury warnings (Job 2).
//
// Official ESPN injury designations only — never invented. For each team with
// a game in the next 48 hours we pull the club's injury report from the
// keyless ESPN core API and keep only Out / Doubtful / Injured Reserve
// designations (Questionable only when the official note itself says the
// player is expected to miss). Position filter: NFL QB/RB/WR/TE; NBA and NHL
// keep every position (the client ranks NBA players by scoring importance).
// Cached 12h; zero sportsbook quota.
// ---------------------------------------------------------------------------

const injuryPlayerSchema = z.object({
  name: z.string(), position: z.string(), status: z.string(), note: z.string(),
});
const injuryTeamSchema = z.object({ team: z.string(), players: z.array(injuryPlayerSchema) });
const keyInjuriesResponse = z.object({
  sport: z.enum(sports),
  league: z.string().nullable().default(null),
  fetchedAt: z.string(),
  teams: z.array(injuryTeamSchema),
});

const INJURY_TTL_MS = 12 * 60 * 60 * 1000;
const ESPN_CORE_BASE = "https://sports.core.api.espn.com/v2/sports";
const INJURY_LEAGUE_PATH: Record<Exclude<Sport, "soccer">, string> = {
  nhl: "hockey/leagues/nhl",
  nfl: "football/leagues/nfl",
  nba: "basketball/leagues/nba",
};
function injuryLeaguePath(sport: Sport, league?: SoccerLeagueParam): string {
  if (sport === "soccer") return `soccer/leagues/${league === "epl" ? "eng.1" : "usa.1"}`;
  return INJURY_LEAGUE_PATH[sport];
}

async function espnCoreJson(url: string): Promise<unknown> {
  // Defensive timeout: a hanging upstream must never wedge the action.
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`ESPN core request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

function coreRef(value: unknown): string | null {
  const row = objectValue(value);
  const ref = textValue(row?.$ref);
  if (!ref || !ref.startsWith("http")) return null;
  // ESPN core $refs come back as http:// — plain HTTP hangs Node's fetch
  // against this host (verified 2026-10-12), so upgrade to https://.
  return ref.replace(/^http:\/\//, "https://");
}

// NHL clubs are keyed by tri-code on the api-web.nhle.com side, but the ESPN
// core injuries endpoint needs ESPN's numeric team ids. Resolve dynamically
// (cached 7 days); ESPN abbreviations match our tri-codes except LA/NJ/SJ.
const NHL_ESPN_ABBR_OVERRIDES: Record<string, string> = { LAK: "LA", NJD: "NJ", SJS: "SJ" };

async function nhlEspnIdMap(ctx: Ctx): Promise<Record<string, number>> {
  const cacheKey = "nhl-espn-team-ids";
  try {
    const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
    const row = rows[0];
    if (row && row.expiresAt.getTime() > Date.now()) {
      const parsed = JSON.parse(row.payloadJson) as Record<string, number>;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch { /* fall through to live fetch */ }
  const reverse = new Map<string, string>();
  for (const [tri, abbr] of Object.entries(NHL_ESPN_ABBR_OVERRIDES)) reverse.set(abbr, tri);
  const map: Record<string, number> = {};
  for (const page of [1, 2]) {
    const payload = await espnCoreJson(`${ESPN_CORE_BASE}/hockey/leagues/nhl/teams?lang=en&region=us&page=${page}`);
    const items = arrayValue(objectValue(payload)?.items);
    if (!items.length) break;
    const teams = await pool(items, 8, async (item) => {
      const ref = coreRef(item);
      if (!ref) return null;
      try { return await espnCoreJson(ref); } catch { return null; }
    });
    for (const team of teams) {
      const row = objectValue(team);
      const abbr = textValue(row?.abbreviation);
      // ESPN core returns the team id as a numeric string ("1"), not a
      // number — parse it explicitly (the strict num() helper rejects strings).
      const idRaw = row?.id;
      const id = typeof idRaw === "number" && Number.isFinite(idRaw) ? idRaw
        : typeof idRaw === "string" && /^\d+$/.test(idRaw.trim()) ? parseInt(idRaw, 10) : null;
      if (!abbr || id === null) continue;
      map[reverse.get(abbr) ?? abbr] = id;
    }
  }
  if (Object.keys(map).length >= 30) {
    try {
      await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
      await ctx.db.insert(schema.nhlInsightCache).values({
        key: cacheKey, payloadJson: JSON.stringify(map),
        fetchedAt: new Date(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    } catch { /* cache is best-effort */ }
  }
  return map;
}

function espnTeamId(sport: Sport, abbr: string, nhlIds: Record<string, number>, league?: SoccerLeagueParam): number | null {
  if (sport === "nfl") return nflTeamMeta(abbr)?.id ?? null;
  if (sport === "nba") return nbaTeamMeta(abbr)?.id ?? null;
  if (sport === "soccer") return soccerTeamMeta(league ?? "mls", abbr)?.id ?? null;
  return nhlIds[abbr] ?? null;
}

function startsWithin48h(iso: string): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + 48 * 60 * 60 * 1000;
}

// Clubs with a game tipping off / kicking off in the next 48 hours.
async function upcomingInjuryTeams(sport: Sport, league?: SoccerLeagueParam): Promise<string[]> {
  const seen = new Set<string>();
  if (sport === "soccer") {
    // The soccer scoreboard takes a single YYYYMMDD; fetch the next three
    // calendar days and let the 48h filter pick precisely.
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const boards = await pool([0, 1, 2], 3, async (offset) => {
      try { return await fetchSoccerScoreboard(league ?? "mls", yyyymmdd(now + offset * dayMs)); }
      catch { return null; }
    });
    for (const board of boards) {
      if (!board) continue;
      for (const g of board.games) {
        if (!startsWithin48h(g.date)) continue;
        seen.add(g.away.abbr); seen.add(g.home.abbr);
      }
    }
    const valid = new Set(soccerTeams(league ?? "mls").map((t) => t.abbr));
    return [...seen].filter((abbr) => valid.has(abbr));
  }
  if (sport === "nfl") {
    const board = await fetchNflScoreboard();
    for (const g of board.games) {
      if (!startsWithin48h(g.date)) continue;
      seen.add(g.away.abbr); seen.add(g.home.abbr);
    }
    // Next week's board can hold games inside 48h once the week turns over.
    try {
      const next = await fetchNflScoreboard(board.week + 1);
      for (const g of next.games) {
        if (!startsWithin48h(g.date)) continue;
        seen.add(g.away.abbr); seen.add(g.home.abbr);
      }
    } catch { /* current week is enough */ }
  } else if (sport === "nba") {
    // The default scoreboard only covers today and the dates param takes a
    // single YYYYMMDD (no ranges), so fetch the next three calendar days and
    // let the 48h filter pick precisely.
    const fmtDay = (t: number) => {
      const d = new Date(t);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
    };
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const boards = await pool([1, 2, 3], 3, async (offset) => {
      try { return await fetchNbaScoreboard(fmtDay(now + offset * dayMs)); } catch { return null; }
    });
    for (const board of boards) {
      if (!board) continue;
      for (const g of board.games) {
        if (!startsWithin48h(g.date)) continue;
        seen.add(g.away.abbr); seen.add(g.home.abbr);
      }
    }
  } else {
    const today = new Date();
    const dates = [0, 1, 2].map((offset) => {
      const d = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    });
    const payloads = await pool(dates, 3, async (date) => {
      try { return await espnCoreJson(`https://api-web.nhle.com/v1/schedule/${date}`); } catch { return null; }
    });
    for (const payload of payloads) {
      for (const weekValue of arrayValue(objectValue(payload)?.gameWeek)) {
        for (const gameValue of arrayValue(objectValue(weekValue)?.games)) {
          const game = objectValue(gameValue);
          if (!game || !startsWithin48h(textValue(game.startTimeUTC) ?? "")) continue;
          const away = textValue(objectValue(game.awayTeam)?.abbrev);
          const home = textValue(objectValue(game.homeTeam)?.abbrev);
          if (away) seen.add(away);
          if (home) seen.add(home);
        }
      }
    }
  }
  const valid = sport === "nfl" ? new Set(nflTeamCodes as readonly string[]) : sport === "nba" ? new Set(nbaTeamCodes as readonly string[]) : new Set(teamCodes as readonly string[]);
  return [...seen].filter((abbr) => valid.has(abbr));
}

// Official designation gate: Out, Doubtful, and Injured Reserve always
// count. Questionable counts only when ESPN's own note says the player is
// expected to miss — conservative by design, never inferred.
function injuryIsKey(status: string, note: string): boolean {
  const s = status.trim().toLowerCase();
  if (s === "out" || s === "doubtful" || s === "injured reserve" || s === "ir") return true;
  if (s === "questionable") {
    return /(ruled out|will not play|won'?t play|expected to miss|not expected to play)/i.test(note);
  }
  return false;
}

const NFL_KEY_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
// Soccer: forwards, attacking midfielders, and goalkeepers move matches.
const SOCCER_KEY_POSITIONS = new Set(["F", "M", "G"]);

async function fetchTeamKeyInjuries(sport: Sport, espnId: number, league?: SoccerLeagueParam): Promise<z.infer<typeof injuryPlayerSchema>[]> {
  const listUrl = `${ESPN_CORE_BASE}/${injuryLeaguePath(sport, league)}/teams/${espnId}/injuries?lang=en&region=us`;
  const payload = await espnCoreJson(listUrl);
  const root = objectValue(payload);
  const items = arrayValue(root?.items).slice(0, 50);
  const pageCount = num(root?.pageCount) ?? 1;
  const refs = items.flatMap((item) => { const ref = coreRef(item); return ref ? [ref] : []; });
  // If page one is full and turned up nothing key, peek at page two — the
  // list is newest-first, so current designations are almost always on page 1.
  let details = await pool(refs, 6, async (ref) => {
    try { return await espnCoreJson(ref); } catch { return null; }
  });
  const keySoFar = details.filter((d) => d && injuryIsKey(textValue(objectValue(d)?.status) ?? "", "")).length;
  if (pageCount > 1 && items.length >= 25 && keySoFar === 0) {
    try {
      const page2 = await espnCoreJson(`${listUrl}&page=2`);
      const refs2 = arrayValue(objectValue(page2)?.items).flatMap((item) => { const ref = coreRef(item); return ref ? [ref] : []; });
      const details2 = await pool(refs2, 6, async (ref) => {
        try { return await espnCoreJson(ref); } catch { return null; }
      });
      details = [...details, ...details2];
    } catch { /* page one is enough */ }
  }
  const kept: z.infer<typeof injuryPlayerSchema>[] = [];
  const keyDetails = details.flatMap((d) => {
    const row = objectValue(d);
    if (!row) return [];
    const status = textValue(row.status) ?? "";
    const note = textValue(row.shortComment) ?? textValue(row.longComment) ?? "";
    return injuryIsKey(status, note) ? [{ row, status, note }] : [];
  });
  const athletes = await pool(keyDetails, 4, async ({ row }) => {
    const ref = coreRef(row.athlete);
    if (!ref) return null;
    try { return await espnCoreJson(ref); } catch { return null; }
  });
  keyDetails.forEach(({ status, note }, i) => {
    const athlete = objectValue(athletes[i]);
    const name = textValue(athlete?.displayName) ?? textValue(athlete?.fullName) ?? "Unknown";
    const position = textValue(objectValue(athlete?.position)?.abbreviation) ?? "";
    if (sport === "nfl" && !NFL_KEY_POSITIONS.has(position.toUpperCase())) return;
    if (sport === "soccer" && !SOCCER_KEY_POSITIONS.has(position.toUpperCase())) return;
    kept.push({ name, position, status, note });
  });
  return kept;
}

async function fetchKeyInjuries(ctx: Ctx, sport: Sport, force: boolean, league?: SoccerLeagueParam): Promise<z.infer<typeof keyInjuriesResponse>> {
  const cacheKey = sport === "soccer" ? `key-injuries-soccer-${league ?? "mls"}` : `key-injuries-${sport}`;
  if (!force) {
    try {
      const rows = await ctx.db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey)).limit(1);
      const row = rows[0];
      if (row && row.expiresAt.getTime() > Date.now()) {
        const teams = JSON.parse(row.payloadJson) as z.infer<typeof injuryTeamSchema>[];
        return { sport, league: sport === "soccer" ? (league ?? "mls") : null, fetchedAt: row.fetchedAt.toISOString(), teams };
      }
    } catch { /* fall through to live fetch */ }
  }
  const abbrs = await upcomingInjuryTeams(sport, league);
  const nhlIds = sport === "nhl" ? await nhlEspnIdMap(ctx).catch(() => ({} as Record<string, number>)) : {};
  const teams: z.infer<typeof injuryTeamSchema>[] = [];
  await pool(abbrs, 4, async (abbr) => {
    const id = espnTeamId(sport, abbr, nhlIds, league);
    if (!id) return;
    try {
      const players = await fetchTeamKeyInjuries(sport, id, league);
      if (players.length) teams.push({ team: abbr, players });
    } catch { /* one club never breaks the report */ }
  });
  teams.sort((a, b) => a.team.localeCompare(b.team));
  const response = { sport, league: sport === "soccer" ? (league ?? "mls") : null, fetchedAt: new Date().toISOString(), teams };
  try {
    await ctx.db.delete(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, cacheKey));
    await ctx.db.insert(schema.nhlInsightCache).values({
      key: cacheKey, payloadJson: JSON.stringify(teams),
      fetchedAt: new Date(response.fetchedAt), expiresAt: new Date(Date.now() + INJURY_TTL_MS),
    });
  } catch { /* cache is best-effort */ }
  return response;
}

// ---------------------------------------------------------------------------
// Admin-only usage stats (Job 3). Counts, never identities: the tracker in
// index.ts stores one row per (UTC day, SHA-256(IP + day + UA), sport) and
// never stores raw IPs. Gated exactly like the plate write actions.
// ---------------------------------------------------------------------------

const usageDaySchema = z.object({ uniques: z.number(), views: z.number() });
const usageStatsResponse = z.object({
  today: usageDaySchema,
  yesterday: usageDaySchema,
  last14: z.array(z.object({ date: z.string(), uniques: z.number(), views: z.number() })),
  bySport: z.object({ nhl: usageDaySchema, nfl: usageDaySchema, nba: usageDaySchema }),
  total: usageDaySchema,
});

function usageDayKey(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function loadUsageStats(ctx: Ctx): Promise<z.infer<typeof usageStatsResponse>> {
  const today = usageDayKey(0);
  const yesterday = usageDayKey(-1);
  const since = usageDayKey(-13);
  const zero = { uniques: 0, views: 0 };
  const dayRows = await ctx.db.select({
    date: schema.usageDaily.date,
    uniques: sql<number>`count(distinct ${schema.usageDaily.visitorHash})`,
    views: sql<number>`coalesce(sum(${schema.usageDaily.views}), 0)`,
  }).from(schema.usageDaily).where(gte(schema.usageDaily.date, since)).groupBy(schema.usageDaily.date);
  const sportRows = await ctx.db.select({
    sport: schema.usageDaily.sport,
    uniques: sql<number>`count(distinct ${schema.usageDaily.visitorHash})`,
    views: sql<number>`coalesce(sum(${schema.usageDaily.views}), 0)`,
  }).from(schema.usageDaily).where(gte(schema.usageDaily.date, since)).groupBy(schema.usageDaily.sport);
  const byDay = new Map(dayRows.map((r) => [r.date, { uniques: Number(r.uniques) || 0, views: Number(r.views) || 0 }]));
  const bySport = new Map(sportRows.map((r) => [r.sport, { uniques: Number(r.uniques) || 0, views: Number(r.views) || 0 }]));
  const last14: { date: string; uniques: number; views: number }[] = [];
  for (let offset = -13; offset <= 0; offset++) {
    const date = usageDayKey(offset);
    last14.push({ date, ...(byDay.get(date) ?? zero) });
  }
  const total = { uniques: 0, views: 0 };
  for (const row of dayRows) { total.views += Number(row.views) || 0; }
  // Visitor hashes rotate daily by design (privacy), so true 14-day
  // deduplicated uniques are unknowable; total.uniques is the sum of daily
  // uniques — an upper bound, not a deduplicated count.
  for (const row of dayRows) { total.uniques += Number(row.uniques) || 0; }
  return {
    today: byDay.get(today) ?? { ...zero },
    yesterday: byDay.get(yesterday) ?? { ...zero },
    last14,
    bySport: {
      nhl: bySport.get("nhl") ?? { ...zero },
      nfl: bySport.get("nfl") ?? { ...zero },
      nba: bySport.get("nba") ?? { ...zero },
    },
    total,
  };
}

const trackRecordPickSchema = z.object({
  id: z.number(),
  sport: z.string(),
  league: z.string().nullable(),
  awayTeam: z.string(),
  homeTeam: z.string(),
  gameDate: z.string(),
  modelPick: z.string().nullable(),
  modelProb: z.number().nullable(),
  bookPick: z.string().nullable(),
  bookPrice: z.number().nullable(),
  winner: z.string().nullable(),
  modelCorrect: z.boolean().nullable(),
  bookCorrect: z.boolean().nullable(),
  source: z.string(),
});

const trackRecordEraSchema = z.object({
  picks: z.number(),
  wins: z.number(),
  losses: z.number(),
  winPct: z.number().nullable(),
  bookWins: z.number().nullable(),
  bookLosses: z.number().nullable(),
  bookWinPct: z.number().nullable(),
  roiUnits: z.number().nullable(),
  bySport: z.array(z.object({
    sport: z.string(), picks: z.number(), wins: z.number(), losses: z.number(), winPct: z.number().nullable(),
  })),
});

const trackRecordResponse = z.object({
  backtest: trackRecordEraSchema,
  live: trackRecordEraSchema,
  recent: z.array(trackRecordPickSchema),
  lastSnapshotAt: z.string().nullable(),
  lastGradedAt: z.string().nullable(),
});

type SnapshotRow = typeof schema.modelSnapshots.$inferSelect;

function trackEra(rows: SnapshotRow[]) {
  const graded = rows.filter((r) => r.gradedAt !== null && r.modelPick !== null);
  const wins = graded.filter((r) => r.modelCorrect === 1).length;
  const losses = graded.filter((r) => r.modelCorrect === 0).length;
  const bookGraded = rows.filter((r) => r.gradedAt !== null && r.bookPick !== null);
  const bookWins = bookGraded.filter((r) => r.bookCorrect === 1).length;
  const bookLosses = bookGraded.filter((r) => r.bookCorrect === 0).length;
  let roiUnits: number | null = null;
  const liveRows = rows.filter((r) => r.source === "live");
  if (liveRows.length > 0) {
    roiUnits = 0;
    for (const r of liveRows) {
      if (r.gradedAt === null || r.modelPick === null) continue;
      const price = r.modelPick === "away" ? r.bookAwayPrice : r.modelPick === "home" ? r.bookHomePrice : r.bookDrawPrice;
      if (price === null || price === 0) continue;
      if (r.modelCorrect === 1) roiUnits += price > 0 ? price / 100 : 100 / Math.abs(price);
      else if (r.modelCorrect === 0) roiUnits -= 1;
    }
    roiUnits = Math.round(roiUnits * 100) / 100;
  }
  const bySportMap = new Map<string, { picks: number; wins: number; losses: number }>();
  for (const r of graded) {
    const s = bySportMap.get(r.sport) ?? { picks: 0, wins: 0, losses: 0 };
    s.picks += 1;
    if (r.modelCorrect === 1) s.wins += 1;
    else s.losses += 1;
    bySportMap.set(r.sport, s);
  }
  const bySport = [...bySportMap.entries()].map(([sport, s]) => ({
    sport, picks: s.picks, wins: s.wins, losses: s.losses,
    winPct: s.picks > 0 ? Math.round((s.wins / s.picks) * 1000) / 10 : null,
  }));
  return {
    picks: graded.length, wins, losses,
    winPct: graded.length > 0 ? Math.round((wins / graded.length) * 1000) / 10 : null,
    bookWins: bookGraded.length > 0 ? bookWins : null,
    bookLosses: bookGraded.length > 0 ? bookLosses : null,
    bookWinPct: bookGraded.length > 0 ? Math.round((bookWins / bookGraded.length) * 1000) / 10 : null,
    roiUnits,
    bySport,
  };
}

async function loadTrackRecord(ctx: Ctx): Promise<z.infer<typeof trackRecordResponse>> {
  await ensureBacktestSeed(ctx);
  const rows = await ctx.db.select().from(schema.modelSnapshots)
    .orderBy(desc(schema.modelSnapshots.gameDate), desc(schema.modelSnapshots.id));
  const probOf = (r: SnapshotRow): number | null => {
    if (r.modelPick === "away") return r.modelAway;
    if (r.modelPick === "home") return r.modelHome;
    if (r.modelPick === "draw") return r.modelDraw;
    return null;
  };
  const priceOf = (r: SnapshotRow): number | null => {
    if (r.modelPick === "away") return r.bookAwayPrice;
    if (r.modelPick === "home") return r.bookHomePrice;
    if (r.modelPick === "draw") return r.bookDrawPrice;
    return null;
  };
  const recent = rows.filter((r) => r.gradedAt !== null).slice(0, 20).map((r) => ({
    id: r.id, sport: r.sport, league: r.league || null,
    awayTeam: r.awayTeam, homeTeam: r.homeTeam, gameDate: r.gameDate,
    modelPick: r.modelPick, modelProb: probOf(r),
    bookPick: r.bookPick, bookPrice: priceOf(r),
    winner: r.winner,
    modelCorrect: r.modelCorrect === null ? null : r.modelCorrect === 1,
    bookCorrect: r.bookCorrect === null ? null : r.bookCorrect === 1,
    source: r.source,
  }));
  const snapshotted = rows.filter((r) => r.snapshotAt !== null);
  const gradedRows = rows.filter((r) => r.gradedAt !== null);
  const maxDate = (list: SnapshotRow[], key: "snapshotAt" | "gradedAt"): string | null => {
    let best: number | null = null;
    for (const r of list) {
      const v = r[key];
      if (v !== null) {
        const t = v instanceof Date ? v.getTime() : Number(v);
        if (best === null || t > best) best = t;
      }
    }
    return best === null ? null : new Date(best).toISOString();
  };
  return {
    backtest: trackEra(rows.filter((r) => r.source === "backtest")),
    live: trackEra(rows.filter((r) => r.source === "live")),
    recent,
    lastSnapshotAt: maxDate(snapshotted, "snapshotAt"),
    lastGradedAt: maxDate(gradedRows, "gradedAt"),
  };
}

export const Actions = {
  getDashboard: defineAction({ request: z.object({ sport: z.enum(sports).default("nhl") }), response: dashboardResponse, async handler(ctx, args) { return loadDashboard(ctx, args.sport); } }),
  refreshDaily: defineAction({ request: z.object({}), response: z.object({ status: z.enum(["success", "partial", "failed"]), message: z.string(), rowCount: z.number(), snapshotDate: z.string() }), async handler(ctx) { const result = await refresh(ctx); try { await fetchHotStreaks(ctx, true); } catch { /* Keep odds refresh independent of free NHL insight refresh. */ } try { await fetchNflHotStreaks(ctx, true); } catch { /* Same for the NFL leg. */ } try { await fetchColdStreaks(ctx, true); } catch { /* Cold streaks refresh with the same daily job. */ } try { await fetchNflColdStreaks(ctx, true); } catch { /* Same for the NFL leg. */ } try { await fetchNbaHotStreaks(ctx, true); } catch { /* Same for the NBA leg. */ } try { await fetchNbaColdStreaks(ctx, true); } catch { /* Same for the NBA leg. */ } try { await fetchLikelyScorers(ctx, "nhl", true); } catch { /* Likely scorers warm with the same daily job. */ } try { await fetchLikelyScorers(ctx, "nfl", true); } catch { /* Same for the NFL leg. */ } try { await fetchLikelyScorers(ctx, "nba", true); } catch { /* Same for the NBA leg. */ } try { await warmNflForm(ctx); } catch { /* Flip % v2 form warms with the same daily job. */ } try { await warmNbaForm(ctx); } catch { /* Same for the NBA leg. */ } try { await fetchKeyInjuries(ctx, "nfl", true); } catch { /* Injury warnings warm with the same daily job. */ } try { await fetchKeyInjuries(ctx, "nba", true); } catch { /* Same for the NBA leg. */ } try { await fetchKeyInjuries(ctx, "nhl", true); } catch { /* Same for the NHL leg. */ } try { await fetchKeyInjuries(ctx, "soccer", true, "mls"); } catch { /* Same for the MLS leg. */ } try { await fetchKeyInjuries(ctx, "soccer", true, "epl"); } catch { /* Same for the EPL leg. */ } try { await fetchLikelyScorers(ctx, "soccer", true, "mls"); } catch { /* Same for the MLS leg. */ } try { await fetchLikelyScorers(ctx, "soccer", true, "epl"); } catch { /* Same for the EPL leg. */ } try { await fetchSoccerHotStreaks(ctx, "mls", true); } catch { /* Same for the MLS leg. */ } try { await fetchSoccerHotStreaks(ctx, "epl", true); } catch { /* Same for the EPL leg. */ } try { await fetchSoccerColdStreaks(ctx, "mls", true); } catch { /* Same for the MLS leg. */ } try { await fetchSoccerColdStreaks(ctx, "epl", true); } catch { /* Same for the EPL leg. */ } try { await loadSoccerStandings(ctx, "mls"); } catch { /* Standings warm with the same daily job. */ } try { await loadSoccerStandings(ctx, "epl"); } catch { /* Same for the EPL leg. */ } return result; } }),
  getNhlOverview: defineAction({ request: z.object({}), response: nhlOverviewResponse, async handler() { return loadNhlOverview(); } }),
  getFirstGoalMatchup: defineAction({ request: z.object({ awayTeam: z.enum(teamCodes), homeTeam: z.enum(teamCodes), force: z.boolean().default(false) }).refine((value) => value.awayTeam !== value.homeTeam, { message: "Choose two different teams" }), response: firstGoalMatchupResponse, async handler(ctx, args) { return loadFirstGoalMatchup(ctx, args.awayTeam, args.homeTeam, args.force); } }),
  getHotStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: hotStreaksResponse, async handler(ctx, args) { return fetchHotStreaks(ctx, args.force); } }),
  getNhlRoster: defineAction({ request: z.object({ team: z.enum(teamCodes) }), response: rosterResponse, async handler(_ctx, args) { return loadRoster(args.team); } }),
  getNhlPlayerGameLog: defineAction({ request: z.object({ playerId: z.number().int().positive() }), response: gameLogResponse, async handler(_ctx, args) { return loadNhlPlayerGameLog(args.playerId); } }),
  getNflOverview: defineAction({ request: z.object({ week: z.number().int().min(1).max(18).optional() }), response: nflOverviewResponse, async handler(ctx, args) { return loadNflOverview(args.week, ctx); } }),
  getNflMatchup: defineAction({ request: z.object({ awayTeam: z.enum(nflTeamCodes), homeTeam: z.enum(nflTeamCodes), force: z.boolean().default(false) }).refine((value) => value.awayTeam !== value.homeTeam, { message: "Choose two different teams" }), response: nflMatchupResponse, async handler(ctx, args) { return loadNflMatchup(ctx, args.awayTeam, args.homeTeam, args.force); } }),
  getNflHotStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: nflHotStreaksResponse, async handler(ctx, args) { return fetchNflHotStreaks(ctx, args.force); } }),
  getColdStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: coldStreaksResponse, async handler(ctx, args) { return fetchColdStreaks(ctx, args.force); } }),
  getNflColdStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: nflColdStreaksResponse, async handler(ctx, args) { return fetchNflColdStreaks(ctx, args.force); } }),
  getNbaOverview: defineAction({ request: z.object({}), response: nbaOverviewResponse, async handler(ctx) { return loadNbaOverview(ctx); } }),
  getKeyInjuries: defineAction({ request: z.object({ sport: z.enum(sports), league: z.enum(soccerLeagues).optional() }), response: keyInjuriesResponse, async handler(ctx, args) { return fetchKeyInjuries(ctx, args.sport, false, args.league); } }),
  getNbaMatchup: defineAction({ request: z.object({ awayTeam: z.enum(nbaTeamCodes), homeTeam: z.enum(nbaTeamCodes), force: z.boolean().default(false) }).refine((value) => value.awayTeam !== value.homeTeam, { message: "Choose two different teams" }), response: nbaMatchupResponse, async handler(ctx, args) { return loadNbaMatchup(ctx, args.awayTeam, args.homeTeam, args.force); } }),
  getNbaHotStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: nbaHotStreaksResponse, async handler(ctx, args) { return fetchNbaHotStreaks(ctx, args.force); } }),
  getNbaColdStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: nbaColdStreaksResponse, async handler(ctx, args) { return fetchNbaColdStreaks(ctx, args.force); } }),
  getLikelyScorers: defineAction({ request: z.object({ sport: z.enum(sports), league: z.enum(soccerLeagues).optional(), force: z.boolean().default(false) }), response: likelyScorersResponse, async handler(ctx, args) { return fetchLikelyScorers(ctx, args.sport, args.force, args.league); } }),
  getMatchupScorers: defineAction({ request: z.object({ sport: z.enum(sports), away: z.string().min(1), home: z.string().min(1), league: z.enum(soccerLeagues).optional() }), response: matchupScorersResponse, async handler(ctx, args) { return fetchMatchupScorers(ctx, args.sport, args.away, args.home, args.league); } }),
  getBookRead: defineAction({ request: z.object({ sport: z.enum(sports), awayTeam: z.string().min(1), homeTeam: z.string().min(1), league: z.string().nullable().optional() }), response: bookReadResponse, async handler(ctx, args) { return loadBookRead(ctx, args.sport, args.awayTeam, args.homeTeam, args.league ?? null); } }),
  getHamPlates: defineAction({
    request: z.object({}),
    response: z.object({ plates: z.array(z.object({
      slug: z.string(), name: z.string(), tierLabel: z.string(), tierOdds: z.string(),
      imageData: z.string().nullable(), description: z.string().nullable(),
    })) }),
    async handler(ctx) {
      const rows = await ctx.db.select().from(schema.hamSelectionPlates).orderBy(schema.hamSelectionPlates.sortOrder);
      return { plates: rows.map((r) => ({ slug: r.slug, name: r.name, tierLabel: r.tierLabel, tierOdds: r.tierOdds, imageData: r.imageData, description: r.description })) };
    },
  }),
  saveHamPlate: defineAction({
    request: z.object({
      adminToken: adminTokenSchema,
      slug: z.string().min(1).max(32),
      imageData: z.string().max(15_000_000).nullable().optional(),
      description: z.string().trim().max(600).nullable().optional(),
    }),
    response: z.object({ saved: z.boolean() }),
    async handler(ctx, args) {
      requireAdmin(args);
      const set: { imageData?: string | null; description?: string | null; updatedAt: Date } = { updatedAt: new Date() };
      if (args.imageData !== undefined) set.imageData = args.imageData;
      if (args.description !== undefined) set.description = args.description;
      await ctx.db.update(schema.hamSelectionPlates).set(set).where(eq(schema.hamSelectionPlates.slug, args.slug));
      return { saved: true };
    },
  }),  getNflRoster: defineAction({ request: z.object({ team: z.enum(nflTeamCodes) }), response: nflRosterResponse, async handler(ctx, args) { return loadNflRoster(ctx, args.team); } }),
  getNflPlayerGameLog: defineAction({ request: z.object({ team: z.enum(nflTeamCodes), playerId: z.number().int().positive() }), response: nflGameLogResponse, async handler(ctx, args) { return loadNflPlayerGameLog(ctx, args.team, args.playerId); } }),
  getNbaRoster: defineAction({ request: z.object({ team: z.enum(nbaTeamCodes) }), response: nbaRosterResponse, async handler(ctx, args) { return loadNbaRoster(ctx, args.team); } }),
  getNbaPlayerGameLog: defineAction({ request: z.object({ team: z.enum(nbaTeamCodes), playerId: z.number().int().positive() }), response: nbaGameLogResponse, async handler(ctx, args) { return loadNbaPlayerGameLog(ctx, args.team, args.playerId); } }),
  getSoccerOverview: defineAction({ request: z.object({ league: z.enum(soccerLeagues) }), response: soccerOverviewResponse, async handler(ctx, args) { return loadSoccerOverview(ctx, args.league); } }),
  getSoccerMatchup: defineAction({ request: z.object({ league: z.enum(soccerLeagues), awayTeam: z.string(), homeTeam: z.string(), force: z.boolean().default(false) }).refine((value) => value.awayTeam !== value.homeTeam, { message: "Choose two different teams" }), response: soccerMatchupResponse, async handler(ctx, args) { return loadSoccerMatchup(ctx, args.league, args.awayTeam, args.homeTeam, args.force); } }),
  getSoccerHotStreaks: defineAction({ request: z.object({ league: z.enum(soccerLeagues), force: z.boolean().default(false) }), response: soccerHotStreaksResponse, async handler(ctx, args) { return fetchSoccerHotStreaks(ctx, args.league, args.force); } }),
  getSoccerColdStreaks: defineAction({ request: z.object({ league: z.enum(soccerLeagues), force: z.boolean().default(false) }), response: soccerColdStreaksResponse, async handler(ctx, args) { return fetchSoccerColdStreaks(ctx, args.league, args.force); } }),
  getSoccerRoster: defineAction({ request: z.object({ league: z.enum(soccerLeagues), team: z.string() }), response: soccerRosterResponse, async handler(ctx, args) { return loadSoccerRoster(ctx, args.league, args.team); } }),
  getSoccerPlayerGameLog: defineAction({ request: z.object({ league: z.enum(soccerLeagues), team: z.string(), playerId: z.number().int().positive() }), response: soccerGameLogResponse, async handler(ctx, args) { return loadSoccerPlayerGameLog(ctx, args.league, args.team, args.playerId); } }),
  getPremiumBoard: defineAction({ request: z.object({ sport: z.enum(sports) }), response: premiumResponse, async handler(ctx, args) { return loadPremium(ctx, args.sport); } }),
  getTrackRecord: defineAction({ request: z.object({}), response: trackRecordResponse, async handler(ctx) { return loadTrackRecord(ctx); } }),
  getAdminStatus: defineAction({ request: z.object({}), response: z.object({ configured: z.boolean() }), async handler() { return { configured: !!process.env.ADMIN_TOKEN?.trim() }; } }),
  getUsageStats: defineAction({ request: z.object({ adminToken: adminTokenSchema }), response: usageStatsResponse, async handler(ctx, args) { requireAdmin(args); return loadUsageStats(ctx); } }),
  refreshAllSportsbooks: defineAction({ request: z.object({ adminToken: adminTokenSchema }), response: premiumRefreshResponse, async handler(ctx, args) { requireAdmin(args); return refreshAllPremium(ctx); } }),
  getSportsGameOddsKeyStatus: defineAction({ request: z.object({}), response: providerStatusResponse, async handler(ctx) { return getProviderStatus(ctx, "sportsgameodds"); } }),
  saveSportsGameOddsKey: defineAction({
    request: z.object({ key: z.string().trim().min(16).max(512), adminToken: adminTokenSchema }),
    response: providerStatusResponse,
    async handler(ctx, args): Promise<z.infer<typeof providerStatusResponse>> {
      requireAdmin(args);
      const apiKey = args.key.trim();
      const validation = await validateSportsGameOddsKey({ apiKey });
      if (!validation.ok) throw providerError(validation);
      return upsertProviderKey(ctx, "sportsgameodds", apiKey);
    },
  }),
  removeSportsGameOddsKey: defineAction({
    request: z.object({ adminToken: adminTokenSchema }),
    response: removedResponse,
    async handler(ctx, args): Promise<z.infer<typeof removedResponse>> {
      requireAdmin(args);
      return removeProviderKey(ctx, "sportsgameodds");
    },
  }),
  getOddsApiKeyStatus: defineAction({ request: z.object({}), response: providerStatusResponse, async handler(ctx) { return getProviderStatus(ctx, "theoddsapi"); } }),
  saveOddsApiKey: defineAction({
    request: z.object({ key: z.string().trim().min(16).max(512), adminToken: adminTokenSchema }),
    response: providerStatusResponse,
    async handler(ctx, args): Promise<z.infer<typeof providerStatusResponse>> {
      requireAdmin(args);
      const apiKey = args.key.trim();
      const validation = await validateOddsApiKey({ apiKey });
      if (!validation.ok) throw providerError(validation, "theoddsapi");
      return upsertProviderKey(ctx, "theoddsapi", apiKey);
    },
  }),
  removeOddsApiKey: defineAction({
    request: z.object({ adminToken: adminTokenSchema }),
    response: removedResponse,
    async handler(ctx, args): Promise<z.infer<typeof removedResponse>> {
      requireAdmin(args);
      return removeProviderKey(ctx, "theoddsapi");
    },
  }),
};
