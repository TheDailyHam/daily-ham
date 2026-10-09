// Keyless ESPN data client for the NFL leg of the Daily Ham.
//
// Mirrors the two-river architecture: everything here is free and unlimited
// (official ESPN JSON feeds). The quota-limited odds providers (oddsapi.ts /
// provider.ts) supply sportsbook prices only and never gate this data.
//
// Verified 2026-10-08 against the live feeds:
//   scoreboard  site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
//   standings   sports.core.api.espn.com/.../leagues/nfl/seasons/{Y}/types/2/groups/{8,9}/standings/0
//   teams       site.api.espn.com/.../nfl/teams?limit=32
//   roster      site.api.espn.com/.../nfl/teams/{id}/roster
//   summary     site.api.espn.com/.../nfl/summary?event={gameId}

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
export const NFL_SEASON = 2026;
export const NFL_REGULAR_SEASON_WEEKS = 18;

export type NflTeamMeta = { abbr: string; id: number; name: string; color: string; secondary: string };

// Hardcoded from the teams feed (stable ESPN ids + official club colors).
export const NFL_TEAMS: NflTeamMeta[] = [
  { abbr: "ARI", id: 22, name: "Arizona Cardinals", color: "#a40227", secondary: "#ffffff" },
  { abbr: "ATL", id: 1, name: "Atlanta Falcons", color: "#a71930", secondary: "#000000" },
  { abbr: "BAL", id: 33, name: "Baltimore Ravens", color: "#29126f", secondary: "#000000" },
  { abbr: "BUF", id: 2, name: "Buffalo Bills", color: "#00338d", secondary: "#d50a0a" },
  { abbr: "CAR", id: 29, name: "Carolina Panthers", color: "#0085ca", secondary: "#000000" },
  { abbr: "CHI", id: 3, name: "Chicago Bears", color: "#0b1c3a", secondary: "#e64100" },
  { abbr: "CIN", id: 4, name: "Cincinnati Bengals", color: "#fb4f14", secondary: "#000000" },
  { abbr: "CLE", id: 5, name: "Cleveland Browns", color: "#472a08", secondary: "#ff3c00" },
  { abbr: "DAL", id: 6, name: "Dallas Cowboys", color: "#002a5c", secondary: "#b0b7bc" },
  { abbr: "DEN", id: 7, name: "Denver Broncos", color: "#0a2343", secondary: "#fc4c02" },
  { abbr: "DET", id: 8, name: "Detroit Lions", color: "#0076b6", secondary: "#bbbbbb" },
  { abbr: "GB", id: 9, name: "Green Bay Packers", color: "#204e32", secondary: "#ffb612" },
  { abbr: "HOU", id: 34, name: "Houston Texans", color: "#021018", secondary: "#eb0028" },
  { abbr: "IND", id: 11, name: "Indianapolis Colts", color: "#003b75", secondary: "#ffffff" },
  { abbr: "JAX", id: 30, name: "Jacksonville Jaguars", color: "#007487", secondary: "#d7a22a" },
  { abbr: "KC", id: 12, name: "Kansas City Chiefs", color: "#e31837", secondary: "#ffb612" },
  { abbr: "LAC", id: 24, name: "Los Angeles Chargers", color: "#0080c6", secondary: "#ffc20e" },
  { abbr: "LAR", id: 14, name: "Los Angeles Rams", color: "#003594", secondary: "#ffd100" },
  { abbr: "LV", id: 13, name: "Las Vegas Raiders", color: "#000000", secondary: "#a5acaf" },
  { abbr: "MIA", id: 15, name: "Miami Dolphins", color: "#008e97", secondary: "#fc4c02" },
  { abbr: "MIN", id: 16, name: "Minnesota Vikings", color: "#4f2683", secondary: "#ffc62f" },
  { abbr: "NE", id: 17, name: "New England Patriots", color: "#002a5c", secondary: "#c60c30" },
  { abbr: "NO", id: 18, name: "New Orleans Saints", color: "#d3bc8d", secondary: "#000000" },
  { abbr: "NYG", id: 19, name: "New York Giants", color: "#003c7f", secondary: "#c9243f" },
  { abbr: "NYJ", id: 20, name: "New York Jets", color: "#115740", secondary: "#ffffff" },
  { abbr: "PHI", id: 21, name: "Philadelphia Eagles", color: "#06424d", secondary: "#000000" },
  { abbr: "PIT", id: 23, name: "Pittsburgh Steelers", color: "#000000", secondary: "#ffb612" },
  { abbr: "SEA", id: 26, name: "Seattle Seahawks", color: "#002a5c", secondary: "#69be28" },
  { abbr: "SF", id: 25, name: "San Francisco 49ers", color: "#aa0000", secondary: "#b3995d" },
  { abbr: "TB", id: 27, name: "Tampa Bay Buccaneers", color: "#bd1c36", secondary: "#3e3a35" },
  { abbr: "TEN", id: 10, name: "Tennessee Titans", color: "#4495d2", secondary: "#001532" },
  { abbr: "WSH", id: 28, name: "Washington Commanders", color: "#5a1414", secondary: "#ffb612" },
];
export const NFL_TEAM_CODES = NFL_TEAMS.map((t) => t.abbr) as unknown as [string, ...string[]];
const teamByAbbr = new Map(NFL_TEAMS.map((t) => [t.abbr, t]));
const teamById = new Map(NFL_TEAMS.map((t) => [t.id, t]));
export function nflTeamMeta(abbr: string): NflTeamMeta | null { return teamByAbbr.get(abbr) ?? null; }
export function nflAbbrById(id: number): string | null { return teamById.get(id)?.abbr ?? null; }

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
// Scoreboard
// ---------------------------------------------------------------------------

export type NflGameSide = { abbr: string; name: string; score: number | null; winner: boolean; linescores: number[] };
export type NflGame = {
  id: number; week: number; date: string; name: string; shortName: string;
  state: "pre" | "live" | "final"; detail: string;
  away: NflGameSide; home: NflGameSide;
};

function parseGame(event: unknown, week: number): NflGame | null {
  const e = record(event);
  if (!e) return null;
  const id = int(e.id);
  const date = text(e.date);
  const competitions = arr(e.competitions);
  const c0 = record(competitions[0]);
  if (id === null || !date || !c0) return null;
  const statusName = text(record(c0.status)?.type ? record(record(c0.status)?.type)?.name : null) ?? "";
  const detail = text(record(c0.status)?.type ? record(record(c0.status)?.type)?.shortDetail : null) ?? "";
  const state: NflGame["state"] = statusName === "STATUS_FINAL" ? "final" : statusName === "STATUS_IN_PROGRESS" ? "live" : "pre";
  const sides: Record<string, NflGameSide> = {};
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
  return { id, week, date, name: text(e.name) ?? `${away.abbr} @ ${home.abbr}`, shortName: text(e.shortName) ?? `${away.abbr} @ ${home.abbr}`, state, detail, away, home };
}

export async function fetchNflScoreboard(week?: number): Promise<{ week: number; season: number; games: NflGame[] }> {
  const url = week ? `${ESPN_SITE}/scoreboard?week=${week}` : `${ESPN_SITE}/scoreboard`;
  const payload = await getJson(url);
  const root = record(payload);
  const wk = int(record(root?.week)?.number) ?? week ?? 1;
  const season = int(record(root?.season)?.year) ?? NFL_SEASON;
  const games = arr(root?.events).flatMap((event) => { const g = parseGame(event, wk); return g ? [g] : []; });
  return { week: wk, season, games };
}

// ---------------------------------------------------------------------------
// Standings (core API, per conference)
// ---------------------------------------------------------------------------

export type NflStanding = {
  team: string; name: string; conference: string; division: string;
  wins: number; losses: number; ties: number;
  pointsFor: number; pointsAgainst: number;
  streak: string | null; playoffSeed: number | null;
};

function statValue(stats: unknown[], name: string): string | null {
  for (const s of stats) {
    const r = record(s);
    if (r && text(r.name) === name) return text(r.displayValue) ?? text(r.value);
  }
  return null;
}

export async function fetchNflStandings(): Promise<{ fetchedAt: string; sourceUrl: string; standings: NflStanding[] }> {
  // Note: the group/9 endpoint returns all 32 clubs (not just NFC) — fetch
  // once and dedupe by team. Conference is derived from the division map.
  const url = `${ESPN_CORE}/seasons/${NFL_SEASON}/types/2/groups/9/standings/0?lang=en&region=us`;
  const payload = await getJson(url);
  const entries = arr(record(payload)?.standings);
  const seen = new Set<string>();
  const out: NflStanding[] = [];
  for (const entryValue of entries) {
    const entry = record(entryValue);
    if (!entry) continue;
    const teamRef = text(record(entry.team)?.$ref) ?? "";
    const idMatch = teamRef.match(/\/teams\/(\d+)/);
    const abbr = idMatch ? nflAbbrById(Number(idMatch[1])) : null;
    if (!abbr || seen.has(abbr)) continue;
    seen.add(abbr);
    const meta = nflTeamMeta(abbr);
    const rec = record(arr(entry.records)[0]);
    const stats = arr(rec?.stats);
    const intStat = (name: string) => { const v = statValue(stats, name); const n = v === null ? null : parseInt(v, 10); return Number.isFinite(n) ? (n as number) : 0; };
    const division = NFL_DIVISIONS[abbr] ?? "";
    out.push({
      team: abbr,
      name: meta?.name ?? abbr,
      conference: division.startsWith("NFC") ? "NFC" : "AFC",
      division,
      wins: intStat("wins"),
      losses: intStat("losses"),
      ties: intStat("ties"),
      pointsFor: intStat("pointsFor"),
      pointsAgainst: intStat("pointsAgainst"),
      streak: statValue(stats, "streak"),
      playoffSeed: (() => { const v = statValue(stats, "playoffSeed"); const n = v === null ? null : parseInt(v, 10); return Number.isFinite(n) ? (n as number) : null; })(),
    });
  }
  out.sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst));
  return { fetchedAt: new Date().toISOString(), sourceUrl: url, standings: out };
}

// Division lookup: static and stable (realignment is rare; verified 2026).
const NFL_DIVISIONS: Record<string, string> = {
  BUF: "AFC East", MIA: "AFC East", NE: "AFC East", NYJ: "AFC East",
  BAL: "AFC North", CIN: "AFC North", CLE: "AFC North", PIT: "AFC North",
  HOU: "AFC South", IND: "AFC South", JAX: "AFC South", TEN: "AFC South",
  DEN: "AFC West", KC: "AFC West", LAC: "AFC West", LV: "AFC West",
  DAL: "NFC East", NYG: "NFC East", PHI: "NFC East", WSH: "NFC East",
  CHI: "NFC North", DET: "NFC North", GB: "NFC North", MIN: "NFC North",
  ATL: "NFC South", CAR: "NFC South", NO: "NFC South", TB: "NFC South",
  ARI: "NFC West", LAR: "NFC West", SF: "NFC West", SEA: "NFC West",
};
export function nflDivision(abbr: string): string { return NFL_DIVISIONS[abbr] ?? ""; }

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export type NflRosterPlayer = { id: number; name: string; jersey: string | null; position: string; group: string };
export async function fetchNflRoster(abbr: string): Promise<{ team: string; fetchedAt: string; sourceUrl: string; players: NflRosterPlayer[]; groups: Record<string, number> }> {
  const meta = nflTeamMeta(abbr);
  if (!meta) throw new Error(`Unknown NFL team ${abbr}`);
  const url = `${ESPN_SITE}/teams/${meta.id}/roster`;
  const payload = await getJson(url);
  const players: NflRosterPlayer[] = [];
  const groups: Record<string, number> = {};
  for (const groupValue of arr(record(payload)?.athletes)) {
    const group = record(groupValue);
    const groupName = text(group?.position) ?? "squad";
    for (const itemValue of arr(group?.items)) {
      const item = record(itemValue);
      const id = int(item?.id);
      const name = text(item?.displayName);
      if (id === null || !name) continue;
      const pos = record(item?.position);
      players.push({ id, name, jersey: text(item?.jersey), position: text(pos?.abbreviation) ?? "—", group: groupName });
      groups[groupName] = (groups[groupName] ?? 0) + 1;
    }
  }
  return { team: abbr, fetchedAt: new Date().toISOString(), sourceUrl: url, players, groups };
}

// ---------------------------------------------------------------------------
// Game summary: per-player boxscore + scoring plays
// ---------------------------------------------------------------------------

export type NflBoxAthlete = { id: number; name: string; stats: Record<string, string> };
export type NflBoxCategory = { category: string; keys: string[]; athletes: NflBoxAthlete[] };
export type NflBoxTeam = { abbr: string; categories: NflBoxCategory[] };
export type NflScoringPlay = { team: string; period: number; clock: string | null; text: string };

export async function fetchNflGameSummary(gameId: number): Promise<{ teams: NflBoxTeam[]; scoringPlays: NflScoringPlay[] }> {
  const payload = await getJson(`${ESPN_SITE}/summary?event=${gameId}`);
  const root = record(payload);
  const boxscore = record(root?.boxscore);
  const teams: NflBoxTeam[] = [];
  for (const teamValue of arr(boxscore?.players)) {
    const team = record(teamValue);
    const abbr = text(record(team?.team)?.abbreviation) ?? "—";
    const categories: NflBoxCategory[] = [];
    for (const catValue of arr(team?.statistics)) {
      const cat = record(catValue);
      const keys = arr(cat?.keys).flatMap((k) => { const t = text(k); return t ? [t] : []; });
      const athletes: NflBoxAthlete[] = [];
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
      categories.push({ category: text(cat?.name) ?? "stats", keys, athletes });
    }
    teams.push({ abbr, categories });
  }
  const scoringPlays: NflScoringPlay[] = [];
  for (const playValue of arr(root?.scoringPlays)) {
    const play = record(playValue);
    const team = text(record(play?.team)?.abbreviation);
    if (!team) continue;
    scoringPlays.push({ team, period: int(record(play?.period)?.number) ?? 0, clock: text(play?.clock), text: text(play?.text) ?? "" });
  }
  return { teams, scoringPlays };
}

// ---------------------------------------------------------------------------
// Team game history (scoreboard scan, no summaries needed for team stats)
// ---------------------------------------------------------------------------

export type NflTeamGame = {
  gameId: number; week: number; date: string;
  opponent: string; homeAway: "home" | "away";
  teamScore: number; oppScore: number; won: boolean;
  firstHalfFor: number; firstHalfAgainst: number;
  margin: number; overtime: boolean;
  firstScoringTeam: string | null; // filled by enrichFirstScores
};

export async function fetchNflTeamGames(abbr: string, maxGames = 10): Promise<{ games: NflTeamGame[]; currentWeek: number; sourceUrl: string }> {
  const current = await fetchNflScoreboard();
  const games: NflTeamGame[] = [];
  for (let week = current.week; week >= 1 && games.length < maxGames; week--) {
    const board = week === current.week ? current : await fetchNflScoreboard(week);
    for (const game of board.games) {
      if (game.state !== "final") continue;
      const isAway = game.away.abbr === abbr;
      const isHome = game.home.abbr === abbr;
      if (!isAway && !isHome) continue;
      const side = isAway ? game.away : game.home;
      const opp = isAway ? game.home : game.away;
      if (side.score === null || opp.score === null) continue;
      const q1 = side.linescores[0] ?? 0;
      const q2 = side.linescores[1] ?? 0;
      const oq1 = opp.linescores[0] ?? 0;
      const oq2 = opp.linescores[1] ?? 0;
      games.push({
        gameId: game.id, week: game.week, date: game.date,
        opponent: opp.abbr, homeAway: isAway ? "away" : "home",
        teamScore: side.score, oppScore: opp.score, won: side.winner,
        firstHalfFor: q1 + q2, firstHalfAgainst: oq1 + oq2,
        margin: Math.abs(side.score - opp.score),
        overtime: side.linescores.length > 4 || opp.linescores.length > 4,
        firstScoringTeam: null,
      });
    }
  }
  games.sort((a, b) => b.date.localeCompare(a.date));
  return { games: games.slice(0, maxGames), currentWeek: current.week, sourceUrl: `${ESPN_SITE}/scoreboard` };
}

export async function enrichFirstScores(games: NflTeamGame[]): Promise<void> {
  for (let i = 0; i < games.length; i += 4) {
    await Promise.all(games.slice(i, i + 4).map(async (game) => {
      try {
        const summary = await fetchNflGameSummary(game.gameId);
        game.firstScoringTeam = summary.scoringPlays[0]?.team ?? null;
      } catch { game.firstScoringTeam = null; }
    }));
  }
}
