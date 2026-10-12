// Keyless ESPN data client for the soccer leg of the Daily Ham.
//
// Mirrors the two-river architecture: everything here is free and unlimited
// (official ESPN JSON feeds). The quota-limited odds providers (oddsapi.ts /
// provider.ts) supply sportsbook prices only and never gate this data.
//
// Two leagues are bundled under one "soccer" sport:
//   mls  soccer/usa.1  (Major League Soccer, 30 clubs, calendar-year season)
//   epl  soccer/eng.1  (English Premier League, 20 clubs, Aug–May season)
//
// Verified 2026-10-11 against the live feeds:
//   scoreboard  site.api.espn.com/apis/site/v2/sports/soccer/{usa.1,eng.1}/scoreboard
//   teams       site.api.espn.com/.../soccer/{usa.1,eng.1}/teams (ids + colors)
//   record      sports.core.api.espn.com/v2/sports/soccer/leagues/{usa.1,eng.1}
//                 /seasons/2026/types/1/teams/{id}/record  (W/D/L, GF/GA)
//   roster      site.api.espn.com/.../soccer/{usa.1,eng.1}/teams/{id}/roster
//   leaders     .../seasons/2026/types/1/teams/{id}/leaders (goalsLeaders etc.)
//   schedule    site.api.espn.com/.../soccer/{usa.1,eng.1}/teams/{id}/schedule
//   summary     site.api.espn.com/.../soccer/{usa.1,eng.1}/summary?event={id}
//   injuries    sports.core.api.espn.com/.../soccer/leagues/{usa.1,eng.1}/teams/{id}/injuries
//
// Soccer shape notes vs the NBA client:
// - Seasons are labeled by STARTING year: the 2026-27 EPL season is 2026,
//   and the 2026 MLS season is 2026.
// - The site-API standings endpoint returns {} for soccer, and the core-API
//   standings resource does not inline entries (unlike NBA). Standings are
//   therefore built from the per-team record endpoint (W/D/L, points, GF/GA,
//   streak) — 50 keyless requests, cached 24h by the caller.
// - Scores arrive inconsistently: numbers on MLS, numeric strings on EPL,
//   and core-ref objects {value, displayValue} on team schedules.
// - Draws are first-class: the model is three-way (home/draw/away) via a
//   Poisson goal model, never binary.

export type SoccerLeague = "mls" | "epl";
export const SOCCER_LEAGUES: SoccerLeague[] = ["mls", "epl"];

const LEAGUE_PATH: Record<SoccerLeague, string> = { mls: "usa.1", epl: "eng.1" };
const SG_ODDS_LEAGUE: Record<SoccerLeague, "MLS" | "EPL"> = { mls: "MLS", epl: "EPL" };
const ODDS_API_KEY: Record<SoccerLeague, string> = { mls: "soccer_usa_mls", epl: "soccer_epl" };
// ESPN labels soccer seasons by the year they START.
export const SOCCER_SEASON = 2026;

export function soccerEspnPath(league: SoccerLeague): string { return LEAGUE_PATH[league]; }
export function soccerSportsGameOddsLeague(league: SoccerLeague): "MLS" | "EPL" { return SG_ODDS_LEAGUE[league]; }
export function soccerOddsApiKey(league: SoccerLeague): string { return ODDS_API_KEY[league]; }
export function soccerLeagueLabel(league: SoccerLeague): string { return league === "mls" ? "MLS" : "Premier League"; }

function siteBase(league: SoccerLeague): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE_PATH[league]}`;
}
function coreBase(league: SoccerLeague): string {
  return `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${LEAGUE_PATH[league]}`;
}

export type SoccerTeamMeta = { abbr: string; id: number; name: string; color: string; secondary: string };

// Hardcoded from the teams feed (stable ESPN ids + official club colors,
// verified 2026-10-11). Clubs whose primary ESPN color is white keep their
// colored alternate as the display color so theming stays visible.
export const MLS_TEAMS: SoccerTeamMeta[] = [
  { abbr: "ATL", id: 18418, name: "Atlanta United FC", color: "#9d2235", secondary: "#aa9767" },
  { abbr: "ATX", id: 20906, name: "Austin FC", color: "#00b140", secondary: "#000000" },
  { abbr: "MTL", id: 9720, name: "CF Montréal", color: "#003da6", secondary: "#c1c5c9" },
  { abbr: "CLT", id: 21300, name: "Charlotte FC", color: "#0085ca", secondary: "#000000" },
  { abbr: "CHI", id: 182, name: "Chicago Fire FC", color: "#7ccdef", secondary: "#ff0000" },
  { abbr: "COL", id: 184, name: "Colorado Rapids", color: "#8a2432", secondary: "#8ab7e9" },
  { abbr: "CLB", id: 183, name: "Columbus Crew", color: "#000000", secondary: "#fedd00" },
  { abbr: "DC", id: 193, name: "D.C. United", color: "#000000", secondary: "#d61018" },
  { abbr: "CIN", id: 18267, name: "FC Cincinnati", color: "#003087", secondary: "#fe5000" },
  { abbr: "DAL", id: 185, name: "FC Dallas", color: "#c6093b", secondary: "#001f5b" },
  { abbr: "HOU", id: 6077, name: "Houston Dynamo FC", color: "#ff6b00", secondary: "#101820" },
  { abbr: "MIA", id: 20232, name: "Inter Miami CF", color: "#231f20", secondary: "#f7b5cd" },
  { abbr: "LA", id: 187, name: "LA Galaxy", color: "#00235d", secondary: "#ffffff" },
  { abbr: "LAFC", id: 18966, name: "LAFC", color: "#000000", secondary: "#c7a36f" },
  { abbr: "MIN", id: 17362, name: "Minnesota United FC", color: "#000000", secondary: "#9bcde4" },
  { abbr: "NSH", id: 18986, name: "Nashville SC", color: "#ece83a", secondary: "#1f1646" },
  { abbr: "NE", id: 189, name: "New England Revolution", color: "#022166", secondary: "#ce0e2d" },
  { abbr: "NYC", id: 17606, name: "New York City FC", color: "#9fd2ff", secondary: "#000229" },
  { abbr: "ORL", id: 12011, name: "Orlando City SC", color: "#60269e", secondary: "#f0d283" },
  { abbr: "PHI", id: 10739, name: "Philadelphia Union", color: "#051f31", secondary: "#e0d0a6" },
  { abbr: "POR", id: 9723, name: "Portland Timbers", color: "#2c5234", secondary: "#c99700" },
  { abbr: "RSL", id: 4771, name: "Real Salt Lake", color: "#a32035", secondary: "#daa900" },
  { abbr: "RBNY", id: 190, name: "Red Bull New York", color: "#ba0c2f", secondary: "#ffc72c" },
  { abbr: "SD", id: 22529, name: "San Diego FC", color: "#697a7c", secondary: "#f89e1a" },
  { abbr: "SJ", id: 191, name: "San Jose Earthquakes", color: "#003da6", secondary: "#ffffff" },
  { abbr: "SEA", id: 9726, name: "Seattle Sounders FC", color: "#2dc84d", secondary: "#0033a0" },
  { abbr: "SKC", id: 186, name: "Sporting Kansas City", color: "#a7c6ed", secondary: "#0a2240" },
  { abbr: "STL", id: 21812, name: "St. Louis CITY SC", color: "#ec1458", secondary: "#001544" },
  { abbr: "TOR", id: 7318, name: "Toronto FC", color: "#aa182c", secondary: "#a2a9ad" },
  { abbr: "VAN", id: 9727, name: "Vancouver Whitecaps", color: "#12284c", secondary: "#ffffff" },
];

export const EPL_TEAMS: SoccerTeamMeta[] = [
  { abbr: "BOU", id: 349, name: "AFC Bournemouth", color: "#f42727", secondary: "#b57edc" },
  { abbr: "ARS", id: 359, name: "Arsenal", color: "#e20520", secondary: "#003399" },
  { abbr: "AVL", id: 362, name: "Aston Villa", color: "#660e36", secondary: "#000000" },
  { abbr: "BRE", id: 337, name: "Brentford", color: "#f42727", secondary: "#0f1c3f" },
  { abbr: "BHA", id: 331, name: "Brighton & Hove Albion", color: "#0606fa", secondary: "#005f60" },
  { abbr: "CHE", id: 363, name: "Chelsea", color: "#144992", secondary: "#ffffff" },
  { abbr: "COV", id: 388, name: "Coventry City", color: "#87cced", secondary: "#ffffff" },
  { abbr: "CRY", id: 384, name: "Crystal Palace", color: "#0202fb", secondary: "#000000" },
  { abbr: "EVE", id: 368, name: "Everton", color: "#0606fa", secondary: "#ffffff" },
  { abbr: "FUL", id: 370, name: "Fulham", color: "#cc0000", secondary: "#ffffff" },
  { abbr: "HUL", id: 306, name: "Hull City", color: "#f28800", secondary: "#ffffff" },
  { abbr: "IPS", id: 373, name: "Ipswich Town", color: "#0000fa", secondary: "#f5f2dc" },
  { abbr: "LEE", id: 357, name: "Leeds United", color: "#ffcd00", secondary: "#ffffff" },
  { abbr: "LIV", id: 364, name: "Liverpool", color: "#d11317", secondary: "#ffffff" },
  { abbr: "MNC", id: 382, name: "Manchester City", color: "#99c5ea", secondary: "#000000" },
  { abbr: "MAN", id: 360, name: "Manchester United", color: "#da020e", secondary: "#4169e1" },
  { abbr: "NEW", id: 361, name: "Newcastle United", color: "#000000", secondary: "#0b1b3d" },
  { abbr: "NFO", id: 393, name: "Nottingham Forest", color: "#c8102e", secondary: "#1b3624" },
  { abbr: "SUN", id: 366, name: "Sunderland", color: "#eb172b", secondary: "#ffb6c1" },
  { abbr: "TOT", id: 367, name: "Tottenham Hotspur", color: "#0b1426", secondary: "#ffffff" },
];

export function soccerTeams(league: SoccerLeague): SoccerTeamMeta[] {
  return league === "mls" ? MLS_TEAMS : EPL_TEAMS;
}
const metaByLeagueAbbr = new Map<string, SoccerTeamMeta>();
for (const league of SOCCER_LEAGUES) {
  for (const t of soccerTeams(league)) metaByLeagueAbbr.set(`${league}:${t.abbr}`, t);
}
const metaByLeagueId = new Map<string, SoccerTeamMeta>();
for (const league of SOCCER_LEAGUES) {
  for (const t of soccerTeams(league)) metaByLeagueId.set(`${league}:${t.id}`, t);
}
export function soccerTeamMeta(league: SoccerLeague, abbr: string): SoccerTeamMeta | null {
  return metaByLeagueAbbr.get(`${league}:${abbr}`) ?? null;
}
export function soccerAbbrById(league: SoccerLeague, id: number): string | null {
  return metaByLeagueId.get(`${league}:${id}`)?.abbr ?? null;
}
export function soccerTeamCodes(league: SoccerLeague): [string, ...string[]] {
  return soccerTeams(league).map((t) => t.abbr) as [string, ...string[]];
}

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  // Team-schedule scores arrive as core-ref objects {value, displayValue}.
  const r = record(value);
  if (r) {
    const v = num(r.value);
    if (v !== null) return v;
    const dv = num(r.displayValue);
    if (dv !== null) return dv;
  }
  return null;
}
function int(value: unknown): number | null { const n = num(value); return n === null ? null : Math.trunc(n); }
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`ESPN request failed (${response.status}): ${url}`);
  return response.json() as Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Scoreboard (address slates by date; soccer uses YYYYMMDD like the NBA)
// ---------------------------------------------------------------------------

export type SoccerGameSide = { abbr: string; name: string; score: number | null; winner: boolean };
export type SoccerGame = {
  id: number; date: string; name: string; shortName: string;
  state: "pre" | "live" | "final"; detail: string;
  away: SoccerGameSide; home: SoccerGameSide;
};

function parseGame(event: unknown): SoccerGame | null {
  const e = record(event);
  if (!e) return null;
  const id = int(e.id);
  const date = text(e.date);
  const c0 = record(arr(e.competitions)[0]);
  if (id === null || !date || !c0) return null;
  const statusType = record(record(c0.status)?.type);
  const statusName = text(statusType?.name) ?? "";
  const detail = text(statusType?.shortDetail) ?? "";
  const state: SoccerGame["state"] =
    statusName === "STATUS_FINAL" || statusName === "STATUS_FULL_TIME" ? "final"
    : statusName === "STATUS_IN_PROGRESS" || statusName === "STATUS_FIRST_HALF" || statusName === "STATUS_SECOND_HALF" || statusName === "STATUS_HALFTIME" ? "live"
    : "pre";
  const sides: Record<string, SoccerGameSide> = {};
  for (const compValue of arr(c0.competitors)) {
    const competitor = record(compValue);
    if (!competitor) continue;
    const team = record(competitor.team);
    const abbr = text(team?.abbreviation) ?? "—";
    const homeAway = text(competitor.homeAway) ?? "";
    sides[homeAway] = {
      abbr,
      name: text(team?.displayName) ?? abbr,
      score: int(competitor.score),
      winner: competitor.winner === true,
    };
  }
  const away = sides.away;
  const home = sides.home;
  if (!away || !home) return null;
  return { id, date, name: text(e.name) ?? `${away.abbr} @ ${home.abbr}`, shortName: text(e.shortName) ?? `${away.abbr} @ ${home.abbr}`, state, detail, away, home };
}

/** Fetch the scoreboard slate. `dates` is an optional YYYYMMDD date. */
export async function fetchSoccerScoreboard(league: SoccerLeague, dates?: string): Promise<{ season: number; games: SoccerGame[]; sourceUrl: string }> {
  const url = dates ? `${siteBase(league)}/scoreboard?dates=${dates}` : `${siteBase(league)}/scoreboard`;
  const payload = await getJson(url);
  const root = record(payload);
  const season = int(record(root?.season)?.year) ?? SOCCER_SEASON;
  const games = arr(root?.events).flatMap((event) => { const g = parseGame(event); return g ? [g] : []; });
  return { season, games, sourceUrl: url };
}

// ---------------------------------------------------------------------------
// Standings — built from the per-team record endpoint (the site/core
// standings endpoints return no entries for soccer). W/D/L, points, GF/GA
// and streak per club; 50 keyless requests total, cached 24h by the caller.
// ---------------------------------------------------------------------------

export type SoccerStanding = {
  team: string; name: string;
  played: number; wins: number; draws: number; losses: number; points: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number;
  streak: string | null;
  homeWins: number; homeDraws: number; homeLosses: number;
  awayWins: number; awayDraws: number; awayLosses: number;
};

function recordStat(stats: unknown[], name: string): number {
  for (const s of stats) {
    const r = record(s);
    if (r && text(r.name) === name) {
      const v = num(r.value);
      if (v !== null) return Math.trunc(v);
      const dv = text(r.displayValue);
      const parsed = dv === null ? NaN : parseInt(dv.replace("+", ""), 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

export async function fetchSoccerTeamRecord(league: SoccerLeague, abbr: string): Promise<SoccerStanding | null> {
  const meta = soccerTeamMeta(league, abbr);
  if (!meta) return null;
  const url = `${coreBase(league)}/seasons/${SOCCER_SEASON}/types/1/teams/${meta.id}/record?lang=en&region=us`;
  const payload = await getJson(url);
  const items = arr(record(payload)?.items);
  const overall = record(items[0]);
  if (!overall) return null;
  const stats = arr(overall.stats);
  const streakRaw = (() => {
    for (const s of stats) {
      const r = record(s);
      if (r && text(r.name) === "streak") return text(r.displayValue);
    }
    return null;
  })();
  return {
    team: abbr,
    name: meta.name,
    played: recordStat(stats, "gamesPlayed"),
    wins: recordStat(stats, "wins"),
    draws: recordStat(stats, "ties"),
    losses: recordStat(stats, "losses"),
    points: recordStat(stats, "points"),
    goalsFor: recordStat(stats, "pointsFor"),
    goalsAgainst: recordStat(stats, "pointsAgainst"),
    goalDifference: recordStat(stats, "pointDifferential"),
    streak: streakRaw && streakRaw !== "-" ? streakRaw : null,
    homeWins: recordStat(stats, "homeWins"),
    homeDraws: recordStat(stats, "homeTies"),
    homeLosses: recordStat(stats, "homeLosses"),
    awayWins: recordStat(stats, "awayWins"),
    awayDraws: recordStat(stats, "awayTies"),
    awayLosses: recordStat(stats, "awayLosses"),
  };
}

// ---------------------------------------------------------------------------
// Poisson three-way model (draws are first-class).
//
// Team ratings come from regressed goals for/against per game. Expected
// goals for a matchup: homeXg = homeAttack * awayConcede * avgHomeGoals,
// and symmetrically for the away side. Independent-Poisson scorelines up
// to 8 goals each give P(home)/P(draw)/P(away), over 2.5, BTTS and 3+
// goal margin. Everything is a model estimate — never a sportsbook price.
// ---------------------------------------------------------------------------

export type SoccerTeamRatings = {
  team: string; games: number;
  goalsForPerGame: number; goalsAgainstPerGame: number;
};

const REGRESS_GAMES = 10;
export function regressedRate(scored: number, games: number, leagueAvg: number): number {
  const w = Math.min(Math.max(games, 0), REGRESS_GAMES);
  if (w === 0) return leagueAvg;
  // Blend the observed per-game rate with the league average: full weight
  // to observed once 10 games are logged, league average when none are.
  const observed = scored / Math.max(games, 1);
  return (observed * w + leagueAvg * (REGRESS_GAMES - w)) / REGRESS_GAMES;
}

function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export type SoccerThreeWay = { home: number; draw: number; away: number };
export type SoccerMatchProbs = SoccerThreeWay & {
  over25: number; btts: number; margin3Plus: number;
  homeXg: number; awayXg: number;
};

const MAX_GOALS = 8;
export function soccerMatchProbabilities(
  homeFor: number, homeAgainst: number,
  awayFor: number, awayAgainst: number,
  leagueAvgHomeGoals: number, leagueAvgAwayGoals: number,
): SoccerMatchProbs {
  const homeXg = Math.max(0.05, (homeFor / Math.max(leagueAvgHomeGoals, 0.01)) * (awayAgainst / Math.max(leagueAvgAwayGoals, 0.01)) * leagueAvgHomeGoals);
  const awayXg = Math.max(0.05, (awayFor / Math.max(leagueAvgAwayGoals, 0.01)) * (homeAgainst / Math.max(leagueAvgHomeGoals, 0.01)) * leagueAvgAwayGoals);
  const homePmf: number[] = [];
  const awayPmf: number[] = [];
  for (let k = 0; k <= MAX_GOALS; k++) {
    homePmf.push(poissonPmf(homeXg, k));
    awayPmf.push(poissonPmf(awayXg, k));
  }
  let home = 0, draw = 0, away = 0, over25 = 0, btts = 0, margin3Plus = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = homePmf[h]! * awayPmf[a]!;
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h + a >= 3) over25 += p;
      if (h > 0 && a > 0) btts += p;
      if (Math.abs(h - a) >= 3) margin3Plus += p;
    }
  }
  const total = home + draw + away || 1;
  const round3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    home: round3(home / total), draw: round3(draw / total), away: round3(away / total),
    over25: round3(over25 / total), btts: round3(btts / total), margin3Plus: round3(margin3Plus / total),
    homeXg: round3(homeXg), awayXg: round3(awayXg),
  };
}

// ---------------------------------------------------------------------------
// Roster (flat athletes array with positions G/D/M/F)
// ---------------------------------------------------------------------------

export type SoccerRosterPlayer = { id: number; name: string; jersey: string | null; position: string };
export async function fetchSoccerRoster(league: SoccerLeague, abbr: string): Promise<{ team: string; fetchedAt: string; sourceUrl: string; players: SoccerRosterPlayer[] }> {
  const meta = soccerTeamMeta(league, abbr);
  if (!meta) throw new Error(`Unknown soccer team ${league}:${abbr}`);
  const url = `${siteBase(league)}/teams/${meta.id}/roster`;
  const payload = await getJson(url);
  const players: SoccerRosterPlayer[] = [];
  for (const itemValue of arr(record(payload)?.athletes)) {
    const item = record(itemValue);
    const id = int(item?.id);
    const name = text(item?.displayName);
    if (id === null || !name) continue;
    players.push({ id, name, jersey: text(item?.jersey), position: text(record(item?.position)?.abbreviation) ?? "—" });
  }
  return { team: abbr, fetchedAt: new Date().toISOString(), sourceUrl: url, players };
}

// ---------------------------------------------------------------------------
// Team leaders (goalsLeaders etc.) — powers likely scorers + roster scoring.
// The athlete name lives behind a $ref; displayValue carries "Goals: N".
// ---------------------------------------------------------------------------

export type SoccerLeader = { athleteId: number; name: string | null; goals: number; assists: number; appearances: number };
async function fetchAthleteName(league: SoccerLeague, athleteId: number): Promise<string | null> {
  try {
    const payload = await getJson(`${coreBase(league)}/seasons/${SOCCER_SEASON}/athletes/${athleteId}?lang=en&region=us`);
    return text(record(payload)?.displayName);
  } catch { return null; }
}

export async function fetchSoccerTeamLeaders(league: SoccerLeague, abbr: string): Promise<{ team: string; sourceUrl: string; leaders: SoccerLeader[] }> {
  const meta = soccerTeamMeta(league, abbr);
  if (!meta) throw new Error(`Unknown soccer team ${league}:${abbr}`);
  const url = `${coreBase(league)}/seasons/${SOCCER_SEASON}/types/1/teams/${meta.id}/leaders?lang=en&region=us`;
  const payload = await getJson(url);
  const categories = arr(record(payload)?.categories);
  const goalsCat = categories.find((c) => text(record(c)?.name) === "goalsLeaders");
  const leaders: SoccerLeader[] = [];
  for (const entryValue of arr(record(goalsCat)?.leaders).slice(0, 6)) {
    const entry = record(entryValue);
    if (!entry) continue;
    const ref = text(record(entry.athlete)?.$ref) ?? "";
    const idMatch = ref.match(/\/athletes\/(\d+)/);
    const athleteId = idMatch ? Number(idMatch[1]) : null;
    if (athleteId === null) continue;
    const display = text(entry.displayValue) ?? "";
    const goalsMatch = display.match(/Goals:\s*(\d+)/i);
    const appsMatch = display.match(/(?:Matches|Appearances):\s*(\d+)/i);
    leaders.push({
      athleteId,
      name: null, // resolved by the caller in bulk
      goals: goalsMatch ? Number(goalsMatch[1]) : 0,
      assists: 0,
      appearances: appsMatch ? Number(appsMatch[1]) : 0,
    });
  }
  // Resolve names in parallel; a missing name never breaks the list.
  await Promise.all(leaders.map(async (l) => { l.name = await fetchAthleteName(league, l.athleteId); }));
  return { team: abbr, sourceUrl: url, leaders: leaders.filter((l) => l.name && l.goals > 0) };
}

// ---------------------------------------------------------------------------
// Game summary: goal events (scorer + minute) + per-player match stats.
// ---------------------------------------------------------------------------

export type SoccerGoalEvent = { minute: string; teamAbbr: string; scorer: string; detail: string };
export type SoccerMatchPlayerStat = { athleteId: number; name: string; stats: Record<string, number> };
export type SoccerGameSummary = {
  goals: SoccerGoalEvent[];
  homeAbbr: string; awayAbbr: string;
  players: SoccerMatchPlayerStat[];
};

export async function fetchSoccerGameSummary(league: SoccerLeague, gameId: number): Promise<SoccerGameSummary> {
  const payload = await getJson(`${siteBase(league)}/summary?event=${gameId}`);
  const root = record(payload);
  const goals: SoccerGoalEvent[] = [];
  for (const keValue of arr(root?.keyEvents)) {
    const ke = record(keValue);
    if (!ke) continue;
    const typeText = text(record(ke.type)?.text) ?? "";
    if (!/goal/i.test(typeText)) continue;
    const textContent = text(ke.text) ?? "";
    // "Goal! Manchester City 0, Bournemouth 1. Marcus Tavernier (Bournemouth)
    //  left footed shot ...". The scorer sits between the last ". " before
    // the parenthesized club and the "(" — robust against periods inside
    // club names like "D.C. United".
    const parenIdx = textContent.indexOf("(");
    const beforeParen = parenIdx > 0 ? textContent.slice(0, parenIdx) : textContent;
    const lastDot = beforeParen.lastIndexOf(".");
    const scorer = lastDot >= 0 ? beforeParen.slice(lastDot + 1).trim() || "Unknown" : "Unknown";
    // keyEvents carry team as {id, displayName} — no abbreviation; resolve it.
    const teamObj = record(ke.team);
    const teamId = int(teamObj?.id);
    const teamAbbr = teamId !== null ? soccerAbbrById(league, teamId) ?? text(teamObj?.displayName) ?? "—" : "—";
    goals.push({
      minute: text(record(ke.clock)?.displayValue) ?? "",
      teamAbbr,
      scorer,
      detail: textContent,
    });
  }
  let homeAbbr = "—";
  let awayAbbr = "—";
  const headerComp = record(arr(record(root?.header)?.competitions)[0]);
  for (const compValue of arr(headerComp?.competitors)) {
    const competitor = record(compValue);
    const ha = text(competitor?.homeAway);
    const abbr = text(record(competitor?.team)?.abbreviation) ?? "—";
    if (ha === "home") homeAbbr = abbr;
    else if (ha === "away") awayAbbr = abbr;
  }
  const players: SoccerMatchPlayerStat[] = [];
  for (const rosterValue of arr(root?.rosters)) {
    const roster = record(rosterValue);
    for (const pValue of arr(roster?.roster)) {
      const p = record(pValue);
      const athlete = record(p?.athlete);
      const athleteId = int(athlete?.id);
      const name = text(athlete?.displayName);
      if (athleteId === null || !name) continue;
      const stats: Record<string, number> = {};
      for (const sValue of arr(p?.stats)) {
        const s = record(sValue);
        const sName = text(s?.name);
        const sVal = num(s?.value);
        if (sName && sVal !== null) stats[sName] = sVal;
      }
      players.push({ athleteId, name, stats });
    }
  }
  return { goals, homeAbbr, awayAbbr, players };
}

// ---------------------------------------------------------------------------
// Team game history (team schedule endpoint; scores may be core-ref objects)
// ---------------------------------------------------------------------------

export type SoccerTeamGame = {
  gameId: number; date: string;
  opponent: string; homeAway: "home" | "away";
  teamScore: number; oppScore: number;
  result: "W" | "D" | "L";
};

export async function fetchSoccerTeamGames(league: SoccerLeague, abbr: string, maxGames = 12): Promise<{ games: SoccerTeamGame[]; sourceUrl: string }> {
  const meta = soccerTeamMeta(league, abbr);
  if (!meta) throw new Error(`Unknown soccer team ${league}:${abbr}`);
  const url = `${siteBase(league)}/teams/${meta.id}/schedule`;
  const payload = await getJson(url);
  const root = record(payload);
  const games: SoccerTeamGame[] = [];
  for (const eventValue of arr(root?.events)) {
    const e = record(eventValue);
    const id = int(e?.id);
    const date = text(e?.date);
    const c0 = record(arr(e?.competitions)[0]);
    if (id === null || !date || !c0) continue;
    const statusName = text(record(record(c0.status)?.type)?.name) ?? "";
    if (statusName !== "STATUS_FULL_TIME" && statusName !== "STATUS_FINAL") continue;
    let side: "home" | "away" | null = null;
    let opp = "—";
    let teamScore: number | null = null;
    let oppScore: number | null = null;
    for (const compValue of arr(c0.competitors)) {
      const competitor = record(compValue);
      const ha = text(competitor?.homeAway);
      const teamAbbr = text(record(competitor?.team)?.abbreviation) ?? "—";
      if (teamAbbr === abbr) {
        side = ha === "home" ? "home" : "away";
        teamScore = int(competitor?.score);
      } else {
        opp = teamAbbr;
        oppScore = int(competitor?.score);
      }
    }
    if (!side || teamScore === null || oppScore === null) continue;
    games.push({
      gameId: id, date: date.slice(0, 10),
      opponent: opp, homeAway: side,
      teamScore, oppScore,
      result: teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D",
    });
  }
  games.sort((a, b) => b.date.localeCompare(a.date) || b.gameId - a.gameId);
  return { games: games.slice(0, maxGames), sourceUrl: url };
}
