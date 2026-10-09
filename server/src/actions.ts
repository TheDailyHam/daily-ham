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
import { fetchOddsApiEvents, parseOddsApiPayload, validateOddsApiKey } from "./oddsapi.js";
import {
  NFL_SEASON, enrichFirstScores, fetchNflGameSummary, fetchNflRoster,
  fetchNflScoreboard, fetchNflStandings, fetchNflTeamGames, nflDivision, nflTeamMeta,
  type NflTeamGame,
} from "./nfl.js";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import * as schema from "./schema.js";

const sports = ["nhl", "nfl"] as const;
type Sport = (typeof sports)[number];
const teamCodes = ["ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH"] as const;
// ESPN NFL abbreviations (verified 2026-10-08). Note BUF/DAL/PIT collide
// with NHL codes — the two sports never share a schema or action.
const nflTeamCodes = ["ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH"] as const;
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
        offers.push({ eventId, matchup: eventMatchup(event), startsAt, oddId: textValue(odd.oddID) ?? oddKey, stat: textValue(odd.statID) ?? "market", marketName: textValue(odd.marketName) ?? textValue(odd.statID) ?? "Market", entity: eventEntity(event, odd), entityType: textValue(odd.playerID) ? "player" : textValue(odd.statEntityID) === "home" || textValue(odd.statEntityID) === "away" ? "team" : "event", period: textValue(odd.periodID) ?? "game", betType: textValue(odd.betTypeID) ?? "—", side: textValue(odd.sideID) ?? "—", book, odds: textValue(value.odds) ?? textValue(odd.bookOdds), fairOdds: textValue(odd.fairOdds), line, openingOdds: textValue(value.openOdds) ?? textValue(value.openingOdds), openingLine });
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

async function fetchPremiumAndCache(ctx: Ctx, sport: Sport, provider: OddsProvider): Promise<z.infer<typeof premiumResponse>> {
  const fetchedAt = new Date();
  let parsed: z.infer<typeof premiumResponse>;
  if (provider.name === "theoddsapi") {
    // One request carries every game, market and bookmaker.
    const result = await fetchOddsApiEvents({ apiKey: provider.apiKey, sport });
    if (!result.ok) throw providerError(result, "theoddsapi");
    const mapped = parseOddsApiPayload(result.payload.data, { sport, marketNames: result.payload.marketNames });
    const leagueLabel = sport === "nfl" ? "NFL" : "NHL";
    parsed = { sport, fetchedAt: fetchedAt.toISOString(), eventCount: mapped.eventCount, marketCount: mapped.marketCount, offerCount: mapped.offerCount, offers: mapped.offers, cacheStatus: "fresh", healthMessage: `Odds updated successfully (The Odds API · ${leagueLabel})` };
  } else {
    const league = sport === "nfl" ? "NFL" as const : "NHL" as const;
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

async function fetchHotStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof hotStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "hot-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return hotStreaksResponse.parse(JSON.parse(cached.payloadJson));
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
  type Acc = { playerId: number; name: string; team: (typeof teamCodes)[number]; position: string; games: z.infer<typeof hotGameSchema>[] };
  const byPlayer = new Map<number, Acc>();
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

async function loadNflOverview(week?: number): Promise<z.infer<typeof nflOverviewResponse>> {
  const board = await fetchNflScoreboard(week);
  let standings: z.infer<typeof nflStandingSchema>[] = [];
  let standingsUrl = "";
  try {
    const data = await fetchNflStandings();
    standingsUrl = data.sourceUrl;
    standings = data.standings.map((s) => ({ ...s, division: s.division || nflDivision(s.team) }));
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

async function fetchNflHotStreaks(ctx: Ctx, force: boolean): Promise<z.infer<typeof nflHotStreaksResponse>> {
  const db = ctx.db;
  const cachedRows = await db.select().from(schema.nhlInsightCache).where(eq(schema.nhlInsightCache.key, "nfl-hot-streaks")).limit(1);
  const cached = cachedRows[0];
  if (!force && cached && cached.expiresAt.getTime() > Date.now()) return nflHotStreaksResponse.parse(JSON.parse(cached.payloadJson));

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
  type Acc = { playerId: number; name: string; team: string; games: z.infer<typeof nflHotGameSchema>[] };
  const byPlayer = new Map<number, Acc>();
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

export const Actions = {
  getDashboard: defineAction({ request: z.object({ sport: z.enum(sports).default("nhl") }), response: dashboardResponse, async handler(ctx, args) { return loadDashboard(ctx, args.sport); } }),
  refreshDaily: defineAction({ request: z.object({}), response: z.object({ status: z.enum(["success", "partial", "failed"]), message: z.string(), rowCount: z.number(), snapshotDate: z.string() }), async handler(ctx) { const result = await refresh(ctx); try { await fetchHotStreaks(ctx, true); } catch { /* Keep odds refresh independent of free NHL insight refresh. */ } try { await fetchNflHotStreaks(ctx, true); } catch { /* Same for the NFL leg. */ } return result; } }),
  getNhlOverview: defineAction({ request: z.object({}), response: nhlOverviewResponse, async handler() { return loadNhlOverview(); } }),
  getFirstGoalMatchup: defineAction({ request: z.object({ awayTeam: z.enum(teamCodes), homeTeam: z.enum(teamCodes), force: z.boolean().default(false) }).refine((value) => value.awayTeam !== value.homeTeam, { message: "Choose two different teams" }), response: firstGoalMatchupResponse, async handler(ctx, args) { return loadFirstGoalMatchup(ctx, args.awayTeam, args.homeTeam, args.force); } }),
  getHotStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: hotStreaksResponse, async handler(ctx, args) { return fetchHotStreaks(ctx, args.force); } }),
  getNhlRoster: defineAction({ request: z.object({ team: z.enum(teamCodes) }), response: rosterResponse, async handler(_ctx, args) { return loadRoster(args.team); } }),
  getNhlPlayerGameLog: defineAction({ request: z.object({ playerId: z.number().int().positive() }), response: gameLogResponse, async handler(_ctx, args) { return loadNhlPlayerGameLog(args.playerId); } }),
  getNflOverview: defineAction({ request: z.object({ week: z.number().int().min(1).max(18).optional() }), response: nflOverviewResponse, async handler(_ctx, args) { return loadNflOverview(args.week); } }),
  getNflMatchup: defineAction({ request: z.object({ awayTeam: z.enum(nflTeamCodes), homeTeam: z.enum(nflTeamCodes), force: z.boolean().default(false) }).refine((value) => value.awayTeam !== value.homeTeam, { message: "Choose two different teams" }), response: nflMatchupResponse, async handler(ctx, args) { return loadNflMatchup(ctx, args.awayTeam, args.homeTeam, args.force); } }),
  getNflHotStreaks: defineAction({ request: z.object({ force: z.boolean().default(false) }), response: nflHotStreaksResponse, async handler(ctx, args) { return fetchNflHotStreaks(ctx, args.force); } }),
  getNflRoster: defineAction({ request: z.object({ team: z.enum(nflTeamCodes) }), response: nflRosterResponse, async handler(ctx, args) { return loadNflRoster(ctx, args.team); } }),
  getNflPlayerGameLog: defineAction({ request: z.object({ team: z.enum(nflTeamCodes), playerId: z.number().int().positive() }), response: nflGameLogResponse, async handler(ctx, args) { return loadNflPlayerGameLog(ctx, args.team, args.playerId); } }),
  getPremiumBoard: defineAction({ request: z.object({ sport: z.enum(sports) }), response: premiumResponse, async handler(ctx, args) { return loadPremium(ctx, args.sport); } }),
  getAdminStatus: defineAction({ request: z.object({}), response: z.object({ configured: z.boolean() }), async handler() { return { configured: !!process.env.ADMIN_TOKEN?.trim() }; } }),
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
