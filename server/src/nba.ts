// Keyless ESPN data client for the NBA leg of the Daily Ham.
//
// Mirrors the two-river architecture: everything here is free and unlimited
// (official ESPN JSON feeds). The quota-limited odds providers (oddsapi.ts /
// provider.ts) supply sportsbook prices only and never gate this data.
//
// Verified 2026-10-11 against the live feeds:
//   scoreboard  site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
//   standings   sports.core.api.espn.com/.../leagues/nba/seasons/2027/types/2/groups/{5,6}/standings/0
//   teams       site.api.espn.com/.../nba/teams?limit=30
//   roster      site.api.espn.com/.../nba/teams/{id}/roster
//   schedule    site.api.espn.com/.../nba/teams/{id}/schedule
//   summary     site.api.espn.com/.../nba/summary?event={gameId}
//
// ESPN labels NBA seasons by the year they END: the 2026-27 season is 2027.
// Using 2026 would serve the completed 2025-26 season's final standings.
//
// NBA shape notes vs the NFL client:
// - The scoreboard has no weeks; games are addressed by date (?dates=YYYYMMDD).
// - Linescores are per quarter (4 + OT periods).
// - Standings groups: 5 = Eastern Conference, 6 = Western Conference.
// - The roster endpoint returns a FLAT athletes array (no position groups);
//   players are grouped by position abbreviation (G/F/C).
// - Boxscore categories have no `name` field; stat keys are used directly and
//   the category label comes from the `names` array.
// - scoringPlays is empty for NBA; first-basket info comes from scanning the
//   play-by-play `plays` array for the first scoringPlay.
// - The team schedule endpoint has no linescores, so quarter splits and OT
//   detection also come from the plays scan (enrichNbaGameDetails).

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
// ESPN season label for the 2026-27 season (labeled by ending year).
export const NBA_SEASON = 2027;

export type NbaTeamMeta = { abbr: string; id: number; name: string; color: string; secondary: string };

// Hardcoded from the teams feed (stable ESPN ids + official club colors,
// verified 2026-10-11). Note: ESPN uses "NY" (Knicks) and "UTAH" (Jazz).
export const NBA_TEAMS: NbaTeamMeta[] = [
  { abbr: "ATL", id: 1, name: "Atlanta Hawks", color: "#c8102e", secondary: "#fdb927" },
  { abbr: "BOS", id: 2, name: "Boston Celtics", color: "#008348", secondary: "#ffffff" },
  { abbr: "BKN", id: 17, name: "Brooklyn Nets", color: "#000000", secondary: "#ffffff" },
  { abbr: "CHA", id: 30, name: "Charlotte Hornets", color: "#008ca8", secondary: "#1d1060" },
  { abbr: "CHI", id: 4, name: "Chicago Bulls", color: "#ce1141", secondary: "#000000" },
  { abbr: "CLE", id: 5, name: "Cleveland Cavaliers", color: "#860038", secondary: "#bc945c" },
  { abbr: "DAL", id: 6, name: "Dallas Mavericks", color: "#0064b1", secondary: "#bbc4ca" },
  { abbr: "DEN", id: 7, name: "Denver Nuggets", color: "#0e2240", secondary: "#fec524" },
  { abbr: "DET", id: 8, name: "Detroit Pistons", color: "#1d428a", secondary: "#c8102e" },
  { abbr: "GS", id: 9, name: "Golden State Warriors", color: "#fdb927", secondary: "#1d428a" },
  { abbr: "HOU", id: 10, name: "Houston Rockets", color: "#ce0e2d", secondary: "#000000" },
  { abbr: "IND", id: 11, name: "Indiana Pacers", color: "#0c2340", secondary: "#ffd520" },
  { abbr: "LAC", id: 12, name: "LA Clippers", color: "#12173f", secondary: "#c8102e" },
  { abbr: "LAL", id: 13, name: "Los Angeles Lakers", color: "#552583", secondary: "#fdb927" },
  { abbr: "MEM", id: 29, name: "Memphis Grizzlies", color: "#5d76a9", secondary: "#12173f" },
  { abbr: "MIA", id: 14, name: "Miami Heat", color: "#98002e", secondary: "#000000" },
  { abbr: "MIL", id: 15, name: "Milwaukee Bucks", color: "#00471b", secondary: "#eee1c6" },
  { abbr: "MIN", id: 16, name: "Minnesota Timberwolves", color: "#266092", secondary: "#79bc43" },
  { abbr: "NO", id: 3, name: "New Orleans Pelicans", color: "#0a2240", secondary: "#b4975a" },
  { abbr: "NY", id: 18, name: "New York Knicks", color: "#1d428a", secondary: "#f58426" },
  { abbr: "OKC", id: 25, name: "Oklahoma City Thunder", color: "#007ac1", secondary: "#ef3b24" },
  { abbr: "ORL", id: 19, name: "Orlando Magic", color: "#0150b5", secondary: "#9ca0a3" },
  { abbr: "PHI", id: 20, name: "Philadelphia 76ers", color: "#1d428a", secondary: "#e01234" },
  { abbr: "PHX", id: 21, name: "Phoenix Suns", color: "#29127a", secondary: "#e56020" },
  { abbr: "POR", id: 22, name: "Portland Trail Blazers", color: "#e03a3e", secondary: "#000000" },
  { abbr: "SAC", id: 23, name: "Sacramento Kings", color: "#5a2d81", secondary: "#6a7a82" },
  { abbr: "SA", id: 24, name: "San Antonio Spurs", color: "#000000", secondary: "#c4ced4" },
  { abbr: "TOR", id: 28, name: "Toronto Raptors", color: "#d91244", secondary: "#000000" },
  { abbr: "UTAH", id: 26, name: "Utah Jazz", color: "#4e008e", secondary: "#79a3dc" },
  { abbr: "WSH", id: 27, name: "Washington Wizards", color: "#e31837", secondary: "#002b5c" },
];
export const NBA_TEAM_CODES = NBA_TEAMS.map((t) => t.abbr) as unknown as [string, ...string[]];
const teamByAbbr = new Map(NBA_TEAMS.map((t) => [t.abbr, t]));
const teamById = new Map(NBA_TEAMS.map((t) => [t.id, t]));
export function nbaTeamMeta(abbr: string): NbaTeamMeta | null { return teamByAbbr.get(abbr) ?? null; }
export function nbaAbbrById(id: number): string | null { return teamById.get(id)?.abbr ?? null; }

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
  // ESPN is inconsistent: scores/ids sometimes arrive as numeric strings.
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function int(value: unknown): number | null { const n = num(value); return n === null ? null : Math.trunc(n); }
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ESPN request failed (${response.status}): ${url}`);
  return response.json() as Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Scoreboard (no weeks in the NBA; address slates by date)
// ---------------------------------------------------------------------------

export type NbaGameSide = { abbr: string; name: string; score: number | null; winner: boolean; linescores: number[] };
export type NbaGame = {
  id: number; date: string; name: string; shortName: string;
  state: "pre" | "live" | "final"; detail: string;
  away: NbaGameSide; home: NbaGameSide;
};

function parseGame(event: unknown): NbaGame | null {
  const e = record(event);
  if (!e) return null;
  const id = int(e.id);
  const date = text(e.date);
  const competitions = arr(e.competitions);
  const c0 = record(competitions[0]);
  if (id === null || !date || !c0) return null;
  const statusName = text(record(c0.status)?.type ? record(record(c0.status)?.type)?.name : null) ?? "";
  const detail = text(record(c0.status)?.type ? record(record(c0.status)?.type)?.shortDetail : null) ?? "";
  const state: NbaGame["state"] = statusName === "STATUS_FINAL" ? "final" : statusName === "STATUS_IN_PROGRESS" ? "live" : "pre";
  const sides: Record<string, NbaGameSide> = {};
  for (const compValue of arr(c0.competitors)) {
    const competitor = record(compValue);
    if (!competitor) continue;
    const team = record(competitor.team);
    const abbr = text(team?.abbreviation) ?? "—";
    const homeAway = text(competitor.homeAway) ?? "";
    const linescores = arr(competitor.linescores).flatMap((ls) => { const v = num(record(ls)?.value); return v === null ? [] : [v]; });
    sides[homeAway] = {
      abbr,
      name: text(team?.displayName) ?? abbr,
      score: int(competitor.score),
      winner: competitor.winner === true,
      linescores,
    };
  }
  const away = sides.away;
  const home = sides.home;
  if (!away || !home) return null;
  return { id, date, name: text(e.name) ?? `${away.abbr} @ ${home.abbr}`, shortName: text(e.shortName) ?? `${away.abbr} @ ${home.abbr}`, state, detail, away, home };
}

/** Fetch the scoreboard slate. `dates` is an optional YYYYMMDD date (single day). */
export async function fetchNbaScoreboard(dates?: string): Promise<{ season: number; games: NbaGame[]; sourceUrl: string }> {
  const url = dates ? `${ESPN_SITE}/scoreboard?dates=${dates}` : `${ESPN_SITE}/scoreboard`;
  const payload = await getJson(url);
  const root = record(payload);
  const season = int(record(root?.season)?.year) ?? NBA_SEASON;
  const games = arr(root?.events).flatMap((event) => { const g = parseGame(event); return g ? [g] : []; });
  return { season, games, sourceUrl: url };
}

// ---------------------------------------------------------------------------
// Standings (core API, per conference: 5 = East, 6 = West)
// ---------------------------------------------------------------------------

export type NbaStanding = {
  team: string; name: string; conference: string; division: string;
  wins: number; losses: number;
  pointsFor: number; pointsAgainst: number;
  streak: string | null; playoffSeed: number | null;
  // Home/road splits from ESPN core `records` (type "home" / "road"). Null
  // when the feed omits them, so the model can tell real splits from zeros.
  homeWins: number | null; homeLosses: number | null; homeTies: number | null;
  roadWins: number | null; roadLosses: number | null; roadTies: number | null;
};

function statValue(stats: unknown[], name: string): string | null {
  for (const s of stats) {
    const r = record(s);
    if (r && text(r.name) === name) return text(r.displayValue) ?? text(r.value);
  }
  return null;
}

export async function fetchNbaStandings(): Promise<{ fetchedAt: string; sourceUrl: string; standings: NbaStanding[] }> {
  const urls = [
    `${ESPN_CORE}/seasons/${NBA_SEASON}/types/2/groups/5/standings/0?lang=en&region=us`,
    `${ESPN_CORE}/seasons/${NBA_SEASON}/types/2/groups/6/standings/0?lang=en&region=us`,
  ];
  const seen = new Set<string>();
  const out: NbaStanding[] = [];
  for (const url of urls) {
    const payload = await getJson(url);
    const entries = arr(record(payload)?.standings);
    for (const entryValue of entries) {
      const entry = record(entryValue);
      if (!entry) continue;
      const teamRef = text(record(entry.team)?.$ref) ?? "";
      const idMatch = teamRef.match(/\/teams\/(\d+)/);
      const abbr = idMatch ? nbaAbbrById(Number(idMatch[1])) : null;
      if (!abbr || seen.has(abbr)) continue;
      seen.add(abbr);
      const meta = nbaTeamMeta(abbr);
      const rec = record(arr(entry.records)[0]);
      const stats = arr(rec?.stats);
      const intStat = (name: string) => { const v = statValue(stats, name); const n = v === null ? null : parseInt(v, 10); return Number.isFinite(n) ? (n as number) : 0; };
      // Home/road splits live in sibling records (type "home" / "road").
      const split = (type: string): { wins: number | null; losses: number | null; ties: number | null } => {
        const splitRec = arr(entry.records).map((r) => record(r)).find((r) => r && text(r.type) === type);
        const splitStats = arr(splitRec?.stats);
        const splitStat = (name: string): number | null => { const v = statValue(splitStats, name); const n = v === null ? null : parseInt(v, 10); return n !== null && Number.isFinite(n) ? n : null; };
        return { wins: splitStat("wins"), losses: splitStat("losses"), ties: splitStat("ties") };
      };
      const homeSplit = split("home");
      const roadSplit = split("road");
      const division = NBA_DIVISIONS[abbr] ?? "";
      out.push({
        team: abbr,
        name: meta?.name ?? abbr,
        conference: EASTERN_DIVISIONS.has(division) ? "East" : "West",
        division,
        wins: intStat("wins"),
        losses: intStat("losses"),
        pointsFor: intStat("pointsFor"),
        pointsAgainst: intStat("pointsAgainst"),
        streak: statValue(stats, "streak"),
        playoffSeed: (() => { const v = statValue(stats, "playoffSeed"); const n = v === null ? NaN : parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; })(),
        homeWins: homeSplit.wins, homeLosses: homeSplit.losses, homeTies: homeSplit.ties,
        roadWins: roadSplit.wins, roadLosses: roadSplit.losses, roadTies: roadSplit.ties,
      });
    }
  }
  out.sort((a, b) => b.wins - a.wins || a.losses - b.losses || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst));
  return { fetchedAt: new Date().toISOString(), sourceUrl: urls[0] ?? "", standings: out };
}

// Division lookup: static and stable (realignment is rare; verified 2026).
const NBA_DIVISIONS: Record<string, string> = {
  BOS: "Atlantic", BKN: "Atlantic", NY: "Atlantic", PHI: "Atlantic", TOR: "Atlantic",
  CHI: "Central", CLE: "Central", DET: "Central", IND: "Central", MIL: "Central",
  ATL: "Southeast", CHA: "Southeast", MIA: "Southeast", ORL: "Southeast", WSH: "Southeast",
  DEN: "Northwest", MIN: "Northwest", OKC: "Northwest", POR: "Northwest", UTAH: "Northwest",
  GS: "Pacific", LAC: "Pacific", LAL: "Pacific", PHX: "Pacific", SAC: "Pacific",
  DAL: "Southwest", HOU: "Southwest", MEM: "Southwest", NO: "Southwest", SA: "Southwest",
};
const EASTERN_DIVISIONS = new Set(["Atlantic", "Central", "Southeast"]);
export function nbaDivision(abbr: string): string { return NBA_DIVISIONS[abbr] ?? ""; }

// ---------------------------------------------------------------------------
// Roster (flat athletes array; grouped by position abbreviation)
// ---------------------------------------------------------------------------

export type NbaRosterPlayer = { id: number; name: string; jersey: string | null; position: string; group: string };
export async function fetchNbaRoster(abbr: string): Promise<{ team: string; fetchedAt: string; sourceUrl: string; players: NbaRosterPlayer[]; groups: Record<string, number> }> {
  const meta = nbaTeamMeta(abbr);
  if (!meta) throw new Error(`Unknown NBA team ${abbr}`);
  const url = `${ESPN_SITE}/teams/${meta.id}/roster`;
  const payload = await getJson(url);
  const players: NbaRosterPlayer[] = [];
  const groups: Record<string, number> = {};
  for (const itemValue of arr(record(payload)?.athletes)) {
    const item = record(itemValue);
    const id = int(item?.id);
    const name = text(item?.displayName);
    if (id === null || !name) continue;
    const pos = record(item?.position);
    const position = text(pos?.abbreviation) ?? "—";
    const group = text(pos?.displayName) ?? position;
    players.push({ id, name, jersey: text(item?.jersey), position, group });
    groups[group] = (groups[group] ?? 0) + 1;
  }
  return { team: abbr, fetchedAt: new Date().toISOString(), sourceUrl: url, players, groups };
}

// ---------------------------------------------------------------------------
// Game summary: per-player boxscore + play-by-play derived details
// ---------------------------------------------------------------------------

export type NbaBoxAthlete = { id: number; name: string; stats: Record<string, string> };
export type NbaBoxCategory = { label: string; keys: string[]; athletes: NbaBoxAthlete[] };
export type NbaBoxTeam = { abbr: string; categories: NbaBoxCategory[] };
export type NbaPlayInfo = {
  /** Which side scored first: "away" | "home" | null (unknown). */
  firstScoringSide: "away" | "home" | null;
  firstHalfAway: number | null; firstHalfHome: number | null;
  overtime: boolean;
};

export async function fetchNbaGameSummary(gameId: number): Promise<{
  teams: NbaBoxTeam[]; homeAbbr: string; awayAbbr: string; playInfo: NbaPlayInfo;
}> {
  const payload = await getJson(`${ESPN_SITE}/summary?event=${gameId}`);
  const root = record(payload);
  const boxscore = record(root?.boxscore);
  const teams: NbaBoxTeam[] = [];
  for (const teamValue of arr(boxscore?.players)) {
    const team = record(teamValue);
    const abbr = text(record(team?.team)?.abbreviation) ?? "—";
    const categories: NbaBoxCategory[] = [];
    for (const catValue of arr(team?.statistics)) {
      const cat = record(catValue);
      const keys = arr(cat?.keys).flatMap((k) => { const t = text(k); return t ? [t] : []; });
      const names = arr(cat?.names).flatMap((k) => { const t = text(k); return t ? [t] : []; });
      const athletes: NbaBoxAthlete[] = [];
      for (const athValue of arr(cat?.athletes)) {
        const row = record(athValue);
        const athlete = record(row?.athlete);
        const id = int(athlete?.id);
        const name = text(athlete?.displayName);
        if (id === null || !name) continue;
        const values = arr(row?.stats).map((v) => text(v) ?? "");
        const stats: Record<string, string> = {};
        keys.forEach((key, i) => { stats[key] = values[i] ?? ""; });
        athletes.push({ id, name, stats });
      }
      categories.push({ label: names.join(" / ") || "stats", keys, athletes });
    }
    teams.push({ abbr, categories });
  }
  let homeAbbr = "—";
  let awayAbbr = "—";
  const headerComp = record(record(root?.header)?.competitions ? arr(record(root?.header)?.competitions)[0] : null);
  for (const compValue of arr(headerComp?.competitors)) {
    const competitor = record(compValue);
    const ha = text(competitor?.homeAway);
    const abbr = text(record(competitor?.team)?.abbreviation) ?? "—";
    if (ha === "home") homeAbbr = abbr;
    else if (ha === "away") awayAbbr = abbr;
  }
  const playInfo: NbaPlayInfo = { firstScoringSide: null, firstHalfAway: null, firstHalfHome: null, overtime: false };
  for (const playValue of arr(root?.plays)) {
    const play = record(playValue);
    if (!play) continue;
    const period = int(record(play.period)?.number) ?? 0;
    const awayScore = num(play.awayScore);
    const homeScore = num(play.homeScore);
    if (play.scoringPlay === true && playInfo.firstScoringSide === null && awayScore !== null && homeScore !== null) {
      if (awayScore > 0 && homeScore === 0) playInfo.firstScoringSide = "away";
      else if (homeScore > 0 && awayScore === 0) playInfo.firstScoringSide = "home";
      else if (awayScore > 0 || homeScore > 0) playInfo.firstScoringSide = awayScore >= homeScore ? "away" : "home";
    }
    if (period === 2 && awayScore !== null && homeScore !== null) {
      playInfo.firstHalfAway = awayScore;
      playInfo.firstHalfHome = homeScore;
    }
    if (period > 4) playInfo.overtime = true;
  }
  return { teams, homeAbbr, awayAbbr, playInfo };
}

// ---------------------------------------------------------------------------
// Team game history (team schedule endpoint; quarter details enriched from
// play-by-play since the schedule feed carries no linescores)
// ---------------------------------------------------------------------------

export type NbaTeamGame = {
  gameId: number; date: string;
  opponent: string; homeAway: "home" | "away";
  teamScore: number; oppScore: number; won: boolean;
  firstHalfFor: number | null; firstHalfAgainst: number | null;
  margin: number; overtime: boolean | null;
  firstScoringTeam: string | null; // filled by enrichNbaGameDetails
  seasonLabel: string;
};

function scheduleScore(value: unknown): number | null {
  const r = record(value);
  if (r) return int(r.value);
  return int(value);
}

export async function fetchNbaTeamGames(abbr: string, maxGames = 10): Promise<{ games: NbaTeamGame[]; sourceUrl: string; seasonLabel: string }> {
  const meta = nbaTeamMeta(abbr);
  if (!meta) throw new Error(`Unknown NBA team ${abbr}`);
  const url = `${ESPN_SITE}/teams/${meta.id}/schedule`;
  const payload = await getJson(url);
  const root = record(payload);
  const seasonLabel = text(record(root?.season)?.displayName) ?? text(record(root?.season)?.name) ?? "";
  const games: NbaTeamGame[] = [];
  for (const eventValue of arr(root?.events)) {
    const e = record(eventValue);
    const id = int(e?.id);
    const date = text(e?.date);
    const c0 = record(arr(e?.competitions)[0]);
    if (id === null || !date || !c0) continue;
    const statusType = record(record(c0.status)?.type);
    const statusName = text(statusType?.name) ?? "";
    if (statusName !== "STATUS_FINAL") continue;
    let side: "home" | "away" | null = null;
    let opp = "—";
    let teamScore: number | null = null;
    let oppScore: number | null = null;
    let won = false;
    for (const compValue of arr(c0.competitors)) {
      const competitor = record(compValue);
      const ha = text(competitor?.homeAway);
      const teamAbbr = text(record(competitor?.team)?.abbreviation) ?? "—";
      if (teamAbbr === abbr) {
        side = ha === "home" ? "home" : "away";
        teamScore = scheduleScore(competitor?.score);
        won = competitor?.winner === true;
      } else {
        opp = teamAbbr;
        oppScore = scheduleScore(competitor?.score);
      }
    }
    if (!side || teamScore === null || oppScore === null) continue;
    games.push({
      gameId: id, date: date.slice(0, 10),
      opponent: opp, homeAway: side,
      teamScore, oppScore, won,
      firstHalfFor: null, firstHalfAgainst: null,
      margin: Math.abs(teamScore - oppScore), overtime: null,
      firstScoringTeam: null, seasonLabel,
    });
  }
  games.sort((a, b) => b.date.localeCompare(a.date) || b.gameId - a.gameId);
  return { games: games.slice(0, maxGames), sourceUrl: url, seasonLabel };
}

/** Fill first-half splits, OT flags and first-basket teams from play-by-play. */
export async function enrichNbaGameDetails(games: NbaTeamGame[]): Promise<void> {
  for (let i = 0; i < games.length; i += 4) {
    await Promise.all(games.slice(i, i + 4).map(async (game) => {
      try {
        const summary = await fetchNbaGameSummary(game.gameId);
        const info = summary.playInfo;
        if (info.firstScoringSide === "away") game.firstScoringTeam = summary.awayAbbr;
        else if (info.firstScoringSide === "home") game.firstScoringTeam = summary.homeAbbr;
        if (game.homeAway === "away") {
          game.firstHalfFor = info.firstHalfAway;
          game.firstHalfAgainst = info.firstHalfHome;
        } else {
          game.firstHalfFor = info.firstHalfHome;
          game.firstHalfAgainst = info.firstHalfAway;
        }
        game.overtime = info.overtime;
      } catch {
        game.firstScoringTeam = null;
      }
    }));
  }
}
