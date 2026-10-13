import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
// Local replacement for the platform's SafeAreaTopScrim: a slim bar that
// occupies the device's top safe-area inset (notch / status bar) so content
// never slides underneath it.
function SafeAreaTopScrim({ backgroundColor }: { backgroundColor: string }) {
  return <div aria-hidden="true" style={{ height: "env(safe-area-inset-top)", backgroundColor, position: "sticky", top: 0, zIndex: 60 }} />;
}
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ApiRequest, type ApiResponse, type KeyInjuries, type KeyInjuryPlayer, type SoccerColdStreaks, type SoccerGame, type SoccerHotStreaks, type SoccerLeague, type SoccerMatchup, type SoccerPlayer, type SoccerPlayerGameLog, type SoccerStandingRow } from "./api";
import logo from "./assets/daily-ham-logo.jpg";
import { EPL_TEAM_THEMES, LEAGUE_THEMES, MLS_TEAM_THEMES, NBA_TEAM_THEMES, SOCCER_LEAGUES, applyLeagueTheme, loadFavorites, saveFavorite, soccerLeagueForTeam, themeFor, type League, type LeagueFavorites } from "./teams";
import { isWatchedPlayer, isWatchedTeam, loadWatchlist, removeWatchedEntry, toggleWatch, type WatchedEntry, type WatchedPlayer, type WatchedTeam } from "./watchlist";

type Sport = League;
type Mode = "board" | "matchup" | "rosters" | "streaks" | "standings" | "watchlist" | "parlay" | "settings" | "jamon" | "record";
const SPORT_KEY = "dh-sport";
function loadSport(): Sport {
  try {
    const raw = localStorage.getItem(SPORT_KEY);
    return raw === "nfl" ? "nfl" : raw === "nba" ? "nba" : raw === "soccer" ? "soccer" : "nhl";
  } catch {
    return "nhl";
  }
}
// Soccer league picker inside the soccer side (MLS | Premier League),
// persisted per-device like the sport itself.
const SOCCER_LEAGUE_KEY = "dh-soccer-league";
function loadSoccerLeague(): SoccerLeague {
  try {
    const raw = localStorage.getItem(SOCCER_LEAGUE_KEY);
    return raw === "epl" ? "epl" : "mls";
  } catch {
    return "mls";
  }
}
type PremiumBoard = ApiResponse<typeof api, "getPremiumBoard">;
type FirstGoalMatchup = ApiResponse<typeof api, "getFirstGoalMatchup">;
type PremiumOffer = PremiumBoard["offers"][number];
type NhlRoster = ApiResponse<typeof api, "getNhlRoster">;
type NhlPlayer = NhlRoster["players"][number];
type PlayerGameLog = ApiResponse<typeof api, "getNhlPlayerGameLog">;
type NhlOverview = ApiResponse<typeof api, "getNhlOverview">;
type HotStreaks = ApiResponse<typeof api, "getHotStreaks">;
type NflOverview = ApiResponse<typeof api, "getNflOverview">;
type NflMatchup = ApiResponse<typeof api, "getNflMatchup">;
type NflRoster = ApiResponse<typeof api, "getNflRoster">;
type NflPlayer = NflRoster["players"][number];
type NflPlayerGameLog = ApiResponse<typeof api, "getNflPlayerGameLog">;
type NflHotStreaks = ApiResponse<typeof api, "getNflHotStreaks">;
type NhlColdStreaks = ApiResponse<typeof api, "getColdStreaks">;
type NflColdStreaks = ApiResponse<typeof api, "getNflColdStreaks">;
type NbaOverview = ApiResponse<typeof api, "getNbaOverview">;
type NbaMatchup = ApiResponse<typeof api, "getNbaMatchup">;
type NbaRoster = ApiResponse<typeof api, "getNbaRoster">;
type NbaPlayer = NbaRoster["players"][number];
type NbaPlayerGameLog = ApiResponse<typeof api, "getNbaPlayerGameLog">;
type NbaHotStreaks = ApiResponse<typeof api, "getNbaHotStreaks">;
type NbaColdStreaks = ApiResponse<typeof api, "getNbaColdStreaks">;
type TeamCode = NhlRoster["team"];
type MarketSide = {
  id: string;
  side: string;
  line: string | null;
  openingLine: string | null;
  offers: PremiumOffer[];
  best: PremiumOffer;
  draftKings: PremiumOffer | null;
  fanDuel: PremiumOffer | null;
  betMGM: PremiumOffer | null;
  evPercent: number | null;
};
type PriceMode = "draftkings" | "fanduel" | "betmgm" | "best";
type MarketGroup = {
  id: string;
  eventId: string;
  matchup: string;
  startsAt: string | null;
  marketName: string;
  stat: string;
  entity: string;
  entityType: "player" | "team" | "event";
  period: string;
  betType: string;
  sides: MarketSide[];
};
type ParlayPick = { id: string; groupId: string; matchup: string; entity: string; marketName: string; side: MarketSide };

const teams: { code: TeamCode; name: string }[] = [
  ["ANA","Anaheim Ducks"],["BOS","Boston Bruins"],["BUF","Buffalo Sabres"],["CAR","Carolina Hurricanes"],["CBJ","Columbus Blue Jackets"],["CGY","Calgary Flames"],["CHI","Chicago Blackhawks"],["COL","Colorado Avalanche"],["DAL","Dallas Stars"],["DET","Detroit Red Wings"],["EDM","Edmonton Oilers"],["FLA","Florida Panthers"],["LAK","Los Angeles Kings"],["MIN","Minnesota Wild"],["MTL","Montréal Canadiens"],["NJD","New Jersey Devils"],["NSH","Nashville Predators"],["NYI","New York Islanders"],["NYR","New York Rangers"],["OTT","Ottawa Senators"],["PHI","Philadelphia Flyers"],["PIT","Pittsburgh Penguins"],["SEA","Seattle Kraken"],["SJS","San Jose Sharks"],["STL","St. Louis Blues"],["TBL","Tampa Bay Lightning"],["TOR","Toronto Maple Leafs"],["UTA","Utah Mammoth"],["VAN","Vancouver Canucks"],["VGK","Vegas Golden Knights"],["WPG","Winnipeg Jets"],["WSH","Washington Capitals"],
].map(([code,name]) => ({ code: code as TeamCode, name: name as string }));

const nflTeams: { code: string; name: string }[] = [
  ["ARI","Arizona Cardinals"],["ATL","Atlanta Falcons"],["BAL","Baltimore Ravens"],["BUF","Buffalo Bills"],["CAR","Carolina Panthers"],["CHI","Chicago Bears"],["CIN","Cincinnati Bengals"],["CLE","Cleveland Browns"],["DAL","Dallas Cowboys"],["DEN","Denver Broncos"],["DET","Detroit Lions"],["GB","Green Bay Packers"],["HOU","Houston Texans"],["IND","Indianapolis Colts"],["JAX","Jacksonville Jaguars"],["KC","Kansas City Chiefs"],["LAC","Los Angeles Chargers"],["LAR","Los Angeles Rams"],["LV","Las Vegas Raiders"],["MIA","Miami Dolphins"],["MIN","Minnesota Vikings"],["NE","New England Patriots"],["NO","New Orleans Saints"],["NYG","New York Giants"],["NYJ","New York Jets"],["PHI","Philadelphia Eagles"],["PIT","Pittsburgh Steelers"],["SEA","Seattle Seahawks"],["SF","San Francisco 49ers"],["TB","Tampa Bay Buccaneers"],["TEN","Tennessee Titans"],["WSH","Washington Commanders"],
].map(([code,name]) => ({ code: code as string, name: name as string }));
type NflTeamCode = ApiRequest<typeof api, "getNflMatchup">["awayTeam"];

const nbaTeams: { code: string; name: string }[] = NBA_TEAM_THEMES.map((theme) => ({ code: theme.code, name: theme.name }));
type NbaTeamCode = ApiRequest<typeof api, "getNbaMatchup">["awayTeam"];

// Soccer clubs per league; the server leg mirrors ESPN's abbreviations
// (ESPN usa.1 for MLS, eng.1 for the Premier League).
const mlsTeams: { code: string; name: string }[] = MLS_TEAM_THEMES.map((theme) => ({ code: theme.code, name: theme.name }));
const eplTeams: { code: string; name: string }[] = EPL_TEAM_THEMES.map((theme) => ({ code: theme.code, name: theme.name }));
const soccerTeams: { code: string; name: string }[] = [...mlsTeams, ...eplTeams];
const soccerTeamsFor = (league: SoccerLeague) => league === "epl" ? eplTeams : mlsTeams;

function dateTime(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function gameDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function statValue(value: number | null, digits = 0) { return value === null ? "—" : value.toFixed(digits); }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()); }
function americanNumber(value: string | null): number | null { if (!value) return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed !== 0 ? parsed : null; }
function decimalOdds(value: string | null): number | null { const odds = americanNumber(value); if (odds === null) return null; return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds); }
function impliedProbability(value: string | null): number | null { const decimal = decimalOdds(value); return decimal === null ? null : 1 / decimal; }
function formatAmerican(value: string | null): string { const odds = americanNumber(value); if (odds === null) return "—"; return odds > 0 ? `+${odds}` : String(odds); }
function average(values: Array<number | null>): number | null { const real = values.filter((value): value is number => value !== null && Number.isFinite(value)); return real.length ? real.reduce((sum, value) => sum + value, 0) / real.length : null; }
function toiMinutes(value: string | null): number | null { if (!value) return null; const [minutes, seconds] = value.split(":").map(Number); return Number.isFinite(minutes) && Number.isFinite(seconds) ? (minutes ?? 0) + (seconds ?? 0) / 60 : null; }
function normalizedBook(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function isDraftKings(value: string): boolean { return normalizedBook(value) === "draftkings"; }
function isFanDuel(value: string): boolean { return normalizedBook(value).startsWith("fanduel"); }
function isBetMGM(value: string): boolean { const book = normalizedBook(value); return book.startsWith("betmgm") || book.startsWith("mgm"); }
function bookName(value: string): string {
  if (isDraftKings(value)) return "DraftKings";
  if (isFanDuel(value)) return "FanDuel";
  if (isBetMGM(value)) return "BetMGM";
  return titleCase(value);
}
function offerForMode(side: MarketSide, mode: PriceMode): PremiumOffer | null {
  if (mode === "draftkings") return side.draftKings;
  if (mode === "fanduel") return side.fanDuel;
  if (mode === "betmgm") return side.betMGM;
  return side.best;
}
function offerCategory(group: MarketGroup, sport: Sport = "nhl"): string {
  const text = `${group.marketName} ${group.stat} ${group.period}`.toLowerCase();
  if (/stanley|conference|division|hart|vezina|calder|norris|selke|rocket|award|futur|super bowl/.test(text)) return "Futures & awards";
  if (group.period !== "game") return `${titleCase(group.period)} lines`;
  if (group.entityType === "player") {
    if (/save|shutout|goalie|goals against/.test(text)) return "Goalie props";
    if (/shot/.test(text)) return "Shots on goal";
    if (/goal/.test(text)) return "Goal props";
    if (/assist/.test(text)) return "Assist props";
    if (/point/.test(text)) return "Point props";
    if (/hit|block/.test(text)) return "Hits & blocks";
    if (/penalty|pim|power play/.test(text)) return "Special teams & PIMs";
    return "Player props";
  }
  if (/team total/.test(text)) return "Team totals";
  if (group.betType === "ml" || /moneyline/.test(text)) return "Moneyline";
  if (group.betType === "sp" || /puck line|spread/.test(text)) return sport === "nhl" ? "Puck lines" : "Spreads";
  if (group.betType === "ou" || /total/.test(text)) return "Game totals";
  return "Team props";
}
function sideOrder(side: string): number {
  const order = ["over", "yes", "home", "away", "under", "no"];
  const index = order.indexOf(side.toLowerCase());
  return index === -1 ? order.length : index;
}
function groupPremiumOffers(offers: PremiumOffer[]): MarketGroup[] {
  const grouped = new Map<string, PremiumOffer[]>();
  for (const offer of offers) {
    const id = [offer.eventId, offer.stat, offer.entity, offer.period, offer.betType, offer.line ?? ""].join("|");
    const list = grouped.get(id) ?? [];
    list.push(offer);
    grouped.set(id, list);
  }
  return Array.from(grouped.entries()).flatMap(([id, rows]) => {
    const first = rows[0];
    if (!first) return [];
    const bySide = new Map<string, PremiumOffer[]>();
    for (const row of rows) {
      const list = bySide.get(row.side) ?? [];
      list.push(row);
      bySide.set(row.side, list);
    }
    const sides = Array.from(bySide.entries()).flatMap(([side, sideRows]) => {
      const firstSide = sideRows[0];
      if (!firstSide) return [];
      const best = [...sideRows].sort((a, b) => (decimalOdds(b.odds) ?? 0) - (decimalOdds(a.odds) ?? 0))[0] ?? firstSide;
      const draftKings = sideRows.find((row) => isDraftKings(row.book)) ?? null;
      const fanDuel = sideRows.find((row) => isFanDuel(row.book)) ?? null;
      const betMGM = sideRows.find((row) => isBetMGM(row.book)) ?? null;
      const fairProbability = impliedProbability(best.fairOdds);
      const bestDecimal = decimalOdds(best.odds);
      const evPercent = fairProbability !== null && bestDecimal !== null ? (fairProbability * bestDecimal - 1) * 100 : null;
      return [{ id: `${id}|${side}`, side, line: firstSide.line, openingLine: firstSide.openingLine, offers: sideRows, best, draftKings, fanDuel, betMGM, evPercent }];
    }).sort((a, b) => sideOrder(a.side) - sideOrder(b.side));
    return [{ id, eventId: first.eventId, matchup: first.matchup, startsAt: first.startsAt, marketName: first.marketName, stat: first.stat, entity: first.entity, entityType: first.entityType, period: first.period, betType: first.betType, sides }];
  });
}
function combinedAmerican(picks: ParlayPick[], mode: PriceMode): string {
  if (picks.length === 0) return "—";
  const offers = picks.map((pick) => offerForMode(pick.side, mode));
  if (offers.some((offer) => offer === null)) return "Unavailable";
  const decimal = offers.reduce((total, offer) => total * (decimalOdds(offer?.odds ?? null) ?? 1), 1);
  const americanValue = decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
  return americanValue > 0 ? `+${americanValue}` : String(americanValue);
}

function ProviderStatus({ pending, error, onRetry }: { pending: boolean; error: string | null; onRetry: () => void }) {
  if (!pending && !error) return null;
  return <section className="key-gate"><div><p className="kicker">PRO DATA CONNECTION</p><h2>{pending ? "Loading the complete board…" : "Pro Odds needs attention"}</h2><p>{error ?? "Fetching every available market, both sides and book-by-book prices."}</p></div>{error && <button className="primary" onClick={onRetry}>Retry connection</button>}</section>;
}

function PlayerStatsSheet({ player, team, onClose }: { player: NhlPlayer; team: TeamCode; onClose: () => void }) {
  const log = useQuery({ queryKey: ["nhl-player-log", player.id], queryFn: () => api.getNhlPlayerGameLog({ playerId: player.id }), retry: false });
  const goalie = player.position === "G";
  const metrics = goalie
    ? [{ id: "saves", label: "Saves" }, { id: "goalsAgainst", label: "Goals against" }, { id: "savePct", label: "Save %" }]
    : [{ id: "shots", label: "Shots" }, { id: "points", label: "Points" }, { id: "goals", label: "Goals" }, { id: "assists", label: "Assists" }, { id: "hits", label: "Hits" }, { id: "blockedShots", label: "Blocks" }, { id: "pim", label: "PIM" }, { id: "powerPlayPoints", label: "PP points" }];
  const [metric, setMetric] = useState(goalie ? "saves" : "shots");
  const games = log.data?.games ?? [];
  const lastFive = games.slice(0, 5);
  const chartData = games.slice(0, 10).reverse().map((game) => ({
    date: gameDate(game.gameDate),
    shots: game.shots,
    points: game.points,
    goals: game.goals,
    assists: game.assists,
    saves: game.shotsAgainst !== null && game.goalsAgainst !== null ? game.shotsAgainst - game.goalsAgainst : null,
    goalsAgainst: game.goalsAgainst,
    savePct: game.savePct === null ? null : Number((game.savePct * 100).toFixed(1)),
    hits: game.hits,
    blockedShots: game.blockedShots,
    pim: game.pim,
    powerPlayPoints: game.powerPlayPoints,
  }));
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000 });
  const upcoming = overview.data?.games.find((game) => new Date(game.startsAt).getTime() > Date.now() && (game.away.abbrev === team || game.home.abbrev === team));
  const opponent = upcoming ? (upcoming.away.abbrev === team ? upcoming.home.abbrev : upcoming.away.abbrev) : null;
  const opponentStanding = overview.data?.standings.find((row) => row.team === opponent);
  const leagueGoalsAgainst = overview.data?.standings.length ? overview.data.standings.reduce((sum, row) => sum + (row.gamesPlayed ? row.goalsAgainst / row.gamesPlayed : 0), 0) / overview.data.standings.filter((row) => row.gamesPlayed > 0).length : null;
  const metricValue = (game: PlayerGameLog["games"][number], id: string): number | null => {
    if (id === "saves") return game.shotsAgainst !== null && game.goalsAgainst !== null ? game.shotsAgainst - game.goalsAgainst : null;
    if (id === "savePct") return game.savePct === null ? null : game.savePct * 100;
    if (id === "goalsAgainst") return game.goalsAgainst;
    if (id === "shots") return game.shots;
    if (id === "points") return game.points;
    if (id === "goals") return game.goals;
    if (id === "assists") return game.assists;
    if (id === "hits") return game.hits;
    if (id === "blockedShots") return game.blockedShots;
    if (id === "pim") return game.pim;
    if (id === "powerPlayPoints") return game.powerPlayPoints;
    return null;
  };
  const seasonAverage = average(games.map((game) => metricValue(game, metric)));
  const lastTenAverage = average(games.slice(0, 10).map((game) => metricValue(game, metric)));
  const lastFiveAverage = average(lastFive.map((game) => metricValue(game, metric)));
  const seasonToi = average(games.map((game) => toiMinutes(game.toi)));
  const recentToi = average(lastFive.map((game) => toiMinutes(game.toi)));
  const toiFactor = seasonToi !== null && recentToi !== null && seasonToi > 0 ? Math.min(1.1, Math.max(.9, recentToi / seasonToi)) : 1;
  const matchupFactor = opponentStanding && opponentStanding.gamesPlayed > 0 && leagueGoalsAgainst && leagueGoalsAgainst > 0 ? Math.min(1.15, Math.max(.85, (opponentStanding.goalsAgainst / opponentStanding.gamesPlayed) / leagueGoalsAgainst)) : 1;
  const baseProjection = seasonAverage === null ? null : seasonAverage * .45 + (lastTenAverage ?? seasonAverage) * .35 + (lastFiveAverage ?? seasonAverage) * .2;
  const modelProjection = baseProjection === null ? null : metric === "savePct" ? baseProjection : baseProjection * toiFactor * matchupFactor;
  const total = (key: "goals" | "assists" | "points" | "shots" | "shotsAgainst" | "goalsAgainst") => lastFive.reduce((sum, game) => sum + (game[key] ?? 0), 0);
  const saves = total("shotsAgainst") - total("goalsAgainst");
  const lastFiveSavePct = total("shotsAgainst") > 0 ? saves / total("shotsAgainst") : null;
  const metricLabel = metrics.find((item) => item.id === metric)?.label ?? "Stat";
  const [sheetTab, setSheetTab] = useState<"overview" | "trend" | "last5" | "log">("overview");

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet player-sheet" role="dialog" aria-modal="true" aria-labelledby="player-stats-title">
      <button className="close" onClick={onClose} aria-label="Close player stats">×</button>
      <p className="kicker">{team} PLAYER FILE</p>
      <div className="sheet-title-row"><h2 id="player-stats-title">{player.name}</h2><PlayerWatchStar sport="nhl" playerId={player.id} team={team} name={player.name} position={player.position} /></div>
      <p className="matchup">#{player.number ?? "—"} · {player.position} · 2026–27 regular season</p>
      <div className="player-season-line">
        {goalie ? <><div><span>Starts / GP</span><strong>{player.games ?? "—"}</strong></div><div><span>Record</span><strong>{player.wins ?? "—"}–{player.losses ?? "—"}</strong></div><div><span>Save %</span><strong>{player.savePct === null ? "—" : player.savePct.toFixed(3)}</strong></div><div><span>GAA</span><strong>{player.gaa === null ? "—" : player.gaa.toFixed(2)}</strong></div></> : <><div><span>Games</span><strong>{player.games ?? "—"}</strong></div><div><span>Goals</span><strong>{player.goals ?? "—"}</strong></div><div><span>Assists</span><strong>{player.assists ?? "—"}</strong></div><div><span>Points</span><strong>{player.points ?? "—"}</strong></div><div><span>Shots</span><strong>{player.shots ?? "—"}</strong></div></>}
      </div>
      <div className="sheet-tabs" role="tablist" aria-label="Player stat sections">
        {(["overview", "trend", "last5", "log"] as const).map((tab) => <button key={tab} role="tab" aria-selected={sheetTab === tab} className={sheetTab === tab ? "active" : ""} onClick={() => setSheetTab(tab)}>{tab === "overview" ? "Overview" : tab === "trend" ? "Trend" : tab === "last5" ? "Last 5" : "Game log"}</button>)}
      </div>
      {log.isPending ? <div className="player-log-loading"><span />Loading game-by-game stats…</div> : log.isError ? <div className="inline-log-error"><strong>Game log unavailable.</strong><span>{log.error instanceof Error ? log.error.message : "Try again shortly."}</span><button onClick={() => log.refetch()}>Retry</button></div> : games.length === 0 ? <div className="history-empty"><strong>No regular-season games yet.</strong><span>The graph, projection and last-five record will populate after official game logs are posted.</span></div> : <>
        {sheetTab === "overview" && <section className="model-panel">
          <div><p className="kicker">DAILY HAM MODEL</p><h3>{metricLabel} projection</h3><span>Statistical projection — not a market lean</span></div>
          <strong>{modelProjection === null ? "—" : modelProjection.toFixed(metric === "savePct" ? 1 : 2)}</strong>
          <div className="model-inputs"><span>Season <b>{seasonAverage?.toFixed(2) ?? "—"}</b></span><span>Last 10 <b>{lastTenAverage?.toFixed(2) ?? "—"}</b></span><span>Last 5 <b>{lastFiveAverage?.toFixed(2) ?? "—"}</b></span><span>TOI factor <b>{toiFactor.toFixed(2)}×</b></span><span>{opponent ? `vs ${opponent}` : "Next opponent"} <b>{opponentStanding ? `${matchupFactor.toFixed(2)}×` : "TBD"}</b></span></div>
          <p>Weighted from official season, last-10 and last-5 game logs, then adjusted by recent ice time and the next opponent’s goals-against rate. Missing context stays neutral.</p>
        </section>}
        {sheetTab === "trend" && <section className="trend-section">
          <div className="section-heading"><div><p className="kicker">RECENT TREND</p><h3>Last {Math.min(10, games.length)} games</h3></div><span>{metricLabel}</span></div>
          <div className="metric-tabs" aria-label="Chart stat">{metrics.map((item) => <button key={item.id} className={metric === item.id ? "active" : ""} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div>
          <div className="player-trend-chart" role="img" aria-label={`${player.name} ${metricLabel} over the last ${Math.min(10, games.length)} games`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 14, right: 10, bottom: 0, left: -22 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} allowDecimals={metric === "savePct"} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Line type="monotone" dataKey={metric} stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: "var(--paper)", strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer></div>
        </section>}
        {sheetTab === "last5" && <section className="last-five-section">
          <div className="section-heading"><div><p className="kicker">FORM CHECK</p><h3>Last five</h3></div><span>{lastFive.length} official games</span></div>
          <div className="last-five-summary">{goalie ? <><div><span>Record</span><strong>{lastFive.filter((game) => game.decision === "W").length}–{lastFive.filter((game) => game.decision === "L").length}</strong></div><div><span>Saves</span><strong>{saves}</strong></div><div><span>Save %</span><strong>{lastFiveSavePct === null ? "—" : lastFiveSavePct.toFixed(3)}</strong></div></> : <><div><span>G</span><strong>{total("goals")}</strong></div><div><span>A</span><strong>{total("assists")}</strong></div><div><span>PTS</span><strong>{total("points")}</strong></div><div><span>SOG</span><strong>{total("shots")}</strong></div></>}</div>
          <div className="last-five-bars" role="img" aria-label={`${player.name} ${metricLabel} by game over the last five games`}><div className="chart-caption"><strong>{metricLabel} by game</strong><span>Last 5 official games</span></div><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.slice(-5)} margin={{ top: 10, right: 8, bottom: 0, left: -24 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} allowDecimals={metric === "savePct"} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Bar dataKey={metric} name={metricLabel} fill="var(--orange)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
          <div className="game-card-list">{lastFive.map((game) => <article className="game-card" key={game.gameId}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{gameDate(game.gameDate)}</span></div>{goalie && <b>{game.decision ?? (game.started ? "START" : "APPEARANCE")}</b>}</div><div className="game-stat-grid">{goalie ? <><div><span>SA</span><b>{statValue(game.shotsAgainst)}</b></div><div><span>SV</span><b>{game.shotsAgainst !== null && game.goalsAgainst !== null ? game.shotsAgainst - game.goalsAgainst : "—"}</b></div><div><span>GA</span><b>{statValue(game.goalsAgainst)}</b></div><div><span>SV%</span><b>{statValue(game.savePct, 3)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></> : <><div><span>G</span><b>{statValue(game.goals)}</b></div><div><span>A</span><b>{statValue(game.assists)}</b></div><div><span>PTS</span><b>{statValue(game.points)}</b></div><div><span>SOG</span><b>{statValue(game.shots)}</b></div><div><span>+/-</span><b>{game.plusMinus !== null && game.plusMinus > 0 ? `+${game.plusMinus}` : statValue(game.plusMinus)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></>}</div></article>)}</div>
        </section>}
        {sheetTab === "log" && <details className="full-log" open><summary>Full season game log <span>{games.length} games</span></summary><div className="game-card-list compact">{games.map((game) => <article className="game-card" key={`full-${game.gameId}`}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{gameDate(game.gameDate)}</span></div>{goalie && <b>{game.decision ?? "—"}</b>}</div><div className="game-stat-grid">{goalie ? <><div><span>SA</span><b>{statValue(game.shotsAgainst)}</b></div><div><span>GA</span><b>{statValue(game.goalsAgainst)}</b></div><div><span>SV%</span><b>{statValue(game.savePct, 3)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></> : <><div><span>G</span><b>{statValue(game.goals)}</b></div><div><span>A</span><b>{statValue(game.assists)}</b></div><div><span>PTS</span><b>{statValue(game.points)}</b></div><div><span>SOG</span><b>{statValue(game.shots)}</b></div><div><span>PP PTS</span><b>{statValue(game.powerPlayPoints)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></>}</div></article>)}</div></details>}
        <div className="source-box"><span>Source</span><a href={log.data?.sourceUrl} target="_blank" rel="noreferrer">NHL official game log ↗</a><small>Fetched {log.data ? dateTime(log.data.fetchedAt) : "—"}</small></div>
      </>}
    </section>
  </div>;
}

function RosterView({ parlay, setParlay, sport, soccerLeague, onSoccerLeague, teamFocus }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; sport: Sport; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void; teamFocus: { sport: League; team: string; nonce: number } | null }) {
  if (sport === "nfl") return <NflRosterView parlay={parlay} setParlay={setParlay} teamFocus={teamFocus} />;
  if (sport === "nba") return <NbaRosterView parlay={parlay} setParlay={setParlay} teamFocus={teamFocus} />;
  if (sport === "soccer") return <SoccerRosterView league={soccerLeague ?? "mls"} onLeagueChange={onSoccerLeague} parlay={parlay} setParlay={setParlay} teamFocus={teamFocus} />;
  const [team, setTeam] = useState<TeamCode>("WSH");
  useEffect(() => {
    if (teamFocus && teamFocus.sport === "nhl" && (teams as { code: string }[]).some((t) => t.code === teamFocus.team)) setTeam(teamFocus.team as TeamCode);
  }, [teamFocus]);
  const [selectedPlayer, setSelectedPlayer] = useState<NhlPlayer | null>(null);
  const nhl = useQuery({ queryKey: ["nhl-roster", team], queryFn: () => api.getNhlRoster({ team }) });
  const teamBoard = useQuery({ queryKey: ["premium-board", "nhl"], queryFn: () => api.getPremiumBoard({ sport: "nhl" }), retry: false });
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const selectedTeamName = teams.find((item) => item.code === team)?.name ?? team;
  const teamMoneylines = useMemo(() => moneylinePicks(groupPremiumOffers(teamBoard.data?.offers ?? [])).filter((group) => group.matchup.includes(selectedTeamName)), [teamBoard.data, selectedTeamName]);

  return (
    <>
    <section className="roster-panel">
      <div className="roster-title"><div><p className="kicker">OFFICIAL NHL ROSTERS</p><h2>Team stats & player trends</h2><p className="roster-intro">Tap any player to open graphs, last-five form and the complete game log.</p></div>{nhl.data && <span>Updated {dateTime(nhl.data.fetchedAt)}</span>}</div>
      <label className="select-label" htmlFor="team">Team</label>
      <select id="team" value={team} onChange={(e) => { setTeam(e.target.value as TeamCode); setSelectedPlayer(null); }}>{teams.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
      {teamMoneylines.length > 0 && <section className="team-moneyline"><div className="section-heading"><div><p className="kicker">NEXT GAME</p><h3>Moneyline board</h3></div><span>Best · DraftKings · FanDuel · BetMGM</span></div><div className="moneyline-grid">{teamMoneylines.map((group) => { const side = strongestSide(group); if (!side) return null; const added = parlay.some((item) => item.id === side.id); const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side }; return <article className="moneyline-card" key={group.id}><div className="moneyline-open"><small>{group.matchup}</small><h4>{group.entity}</h4><div><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DraftKings <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>FanDuel <b>{formatAmerican(side.fanDuel?.odds ?? null)}</b></span><span>BetMGM <b>{formatAmerican(side.betMGM?.odds ?? null)}</b></span></div><FlipMeter sport="nhl" market={group} nhlStandings={overview.data?.standings ?? null} nflStandings={null} nbaStandings={null} /><p className={side.evPercent !== null && side.evPercent > 0 ? "signal positive" : "signal"}>{side.evPercent !== null && side.evPercent > 0 ? `+${side.evPercent.toFixed(1)}% fair-odds EV` : "Market favorite"}</p></div><button className={added ? "pick-button added" : "pick-button"} onClick={() => setParlay(added ? parlay.filter((item) => item.id !== side.id) : [...parlay, pick])}>{added ? "Remove" : "Add ML"}</button></article>;})}</div></section>}
      {nhl.isPending ? (
        <div className="loading"><span />Loading official roster…</div>
      ) : nhl.isError ? (
        <div className="inline-error">Official NHL data is temporarily unavailable. <button onClick={() => nhl.refetch()}>Retry</button></div>
      ) : nhl.data ? (
        <>
          <div className="roster-summary"><div><b>{nhl.data.players.length}</b><span>active players</span></div><div><b>{nhl.data.groups.forwards}</b><span>forwards</span></div><div><b>{nhl.data.groups.defensemen}</b><span>defense</span></div><div><b>{nhl.data.groups.goalies}</b><span>goalies</span></div></div>
          <div className="table-scroll"><div className="roster-table" role="table">
            <div className="roster-header" role="row"><span>Player</span><span>GP</span><span>G</span><span>A</span><span>PTS</span><span>SOG</span></div>
            {nhl.data.players.map((player) => {
              const starredEntry = { playerId: player.id, team, name: player.name, position: player.position };
              const goalieStats: [string, string][] = player.position === "G"
                ? [["GP", `${player.games ?? "—"}`], ["W", `${player.wins ?? "—"}`], ["L", `${player.losses ?? "—"}`], ["SV%", player.savePct === null ? "—" : player.savePct.toFixed(3)], ["GAA", player.gaa === null ? "—" : player.gaa.toFixed(2)]]
                : [["GP", `${player.games ?? "—"}`], ["G", `${player.goals ?? "—"}`], ["A", `${player.assists ?? "—"}`], ["PTS", `${player.points ?? "—"}`], ["SOG", `${player.shots ?? "—"}`]];
              return <div className="roster-card" key={player.id}>
                <button className="roster-card-main" onClick={() => setSelectedPlayer(player)} aria-label={`Open ${player.name} game log and charts`}>
                  <span className="roster-card-head"><b>{player.number !== null ? `#${player.number} ` : ""}{player.name}</b><small>{player.position}{player.shoots ? ` · ${player.shoots} shot` : ""}{player.height ? ` · ${player.height} in` : ""}{player.weight ? ` · ${player.weight} lb` : ""}</small></span>
                  <span className="roster-stat-grid">{goalieStats.map(([label, value]) => <span key={label} className="roster-stat"><small>{label}</small><b>{value}</b></span>)}</span>
                </button>
                <PlayerWatchStar sport="nhl" playerId={starredEntry.playerId} team={starredEntry.team} name={starredEntry.name} position={starredEntry.position} />
              </div>;
            })}
          </div></div>
          <div className="source-box"><span>Source</span><a href={nhl.data.sourceUrl} target="_blank" rel="noreferrer">NHL official data ↗</a><small>2026–27 regular season · TOI available per player</small></div>
        </>
      ) : null}
    </section>
    {selectedPlayer && <PlayerStatsSheet key={selectedPlayer.id} player={selectedPlayer} team={team} onClose={() => setSelectedPlayer(null)} />}
    </>
  );
}

function OddsDetailSheet({ market, onClose }: { market: MarketGroup; onClose: () => void }) {
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="odds-detail-title">
      <button className="close" onClick={onClose} aria-label="Close market details">×</button>
      <p className="kicker">LIVE MARKET DETAIL</p>
      <h2 id="odds-detail-title">{market.entity}</h2>
      <p className="matchup">{market.marketName} · {market.matchup}</p>
      {market.sides.map((side) => {
        const openingLine = side.openingLine === null ? null : Number(side.openingLine);
        const currentLine = side.line === null ? null : Number(side.line);
        const lineMovement = openingLine !== null && currentLine !== null && Number.isFinite(openingLine) && Number.isFinite(currentLine) && openingLine !== currentLine;
        const movement = lineMovement
          ? [{ point: "Open", value: openingLine }, { point: "Current", value: currentLine }]
          : [{ point: "Open", value: americanNumber(side.best.openingOdds) }, { point: "Current", value: americanNumber(side.best.odds) }].filter((point): point is { point: string; value: number } => point.value !== null);
        const openingProbability = impliedProbability(side.best.openingOdds);
        const currentProbability = impliedProbability(side.best.odds);
        const steamPoints = openingProbability !== null && currentProbability !== null ? (currentProbability - openingProbability) * 100 : null;
        const bestDecimal = decimalOdds(side.best.odds);
        const tiers = side.offers.reduce((counts, offer) => {
          const value = decimalOdds(offer.odds);
          if (value === null || bestDecimal === null) return counts;
          if (Math.abs(value - bestDecimal) < .001) counts.best += 1;
          else if (bestDecimal - value <= .05) counts.near += 1;
          else counts.other += 1;
          return counts;
        }, { best: 0, near: 0, other: 0 });
        const priceDistribution = [{ name: "Best price", value: tiers.best }, { name: "Within 0.05 decimal", value: tiers.near }, { name: "Other prices", value: tiers.other }].filter((item) => item.value > 0);
        return <section className="odds-side-detail" key={side.id}>
          <div className="odds-side-title"><h3>{titleCase(side.side)} {side.line ?? ""}</h3>{side.evPercent !== null && side.evPercent > 0 ? <b className="value-flag">+{side.evPercent.toFixed(1)}% fair-odds EV</b> : <span>Market price</span>}</div>
          <div className="line-callout sportsbook-callout"><div><span>Best price</span><strong>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</strong></div><div><span>DraftKings</span><strong>{formatAmerican(side.draftKings?.odds ?? null)}</strong></div><div><span>FanDuel</span><strong>{formatAmerican(side.fanDuel?.odds ?? null)}</strong></div><div><span>BetMGM</span><strong>{formatAmerican(side.betMGM?.odds ?? null)}</strong></div><div><span>Books</span><strong>{side.offers.length}</strong></div></div>
          {steamPoints !== null && Math.abs(steamPoints) >= 2 && <div className="steam-alert"><span>LINE MOVE</span><strong>{steamPoints > 0 ? "+" : ""}{steamPoints.toFixed(1)} implied-probability points</strong><small>Best-book opening price to current price</small></div>}
          <div className="chart-caption"><strong>{lineMovement ? "Line movement" : "Price movement"}</strong><span>Opening → current</span></div>
          {movement.length === 2 ? <div className="history-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={movement} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="point" axisLine={false} tickLine={false}/><YAxis domain={["auto","auto"]} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, lineMovement ? "Line" : "American odds"]}/><Line type="linear" dataKey="value" name={lineMovement ? "Line" : "American odds"} stroke="var(--orange)" strokeWidth={3} dot={{ r: 4 }}/></LineChart></ResponsiveContainer></div> : <div className="history-empty"><strong>No opening snapshot supplied.</strong><span>The current market is still available below.</span></div>}
          {priceDistribution.length > 0 && <div className="price-distribution"><div className="chart-caption"><strong>Book price distribution</strong><span>Current snapshot · {side.offers.length} books</span></div><div className="donut-chart" role="img" aria-label={`Current ${titleCase(side.side)} price distribution across ${side.offers.length} sportsbooks`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={priceDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2}>{["var(--green)","var(--accent)","var(--dim)"].map((color) => <Cell key={color} fill={color}/>)}</Pie><Tooltip formatter={(value) => [`${value} books`, "Count"]}/><Legend verticalAlign="bottom" height={34}/></PieChart></ResponsiveContainer></div></div>}
          <div className="book-list">{[...side.offers].sort((a,b)=>(decimalOdds(b.odds)??0)-(decimalOdds(a.odds)??0)).map((offer)=><div className={offer === side.best ? "best-book" : ""} key={`${side.id}-${offer.book}-${offer.odds}`}><span>{bookName(offer.book)}{offer === side.best&&<em className="best-badge">BEST</em>}{isDraftKings(offer.book)&&<em>DK</em>}{isFanDuel(offer.book)&&<em className="fanduel-badge">FANDUEL</em>}{isBetMGM(offer.book)&&<em className="betmgm-badge">BETMGM</em>}</span><b>{titleCase(side.side)} {side.line ?? ""} {formatAmerican(offer.odds)}</b></div>)}</div>
        </section>;
      })}
    </section>
  </div>;
}

function GameGoalieLine({ market, games }: { market: MarketGroup; games: NhlOverview["games"] }) {
  const matchup = market.matchup.toLowerCase();
  const game = games.find((item) => [item.away.name, item.away.abbrev].some((name) => matchup.includes(name.toLowerCase())) && [item.home.name, item.home.abbrev].some((name) => matchup.includes(name.toLowerCase())));
  if (!game) return null;
  const display = (side: typeof game.away) => `${side.abbrev}: ${side.goalie.names[0] ?? "TBD"}${side.goalie.status === "confirmed" ? " ✓" : ""}`;
  return <span className="market-goalies">G {display(game.away)} · {display(game.home)}</span>;
}

type StandingRow = { team: string; name: string; wins: number; losses: number; ties?: number; gamesPlayed?: number; modelWinPct?: number | null };

function recordPct(row: StandingRow): number | null {
  const gp = row.gamesPlayed ?? row.wins + row.losses + (row.ties ?? 0);
  if (gp === 0) return null;
  return (row.wins + (row.ties ?? 0) / 2) / gp;
}

function flipProbability(awayRow: StandingRow | null, homeRow: StandingRow | null): { away: number; home: number } | null {
  if (!awayRow || !homeRow || awayRow.team === homeRow.team) return null;
  // Flip % v2: prefer the server's model-derived win pct when present
  // (NFL/NBA rows); fall back to the pure W/L record. NHL rows carry no
  // modelWinPct, so their behavior is unchanged.
  const awayPct = awayRow.modelWinPct ?? recordPct(awayRow);
  const homePct = homeRow.modelWinPct ?? recordPct(homeRow);
  if (awayPct === null || homePct === null) return null;
  const awayRaw = (awayPct + (1 - homePct)) / 2;
  const homeRaw = (homePct + (1 - awayPct)) / 2;
  const total = awayRaw + homeRaw;
  if (total <= 0) return null;
  return { away: awayRaw / total, home: homeRaw / total };
}

function FlipBars({ awayAbbrev, homeAbbrev, awayProb, homeProb }: { awayAbbrev: string; homeAbbrev: string; awayProb: number; homeProb: number }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return <>
    <div className="winner-track" role="img" aria-label={`Model win probability: ${awayAbbrev} ${pct(awayProb)}, ${homeAbbrev} ${pct(homeProb)}. Model estimate from season records, not a sportsbook line.`}>
      <i style={{ width: `${awayProb * 100}%` }} /><b style={{ width: `${homeProb * 100}%` }} />
    </div>
    <div className="flip-labels"><span>{awayAbbrev} <b>{pct(awayProb)}</b></span><span><b>{pct(homeProb)}</b> {homeAbbrev}</span></div>
  </>;
}

function SlateFlipCard({ awayAbbrev, homeAbbrev, standings, active, onPick }: {
  awayAbbrev: string; homeAbbrev: string; standings: StandingRow[] | null; active: boolean; onPick: () => void;
}) {
  const probs = flipProbability(standings?.find((row) => row.team === awayAbbrev) ?? null, standings?.find((row) => row.team === homeAbbrev) ?? null);
  return <button className={active ? "slate-flip active" : "slate-flip"} onClick={onPick} aria-label={`Load ${awayAbbrev} at ${homeAbbrev} into the calculator`}>
    <strong>{awayAbbrev} @ {homeAbbrev}</strong>
    {probs ? <FlipBars awayAbbrev={awayAbbrev} homeAbbrev={homeAbbrev} awayProb={probs.away} homeProb={probs.home} /> : <span className="slate-flip-empty">Not enough games yet</span>}
  </button>;
}

function FlipMeter({ sport, market, nhlStandings, nflStandings, nbaStandings }: {
  sport: Sport;
  market: MarketGroup;
  nhlStandings: NhlOverview["standings"] | null;
  nflStandings: NflOverview["standings"] | null;
  nbaStandings: NbaOverview["standings"] | null;
}) {
  const standings = sport === "nba" ? nbaStandings : sport === "nfl" ? nflStandings : nhlStandings;
  if (!standings || standings.length === 0) return null;
  // Pull the two teams straight from the moneyline sides (or the "Away @ Home" matchup line).
  const sideNames = market.sides.map((side) => side.side).filter(Boolean);
  const matchupParts = market.matchup.split("@").map((part) => part.trim()).filter(Boolean);
  const candidates = sideNames.length >= 2 ? sideNames : matchupParts.length >= 2 ? matchupParts : [market.entity];
  const matchRow = (label: string) => {
    const needle = label.toLowerCase();
    return standings.find((row) => {
      const name = (row.name ?? "").toLowerCase();
      const abbrev = (row.team ?? "").toLowerCase();
      return name !== "" && (needle === name || needle === abbrev || needle.includes(name) || name.includes(needle));
    }) ?? null;
  };
  const awayLabel = candidates[0];
  const homeLabel = candidates[candidates.length - 1];
  const awayRow = (awayLabel ? matchRow(awayLabel) : null) as StandingRow | null;
  const homeRow = (homeLabel ? matchRow(homeLabel) : null) as StandingRow | null;
  const probs = flipProbability(awayRow, homeRow);
  if (!probs || !awayRow || !homeRow) return null;
  return <div className="flip-meter">
    <div className="flip-head"><span>Flip %</span><em>model estimate</em></div>
    <FlipBars awayAbbrev={awayRow.team} homeAbbrev={homeRow.team} awayProb={probs.away} homeProb={probs.home} />
  </div>;
}

// Key-injury warnings. The server action is landing in a parallel server
// leg; until then the query fails quietly and no chips render. Designations
// are rendered verbatim from the feed — never invented client-side.
function useKeyInjuries(sport: Exclude<Sport, "soccer">) {
  return useQuery({ queryKey: ["key-injuries", sport], queryFn: () => api.getKeyInjuries({ sport }), staleTime: 6 * 60 * 60 * 1000, retry: 1 });
}

// Soccer injuries ride the parallel server leg; until it lands the query
// fails quietly and no chips render.
function useSoccerKeyInjuries(league: SoccerLeague) {
  return useQuery({ queryKey: ["soccer-key-injuries", league], queryFn: () => api.getSoccerKeyInjuries({ league }), staleTime: 6 * 60 * 60 * 1000, retry: 1 });
}

function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed);
  } catch {
    return null;
  }
}

function InjuryChips({ sport, awayCode, homeCode, injuries, scorers }: {
  sport: Sport;
  awayCode: string;
  homeCode: string;
  injuries: KeyInjuries | null | undefined;
  scorers?: LikelyScorers | null;
}) {
  const chips = useMemo(() => {
    if (!injuries || !Array.isArray(injuries.teams) || injuries.teams.length === 0) return [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const findPlayers = (code: string): KeyInjuryPlayer[] => {
      const entry = injuries.teams.find((t) => {
        const tc = norm(t.team);
        return tc === norm(code) || tc === norm(nbaServerTeam(code)) || tc === norm(nbaClientTeam(code));
      });
      return Array.isArray(entry?.players) ? entry.players : [];
    };
    const scorerRate = (name: string): number | null => {
      if (!scorers) return null;
      const target = norm(name);
      for (const list of Object.values(scorers.teams)) {
        const hit = list.find((p) => { const pn = norm(p.name); return pn === target || pn.includes(target) || target.includes(pn); });
        if (hit) return hit.rate;
      }
      return null;
    };
    const out: { team: string; player: KeyInjuryPlayer }[] = [];
    for (const code of [awayCode, homeCode]) {
      if (!code) continue;
      for (const player of findPlayers(code)) {
        if (!player || !player.name || !player.status) continue;
        if (sport === "nba" && scorers) {
          const rate = scorerRate(player.name);
          if (rate === null || rate < 8) continue; // only meaningful rotation scorers
        }
        out.push({ team: code, player });
      }
    }
    return out;
  }, [sport, awayCode, homeCode, injuries, scorers]);
  if (chips.length === 0) return null;
  const asof = shortDate(injuries?.fetchedAt);
  return <div className="injury-chips" role="note" aria-label="Key player injury report">
    {chips.map((chip, index) => <p key={`${chip.team}-${chip.player.name}-${index}`} className="injury-chip">
      <span aria-hidden="true">⚠</span> <b>{chip.team}</b>: {chip.player.name}{chip.player.position ? ` (${chip.player.position})` : ""} — {chip.player.status}{chip.player.note ? ` · ${chip.player.note}` : ""}
    </p>)}
    {asof && <small className="injury-asof">Injury report as of {asof}</small>}
  </div>;
}

function strongestSide(group: MarketGroup): MarketSide | null {  if (group.sides.length === 0) return null;
  return [...group.sides].sort((a, b) => {
    const evDiff = (b.evPercent ?? -Infinity) - (a.evPercent ?? -Infinity);
    if (Number.isFinite(evDiff) && evDiff !== 0) return evDiff;
    return (impliedProbability(b.best.fairOdds) ?? 0) - (impliedProbability(a.best.fairOdds) ?? 0);
  })[0] ?? null;
}
function moneylinePicks(groups: MarketGroup[]): MarketGroup[] {
  const byEvent = new Map<string, MarketGroup[]>();
  for (const group of groups) {
    if (group.period !== "game" || group.marketName.trim().toLowerCase() !== "moneyline") continue;
    const rows = byEvent.get(group.eventId) ?? [];
    rows.push(group);
    byEvent.set(group.eventId, rows);
  }
  return Array.from(byEvent.values()).flatMap((rows) => {
    const ranked = rows.map((group) => ({ group, side: strongestSide(group) })).filter((item): item is { group: MarketGroup; side: MarketSide } => item.side !== null).sort((a, b) => {
      const positiveEvA = a.side.evPercent !== null && a.side.evPercent > 0 ? a.side.evPercent : -Infinity;
      const positiveEvB = b.side.evPercent !== null && b.side.evPercent > 0 ? b.side.evPercent : -Infinity;
      if (positiveEvA !== positiveEvB) return positiveEvB - positiveEvA;
      return (impliedProbability(b.side.best.fairOdds) ?? impliedProbability(b.side.best.odds) ?? 0) - (impliedProbability(a.side.best.fairOdds) ?? impliedProbability(a.side.best.odds) ?? 0);
    });
    return ranked[0]?.group ? [ranked[0].group] : [];
  });
}

function ParlayView({ parlay, setParlay, sport, onGoBoard }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; sport: Sport; onGoBoard: () => void }) {
  const [stake, setStake] = useState("10");
  const [priceMode, setPriceMode] = useState<PriceMode>("draftkings");
  const combined = combinedAmerican(parlay, priceMode);
  const decimal = decimalOdds(combined);
  const stakeValue = Number(stake);
  const payout = decimal !== null && Number.isFinite(stakeValue) ? stakeValue * decimal : 0;
  const priceOptions: { id: PriceMode; label: string }[] = [
    { id: "draftkings", label: "DraftKings" },
    { id: "fanduel", label: "FanDuel" },
    { id: "betmgm", label: "BetMGM" },
    { id: "best", label: "Best price" },
  ];
  return <section className="parlay-section">
    <div className="roster-title"><div><p className="kicker">ODDS & PARLAY CALCULATOR</p><h2>Your slip</h2><p className="roster-intro">Add legs from the {sport === "nfl" ? "gridiron" : sport === "nba" ? "hardwood" : sport === "soccer" ? "pitch" : "ice"} board, then price the slip below.</p></div><span>{parlay.length} legs</span></div>
    {parlay.length === 0 ? <div className="history-empty"><strong>Your slip is empty.</strong><span>Head to the board and tap <b>Add</b> on any market — moneylines, spreads, totals — and they'll stack up here with live combined odds.</span><button className="refresh" onClick={onGoBoard}>Open the board →</button></div> :
    <div className="slip-card" aria-label="Parlay builder">
      <div className="slip-head"><div><p className="kicker">PARLAY BUILDER</p><h3>{parlay.length} leg{parlay.length === 1 ? "" : "s"}</h3></div><strong className="slip-combined">{combined}</strong></div>
      <div className="slip-price" role="group" aria-label="Price slip at"><span>Priced at</span><div className="segmented">{priceOptions.map((opt) => <button key={opt.id} className={priceMode === opt.id ? "active" : ""} onClick={() => setPriceMode(opt.id)} aria-pressed={priceMode === opt.id}>{opt.label}</button>)}</div></div>
      <div className="slip-stake-row"><label>Stake<span className="stake-wrap">$<input inputMode="decimal" value={stake} onChange={(event)=>setStake(event.target.value)} aria-label="Parlay stake"/></span></label><div className="slip-payout"><small>To win</small><strong>${payout.toFixed(2)}</strong></div></div>
      <ul className="slip-legs">{parlay.map((item)=>{const priced=offerForMode(item.side,priceMode);return <li key={item.id}><div><strong>{item.entity}</strong><small>{titleCase(item.side.side)}{item.side.line ? ` ${item.side.line}` : ""} · {item.marketName}</small></div><b>{priced ? `${bookName(priced.book)} ${formatAmerican(priced.odds)}` : "Not offered"}</b><button type="button" className="slip-remove" onClick={() => setParlay(parlay.filter((p) => p.id !== item.id))} aria-label={`Remove ${item.entity} from slip`}>×</button></li>;})}</ul>
      <button className="slip-clear" onClick={()=>setParlay([])}>Clear slip</button>
      <p className="slip-disclaimer">Planning tool only. Every leg must be offered by the selected sportsbook; unavailable legs are never substituted.</p>
    </div>}
  </section>;
}

type CodyPlate = ApiResponse<typeof api, "getPublicPlates">["plates"][number];

// Plate league label. Cast to string: the server widens the sport enum as
// new sides land; unknown values render uppercased rather than crashing.
function plateLeagueLabel(sport: string): string {
  return sport === "nhl" ? "NHL" : sport === "nfl" ? "NFL" : sport === "nba" ? "NBA" : sport === "soccer" ? "SOCCER" : sport.toUpperCase();
}

const TUTORIAL_SLIDES: { icon: string; kicker: string; title: string; points: string[] }[] = [
  { icon: "🍖", kicker: "WELCOME", title: "Fresh cuts, daily.", points: [
    "The Daily Ham serves NHL, NFL, NBA & soccer projections, real sportsbook prices, official league stats, and Cody's personal picks.",
    "Anything the model calculates is labeled a model estimate — never confused with a sportsbook line.",
    "Swipe through this guide to learn the whole shop.",
  ]},
  { icon: "🏒", kicker: "PICK YOUR SIDE", title: "Hockey, football, basketball, soccer?", points: [
    "Tap NHL / NFL / NBA / SOC at the top to switch leagues — each side is built to full depth.",
    "Hit My team on the welcome card and pick your squad: the whole app, background included, dresses in your team's colors. Each side shows only its own league's teams.",
    "The tabs below are your cutting board: Board, Jamón Ibérico, Parlay, Matchup, Players, Streaks, League, Watchlist, Settings.",
  ]},
  { icon: "🏒", kicker: "THE ICE", title: "Hockey, full depth.", points: [
    "The NHL side runs the full engine: the board, the matchup calculator, rosters, streaks, and league standings.",
    "Player files track goals, assists, points and goalie stats per game — tap any name for the full file.",
    "The matchup calculator covers the winner, first goal, first-period and full-game scripts like overtime.",
  ]},
  { icon: "🏈", kicker: "THE GRIDIRON", title: "Football, full depth.", points: [
    "The NFL side runs the full engine: the board, the matchup calculator, rosters, streaks, and AFC/NFC standings.",
    "Player files track passing, rushing and receiving per game — tap any name for the full file.",
    "The matchup calculator covers the winner, first score, first-half and full-game scripts like a 14+ blowout or overtime.",
  ]},
  { icon: "🏀", kicker: "THE HARDWOOD", title: "Basketball, full depth.", points: [
    "The NBA side runs the same engine: the board, the matchup calculator, rosters, streaks, and East/West standings.",
    "Player files track points, rebounds, assists, steals and blocks per game — tap any name for the full file.",
    "The matchup calculator covers the winner, first basket, first-half and full-game scripts like a 15+ blowout or overtime.",
  ]},
  { icon: "⚽", kicker: "THE PITCH", title: "Soccer, full depth.", points: [
    "The soccer side covers MLS and the Premier League — toggle between them at the top of any soccer view.",
    "The matchup calculator is three-way: home win, draw, away win — plus over 2.5 goals and both teams to score, all as model estimates.",
    "Player files track goals, assists and clean sheets; streaks surface who's scoring and who's gone cold.",
  ]},
  { icon: "📋", kicker: "THE BOARD", title: "Every game, one card.", points: [
    "Each game card shows the matchup, start time, and the Flip % bar.",
    "Flip % is the model's win estimate from each team's actual record — e.g. 58% vs 42%.",
    "Under it sit the two likely scorers: season leaders by goals (NHL), TDs (NFL), points (NBA) or goals (soccer). A stat, not a prop.",
  ]},
  { icon: "⚠️", kicker: "INJURY WATCH", title: "Know who's out.", points: [
    "When a key player is officially ruled out — a starting QB, a top scorer, a number-one goalie — you'll see a ⚠ chip on that team's game card.",
    "Designations come straight from official injury reports, with the report date shown. Nothing is guessed.",
    "Always check the chip before trusting a line: a missing star moves the number more than any model.",
  ]},
  { icon: "💲", kicker: "READING THE ODDS", title: "Best · DraftKings · FanDuel · BetMGM", points: [
    "Every moneyline card lists the best price plus DraftKings, FanDuel and BetMGM.",
    "Tap any price to add it to your parlay slip.",
    "A — means that book isn't posting a price for this game.",
  ]},
  { icon: "➕", kicker: "BETTING BASICS", title: "What + and − mean", points: [
    "− means favorite: the number is what you bet to win $100 profit. −150 → bet $150 to win $100.",
    "+ means underdog: the number is the profit on a $100 bet. +130 → bet $100 to win $130.",
    "Bigger − = heavier favorite. Bigger + = bigger underdog.",
    "−110 is the standard line: bet $110 to win $100. The extra $10 is the book's cut.",
  ]},
  { icon: "💰", kicker: "SAFE BETTING 1/12", title: "Protect the bankroll", points: [
    "Decide your unit before you bet — most sharp bettors risk just 1–2% of their bankroll per play.",
    "A $1,000 bankroll means $10–$20 bets. Flat units keep one cold week from wiping you out.",
  ]},
  { icon: "🧾", kicker: "SAFE BETTING 2/12", title: "The vig is the real opponent", points: [
    "At standard −110 you bet $110 to win $100 — so you must win 52.4% of those bets just to break even.",
    "Picking winners isn't enough. Beating the price is the whole game.",
  ]},
  { icon: "📐", kicker: "SAFE BETTING 3/12", title: "Odds are just percentages", points: [
    "−110 implies a 52.4% chance. +130 implies 43.5%. Every price is a probability in disguise.",
    "If your read says a team wins more often than the price implies, that's an edge — the model percentages here exist for exactly that comparison.",
  ]},
  { icon: "🛒", kicker: "SAFE BETTING 4/12", title: "Shop every line", points: [
    "The same bet can be −110 at one book and −105 at another. That gap is pure profit over a season.",
    "This app lines up Best, DraftKings, FanDuel and BetMGM on every card so you never take a worse number than you have to.",
  ]},
  { icon: "🎰", kicker: "SAFE BETTING 5/12", title: "Parlays are fun, not a plan", points: [
    "Every leg you add multiplies the book's edge. The payout looks huge because the true odds are worse.",
    "Great entertainment for a few dollars and a big sweat — never a bankroll strategy.",
  ]},
  { icon: "🏃", kicker: "SAFE BETTING 6/12", title: "Never chase losses", points: [
    "Doubling up after a loss to “get it back” is how small losing days become big ones.",
    "The next game doesn't owe you anything. Set a daily stop-loss and walk away when you hit it.",
  ]},
  { icon: "📉", kicker: "SAFE BETTING 7/12", title: "Beat the closing line", points: [
    "If you bet −3 and it closes −4.5, you beat the closing line — your read was sharper than the market.",
    "Pros track this obsessively: consistently beating the close means you're pricing games better than the books.",
  ]},
  { icon: "🔒", kicker: "SAFE BETTING 8/12", title: "There are no locks", points: [
    "Heavy favorites lose every single week in every sport. “Can't lose” has bankrupted smarter people than us.",
    "Never bet money you can't afford to lose, and never size up just because something feels certain.",
  ]},
  { icon: "🗒️", kicker: "SAFE BETTING 9/12", title: "Track every bet", points: [
    "Write down every play: date, side, price, stake, result. After 100 bets your ledger tells you the truth.",
    "You'll learn exactly where you're sharp — and where you're donating. Without it, you're guessing about your own skill.",
  ]},
  { icon: "🧠", kicker: "SAFE BETTING 10/12", title: "Beware the fandom tax", points: [
    "Betting your own team every week feels great and usually costs money — fans systematically overrate their squad.",
    "If you can't price your team coldly, skip their games. Your fandom and your bankroll are separate accounts.",
  ]},
  { icon: "🤖", kicker: "SAFE BETTING 11/12", title: "Models aren't guarantees", points: [
    "Every percentage on this app is a model estimate built from past data — not a prediction of the future.",
    "Models are wrong all the time; that's the job. Use them to compare against prices, never as answers.",
  ]},
  { icon: "🚶", kicker: "SAFE BETTING 12/12", title: "Know when to walk away", points: [
    "If betting stops being fun, if you're hiding it, or if you're wagering money you need — stop and talk to someone.",
    "In the US, call or text 1-800-GAMBLER any time. No shame in it: the sharpest move is knowing when to step back.",
  ]},
  { icon: "⚖️", kicker: "MODEL VS BOOKS", title: "Finding value", points: [
    "The matchup calculator compares the model's estimate to what the books imply.",
    "A flip alert fires when the model likes a side more than the books do.",
    "Coin toss means it's too close to call — no edge either way.",
  ]},
  { icon: "📜", kicker: "TRACK RECORD", title: "The receipts.", points: [
    "The Record tab grades every pregame model pick against final scores — and against the books' own prices.",
    "You'll see the model's win-loss record, how the book favorite did on the same games, and the model's ROI at real prices.",
    "Nothing hidden, nothing cherry-picked: when the model is cold, it says so right here.",
  ]},
  { icon: "🎯", kicker: "MATCHUP CALCULATOR", title: "Every angle, sliced.", points: [
    "Pick any game for the model's take: winner, first score, and situational calls — a 14+ blowout or overtime in football, first basket in hoops, home/draw/away in soccer.",
    "Every percentage is a model estimate from official game data — not a sportsbook price.",
    "Use it to sanity-check your own read before you bet.",
  ]},
  { icon: "📊", kicker: "CHARTS & GRAPHS", title: "How to read the visuals", points: [
    "Flip % bar: the split is the model's win estimate — more fill, more likely. Soccer shows three segments: home, draw, away.",
    "Glass probability bars: fuller means more likely. Same idea everywhere.",
    "Player trend graph: per-game stat over recent games — a rising line means heating up.",
    "Donut chart: how the books split their prices. Tendency bars: how often a team scores first.",
  ]},
  { icon: "🔥", kicker: "PLAYERS & STREAKS", title: "Form at a glance", points: [
    "Tap any player for the full file: trend graph, model projection, last five games, full game log.",
    "Tap ★ to watch a player or team — they land in your Watchlist.",
    "Streaks shows who's hot 🔥 and who's ice-cold 🧊 (The Cutting Board), from official box scores.",
  ]},
  { icon: "🧾", kicker: "PARLAY & WATCHLIST", title: "Build your slip", points: [
    "Prices you tap stack up in the Parlay tab — set a stake to see combined odds and payout.",
    "Your Watchlist keeps every starred player and team one tap away.",
    "Team cards open the full team file with the depth chart.",
  ]},
  { icon: "🍽️", kicker: "JAMÓN IBÉRICO", title: "Cody's picks", points: [
    "The golden plate tab holds Cody's personal picks, plated for public viewing.",
    "These are his reads — not model output, not sportsbook lines.",
  ]},
  { icon: "⚙️", kicker: "MAKE IT YOURS", title: "Settings", points: [
    "Brightness slider and scroll feel, saved per device.",
    "Install the app to your home screen for the full experience.",
    "That's the whole tour — go slice up the board.",
  ]},
];

function TutorialSheet({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(TUTORIAL_SLIDES.length - 1, next));
    setIndex(clamped);
    const child = railRef.current?.children[clamped] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
  };
  const onScroll = () => {
    const rail = railRef.current;
    if (!rail || rail.clientWidth === 0) return;
    setIndex(Math.max(0, Math.min(TUTORIAL_SLIDES.length - 1, Math.round(rail.scrollLeft / rail.clientWidth))));
  };
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet tutorial-sheet" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <button className="close" onClick={onClose} aria-label="Close tutorial">×</button>
      <p className="kicker">HOW TO USE THE DAILY HAM</p>
      <div className="tutorial-rail" ref={railRef} onScroll={onScroll}>
        {TUTORIAL_SLIDES.map((slide, i) => <article className="tutorial-slide" key={slide.title}>
          <span className="tutorial-icon" aria-hidden="true">{slide.icon}</span>
          <p className="tutorial-slide-kicker">{slide.kicker}</p>
          <h2 id={i === 0 ? "tutorial-title" : undefined}>{slide.title}</h2>
          <ul>{slide.points.map((point) => <li key={point}>{point}</li>)}</ul>
        </article>)}
      </div>
      <div className="tutorial-dots" aria-hidden="true">{TUTORIAL_SLIDES.map((slide) => <span key={slide.title} className={TUTORIAL_SLIDES[index] === slide ? "active" : ""} />)}</div>
      <div className="tutorial-nav">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous tutorial page">← Back</button>
        <span>{index + 1} of {TUTORIAL_SLIDES.length} · swipe →</span>
        {index < TUTORIAL_SLIDES.length - 1
          ? <button type="button" className="primary" onClick={() => goTo(index + 1)}>Next →</button>
          : <button type="button" className="primary" onClick={onClose}>Start slicing</button>}
      </div>
    </section>
  </div>;
}

type TrackRecord = ApiResponse<typeof api, "getTrackRecord">;
type TrackEra = TrackRecord["backtest"];

function EraCard({ title, sub, era, showBooks, emptyHint }: {
  title: string; sub: string; era: TrackEra; showBooks: boolean; emptyHint?: string;
}) {
  const wl = (w: number, l: number) => `${w}–${l}`;
  return <section className="record-era" aria-label={title}>
    <div className="section-heading"><div><p className="kicker">{sub}</p><h3>{title}</h3></div></div>
    {era.picks === 0 ? (
      <div className="history-empty"><strong>No graded picks yet.</strong><span>{emptyHint ?? "Check back soon."}</span></div>
    ) : (
      <>
        <div className="record-score">
          <div><span>Model record</span><strong>{wl(era.wins, era.losses)}</strong><em>{era.winPct === null ? "—" : `${era.winPct}%`}</em></div>
          {showBooks && <div><span>Book favorite (vig-free)</span><strong>{era.bookWins === null || era.bookLosses === null ? "—" : wl(era.bookWins, era.bookLosses)}</strong><em>{era.bookWinPct === null ? "—" : `${era.bookWinPct}%`}</em></div>}
          {showBooks && <div><span>Model ROI (1u, best price)</span><strong className={era.roiUnits === null ? "" : era.roiUnits >= 0 ? "positive" : "negative"}>{era.roiUnits === null ? "—" : `${era.roiUnits >= 0 ? "+" : ""}${era.roiUnits}u`}</strong><em>units</em></div>}
        </div>
        <div className="record-sports">
          {era.bySport.map((s) => (
            <div key={s.sport} className="record-sport-row"><span>{plateLeagueLabel(s.sport)}</span><b>{wl(s.wins, s.losses)}</b><em>{s.winPct === null ? "—" : `${s.winPct}%`}</em></div>
          ))}
        </div>
      </>
    )}
  </section>;
}

function RecordView() {
  const record = useQuery({
    queryKey: ["track-record"],
    queryFn: () => api.getTrackRecord(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const data = record.data;
  const pickLabel = (pick: string | null, prob: number | null) =>
    pick === null ? "No pick" : `${pick === "away" ? "Away" : pick === "home" ? "Home" : "Draw"}${prob === null ? "" : ` ${Math.round(prob * 100)}%`}`;
  return <section className="record-view" aria-label="Track Record — model vs the books">
    <div className="record-hero">
      <p className="kicker">TRANSPARENCY</p>
      <h1>Track Record</h1>
      <p>Every pregame model pick, graded against final scores — and against the books' own prices. Nothing hidden, nothing cherry-picked.</p>
    </div>
    {record.isPending ? <div className="slate-loading">Tallying the record…</div>
      : record.isError ? <div className="history-empty"><strong>Record unavailable.</strong><span>Pull to refresh and try again.</span></div>
      : data && <>
        <EraCard
          title="Since launch · backtest"
          sub="OCT 7–12 · MODEL VS FINAL SCORES"
          era={data.backtest}
          showBooks={false}
        />
        <p className="record-note">Historical book lines were never stored, so no vs-books comparison exists for this period. That's exactly why live tracking started.</p>
        <EraCard
          title="Tracked vs the books · live"
          sub="FROM OCT 13 · PREGAME SNAPSHOTS"
          era={data.live}
          showBooks={true}
          emptyHint="First snapshots land with the morning refresh — check back after today's games."
        />
        <p className="record-note">Live picks are snapshotted every morning before games, with the model's win probability and each side's best book price (vig removed for the book comparison). The model only picks at 55%+ confidence — below that it passes rather than guessing. ROI assumes a flat 1 unit on every model pick at the best captured price.</p>
        {data.recent.length > 0 && <section className="record-recent" aria-label="Recent graded picks">
          <div className="section-heading"><div><p className="kicker">RECEIPT</p><h3>Recent picks</h3></div></div>
          <div className="record-list">
            {data.recent.map((p) => (
              <article key={p.id} className="record-row">
                <div className="record-row-head"><strong>{p.awayTeam} @ {p.homeTeam}</strong><span>{p.gameDate} · {plateLeagueLabel(p.sport)}{p.source === "backtest" ? " · backtest" : ""}</span></div>
                <div className="record-row-body">
                  <span>Model: <b>{pickLabel(p.modelPick, p.modelProb)}</b> {p.modelCorrect === null ? null : p.modelCorrect ? <em className="positive">✓</em> : <em className="negative">✗</em>}</span>
                  {p.bookPick !== null && <span>Book: <b>{pickLabel(p.bookPick, null)}</b> {p.bookCorrect === null ? null : p.bookCorrect ? <em className="positive">✓</em> : <em className="negative">✗</em>}</span>}
                </div>
              </article>
            ))}
          </div>
        </section>}
      </>}
  </section>;
}

function JamonView({ sport }: { sport: Sport }) {
  const [adminToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY); } catch { return null; }
  });
  const plates = useQuery({
    queryKey: ["jamon-plates", !!adminToken],
    queryFn: async () => {
      const data = adminToken ? await api.getMyPlates({ adminToken }) : await api.getPublicPlates({});
      return data.plates;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const visible = (plates.data ?? []).filter((plate) => plate.sport === sport);
  return <section className="jamon-view" aria-label="Jamón Ibérico — Cody's picks">
    <div className="jamon-hero">
      <p className="kicker">JAMÓN IBÉRICO</p>
      <h1>Cody's picks</h1>
      <p>The premium cut — {sport === "nhl" ? "hockey" : sport === "nfl" ? "football" : sport === "nba" ? "basketball" : "soccer"} picks, plated by hand.</p>
    </div>
    {plates.isPending ? <div className="slate-loading">Plating the picks…</div> : visible.length === 0 ? (
      <div className="history-empty jamon-empty"><strong>No picks plated yet.</strong><span>{adminToken ? "Add your first plate in Settings → My plates." : "Check back soon — Cody's personal picks land here."}</span></div>
    ) : (
      <div className="jamon-spread">{visible.map((plate) => <article className="jamon-plate large" key={plate.id}>
        <div className="plate-top"><span className="plate-league">{plateLeagueLabel(plate.sport as string)}</span>{!plate.isPublic && <em className="plate-private">Private</em>}</div>
        <small className="plate-matchup">{plate.matchup}</small>
        <strong className="plate-pick">{plate.pick}</strong>
        {plate.note ? <p className="plate-note">{plate.note}</p> : null}
      </article>)}</div>
    )}
    <p className="jamon-foot">Cody's personal picks — his read, not model output and not a sportsbook line.</p>
  </section>;
}

function ProView({ parlay, setParlay, home = false, sport, soccerLeague, onSoccerLeague }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; home?: boolean; sport: Sport; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void }) {
  if (sport === "soccer") return <SoccerBoardView league={soccerLeague ?? "mls"} onLeagueChange={onSoccerLeague} parlay={parlay} setParlay={setParlay} home={home} />;
  const board = useQuery({ queryKey: ["premium-board", sport], queryFn: () => api.getPremiumBoard({ sport }), retry: false });
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1, enabled: sport === "nhl" });
  const nflOverview = useQuery({ queryKey: ["nfl-overview", "current"], queryFn: () => api.getNflOverview({}), staleTime: 15 * 60 * 1000, retry: 1, enabled: sport === "nfl" });
  const nbaOverview = useQuery({ queryKey: ["nba-overview", "current"], queryFn: () => api.getNbaOverview({}), staleTime: 15 * 60 * 1000, retry: 1, enabled: sport === "nba" });
  const scorers = useQuery({ queryKey: ["likely-scorers", sport], queryFn: () => api.getLikelyScorers({ sport }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const injuries = useKeyInjuries(sport);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedMarket, setSelectedMarket] = useState<MarketGroup | null>(null);
  const [stake, setStake] = useState("10");
  const [priceMode, setPriceMode] = useState<PriceMode>("draftkings");
  const groups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(groups.map((g) => offerCategory(g, sport)))).sort()], [groups, sport]);
  const visible = groups.filter((group) => (category === "All" || offerCategory(group, sport) === category) && `${group.matchup} ${group.marketName} ${group.stat} ${group.entity} ${group.sides.map((side) => side.side).join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (offerCategory(a, sport) === "Moneyline" ? -1 : 0) - (offerCategory(b, sport) === "Moneyline" ? -1 : 0));
  const moneylines = moneylinePicks(groups);
  const combined = combinedAmerican(parlay, priceMode);
  const decimal = decimalOdds(combined);
  const stakeValue = Number(stake);
  const payout = decimal !== null && Number.isFinite(stakeValue) ? stakeValue * decimal : 0;
  const toggleParlay = (group: MarketGroup, side: MarketSide) => {
    const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side };
    setParlay(parlay.some((item) => item.id === pick.id) ? parlay.filter((item) => item.id !== pick.id) : [...parlay, pick]);
  };
  return <>
    {home && <><InstallCard/><ScheduleStrip compact sport={sport}/></>}
    <ProviderStatus pending={board.isPending || board.isFetching} error={board.error instanceof Error ? board.error.message : null} onRetry={() => board.refetch()} />
    {board.data && <section className="pro-board">
      <div className="roster-title"><div><p className="kicker">{home ? "TODAY'S COMPLETE BOARD" : "LIVE SPORTSBOOK BOARD"}</p><h2>{groups.length.toLocaleString()} markets · {board.data.offerCount.toLocaleString()} book prices</h2><p className="roster-intro">Every market returned by the feed, paired across sides when both are offered.</p></div><span>{board.data.eventCount} events · {dateTime(board.data.fetchedAt)}</span></div>
      <div className={board.data.cacheStatus === "fresh" ? "refresh-health fresh" : "refresh-health stale"} role="status"><span className="health-dot"/><div><strong>{board.data.cacheStatus === "fresh" ? "Odds feed healthy" : "Showing last successful update"}</strong><small>{board.data.healthMessage} · Updated {dateTime(board.data.fetchedAt)}</small></div></div>
      {moneylines.length > 0 && <section className="moneyline-rail" aria-labelledby="moneyline-title"><div className="section-heading"><div><p className="kicker">FIRST LOOK</p><h3 id="moneyline-title">Moneyline picks</h3></div><span>Best · DraftKings · FanDuel · BetMGM</span></div><div className="moneyline-grid">{moneylines.map((group) => { const side = strongestSide(group); if (!side) return null; const added = parlay.some((item) => item.id === side.id); const positiveEv = side.evPercent !== null && side.evPercent > 0; const codes = marketTeamCodes(sport, group, overview.data?.standings ?? null, nflOverview.data?.standings ?? null, nbaOverview.data?.standings ?? null); return <article className="moneyline-card" key={group.id}><button className="moneyline-open" onClick={() => setSelectedMarket(group)} aria-label={`Open moneyline prices for ${group.entity}`}><small>{group.matchup}</small><h4>{group.entity}</h4><div><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DraftKings <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>FanDuel <b>{formatAmerican(side.fanDuel?.odds ?? null)}</b></span><span>BetMGM <b>{formatAmerican(side.betMGM?.odds ?? null)}</b></span></div>{sport === "nhl" && <GameGoalieLine market={group} games={overview.data?.games ?? []}/>}
<FlipMeter sport={sport} market={group} nhlStandings={overview.data?.standings ?? null} nflStandings={nflOverview.data?.standings ?? null} nbaStandings={nbaOverview.data?.standings ?? null} />
{codes && <InjuryChips sport={sport} awayCode={codes[0]} homeCode={codes[1]} injuries={injuries.data ?? null} scorers={scorers.data ?? null} />}
<LikelyScorersStrip sport={sport} market={group} nhlStandings={overview.data?.standings ?? null} nflStandings={nflOverview.data?.standings ?? null} nbaStandings={nbaOverview.data?.standings ?? null} scorers={scorers.data ?? null} />
<p className={positiveEv ? "signal positive" : "signal"}>{positiveEv ? `+${side.evPercent?.toFixed(1)}% fair-odds EV` : "Market favorite"}</p></button><button className={added ? "pick-button added" : "pick-button"} onClick={() => toggleParlay(group, side)}>{added ? "Remove" : "Add ML"}</button></article>;})}</div></section>}
      {parlay.length>0&&<aside className="parlay-panel" aria-label="Parlay builder"><div><p className="kicker">PARLAY BUILDER</p><h3>{parlay.length} legs · {combined}</h3></div><label>Price at<select value={priceMode} onChange={(event)=>setPriceMode(event.target.value as PriceMode)} aria-label="Parlay sportsbook"><option value="draftkings">DraftKings</option><option value="fanduel">FanDuel</option><option value="betmgm">BetMGM</option><option value="best">Best price</option></select></label><label>Stake<input inputMode="decimal" value={stake} onChange={(event)=>setStake(event.target.value)} aria-label="Parlay stake"/></label><div><small>Estimated return</small><strong>${payout.toFixed(2)}</strong></div><button onClick={()=>setParlay([])}>Clear</button><ul>{parlay.map((item)=>{const priced=offerForMode(item.side,priceMode);return <li key={item.id}><span>{item.entity} · {titleCase(item.side.side)} {item.side.line??""}</span><b>{priced ? `${bookName(priced.book)} ${formatAmerican(priced.odds)}` : "Not offered"}</b></li>;})}</ul><p>Planning tool only. Every leg must be offered by the selected sportsbook; unavailable legs are never substituted.</p></aside>}
      <div className="pro-controls"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, team or market" aria-label="Search live odds"/><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter market type">{categories.map((name) => <option key={name}>{name}</option>)}</select><button onClick={() => board.refetch()} disabled={board.isFetching}>{board.isFetching ? "Refreshing…" : "Refresh lines"}</button></div>
      <div className="market-table complete-market-table">{visible.map((market) => { const matchupLine = market.matchup.includes(market.entity) ? `${market.matchup} · ${titleCase(market.period)}` : `${market.entity} · ${market.matchup} · ${titleCase(market.period)}`; return <article className="complete-market" key={market.id}><button className="market-open" onClick={()=>setSelectedMarket(market)} aria-label={`Open ${market.marketName} for ${market.entity}`}><b>{market.marketName}</b><small>{matchupLine}</small>{sport === "nhl" && <GameGoalieLine market={market} games={overview.data?.games ?? []}/>}</button><div className="side-quotes">{market.sides.map((side) => { const added = parlay.some((item) => item.id === side.id); const openingProbability=impliedProbability(side.best.openingOdds); const currentProbability=impliedProbability(side.best.odds); const move=openingProbability!==null&&currentProbability!==null?(currentProbability-openingProbability)*100:null; return <div className="side-quote" key={side.id}><div className="quote-main"><strong>{titleCase(side.side)} {side.line ?? ""}</strong><div className="quote-books"><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DK <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>FD <b>{formatAmerican(side.fanDuel?.odds ?? null)}</b></span><span>MGM <b>{formatAmerican(side.betMGM?.odds ?? null)}</b></span></div><div className="quote-chips">{side.evPercent !== null && side.evPercent > 0 && <em>+{side.evPercent.toFixed(1)}% EV</em>}{move!==null&&Math.abs(move)>=2&&<em className="steam-chip">Move {move>0?"+":""}{move.toFixed(1)} pts</em>}</div></div><button className={added ? "pick-button added" : "pick-button"} onClick={() => toggleParlay(market, side)}>{added ? "Remove" : "Add"}</button></div>;})}</div></article>;})}</div>
      {visible.length===0&&<div className="history-empty"><strong>No matching markets.</strong><span>Clear the filters or refresh the provider board.</span></div>}
    </section>}
    {selectedMarket&&<OddsDetailSheet market={selectedMarket} onClose={()=>setSelectedMarket(null)}/>}</>;
}

function GoalieIndicator({ label, goalie }: { label: string; goalie: NhlOverview["games"][number]["away"]["goalie"] }) {
  return <div className={`goalie-indicator ${goalie.status}`}><span>{label}</span><strong>{goalie.names.length ? goalie.names.join(" / ") : "Starter not posted"}</strong><small>{goalie.status === "confirmed" ? "Confirmed starter" : goalie.status === "watch" ? "Official NHL goalie watch · not confirmed" : "Awaiting official lineup data"}</small></div>;
}

function ScheduleStrip({ compact = false, sport, soccerLeague }: { compact?: boolean; sport: Sport; soccerLeague?: SoccerLeague }) {
  if (sport === "nfl") return <NflScheduleStrip compact={compact} />;
  if (sport === "nba") return <NbaScheduleStrip compact={compact} />;
  if (sport === "soccer") return <SoccerScheduleStrip compact={compact} league={soccerLeague ?? "mls"} />;
  return <NhlScheduleStrip compact={compact} />;
}

function NhlScheduleStrip({ compact = false }: { compact?: boolean }) {
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const injuries = useKeyInjuries("nhl");
  if (overview.isPending) return <div className="slate-loading">Loading the official NHL slate…</div>;
  if (overview.isError || !overview.data) return <div className="inline-error slate-error"><strong>NHL schedule unavailable.</strong><button onClick={() => overview.refetch()}>Retry</button></div>;
  const games = compact ? overview.data.games.filter((game) => game.date === overview.data?.date) : overview.data.games;
  return <section className="slate-section"><div className="section-heading"><div><p className="kicker">OFFICIAL NHL SCHEDULE</p><h3>{compact ? "Tonight on the ice" : "Scores & schedule"}</h3></div><span>Updated {dateTime(overview.data.fetchedAt)}</span></div>{games.length ? <div className="slate-grid">{games.map((game) => <article className="game-tile" key={game.id}><div className="game-time"><span>{gameDate(game.date)}</span><b>{game.state === "FINAL" || game.state === "OFF" ? "Final" : dateTime(game.startsAt)}</b></div><div className="score-team"><strong>{game.away.name}</strong><TeamWatchStar sport="nhl" team={game.away.abbrev} name={game.away.name} /><b>{game.away.score ?? "—"}</b></div><div className="score-team"><strong>{game.home.name}</strong><TeamWatchStar sport="nhl" team={game.home.abbrev} name={game.home.name} /><b>{game.home.score ?? "—"}</b></div><div className="goalie-grid"><GoalieIndicator label={game.away.abbrev} goalie={game.away.goalie}/><GoalieIndicator label={game.home.abbrev} goalie={game.home.goalie}/></div><InjuryChips sport="nhl" awayCode={game.away.abbrev} homeCode={game.home.abbrev} injuries={injuries.data ?? null} />{game.broadcasts.length > 0 && <small className="broadcasts">{game.broadcasts.join(" · ")}</small>}</article>)}</div> : <div className="history-empty"><strong>No games on today’s official slate.</strong><span>Future games will appear when the NHL schedule posts them.</span></div>}<div className="source-box"><span>Source</span><a href={overview.data.scheduleSourceUrl} target="_blank" rel="noreferrer">NHL official schedule ↗</a><small>Starter labels appear only when official game data supports them.</small></div></section>;
}

function LeagueView({ sport, soccerLeague, onSoccerLeague }: { sport: Sport; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void }) {
  if (sport === "nfl") return <NflLeagueView />;
  if (sport === "nba") return <NbaLeagueView />;
  if (sport === "soccer") return <SoccerLeagueView league={soccerLeague ?? "mls"} onLeagueChange={onSoccerLeague} />;
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const [conference, setConference] = useState("All");
  if (overview.isPending) return <div className="loading"><span />Loading NHL schedule and standings…</div>;
  if (overview.isError || !overview.data) return <div className="error-state"><h2>League center is between shifts.</h2><p>The official NHL feed did not answer.</p><button onClick={() => overview.refetch()}>Retry</button></div>;
  const standings = overview.data.standings.filter((row) => conference === "All" || row.conference === conference);
  return <><ScheduleStrip sport="nhl"/><section className="standings-section"><div className="section-heading"><div><p className="kicker">LEAGUE TABLE</p><h3>2026–27 standings</h3></div><span>{overview.data.standings.length} clubs</span></div><div className="metric-tabs"><button className={conference === "All" ? "active" : ""} onClick={() => setConference("All")}>All</button>{Array.from(new Set(overview.data.standings.map((row) => row.conference))).filter(Boolean).map((name) => <button key={name} className={conference === name ? "active" : ""} onClick={() => setConference(name)}>{name}</button>)}</div><div className="standings-scroll"><div className="standings-table" role="table"><div className="standings-row header" role="row"><span>Team</span><span>GP</span><span>W</span><span>L</span><span>OT</span><span>PTS</span><span>DIFF</span></div>{standings.map((row, index) => <div className="standings-row" role="row" key={row.team}><span><b>{index + 1}</b><strong>{row.name}</strong><small>{row.division}</small><span className="standings-star"><TeamWatchStar sport="nhl" team={row.team} name={row.name} /></span></span><span>{row.gamesPlayed}</span><span>{row.wins}</span><span>{row.losses}</span><span>{row.otLosses}</span><span><b>{row.points}</b></span><span className={row.goalsFor - row.goalsAgainst > 0 ? "positive" : ""}>{row.goalsFor - row.goalsAgainst > 0 ? "+" : ""}{row.goalsFor - row.goalsAgainst}</span></div>)}</div></div><div className="source-box"><span>Source</span><a href={overview.data.standingsSourceUrl} target="_blank" rel="noreferrer">NHL official standings ↗</a><small>Goals differential is computed from the listed official totals.</small></div></section></>;
}

function hotPlayerRef(row: HotStreaks["players"][number] | NhlColdStreaks["players"][number]): NhlPlayer {
  return { id: row.playerId, name: row.name, number: null, position: row.position, shoots: null, height: null, weight: null, games: null, goals: null, assists: null, points: null, shots: null, toiSeconds: null, savePct: null, gaa: null, wins: null, losses: null, shotsAgainst: null, saves: null };
}

function HotStreaksView({ sport, soccerLeague, onSoccerLeague }: { sport: Sport; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void }) {
  if (sport === "nfl") return <NflHotStreaksView />;
  if (sport === "nba") return <NbaHotStreaksView />;
  if (sport === "soccer") return <SoccerHotStreaksView league={soccerLeague ?? "mls"} onLeagueChange={onSoccerLeague} />;
  const [category, setCategory] = useState("Heat index");
  const [selected, setSelected] = useState<{ player: NhlPlayer; team: TeamCode } | null>(null);
  const hot = useQuery({ queryKey: ["nhl-hot-streaks"], queryFn: () => api.getHotStreaks({ force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getHotStreaks({ force: true }), onSuccess: (data) => { void hot.refetch(); return data; } });
  const players = [...(hot.data?.players ?? [])].sort((a, b) => {
    if (category === "Point streak") return b.pointStreak - a.pointStreak || b.lastFivePoints - a.lastFivePoints;
    if (category === "Goal streak") return b.goalStreak - a.goalStreak || b.lastFiveGoals - a.lastFiveGoals;
    if (category === "Last-5 points") return b.lastFivePoints - a.lastFivePoints || b.pointStreak - a.pointStreak;
    if (category === "Last-5 goals") return b.lastFiveGoals - a.lastFiveGoals || b.goalStreak - a.goalStreak;
    if (category === "Goalies") return (b.lastFiveSavePct ?? -1) - (a.lastFiveSavePct ?? -1);
    return b.heatScore - a.heatScore;
  }).filter((row) => category !== "Goalies" || row.lastFiveSavePct !== null);
  return <section className="hot-section"><div className="roster-title"><div><p className="kicker">HOT STREAKS</p><h2>Who’s cooking right now</h2><p className="roster-intro">Every qualifying streak is calculated from official recent NHL boxscores. Tap a player for the full stat file.</p></div>{hot.data && <div className="roster-update"><span>Updated {dateTime(hot.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh streaks"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Heat index","Point streak","Goal streak","Last-5 points","Last-5 goals","Goalies"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{hot.isPending ? <div className="loading"><span />Reading recent NHL boxscores…</div> : hot.isError ? <div className="error-state"><h2>Streak board unavailable.</h2><p>The official boxscore feed did not answer.</p><button onClick={() => hot.refetch()}>Retry</button></div> : players.length === 0 ? <div className="history-empty"><strong>No qualifying streaks in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying hot signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <div className="hot-row-wrap" key={row.playerId}><button className="hot-row" onClick={() => setSelected({ player: hotPlayerRef(row), team: row.team })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {row.position}</small></span><span className="streak-badges">{row.pointStreak >= 2 && <b>{row.pointStreak}G point streak</b>}{row.goalStreak >= 2 && <b>{row.goalStreak}G goal streak</b>}{row.lastFiveSavePct !== null && <b>{(row.lastFiveSavePct * 100).toFixed(1)} SV%</b>}</span><span className="hot-totals"><b>{row.lastFivePoints} PTS</b><small>{row.lastFiveGoals} G · last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`${game.date} vs ${game.opponent}`}>{row.position === "G" ? `${game.saves ?? "—"} SV` : `${game.goals}G ${game.assists}A`}</i>)}</span></button><PlayerWatchStar sport="nhl" playerId={row.playerId} team={row.team} name={row.name} position={row.position} /></div>)}</div>}{hot.data && <div className="source-box"><span>Source</span><a href={hot.data.sourceUrl} target="_blank" rel="noreferrer">NHL official boxscores ↗</a><small>{gameDate(hot.data.windowStart)}–{gameDate(hot.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <PlayerStatsSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)}/>}</section>;
}

function CuttingBoardView({ sport, soccerLeague, onSoccerLeague }: { sport: Sport; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void }) {
  if (sport === "nfl") return <NflCuttingBoard />;
  if (sport === "nba") return <NbaCuttingBoard />;
  if (sport === "soccer") return <SoccerCuttingBoard league={soccerLeague ?? "mls"} onLeagueChange={onSoccerLeague} />;
  return <NhlCuttingBoard />;
}

function StreaksView({ sport, initialSide, soccerLeague, onSoccerLeague }: { sport: Sport; initialSide?: "hot" | "cold"; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void }) {
  const [side, setSide] = useState<"hot" | "cold">(initialSide ?? "hot");
  return <section className="streaks-wrap">
    <div className="streaks-toggle" role="tablist" aria-label="Streak direction">
      <button role="tab" aria-selected={side === "hot"} className={side === "hot" ? "active hot" : ""} onClick={() => setSide("hot")}>🔥 Hot streaks</button>
      <button role="tab" aria-selected={side === "cold"} className={side === "cold" ? "active cold" : ""} onClick={() => setSide("cold")}>🧊 Cutting board</button>
    </div>
    {side === "hot" ? <HotStreaksView sport={sport} soccerLeague={soccerLeague} onSoccerLeague={onSoccerLeague} /> : <CuttingBoardView sport={sport} soccerLeague={soccerLeague} onSoccerLeague={onSoccerLeague} />}
  </section>;
}

function NhlCuttingBoard() {
  const [category, setCategory] = useState("Coldest");
  const [selected, setSelected] = useState<{ player: NhlPlayer; team: TeamCode } | null>(null);
  const cold = useQuery({ queryKey: ["nhl-cold-streaks"], queryFn: () => api.getColdStreaks({ force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getColdStreaks({ force: true }), onSuccess: (data) => { void cold.refetch(); return data; } });
  const showTeams = category === "Teams";
  const players = [...(cold.data?.players ?? [])].sort((a, b) => {
    if (category === "Scoreless drought") return b.scorelessStreak - a.scorelessStreak || b.coldScore - a.coldScore;
    if (category === "Goal drought") return b.goallessStreak - a.goallessStreak || b.coldScore - a.coldScore;
    if (category === "Goalies") return (a.lastFiveSavePct ?? 2) - (b.lastFiveSavePct ?? 2);
    return b.coldScore - a.coldScore;
  }).filter((row) => category !== "Goalies" || row.lastFiveSavePct !== null);
  const teams = [...(cold.data?.teams ?? [])].sort((a, b) => b.losses - a.losses);
  return <section className="hot-section cutting-board"><div className="roster-title"><div><p className="kicker">THE CUTTING BOARD</p><h2>Who’s gone cold</h2><p className="roster-intro">Every slump is calculated from official recent NHL boxscores. Tap a player for the full stat file.</p></div>{cold.data && <div className="roster-update"><span>Updated {dateTime(cold.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh board"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Coldest","Scoreless drought","Goal drought","Goalies","Teams"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{cold.isPending ? <div className="loading"><span />Reading recent NHL boxscores…</div> : cold.isError ? <div className="error-state"><h2>Cutting board unavailable.</h2><p>The official boxscore feed did not answer.</p><button onClick={() => cold.refetch()}>Retry</button></div> : showTeams ? (teams.length === 0 ? <div className="history-empty"><strong>No team on a 3+ game slide right now.</strong><span>Every team has won at least one of its last three.</span></div> : <div className="hot-list">{teams.map((row, index) => <div className="hot-row-wrap" key={row.team}><div className="hot-row"><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {row.gamesPlayed} GP</small></span><span className="streak-badges cold"><b>{row.streak} skid</b></span></div><TeamWatchStar sport="nhl" team={row.team} name={row.name} /></div>)}</div>) : players.length === 0 ? <div className="history-empty"><strong>No qualifying slumps in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying cold signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <div className="hot-row-wrap" key={row.playerId}><button className="hot-row" onClick={() => setSelected({ player: hotPlayerRef(row), team: row.team })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {row.position}</small></span><span className="streak-badges cold">{row.scorelessStreak >= 3 && row.position !== "G" && <b>{row.scorelessStreak}G scoreless</b>}{row.goallessStreak >= 4 && row.position !== "G" && <b>{row.goallessStreak}G goalless</b>}{row.lastFiveSavePct !== null && <b>{(row.lastFiveSavePct * 100).toFixed(1)} SV%</b>}</span><span className="hot-totals"><b>{row.lastFivePoints} PTS</b><small>{row.lastFiveGoals} G · last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`${game.date} vs ${game.opponent}`}>{row.position === "G" ? `${game.saves ?? "—"} SV` : `${game.goals}G ${game.assists}A`}</i>)}</span></button><PlayerWatchStar sport="nhl" playerId={row.playerId} team={row.team} name={row.name} position={row.position} /></div>)}</div>}{cold.data && <div className="source-box"><span>Source</span><a href={cold.data.sourceUrl} target="_blank" rel="noreferrer">NHL official boxscores ↗</a><small>{gameDate(cold.data.windowStart)}–{gameDate(cold.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <PlayerStatsSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)}/>}</section>;
}

function percentage(value: number | null): string { return value === null ? "—" : `${Math.round(value * 100)}%`; }

function MatchupView({ sport, soccerLeague, onSoccerLeague }: { sport: Sport; soccerLeague?: SoccerLeague; onSoccerLeague?: (l: SoccerLeague) => void }) {
  if (sport === "nfl") return <NflMatchupCalculator />;
  if (sport === "nba") return <NbaMatchupCalculator />;
  if (sport === "soccer") return <SoccerMatchupCalculator league={soccerLeague ?? "mls"} onLeagueChange={onSoccerLeague} />;
  return <MatchupCalculator />;
}

function ModelVsBooks({ sport, awayCode, homeCode, awayModel, homeModel, groups }: {
  sport: Sport;
  awayCode: string;
  homeCode: string;
  awayModel: number | null;
  homeModel: number | null;
  groups: MarketGroup[];
}) {
  const roster = sport === "nfl" ? nflTeams : sport === "nba" ? nbaTeams : teams;
  const awayName = roster.find((t) => t.code === awayCode)?.name ?? awayCode;
  const homeName = roster.find((t) => t.code === homeCode)?.name ?? homeCode;
  const mlGroups = groups.filter((g) => g.marketName.toLowerCase().includes("moneyline"));
  const groupFor = (name: string) => mlGroups.find((g) =>
    g.entity.toLowerCase() === name.toLowerCase() ||
    g.sides.some((side) => side.side.toLowerCase() === name.toLowerCase()));
  const bestOdds = (name: string) => {
    const group = groupFor(name);
    if (!group) return null;
    const side = group.sides.find((s) => s.side.toLowerCase() === name.toLowerCase()) ?? strongestSide(group);
    return side?.best.odds ?? null;
  };
  const awayImplied = impliedProbability(bestOdds(awayName));
  const homeImplied = impliedProbability(bestOdds(homeName));
  if (awayModel === null || homeModel === null || awayImplied === null || homeImplied === null || awayImplied + homeImplied <= 0) return null;
  // Strip the vig so books and model are on the same scale.
  const awayBook = awayImplied / (awayImplied + homeImplied);
  const homeBook = homeImplied / (awayImplied + homeImplied);
  const modelWinner = awayModel >= homeModel ? awayCode : homeCode;
  const bookFave = awayBook >= homeBook ? awayCode : homeCode;
  const isFlip = modelWinner !== bookFave;
  const isCoinToss = Math.abs(awayModel - 0.5) < 0.03;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return <section className="model-vs-books" aria-label="Model versus sportsbook comparison">
    <div className="section-heading"><div><p className="kicker">MODEL VS BOOKS</p><h3>Does it flip?</h3></div>
    <span>{isFlip ? "⚡ Flip alert" : isCoinToss ? "🪙 Coin toss" : "✓ Aligned"}</span></div>
    <div className="mvb-rows">
      <div className="mvb-row"><span>Model</span><div className="winner-track"><i style={{ width: `${awayModel * 100}%` }} /><b style={{ width: `${homeModel * 100}%` }} /></div><span>{awayCode} <b>{pct(awayModel)}</b> · {homeCode} <b>{pct(homeModel)}</b></span></div>
      <div className="mvb-row"><span>Books</span><div className="winner-track books"><i style={{ width: `${awayBook * 100}%` }} /><b style={{ width: `${homeBook * 100}%` }} /></div><span>{awayCode} <b>{pct(awayBook)}</b> · {homeCode} <b>{pct(homeBook)}</b></span></div>
    </div>
    <p className="mvb-note">
      {isFlip
        ? `The model flips the books: it likes ${modelWinner} while the books favor ${bookFave}.`
        : isCoinToss
          ? "Too close to call — the model sees this as a coin toss."
          : `Both agree on ${modelWinner}.`}
      {" "}Book percentages are vig-stripped from the best available moneyline; the model is a statistical estimate, not a pick.
    </p>
  </section>;
}

type LikelyScorers = ApiResponse<typeof api, "getLikelyScorers">;
type LikelyScorer = LikelyScorers["teams"][string][number];

function marketTeamCodes(sport: Sport, market: MarketGroup, nhlStandings: NhlOverview["standings"] | null, nflStandings: NflOverview["standings"] | null, nbaStandings: NbaOverview["standings"] | null): [string, string] | null {
  const standings = sport === "nba" ? nbaStandings : sport === "nfl" ? nflStandings : nhlStandings;
  if (!standings || standings.length === 0) return null;
  const sideNames = market.sides.map((side) => side.side).filter(Boolean);
  const matchupParts = market.matchup.split("@").map((part) => part.trim()).filter(Boolean);
  const candidates = sideNames.length >= 2 ? sideNames : matchupParts.length >= 2 ? matchupParts : [market.entity];
  const matchCode = (label: string): string | null => {
    const needle = label.toLowerCase();
    const row = standings.find((item) => {
      const name = (item.name ?? "").toLowerCase();
      const abbrev = (item.team ?? "").toLowerCase();
      return name !== "" && (needle === name || needle === abbrev || needle.includes(name) || name.includes(needle));
    });
    return row?.team ?? null;
  };
  const awayLabel = candidates[0];
  const homeLabel = candidates[candidates.length - 1];
  const away = awayLabel ? matchCode(awayLabel) : null;
  const home = homeLabel ? matchCode(homeLabel) : null;
  return away && home ? [away, home] : null;
}

function topGameScorers(scorers: LikelyScorers, awayCode: string, homeCode: string): LikelyScorer[] {
  return [...(scorers.teams[awayCode] ?? []), ...(scorers.teams[homeCode] ?? [])]
    .sort((a, b) => b.rate - a.rate || b.stat - a.stat || a.name.localeCompare(b.name))
    .slice(0, 2);
}

function LikelyScorersStrip({ sport, market, nhlStandings, nflStandings, nbaStandings, scorers }: {
  sport: Sport;
  market: MarketGroup;
  nhlStandings: NhlOverview["standings"] | null;
  nflStandings: NflOverview["standings"] | null;
  nbaStandings: NbaOverview["standings"] | null;
  scorers: LikelyScorers | null;
}) {
  const codes = marketTeamCodes(sport, market, nhlStandings, nflStandings, nbaStandings);
  if (!codes || !scorers) return null;
  const top = topGameScorers(scorers, codes[0], codes[1]);
  if (top.length === 0) return null;
  const unit = sport === "nhl" ? "G" : sport === "nfl" ? "TD" : "PTS";
  const thing = sport === "nhl" ? "goals" : sport === "nfl" ? "touchdowns" : "points";
  return <div className="scorer-strip">
    <div className="scorer-head"><span>🎯 {sport === "nfl" ? "Likely TD scorers" : "Likely scorers"}</span><em>season leaders</em></div>
    <div className="scorer-names">{top.map((player) => <span key={`${player.team}-${player.name}`}><b>{player.name}</b><i>{player.team} · {player.stat}{unit}</i></span>)}</div>
    <small className="scorer-note">Most {thing} per game this season — a stat, not a sportsbook line.</small>
  </div>;
}

async function fetchMatchupRoster(sport: Sport, team: string, league: SoccerLeague | undefined): Promise<{ players: { id: number; name: string }[] }> {
  if (sport === "nhl") return api.getNhlRoster({ team: team as TeamCode });
  if (sport === "nfl") return api.getNflRoster({ team: team as NflTeamCode });
  if (sport === "nba") return api.getNbaRoster({ team: team as NbaTeamCode });
  return api.getSoccerRoster({ league: league ?? "mls", team });
}

function MatchupScorersSection({ sport, awayCode, homeCode, league }: {
  sport: Sport;
  awayCode: string;
  homeCode: string;
  league?: SoccerLeague;
}) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const data = useQuery({
    queryKey: ["matchup-scorers", sport, league ?? "na", awayCode, homeCode],
    queryFn: () => api.getMatchupScorers({ sport, away: awayCode, home: homeCode, league }),
    staleTime: 6 * 60 * 60 * 1000, retry: 1,
  });
  const awayRoster = useQuery({
    queryKey: ["ms-roster", sport, league ?? "na", awayCode],
    queryFn: () => fetchMatchupRoster(sport, awayCode, league),
    staleTime: 12 * 60 * 60 * 1000, retry: 1,
  });
  const homeRoster = useQuery({
    queryKey: ["ms-roster", sport, league ?? "na", homeCode],
    queryFn: () => fetchMatchupRoster(sport, homeCode, league),
    staleTime: 12 * 60 * 60 * 1000, retry: 1,
  });
  const [selected, setSelected] = useState<{ player: { id: number; name: string }; team: string } | null>(null);

  const resolve = (name: string, team: string) => {
    const roster = team === awayCode ? awayRoster.data : homeRoster.data;
    const players = roster?.players ?? [];
    const n = norm(name);
    return players.find((p) => norm(p.name) === n) ?? null;
  };

  const unit = sport === "nhl" ? "G" : sport === "nfl" ? "TD" : sport === "nba" ? "PTS" : "G";
  const sides = data.data ? [awayCode, homeCode] : [];
  return <section className="likely-scorers matchup-scorers" aria-label="Matchup-rated scorers">
    <div className="section-heading"><div><p className="kicker">MATCHUP RATING</p><h3>Who owns this matchup</h3></div><span>🎯</span></div>
    {data.isPending ? <div className="loading"><span />Rating the matchup…</div>
      : data.isError || !data.data ? <p className="mvb-note">Matchup ratings are unavailable right now.</p>
      : sides.map((teamCode) => {
        const players = data.data!.teams[teamCode] ?? [];
        if (players.length === 0) return null;
        const opp = teamCode === awayCode ? homeCode : awayCode;
        return <div key={teamCode} className="ms-team">
          <p className="ms-team-name">{teamCode}</p>
          <ol className="scorer-list">{players.map((p) => {
            const hit = resolve(p.name, teamCode);
            return <li key={`${teamCode}-${p.name}`}>
              <button type="button" className="scorer-row" disabled={!hit} onClick={() => hit && setSelected({ player: hit, team: teamCode })} aria-label={hit ? `Open ${p.name} full stat file` : p.name}>
                <span className="scorer-rating" aria-hidden="true"><b>{p.matchupRating}</b></span>
                <span className="scorer-player"><strong>{p.name}</strong>
                  <small>{p.seasonStat} {unit} · {p.seasonGames} GP · {p.seasonRate.toFixed(2)}/game</small>
                  <small className="ms-h2h">{p.h2hGames > 0 ? `${p.h2hStat} ${unit} in ${p.h2hGames} meeting${p.h2hGames === 1 ? "" : "s"} vs ${opp}` : `No meetings vs ${opp} yet this season`}</small>
                </span>
                <span className="scorer-open" aria-hidden="true">›</span>
              </button>
            </li>;
          })}</ol>
        </div>;
      })}
    {data.data && <p className="mvb-note">{data.data.blendNote}</p>}
    {selected && sport === "nhl" && <PlayerStatsSheet player={selected.player as NhlPlayer} team={selected.team as TeamCode} onClose={() => setSelected(null)} />}
    {selected && sport === "nfl" && <NflPlayerStatsSheet player={selected.player as NflPlayer} team={selected.team as NflTeamCode} onClose={() => setSelected(null)} />}
    {selected && sport === "nba" && <NbaPlayerSheet player={selected.player as NbaPlayer} team={selected.team as NbaTeamCode} onClose={() => setSelected(null)} />}
    {selected && sport === "soccer" && <SoccerPlayerSheet league={league ?? "mls"} player={selected.player as SoccerPlayer} team={selected.team} onClose={() => setSelected(null)} />}
  </section>;
}

function MatchupCalculator() {
  const [awayTeam, setAwayTeam] = useState<TeamCode>("WSH");
  const [homeTeam, setHomeTeam] = useState<TeamCode>("PIT");
  const [matchup, setMatchup] = useState<{ away: TeamCode; home: TeamCode }>({ away: "WSH", home: "PIT" });
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const board = useQuery({ queryKey: ["premium-board", "nhl"], queryFn: () => api.getPremiumBoard({ sport: "nhl" }), retry: false });
  const boardGroups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const result = useQuery({ queryKey: ["first-goal-matchup", matchup.away, matchup.home], queryFn: () => api.getFirstGoalMatchup({ awayTeam: matchup.away, homeTeam: matchup.home, force: false }), retry: 1 });
  const injuries = useKeyInjuries("nhl");
  const refresh = useMutation({ mutationFn: () => api.getFirstGoalMatchup({ awayTeam: matchup.away, homeTeam: matchup.home, force: true }), onSuccess: () => result.refetch() });
  const data: FirstGoalMatchup | undefined = result.data;
  const chooseGame = (away: string, home: string) => {
    if (!teams.some((team) => team.code === away) || !teams.some((team) => team.code === home)) return;
    const next = { away: away as TeamCode, home: home as TeamCode };
    setAwayTeam(next.away); setHomeTeam(next.home); setMatchup(next);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (awayTeam !== homeTeam) setMatchup({ away: awayTeam, home: homeTeam }); };
  const teamChart = data ? [
    { team: data.away.team, "Score first": Number(((data.away.scoredFirstPct ?? 0) * 100).toFixed(1)), "Allow first": Number(((data.away.allowedFirstPct ?? 0) * 100).toFixed(1)) },
    { team: data.home.team, "Score first": Number(((data.home.scoredFirstPct ?? 0) * 100).toFixed(1)), "Allow first": Number(((data.home.allowedFirstPct ?? 0) * 100).toFixed(1)) },
  ] : [];
  const modelChart = data ? [
    { metric: "1P under 2.5", probability: Number(((data.firstPeriodUnder25Probability ?? 0) * 100).toFixed(1)) },
    { metric: "Blowout", probability: Number(((data.blowoutProbability ?? 0) * 100).toFixed(1)) },
    { metric: "Both 2+", probability: Number(((data.bothTeamsTwoProbability ?? 0) * 100).toFixed(1)) },
    { metric: "Regulation draw", probability: Number(((data.regulationDrawProbability ?? 0) * 100).toFixed(1)) },
  ] : [];
  const todayGames = overview.data?.games.filter((game) => game.date === overview.data?.date) ?? [];
  return <section className="matchup-lab">
    <div className="matchup-heading"><div><p className="kicker">MATCHUP CALCULATOR</p><h1>Who takes it?</h1><p>Predict the winner, compare first-goal chances, and read first-period and full-game scripts from official recent results.</p></div>{data && <button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Recalculating…" : "Refresh data"}</button>}</div>
    {todayGames.length > 0 && <div className="slate-flips" aria-label="Today’s NHL matchups with model flip percentages">{todayGames.map((game) => <SlateFlipCard key={game.id} awayAbbrev={game.away.abbrev} homeAbbrev={game.home.abbrev} standings={overview.data?.standings ?? null} active={matchup.away === game.away.abbrev && matchup.home === game.home.abbrev} onPick={() => chooseGame(game.away.abbrev, game.home.abbrev)} />)}</div>}
    <form className="matchup-form" onSubmit={submit}>
      <label>Away team<select value={awayTeam} onChange={(event) => setAwayTeam(event.target.value as TeamCode)}>{teams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <span aria-hidden="true">@</span>
      <label>Home team<select value={homeTeam} onChange={(event) => setHomeTeam(event.target.value as TeamCode)}>{teams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <button className="primary" type="submit" disabled={awayTeam === homeTeam || result.isFetching}>{result.isFetching ? "Calculating…" : "Calculate matchup"}</button>
    </form>
    {awayTeam === homeTeam && <p className="calculator-note error" role="alert">Choose two different teams.</p>}
    {result.isPending ? <div className="loading calculator-loading"><span />Reading recent play-by-play…</div> : result.isError ? <div className="error-state calculator-error"><h2>Matchup data is unavailable.</h2><p>{result.error instanceof Error ? result.error.message : "The official NHL feed did not answer."}</p><button onClick={() => result.refetch()}>Retry</button></div> : data ? <>
      <section className="winner-card">
        <div className="section-heading"><div><p className="kicker">GAME WINNER</p><h2>{data.winnerTeam ? `${data.winnerTeam} to win` : "Insufficient sample"}</h2></div><span>{data.winnerTeam ? `${data.winnerTeam} +${data.winnerEdgePoints?.toFixed(1) ?? "0.0"} pts` : "No model edge"}</span></div>
        <div className="winner-score"><div><span>{data.away.team} · away</span><strong>{percentage(data.awayWinProbability)}</strong><small>{data.away.wins}/{data.away.games} recent wins</small></div><div className="winner-track" role="img" aria-label={`${data.away.team} ${percentage(data.awayWinProbability)} and ${data.home.team} ${percentage(data.homeWinProbability)} predicted win probability`}><i style={{ width: `${(data.awayWinProbability ?? .5) * 100}%` }}/><b style={{ width: `${(data.homeWinProbability ?? .5) * 100}%` }}/></div><div className="home"><span>{data.home.team} · home</span><strong>{percentage(data.homeWinProbability)}</strong><small>{data.home.wins}/{data.home.games} recent wins</small></div></div>
        <InjuryChips sport="nhl" awayCode={matchup.away} homeCode={matchup.home} injuries={injuries.data ?? null} />
        <p className="winner-explain">The winner model blends each club’s recent win rate with the opponent’s loss rate, weighting away and home splits when at least five matching games exist. Overtime and shootout winners count. This is a model estimate, not a sportsbook line.</p>
      </section>
      {data && <ModelVsBooks sport="nhl" awayCode={data.away.team} homeCode={data.home.team} awayModel={data.awayWinProbability} homeModel={data.homeWinProbability} groups={boardGroups} />}
      {data && <MatchupScorersSection sport="nhl" awayCode={data.away.team} homeCode={data.home.team} />}
      <section className="first-goal-card">
        <div className="section-heading"><div><p className="kicker">MODEL ESTIMATE</p><h2>First goal probability</h2></div><span>{data.edgeTeam ? `${data.edgeTeam} +${data.edgePoints?.toFixed(1) ?? "0.0"} pts` : "Insufficient sample"}</span></div>
        <div className="first-goal-score"><div><span>{data.away.team} · away</span><strong>{percentage(data.awayProbability)}</strong></div><div className="first-goal-track" role="img" aria-label={`${data.away.team} ${percentage(data.awayProbability)} and ${data.home.team} ${percentage(data.homeProbability)} to score first`}><i style={{ width: `${(data.awayProbability ?? .5) * 100}%` }}/><b style={{ width: `${(data.homeProbability ?? .5) * 100}%` }}/></div><div className="home"><span>{data.home.team} · home</span><strong>{percentage(data.homeProbability)}</strong></div></div>
        <p className="model-explain">Estimate blends each club’s recent score-first rate, venue split when at least five matching games exist, and how often the opponent allowed the first goal. It is a statistical model, not a sportsbook line.</p>
      </section>
      <section className="scenario-grid" aria-label="Matchup model estimates">
        <article><span>1st period under 2.5</span><strong>{percentage(data.firstPeriodUnder25Probability)}</strong><small>Two or fewer goals in the first period</small></article>
        <article><span>Blowout game</span><strong>{percentage(data.blowoutProbability)}</strong><small>Final margin of three or more goals</small></article>
        <article><span>Both teams 2+</span><strong>{percentage(data.bothTeamsTwoProbability)}</strong><small>Each club scores at least two goals</small></article>
        <article><span>Regulation draw</span><strong>{percentage(data.regulationDrawProbability)}</strong><small>Tied after 60 minutes and headed to overtime</small></article>
      </section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">GAME SCRIPT</p><h3>Matchup probabilities</h3></div><span>Model estimates</span></div><div className="scenario-chart" role="img" aria-label="Bar chart of first period under 2.5, blowout, both teams scoring at least two, and regulation draw probabilities"><ResponsiveContainer width="100%" height="100%"><BarChart data={modelChart} layout="vertical" margin={{ top: 4, right: 26, bottom: 4, left: 12 }}><CartesianGrid stroke="var(--rule)" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="metric" width={92} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`, "Model estimate"]}/><Bar dataKey="probability" fill="var(--orange)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">RECENT TENDENCY</p><h3>First-goal profile</h3></div><span>Last {Math.max(data.away.games, data.home.games)} games max</span></div><div className="team-tendency-chart" role="img" aria-label="Team scored first and allowed first percentages"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="team" axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`]}/><Legend/><Bar dataKey="Score first" fill="var(--green)" radius={[3,3,0,0]}/><Bar dataKey="Allow first" fill="var(--red)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
        <div className="team-sample-grid"><div><strong>{data.away.team}</strong><span>{data.away.scoredFirst}/{data.away.firstGoalGames} scored first</span><small>{data.away.venueGames} recent away games in venue split</small></div><div><strong>{data.home.team}</strong><span>{data.home.scoredFirst}/{data.home.firstGoalGames} scored first</span><small>{data.home.venueGames} recent home games in venue split</small></div></div>
      </section>
      <section className="head-to-head"><div><span>Recent head-to-head</span><strong>{data.headToHead.games ? `${data.away.team} ${data.headToHead.awayScoredFirst} · ${data.home.team} ${data.headToHead.homeScoredFirst}` : "No games in sample"}</strong></div><p>{data.sampleNote}</p></section>
      <div className="source-box"><span>Source</span><a href={data.sourceUrl} target="_blank" rel="noreferrer">NHL official play-by-play ↗</a><small>Calculated {dateTime(data.fetchedAt)} · cached 12 hours</small></div>
    </> : null}
  </section>;
}

function ProviderCard({ storageKey, providerLabel, statusQueryKey, getStatus, saveKey, removeKey, helpText, adminToken }: {
  storageKey: string;
  providerLabel: string;
  statusQueryKey: string;
  getStatus: () => Promise<{ configured: boolean; updatedAt: string | null }>;
  saveKey: (args: { key: string; adminToken?: string }) => Promise<unknown>;
  removeKey: (args: { adminToken?: string }) => Promise<unknown>;
  helpText: string;
  adminToken: string | null;
}) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: [statusQueryKey], queryFn: getStatus });
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useMutation({
    mutationFn: () => removeKey({ adminToken: adminToken ?? undefined }),
    onSuccess: async () => {
      setConfirmRemove(false);
      setMessage(`${providerLabel} key removed.`);
      await queryClient.invalidateQueries({ queryKey: [statusQueryKey] });
      queryClient.removeQueries({ queryKey: ["premium-board"] });
    },
  });

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const secret = key.trim();
    setKey("");
    setMessage(null);
    if (secret.length < 16) {
      setMessage(`Enter the complete ${providerLabel} API key.`);
      return;
    }
    setSaving(true);
    try {
      await saveKey({ key: secret, adminToken: adminToken ?? undefined });
      setMessage("Key verified and saved.");
      await queryClient.invalidateQueries({ queryKey: [statusQueryKey] });
      queryClient.removeQueries({ queryKey: ["premium-board"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The key could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const inputId = `${storageKey}-key`;
  const locked = !adminToken;
  return <div className="credential-card">
    <div className="credential-status" aria-live="polite">
      <span className={status.data?.configured ? "status-dot configured" : "status-dot"} />
      <div><small>{providerLabel.replace(/\s+/g, "").toUpperCase()}</small><strong>{status.isPending ? "Checking…" : status.data?.configured ? "Configured" : "Not configured"}</strong>{status.data?.updatedAt && <span>Updated {dateTime(status.data.updatedAt)}</span>}</div>
    </div>
    {locked ? <p className="settings-message">Provider keys are managed by the site owner — admin access is required to add, replace, or remove keys.</p> : <>
    <form onSubmit={handleSave}>
      <label htmlFor={inputId}>{status.data?.configured ? "Replace API key" : "API key"}</label>
      <div className="credential-entry"><input id={inputId} type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} placeholder="Paste key" aria-describedby={`${inputId}-help`}/><button className="primary" type="submit" disabled={saving || !key.trim()}>{saving ? "Verifying…" : status.data?.configured ? "Replace key" : "Save key"}</button></div>
      <small id={`${inputId}-help`}>{helpText}</small>
    </form>
    {message && <p className="settings-message" role="status">{message}</p>}
    {status.isError && <p className="settings-message error" role="alert">Could not read provider status. <button onClick={() => status.refetch()}>Retry</button></p>}
    {status.data?.configured && !confirmRemove && <button className="remove-key" onClick={() => setConfirmRemove(true)}>Remove key</button>}
    {status.data?.configured && confirmRemove && <div className="remove-confirm" role="group" aria-label="Confirm key removal"><p>Remove the saved key? Pro Odds will stop loading until another key is added.</p><div><button onClick={() => setConfirmRemove(false)} disabled={remove.isPending}>Cancel</button><button className="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending ? "Removing…" : "Remove key"}</button></div></div>}
    {remove.isError && <p className="settings-message error" role="alert">The key could not be removed. Try again.</p>}
    </>}
  </div>;
}

const ADMIN_SESSION_KEY = "dh-admin-token";

const BRIGHTNESS_KEY = "dh-brightness";
const SMOOTH_SCROLL_KEY = "dh-smooth-scroll";

function loadBrightness(): number {
  try { const v = Number(localStorage.getItem(BRIGHTNESS_KEY)); return Number.isFinite(v) && v >= 40 && v <= 100 ? v : 100; } catch { return 100; }
}
function applyBrightness(value: number) {
  try {
    document.documentElement.style.setProperty("--app-brightness", String(value / 100));
    document.documentElement.dataset.dimmed = value < 100 ? "true" : "false";
    localStorage.setItem(BRIGHTNESS_KEY, String(value));
  } catch { /* best-effort */ }
}
function loadSmoothScroll(): boolean {
  try { return localStorage.getItem(SMOOTH_SCROLL_KEY) !== "off"; } catch { return true; }
}
function applySmoothScroll(on: boolean) {
  try {
    document.documentElement.style.scrollBehavior = on ? "smooth" : "auto";
    localStorage.setItem(SMOOTH_SCROLL_KEY, on ? "on" : "off");
  } catch { /* best-effort */ }
}

function DisplaySettings() {
  const [brightness, setBrightness] = useState(loadBrightness);
  const [smooth, setSmooth] = useState(loadSmoothScroll);
  useEffect(() => { applyBrightness(brightness); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { applySmoothScroll(smooth); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onBrightness = (value: number) => { setBrightness(value); applyBrightness(value); };
  const onSmooth = (on: boolean) => { setSmooth(on); applySmoothScroll(on); };
  return <section className="settings-panel">
    <div className="settings-heading"><p className="kicker">DISPLAY</p><h1>Screen preferences</h1><p>Saved on this device only.</p></div>
    <div className="credential-card">
      <div className="display-row"><div><strong>Brightness</strong><small>Dim the whole app for night use.</small></div><span className="display-value">{brightness}%</span></div>
      <input type="range" min={40} max={100} step={5} value={brightness} onChange={(e) => onBrightness(Number(e.target.value))} className="display-slider" aria-label="App brightness" />
    </div>
    <div className="credential-card">
      <div className="display-row"><div><strong>Smooth scrolling</strong><small>Animate jumps between sections. Your phone controls swipe speed.</small></div>
      <button type="button" role="switch" aria-checked={smooth} className={"toggle-switch" + (smooth ? " on" : "")} onClick={() => onSmooth(!smooth)}><i /></button></div>
    </div>
  </section>;
}

function PlatesManager({ adminToken }: { adminToken: string }) {
  const plates = useQuery({ queryKey: ["jamon-mine", "manager"], queryFn: () => api.getMyPlates({ adminToken }), staleTime: 60 * 1000, retry: 1 });
  const [sport, setSport] = useState<Sport>("nhl");
  const [matchup, setMatchup] = useState("");
  const [play, setPlay] = useState("");
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [editing, setEditing] = useState<CodyPlate | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reset() {
    setSport("nhl"); setMatchup(""); setPlay(""); setNote(""); setIsPublic(true); setEditing(null);
  }
  function startEdit(plate: CodyPlate) {
    setEditing(plate); setSport(plate.sport as Sport); setMatchup(plate.matchup); setPlay(plate.pick); setNote(plate.note ?? ""); setIsPublic(plate.isPublic);
    setMessage(null);
  }
  const save = useMutation({
    // The server widens the plate sport enum as new sides land; cast for the
    // parallel soccer leg (fails gracefully server-side until then).
    mutationFn: () => api.savePlate({ adminToken, plate: { id: editing?.id, sport: sport as "nhl", matchup: matchup.trim(), pick: play.trim(), note: note.trim(), isPublic } }),
    onSuccess: () => { setMessage(editing ? "Plate updated." : "Plate added — it's live."); reset(); plates.refetch(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Could not save the plate."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePlate({ adminToken, id }),
    onSuccess: () => { setMessage("Plate removed."); if (editing) reset(); plates.refetch(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Could not delete the plate."),
  });
  const valid = matchup.trim().length > 0 && play.trim().length > 0;

  return <section className="credential-card plates-manager" aria-label="Jamón Ibérico plate manager">
    <div className="credential-status"><span className="status-dot configured" /><div><small>JAMÓN IBÉRICO</small><strong>My plates</strong><span>Unlimited — public plates show on the board, private plates are only visible to you.</span></div></div>
    <form onSubmit={(event) => { event.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
      <div className="plate-form-grid">
        <label>Sport<select value={sport} onChange={(event) => setSport(event.target.value as Sport)}><option value="nhl">NHL</option><option value="nfl">NFL</option><option value="nba">NBA</option><option value="soccer">Soccer</option></select></label>
        <label>Matchup<input value={matchup} onChange={(event) => setMatchup(event.target.value)} placeholder="WSH @ NYR" maxLength={120} /></label>
      </div>
      <label>The pick<input value={play} onChange={(event) => setPlay(event.target.value)} placeholder="Capitals ML" maxLength={120} /></label>
      <label>Note <small>(optional)</small><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why you like it…" maxLength={600} rows={2} /></label>
      <div className="plate-visibility">
        <button type="button" className={isPublic ? "active" : ""} onClick={() => setIsPublic(true)}>Public — everyone sees it</button>
        <button type="button" className={!isPublic ? "active private" : ""} onClick={() => setIsPublic(false)}>Private — just me</button>
      </div>
      <div className="plate-form-actions">
        <button className="primary" type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Plating…" : editing ? "Update plate" : "Add plate"}</button>
        {editing && <button type="button" className="slip-clear" onClick={reset}>Cancel</button>}
      </div>
    </form>
    {message && <p className="settings-message" role="status">{message}</p>}
    <div className="plate-list">
      {plates.isPending ? <p className="settings-message">Loading your plates…</p> : (plates.data?.plates ?? []).length === 0 ? <p className="settings-message">No plates yet — add your first one above.</p> :
        (plates.data?.plates ?? []).map((plate) => <div className="plate-row" key={plate.id}>
          <div><strong>{plate.pick}</strong><small>{plate.sport.toUpperCase()} · {plate.matchup}</small>{plate.note ? <span>{plate.note}</span> : null}</div>
          <em className={plate.isPublic ? "plate-badge public" : "plate-badge private"}>{plate.isPublic ? "Public" : "Private"}</em>
          <div className="plate-row-actions">
            <button type="button" onClick={() => startEdit(plate)}>Edit</button>
            <button type="button" className="danger" onClick={() => remove.mutate(plate.id)} disabled={remove.isPending}>Delete</button>
          </div>
        </div>)}
    </div>
  </section>;
}

// Private admin-only usage dashboard. Never rendered for visitors:
// it only mounts inside the admin-unlocked branch of OwnerConsole.
function UsagePanel({ adminToken }: { adminToken: string }) {
  const stats = useQuery({ queryKey: ["usage-stats"], queryFn: () => api.getUsageStats({ adminToken }), staleTime: 5 * 60 * 1000, retry: 1 });
  return <section className="credential-card usage-panel" aria-label="Private usage dashboard">
    <div className="credential-status"><span className="status-dot configured" /><div><small>PRIVATE · ADMIN ONLY</small><strong>Usage dashboard</strong><span>Visitor counts. Never shown to the public.</span></div></div>
    {stats.isPending ? <p className="settings-message">Loading usage…</p>
    : stats.isError || !stats.data ? <p className="settings-message" role="status">Usage tracking isn't available yet — the server update is still rolling out.</p>
    : <>
      <div className="usage-grid">
        <div className="usage-stat"><small>Today</small><strong>{stats.data.today.uniques.toLocaleString()}</strong><span>{stats.data.today.views.toLocaleString()} views</span></div>
        <div className="usage-stat"><small>Yesterday</small><strong>{stats.data.yesterday.uniques.toLocaleString()}</strong><span>{stats.data.yesterday.views.toLocaleString()} views</span></div>
      </div>
      <div className="usage-block"><p className="kicker">LAST 14 DAYS</p><div className="usage-table" role="table">
        <div className="usage-row header" role="row"><span>Date</span><span>Uniques</span><span>Views</span></div>
        {stats.data.last14.map((day) => <div className="usage-row" role="row" key={day.date}><span>{day.date}</span><span>{day.uniques.toLocaleString()}</span><span>{day.views.toLocaleString()}</span></div>)}
      </div></div>
      <div className="usage-block"><p className="kicker">VIEWS BY SPORT</p><div className="usage-table" role="table">
        <div className="usage-row header" role="row"><span>Sport</span><span>Views</span></div>
        {(Array.isArray(stats.data.bySport)
          ? stats.data.bySport.map((r) => ({ sport: r.sport, views: typeof r.views === "number" ? r.views : (r.views as { views?: number })?.views ?? 0 }))
          : Object.entries(stats.data.bySport).map(([sport, v]) => ({ sport, views: typeof v === "number" ? v : (v as { views?: number })?.views ?? 0 }))
        ).map((row) => <div className="usage-row" role="row" key={row.sport}><span>{row.sport.toUpperCase()}</span><span>{Number(row.views).toLocaleString()}</span></div>)}
      </div></div>
    </>}
  </section>;
}

function OwnerConsole() {
  const adminStatus = useQuery({ queryKey: ["admin-status"], queryFn: () => api.getAdminStatus({}), retry: false });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY); } catch { return null; }
  });
  const [draft, setDraft] = useState("");

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = draft.trim();
    setDraft("");
    if (!token) return;
    try { sessionStorage.setItem(ADMIN_SESSION_KEY, token); } catch { /* private mode: token lasts for this page view only */ }
    setAdminToken(token);
  }
  function lock() {
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* noop */ }
    setAdminToken(null);
  }

  const gateConfigured = adminStatus.data?.configured ?? false;
  return <div className="owner-console"><div className="owner-banner" role="banner">
    <div><p className="kicker">PRIVATE · SITE OWNER ONLY</p><h1>The Daily Ham — Owner Console</h1><p>Plates, provider keys and visitor stats. Nothing here is visible to the public.</p></div>
    <a className="owner-back" href="/">← Public app</a>
  </div><section className="settings-panel">
    <div className="settings-heading"><p className="kicker">PROVIDER SETTINGS</p><h1>Sportsbook connection</h1><p>Connect a sportsbook odds provider — SportsGameOdds or The Odds API — to power the complete NHL, NFL, NBA & soccer odds boards. Your keys are used only for hockey, football, basketball and soccer markets.</p></div>
    {adminStatus.isPending && <p className="settings-message">Checking admin access…</p>}
    {adminStatus.data && !gateConfigured && <div className="credential-card"><p className="settings-message" role="status"><strong>Admin access is not set up on this server yet. </strong><span>Add an <code>ADMIN_TOKEN</code> environment variable and redeploy — then only someone with that token can manage provider keys or trigger manual refreshes.</span></p></div>}
    {gateConfigured && !adminToken && <form className="credential-card" onSubmit={unlock}>
      <label htmlFor="admin-token">Site owner access</label>
      <div className="credential-entry"><input id="admin-token" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Enter admin token" /><button className="primary" type="submit" disabled={!draft.trim()}>Unlock</button></div>
      <small>Provider settings are locked for visitors. Unlock with the site's admin token to add, replace, or remove keys.</small>
    </form>}
    {gateConfigured && adminToken && <div className="credential-card"><div className="credential-status"><span className="status-dot configured" /><div><small>ADMIN</small><strong>Unlocked</strong><span>Key management is enabled for this session.</span></div></div><button className="remove-key" onClick={lock}>Lock settings</button></div>}
    {gateConfigured && adminToken && <>
      <ProviderCard storageKey="sportsgameodds" providerLabel="SportsGameOdds" statusQueryKey="sports-game-odds-key-status" getStatus={() => api.getSportsGameOddsKeyStatus({})} saveKey={(args) => api.saveSportsGameOddsKey(args)} removeKey={(args) => api.removeSportsGameOddsKey(args)} helpText="The field is cleared immediately after submission. The saved value is never displayed." adminToken={adminToken} />
      <ProviderCard storageKey="theoddsapi" providerLabel="The Odds API" statusQueryKey="odds-api-key-status" getStatus={() => api.getOddsApiKeyStatus({})} saveKey={(args) => api.saveOddsApiKey(args)} removeKey={(args) => api.removeOddsApiKey(args)} helpText="Free tier: 500 requests/month, no credit card — one board refresh costs a single request. Get a key at the-odds-api.com. The field is cleared immediately after submission." adminToken={adminToken} />
    </>}
    {gateConfigured && adminToken && <PlatesManager adminToken={adminToken} />}
    {gateConfigured && adminToken && <UsagePanel adminToken={adminToken} />}
  </section></div>;
}

function SiteSettings() {
  return <DisplaySettings />;
}

function InstallCard() {
  const [deferred, setDeferred] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const check = () => {
      try { setInstalled(window.matchMedia("(display-mode: standalone)").matches); } catch { /* best-effort */ }
    };
    check();
    const onPrompt = (event: Event) => { event.preventDefault(); setDeferred(event); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", check);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", check);
    };
  }, []);
  if (installed) return null;
  const install = async () => {
    if (deferred) {
      try { await (deferred as unknown as { prompt: () => Promise<void> }).prompt(); } catch { /* best-effort */ }
      setDeferred(null);
    } else {
      setShowHelp((v) => !v);
    }
  };
  return <section className="install-card" aria-label="Install the Daily Ham app">
    <img src="/icons/icon-192.png" alt="The Daily Ham app icon" />
    <div>
      <strong>Get The Daily Ham app</strong>
      <span>Install it on your phone for fullscreen, home-screen access — free, no app store needed.</span>
      {showHelp && <small className="install-help">Android: tap ⋮ → “Install app” or “Add to Home screen”. iPhone: tap Share → “Add to Home Screen”.</small>}
    </div>
    <button onClick={install}>{deferred ? "Install" : "How"}</button>
  </section>;
}

function WelcomeBanner({ sport, onTour }: { sport: Sport; onTour?: () => void }) {
  const [favs, setFavs] = useState<LeagueFavorites>(() => loadFavorites());
  useEffect(() => {
    const onChange = () => setFavs(loadFavorites());
    window.addEventListener("dh-team-change", onChange);
    return () => window.removeEventListener("dh-team-change", onChange);
  }, []);
  const code = favs[sport];
  const team = code ? themeFor(sport, code) : null;
  return <section className={"welcome-sign" + (team ? " team" : "")} style={team ? ({ "--team-color": team.color, "--team-secondary": team.secondary } as CSSProperties) : undefined}>
    <img src={logo} alt="The Daily Ham ham chef logo" />
    <div>
      <p className="welcome-kicker">{team ? <>Welcome, {team.name} fan <b className="welcome-team-badge">{team.code}</b></> : "Welcome to the Daily Ham"}</p>
      <strong>Fresh Cuts Daily</strong>
      <span>{team ? "Tonight's board, dressed in your team's colors." : "Every NHL, NFL, NBA & soccer market, official league data, model projections and sharp price comparison."}</span>
      <div className="welcome-actions">
        <TeamThemePicker sport={sport}/>
        {onTour && <button type="button" className="tour-cta" onClick={onTour}>Take the tour — learn the app</button>}
      </div>
    </div>
  </section>;
}

function PlayerWatchStar({ sport, playerId, team, name, position }: { sport: League; playerId: number; team: string; name: string; position: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener("dh-watchlist-change", onChange);
    return () => window.removeEventListener("dh-watchlist-change", onChange);
  }, []);
  const starred = isWatchedPlayer(sport, playerId);
  return <button type="button" className={"watch-star" + (starred ? " active" : "")} onClick={() => toggleWatch({ kind: "player", sport, playerId, team, name, position })} aria-label={starred ? `Remove ${name} from watchlist` : `Watch ${name}`} aria-pressed={starred}>★</button>;
}

function TeamWatchStar({ sport, team, name }: { sport: League; team: string; name: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener("dh-watchlist-change", onChange);
    return () => window.removeEventListener("dh-watchlist-change", onChange);
  }, []);
  const starred = isWatchedTeam(sport, team);
  return <button type="button" className={"watch-star" + (starred ? " active" : "")} onClick={() => toggleWatch({ kind: "team", sport, team, name })} aria-label={starred ? `Remove ${name} from watchlist` : `Watch ${name}`} aria-pressed={starred}>★</button>;
}

function InstallPrompt() {
  const [deferred, setDeferred] = useState<Event | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return;
    } catch { /* best-effort */ }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (!deferred || dismissed) return null;
  const install = async () => {
    try {
      await (deferred as unknown as { prompt: () => Promise<void> }).prompt();
    } catch { /* best-effort */ }
    setDeferred(null);
  };
  return <div className="install-banner" role="dialog" aria-label="Install the Daily Ham app">
    <div><strong>Get The Daily Ham app</strong><small>Install it on your home screen for fullscreen, offline-ready access.</small></div>
    <button onClick={install}>Install</button>
    <button type="button" className="install-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss install prompt">×</button>
  </div>;
}

function ToastHost() {  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail !== "string" || !detail) return;
      setMessage(detail);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMessage(null), 2200);
    };
    window.addEventListener("dh-toast", onToast);
    return () => {
      window.removeEventListener("dh-toast", onToast);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);
  return <div className={"dh-toast" + (message ? " show" : "")} role="status" aria-live="polite">{message ?? ""}</div>;
}

function TeamThemePicker({ sport }: { sport: Sport }) {
  const [open, setOpen] = useState(false);
  const [favs, setFavs] = useState<LeagueFavorites>(() => loadFavorites());
  const [pickerSoccerLeague, setPickerSoccerLeague] = useState<SoccerLeague>("mls");
  useEffect(() => {
    const onChange = () => setFavs(loadFavorites());
    window.addEventListener("dh-team-change", onChange);
    return () => window.removeEventListener("dh-team-change", onChange);
  }, []);
  const code = favs[sport];
  const current = code ? themeFor(sport, code) : null;

  function pick(league: League, pickCode: string | null) {
    saveFavorite(league, pickCode);
    setFavs(loadFavorites());
    setOpen(false);
  }

  return <>
    <button type="button" className="team-picker-btn" onClick={() => setOpen(true)} aria-label={current ? `Favorite ${sport.toUpperCase()} team: ${current.name}. Change favorite teams.` : "Pick your favorite teams"}>
      <span className="team-picker-dot" style={current ? { background: current.color } : undefined} aria-hidden="true" />
      <span>{current ? current.code : "My team"}</span>
    </button>
    {open && <div className="team-modal-backdrop" onClick={() => setOpen(false)}>
      <div className="team-modal" role="dialog" aria-modal="true" aria-label="Pick your favorite teams" onClick={(e) => e.stopPropagation()}>
        <div className="team-modal-head"><h3>Your team, your colors</h3><button type="button" className="team-modal-close" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
        <p>Pick your favorite {sport === "nhl" ? "NHL" : sport === "nfl" ? "NFL" : sport === "nba" ? "NBA" : "soccer"} club — this side of the site dresses in its colors. Switch to another side to pick a team there. Saved on this device.</p>
        <div>
          <p className="team-league-label">{sport === "nhl" ? "NHL" : sport === "nfl" ? "NFL" : sport === "nba" ? "NBA" : "SOCCER"}</p>
          {sport === "soccer" && <div className="metric-tabs" role="tablist" aria-label="Soccer league">{SOCCER_LEAGUES.map((l) => <button key={l.code} type="button" role="tab" aria-selected={pickerSoccerLeague === l.code} className={pickerSoccerLeague === l.code ? "active" : ""} onClick={() => setPickerSoccerLeague(l.code)}>{l.name}</button>)}</div>}
          <div className="team-grid">
            {(sport === "soccer" ? (pickerSoccerLeague === "epl" ? EPL_TEAM_THEMES : MLS_TEAM_THEMES) : LEAGUE_THEMES[sport]).map((t) => <button key={`${sport}-${t.code}`} type="button" className={"team-cell" + (favs[sport] === t.code ? " sel" : "")} onClick={() => pick(sport, t.code)} aria-pressed={favs[sport] === t.code}>
              <span className="team-swatch" style={{ background: `linear-gradient(135deg, ${t.color} 50%, ${t.secondary} 50%)` }} aria-hidden="true" />
              <b>{t.code}</b><small>{t.name}</small>
            </button>)}
          </div>
        </div>
        {favs[sport] && <button type="button" className="team-clear" onClick={() => { saveFavorite(sport, null); setFavs(loadFavorites()); }}>Reset to The Daily Ham colors</button>}
      </div>
    </div>}
  </>;
}

// ---------------------------------------------------------------------------
// NFL views. Mirror the NHL sections: schedule strip, league, matchup
// calculator, rosters + player files, hot streaks — all on ESPN keyless
// feeds, with the same Deep-Dive stat-file treatment as hockey.
// ---------------------------------------------------------------------------

function nflGameDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)); }

function NflScheduleStrip({ compact = false }: { compact?: boolean }) {
  const [week, setWeek] = useState<number | undefined>(undefined);
  const overview = useQuery({ queryKey: ["nfl-overview", week ?? "current"], queryFn: () => api.getNflOverview(week ? { week } : {}), staleTime: 15 * 60 * 1000, retry: 1 });
  const injuries = useKeyInjuries("nfl");
  if (overview.isPending) return <div className="slate-loading">Loading the official NFL slate…</div>;
  if (overview.isError || !overview.data) return <div className="inline-error slate-error"><strong>NFL schedule unavailable.</strong><button onClick={() => overview.refetch()}>Retry</button></div>;
  const data = overview.data;
  const live = data.games.filter((g) => g.state === "live");
  const games = compact ? [...live, ...data.games.filter((g) => g.state !== "live")].slice(0, 6) : data.games;
  const stateLabel = (g: NflOverview["games"][number]) => g.state === "final" ? "Final" : g.state === "live" ? g.detail || "Live" : dateTime(g.startsAt);
  return <section className="slate-section">
    <div className="section-heading"><div><p className="kicker">OFFICIAL NFL SCHEDULE</p><h3>{compact ? "This week on the gridiron" : `Week ${data.week} scores & schedule`}</h3></div><span>Updated {dateTime(data.fetchedAt)}</span></div>
    {!compact && <div className="metric-tabs week-tabs" aria-label="Select week">{data.weeks.map((w) => <button key={w} className={(week ?? data.week) === w ? "active" : ""} onClick={() => setWeek(w)}>{w}</button>)}</div>}
    {games.length ? <div className="slate-grid">{games.map((game) => <article className="game-tile" key={game.id}>
      <div className="game-time"><span>Week {game.week} · {nflGameDate(game.date)}</span><b>{stateLabel(game)}</b></div>
      <div className="score-team"><strong>{game.away.name}</strong><TeamWatchStar sport="nfl" team={game.away.abbrev} name={game.away.name} /><b>{game.away.score ?? "—"}</b></div>
      <div className="score-team"><strong>{game.home.name}</strong><TeamWatchStar sport="nfl" team={game.home.abbrev} name={game.home.name} /><b>{game.home.score ?? "—"}</b></div><InjuryChips sport="nfl" awayCode={game.away.abbrev} homeCode={game.home.abbrev} injuries={injuries.data ?? null} />
    </article>)}</div> : <div className="history-empty"><strong>No games posted for this week yet.</strong><span>Check another week.</span></div>}
    <div className="source-box"><span>Source</span><a href={data.scheduleSourceUrl} target="_blank" rel="noreferrer">ESPN NFL scoreboard ↗</a><small>2026 regular season · keyless feed</small></div>
  </section>;
}

function NflLeagueView() {
  const overview = useQuery({ queryKey: ["nfl-overview", "current"], queryFn: () => api.getNflOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const [conference, setConference] = useState("All");
  if (overview.isPending) return <div className="loading"><span />Loading NFL schedule and standings…</div>;
  if (overview.isError || !overview.data) return <div className="error-state"><h2>League center is between downs.</h2><p>The ESPN feed did not answer.</p><button onClick={() => overview.refetch()}>Retry</button></div>;
  const standings = overview.data.standings.filter((row) => conference === "All" || row.conference === conference);
  return <><NflScheduleStrip/><section className="standings-section">
    <div className="section-heading"><div><p className="kicker">LEAGUE TABLE</p><h3>2026 standings</h3></div><span>{overview.data.standings.length} clubs</span></div>
    <div className="metric-tabs"><button className={conference === "All" ? "active" : ""} onClick={() => setConference("All")}>All</button>{["AFC", "NFC"].map((name) => <button key={name} className={conference === name ? "active" : ""} onClick={() => setConference(name)}>{name}</button>)}</div>
    <div className="standings-scroll"><div className="standings-table" role="table">
      <div className="standings-row header" role="row"><span>Team</span><span>W</span><span>L</span><span>T</span><span>PF</span><span>PA</span><span>DIFF</span></div>
      {standings.map((row, index) => <div className="standings-row" role="row" key={row.team}><span><b>{index + 1}</b><strong>{row.name}</strong><small>{row.division}</small><span className="standings-star"><TeamWatchStar sport="nfl" team={row.team} name={row.name} /></span></span><span><b>{row.wins}</b></span><span>{row.losses}</span><span>{row.ties}</span><span>{row.pointsFor}</span><span>{row.pointsAgainst}</span><span className={row.pointsFor - row.pointsAgainst > 0 ? "positive" : ""}>{row.pointsFor - row.pointsAgainst > 0 ? "+" : ""}{row.pointsFor - row.pointsAgainst}</span></div>)}
    </div></div>
    <div className="source-box"><span>Source</span><a href={overview.data.standingsSourceUrl} target="_blank" rel="noreferrer">ESPN NFL standings ↗</a><small>Point differential is computed from the listed official totals.</small></div>
  </section></>;
}

function NflMatchupCalculator() {
  const [awayTeam, setAwayTeam] = useState<NflTeamCode>("KC");
  const [homeTeam, setHomeTeam] = useState<NflTeamCode>("BUF");
  const [matchup, setMatchup] = useState<{ away: NflTeamCode; home: NflTeamCode }>({ away: "KC", home: "BUF" });
  const overview = useQuery({ queryKey: ["nfl-overview", "current"], queryFn: () => api.getNflOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const board = useQuery({ queryKey: ["premium-board", "nfl"], queryFn: () => api.getPremiumBoard({ sport: "nfl" }), retry: false });
  const boardGroups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const result = useQuery({ queryKey: ["nfl-matchup", matchup.away, matchup.home], queryFn: () => api.getNflMatchup({ awayTeam: matchup.away, homeTeam: matchup.home, force: false }), retry: 1 });
  const injuries = useKeyInjuries("nfl");
  const refresh = useMutation({ mutationFn: () => api.getNflMatchup({ awayTeam: matchup.away, homeTeam: matchup.home, force: true }), onSuccess: () => result.refetch() });
  const data: NflMatchup | undefined = result.data;
  const chooseGame = (away: string, home: string) => {
    if (!nflTeams.some((t) => t.code === away) || !nflTeams.some((t) => t.code === home)) return;
    const next = { away: away as NflTeamCode, home: home as NflTeamCode };
    setAwayTeam(next.away); setHomeTeam(next.home); setMatchup(next);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (awayTeam !== homeTeam) setMatchup({ away: awayTeam, home: homeTeam }); };
  const modelChart = data ? [
    { metric: "1H under 24.5", probability: Number(((data.firstHalfUnder245Probability ?? 0) * 100).toFixed(1)) },
    { metric: "Blowout 14+", probability: Number(((data.blowoutProbability ?? 0) * 100).toFixed(1)) },
    { metric: "Both 20+", probability: Number(((data.bothTeams20Probability ?? 0) * 100).toFixed(1)) },
    { metric: "Overtime", probability: Number(((data.overtimeProbability ?? 0) * 100).toFixed(1)) },
  ] : [];
  const teamChart = data ? [
    { team: data.away.team, "Score first": Number(((data.away.firstScorePct ?? 0) * 100).toFixed(1)), "Allow first": Number((((data.away.firstScoreGames - data.away.firstScore) / Math.max(1, data.away.firstScoreGames)) * 100).toFixed(1)) },
    { team: data.home.team, "Score first": Number(((data.home.firstScorePct ?? 0) * 100).toFixed(1)), "Allow first": Number((((data.home.firstScoreGames - data.home.firstScore) / Math.max(1, data.home.firstScoreGames)) * 100).toFixed(1)) },
  ] : [];
  const weekGames = overview.data?.games.filter((g) => g.state !== "final") ?? [];
  return <section className="matchup-lab">
    <div className="matchup-heading"><div><p className="kicker">MATCHUP CALCULATOR</p><h1>Who takes it?</h1><p>Predict the winner, compare first-score chances, and read first-half and full-game scripts from official recent results.</p></div>{data && <button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Recalculating…" : "Refresh data"}</button>}</div>
    {weekGames.length > 0 && <div className="slate-flips" aria-label="This week's NFL matchups with model flip percentages">{weekGames.slice(0, 12).map((game) => <SlateFlipCard key={game.id} awayAbbrev={game.away.abbrev} homeAbbrev={game.home.abbrev} standings={overview.data?.standings ?? null} active={matchup.away === game.away.abbrev && matchup.home === game.home.abbrev} onPick={() => chooseGame(game.away.abbrev, game.home.abbrev)} />)}</div>}
    <form className="matchup-form" onSubmit={submit}>
      <label>Away team<select value={awayTeam} onChange={(event) => setAwayTeam(event.target.value as NflTeamCode)}>{nflTeams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <span aria-hidden="true">@</span>
      <label>Home team<select value={homeTeam} onChange={(event) => setHomeTeam(event.target.value as NflTeamCode)}>{nflTeams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <button className="primary" type="submit" disabled={awayTeam === homeTeam || result.isFetching}>{result.isFetching ? "Calculating…" : "Calculate matchup"}</button>
    </form>
    {awayTeam === homeTeam && <p className="calculator-note error" role="alert">Choose two different teams.</p>}
    {result.isPending ? <div className="loading calculator-loading"><span />Reading recent game data…</div> : result.isError ? <div className="error-state calculator-error"><h2>Matchup data is unavailable.</h2><p>{result.error instanceof Error ? result.error.message : "The ESPN feed did not answer."}</p><button onClick={() => result.refetch()}>Retry</button></div> : data ? <>
      <section className="winner-card">
        <div className="section-heading"><div><p className="kicker">GAME WINNER</p><h2>{data.winnerTeam ? `${data.winnerTeam} to win` : "Insufficient sample"}</h2></div><span>{data.winnerTeam ? `${data.winnerTeam} +${data.winnerEdgePoints?.toFixed(1) ?? "0.0"} pts` : "No model edge"}</span></div>
        <div className="winner-score"><div><span>{data.away.team} · away</span><strong>{percentage(data.awayWinProbability)}</strong><small>{data.away.wins}/{data.away.games} recent wins</small></div><div className="winner-track" role="img" aria-label={`${data.away.team} ${percentage(data.awayWinProbability)} and ${data.home.team} ${percentage(data.homeWinProbability)} predicted win probability`}><i style={{ width: `${(data.awayWinProbability ?? .5) * 100}%` }}/><b style={{ width: `${(data.homeWinProbability ?? .5) * 100}%` }}/></div><div className="home"><span>{data.home.team} · home</span><strong>{percentage(data.homeWinProbability)}</strong><small>{data.home.wins}/{data.home.games} recent wins</small></div></div>
        <InjuryChips sport="nfl" awayCode={matchup.away} homeCode={matchup.home} injuries={injuries.data ?? null} />
        <p className="winner-explain">The winner model blends each club's recent win rate with the opponent's loss rate, weighting away and home splits when at least three matching games exist. This is a model estimate, not a sportsbook line.</p>
      </section>
      {data && <ModelVsBooks sport="nfl" awayCode={data.away.team} homeCode={data.home.team} awayModel={data.awayWinProbability} homeModel={data.homeWinProbability} groups={boardGroups} />}
      {data && <MatchupScorersSection sport="nfl" awayCode={data.away.team} homeCode={data.home.team} />}
      <section className="first-goal-card">
        <div className="section-heading"><div><p className="kicker">MODEL ESTIMATE</p><h2>First score probability</h2></div><span>{data.firstScoreEdgeTeam ? `${data.firstScoreEdgeTeam} +${data.firstScoreEdgePoints?.toFixed(1) ?? "0.0"} pts` : "Insufficient sample"}</span></div>
        <div className="first-goal-score"><div><span>{data.away.team} · away</span><strong>{percentage(data.firstScoreAwayProbability)}</strong></div><div className="first-goal-track" role="img" aria-label={`${data.away.team} ${percentage(data.firstScoreAwayProbability)} and ${data.home.team} ${percentage(data.firstScoreHomeProbability)} to score first`}><i style={{ width: `${(data.firstScoreAwayProbability ?? .5) * 100}%` }}/><b style={{ width: `${(data.firstScoreHomeProbability ?? .5) * 100}%` }}/></div><div className="home"><span>{data.home.team} · home</span><strong>{percentage(data.firstScoreHomeProbability)}</strong></div></div>
        <p className="model-explain">Estimate blends each club's recent first-score rate, venue split when at least three matching games exist, and how often the opponent allowed the opening score. It is a statistical model, not a sportsbook line.</p>
      </section>
      <section className="scenario-grid" aria-label="Matchup model estimates">
        <article><span>1st half under 24.5</span><strong>{percentage(data.firstHalfUnder245Probability)}</strong><small>24 or fewer first-half points</small></article>
        <article><span>Blowout game</span><strong>{percentage(data.blowoutProbability)}</strong><small>Final margin of 14 or more</small></article>
        <article><span>Both teams 20+</span><strong>{percentage(data.bothTeams20Probability)}</strong><small>Each club scores at least 20</small></article>
        <article><span>Overtime</span><strong>{percentage(data.overtimeProbability)}</strong><small>Game goes beyond regulation</small></article>
      </section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">GAME SCRIPT</p><h3>Matchup probabilities</h3></div><span>Model estimates</span></div><div className="scenario-chart" role="img" aria-label="Bar chart of first half under 24.5, blowout, both teams 20 plus, and overtime probabilities"><ResponsiveContainer width="100%" height="100%"><BarChart data={modelChart} layout="vertical" margin={{ top: 4, right: 26, bottom: 4, left: 12 }}><CartesianGrid stroke="var(--rule)" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="metric" width={92} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`, "Model estimate"]}/><Bar dataKey="probability" fill="var(--orange)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">RECENT TENDENCY</p><h3>First-score profile</h3></div><span>Last {Math.max(data.away.games, data.home.games)} games max</span></div><div className="team-tendency-chart" role="img" aria-label="Team scored first and allowed first percentages"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="team" axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`]}/><Legend/><Bar dataKey="Score first" fill="var(--green)" radius={[3,3,0,0]}/><Bar dataKey="Allow first" fill="var(--red)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
        <div className="team-sample-grid"><div><strong>{data.away.team}</strong><span>{data.away.firstScore}/{data.away.firstScoreGames} scored first</span><small>{data.away.venueGames} recent away games in venue split</small></div><div><strong>{data.home.team}</strong><span>{data.home.firstScore}/{data.home.firstScoreGames} scored first</span><small>{data.home.venueGames} recent home games in venue split</small></div></div>
      </section>
      <section className="head-to-head"><div><span>Recent head-to-head</span><strong>{data.headToHead.games ? `${data.away.team} ${data.headToHead.awayWins} · ${data.home.team} ${data.headToHead.homeWins}` : "No games in sample"}</strong></div><p>{data.sampleNote}</p></section>
      <div className="source-box"><span>Source</span><a href={data.sourceUrl} target="_blank" rel="noreferrer">ESPN NFL scoreboard ↗</a><small>Calculated {dateTime(data.fetchedAt)} · cached 12 hours</small></div>
    </> : null}
  </section>;
}

function nflPrimaryMetric(player: NflPlayer): { id: string; label: string } {
  const pass = player.passYards ?? 0;
  const rush = player.rushYards ?? 0;
  const rec = player.recYards ?? 0;
  if (pass >= rush && pass >= rec) return { id: "passYards", label: "Pass yards" };
  if (rush >= rec) return { id: "rushYards", label: "Rush yards" };
  return { id: "recYards", label: "Receiving yards" };
}

function NflPlayerStatsSheet({ player, team, onClose }: { player: NflPlayer; team: NflTeamCode; onClose: () => void }) {
  const log = useQuery({ queryKey: ["nfl-player-log", team, player.id], queryFn: () => api.getNflPlayerGameLog({ team, playerId: player.id }), retry: false });
  const primary = nflPrimaryMetric(player);
  const metrics = [
    { id: "passYards", label: "Pass yds" }, { id: "passTds", label: "Pass TD" },
    { id: "rushYards", label: "Rush yds" }, { id: "rushTds", label: "Rush TD" },
    { id: "recYards", label: "Rec yds" }, { id: "receptions", label: "Rec" }, { id: "totalTds", label: "Total TD" },
  ];
  const [metric, setMetric] = useState(primary.id);
  const games = log.data?.games ?? [];
  const metricValue = (game: NflPlayerGameLog["games"][number], id: string): number | null => {
    if (id === "passYards") return game.passYards;
    if (id === "passTds") return game.passTds;
    if (id === "rushYards") return game.rushYards;
    if (id === "rushTds") return game.rushTds;
    if (id === "recYards") return game.recYards;
    if (id === "receptions") return game.receptions;
    if (id === "totalTds") return (game.passTds ?? 0) + (game.rushTds ?? 0) + (game.recTds ?? 0);
    return null;
  };
  const chartData = games.slice(0, 8).reverse().map((game) => ({
    date: nflGameDate(game.gameDate),
    passYards: game.passYards, passTds: game.passTds, rushYards: game.rushYards, rushTds: game.rushTds,
    recYards: game.recYards, receptions: game.receptions,
    totalTds: (game.passTds ?? 0) + (game.rushTds ?? 0) + (game.recTds ?? 0),
  }));
  const lastFive = games.slice(0, 5);
  const seasonAverage = average(games.map((game) => metricValue(game, metric)));
  const lastFiveAverage = average(lastFive.map((game) => metricValue(game, metric)));
  const modelProjection = seasonAverage === null ? null : seasonAverage * .5 + (lastFiveAverage ?? seasonAverage) * .5;
  const metricLabel = metrics.find((item) => item.id === metric)?.label ?? "Stat";
  const totals = (fn: (g: NflPlayerGameLog["games"][number]) => number | null) => lastFive.reduce((s, g) => s + (fn(g) ?? 0), 0);
  const [sheetTab, setSheetTab] = useState<"overview" | "trend" | "last5" | "log">("overview");

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet player-sheet" role="dialog" aria-modal="true" aria-labelledby="nfl-player-stats-title">
      <button className="close" onClick={onClose} aria-label="Close player stats">×</button>
      <p className="kicker">{team} PLAYER FILE · NFL</p>
      <div className="sheet-title-row"><h2 id="nfl-player-stats-title">{player.name}</h2><PlayerWatchStar sport="nfl" playerId={player.id} team={team} name={player.name} position={player.position} /></div>
      <p className="matchup">{player.jersey ? `#${player.jersey} · ` : ""}{player.position} · 2026 regular season</p>
      <div className="player-season-line">
        <div><span>Games</span><strong>{player.games ?? "—"}</strong></div>
        <div><span>Pass yds</span><strong>{player.passYards ?? "—"}</strong></div>
        <div><span>Rush yds</span><strong>{player.rushYards ?? "—"}</strong></div>
        <div><span>Rec yds</span><strong>{player.recYards ?? "—"}</strong></div>
        <div><span>Total TD</span><strong>{(player.passTds ?? 0) + (player.rushTds ?? 0) + (player.recTds ?? 0)}</strong></div>
      </div>
      <div className="sheet-tabs" role="tablist" aria-label="Player stat sections">
        {(["overview", "trend", "last5", "log"] as const).map((tab) => <button key={tab} role="tab" aria-selected={sheetTab === tab} className={sheetTab === tab ? "active" : ""} onClick={() => setSheetTab(tab)}>{tab === "overview" ? "Overview" : tab === "trend" ? "Trend" : tab === "last5" ? "Last 5" : "Game log"}</button>)}
      </div>
      {log.isPending ? <div className="player-log-loading"><span />Loading game-by-game stats…</div> : log.isError ? <div className="inline-log-error"><strong>Game log unavailable.</strong><span>{log.error instanceof Error ? log.error.message : "Try again shortly."}</span><button onClick={() => log.refetch()}>Retry</button></div> : games.length === 0 ? <div className="history-empty"><strong>No games logged yet.</strong><span>The graph, projection and last-five record will populate after official game data posts.</span></div> : <>
        {sheetTab === "overview" && <section className="model-panel">
          <div><p className="kicker">DAILY HAM MODEL</p><h3>{metricLabel} projection</h3><span>Statistical projection — not a market lean</span></div>
          <strong>{modelProjection === null ? "—" : modelProjection.toFixed(1)}</strong>
          <div className="model-inputs"><span>Season <b>{seasonAverage?.toFixed(1) ?? "—"}</b></span><span>Last 5 <b>{lastFiveAverage?.toFixed(1) ?? "—"}</b></span></div>
          <p>Weighted from official season and last-5 game logs. Missing context stays neutral.</p>
        </section>}
        {sheetTab === "trend" && <section className="trend-section">
          <div className="section-heading"><div><p className="kicker">RECENT TREND</p><h3>Last {Math.min(8, games.length)} games</h3></div><span>{metricLabel}</span></div>
          <div className="metric-tabs" aria-label="Chart stat">{metrics.map((item) => <button key={item.id} className={metric === item.id ? "active" : ""} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div>
          <div className="player-trend-chart" role="img" aria-label={`${player.name} ${metricLabel} over the last ${Math.min(8, games.length)} games`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 14, right: 10, bottom: 0, left: -22 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Line type="monotone" dataKey={metric} stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: "var(--paper)", strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer></div>
        </section>}
        {sheetTab === "last5" && <section className="last-five-section">
          <div className="section-heading"><div><p className="kicker">FORM CHECK</p><h3>Last five</h3></div><span>{lastFive.length} official games</span></div>
          <div className="last-five-summary"><div><span>Pass yds</span><strong>{totals((g) => g.passYards)}</strong></div><div><span>Rush yds</span><strong>{totals((g) => g.rushYards)}</strong></div><div><span>Rec yds</span><strong>{totals((g) => g.recYards)}</strong></div><div><span>Total TD</span><strong>{totals((g) => (g.passTds ?? 0) + (g.rushTds ?? 0) + (g.recTds ?? 0))}</strong></div></div>
          <div className="game-card-list">{lastFive.map((game) => <article className="game-card" key={game.gameId}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>Week {game.week} · {nflGameDate(game.gameDate)} · {game.result} {game.teamScore}-{game.oppScore}</span></div></div><div className="game-stat-grid"><div><span>Pass</span><b>{game.passYards ?? "—"} yds · {game.passTds ?? 0} TD</b></div><div><span>Rush</span><b>{game.rushYards ?? "—"} yds · {game.rushTds ?? 0} TD</b></div><div><span>Rec</span><b>{game.receptions ?? "—"} rec · {game.recYards ?? "—"} yds</b></div></div></article>)}</div>
        </section>}
        {sheetTab === "log" && <details className="full-log" open><summary>Full season game log <span>{games.length} games</span></summary><div className="game-card-list compact">{games.map((game) => <article className="game-card" key={`full-${game.gameId}`}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>Week {game.week} · {nflGameDate(game.gameDate)} · {game.result} {game.teamScore}-{game.oppScore}</span></div></div><div className="game-stat-grid"><div><span>Pass</span><b>{game.completions ?? "—"}/{game.attempts ?? "—"} · {game.passYards ?? "—"} yds · {game.passTds ?? 0} TD · {game.interceptions ?? 0} INT</b></div><div><span>Rush</span><b>{game.rushAttempts ?? "—"} att · {game.rushYards ?? "—"} yds · {game.rushTds ?? 0} TD</b></div><div><span>Rec</span><b>{game.receptions ?? "—"}/{game.targets ?? "—"} · {game.recYards ?? "—"} yds · {game.recTds ?? 0} TD</b></div></div></article>)}</div></details>}
        <div className="source-box"><span>Source</span><a href={log.data?.sourceUrl} target="_blank" rel="noreferrer">ESPN NFL game data ↗</a><small>Fetched {log.data ? dateTime(log.data.fetchedAt) : "—"}</small></div>
      </>}
    </section>
  </div>;
}

function NflRosterView({ parlay, setParlay, teamFocus }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; teamFocus: { sport: League; team: string; nonce: number } | null }) {
  const [team, setTeam] = useState<NflTeamCode>("KC");
  useEffect(() => {
    if (teamFocus && teamFocus.sport === "nfl" && nflTeams.some((t) => t.code === teamFocus.team)) setTeam(teamFocus.team as NflTeamCode);
  }, [teamFocus]);
  const [selectedPlayer, setSelectedPlayer] = useState<NflPlayer | null>(null);
  const [watched, setWatched] = useState(0);
  const nfl = useQuery({ queryKey: ["nfl-roster", team], queryFn: () => api.getNflRoster({ team }) });
  const teamBoard = useQuery({ queryKey: ["premium-board", "nfl"], queryFn: () => api.getPremiumBoard({ sport: "nfl" }), retry: false });
  const nflOverview = useQuery({ queryKey: ["nfl-overview", "current"], queryFn: () => api.getNflOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const selectedTeamName = nflTeams.find((item) => item.code === team)?.name ?? team;
  const teamMoneylines = useMemo(() => moneylinePicks(groupPremiumOffers(teamBoard.data?.offers ?? [])).filter((group) => group.matchup.includes(selectedTeamName)), [teamBoard.data, selectedTeamName]);
  useEffect(() => {
    const onChange = () => setWatched((w) => w + 1);
    window.addEventListener("dh-watchlist-change", onChange);
    return () => window.removeEventListener("dh-watchlist-change", onChange);
  }, []);
  void watched;

  return (
    <>
    <section className="roster-panel">
      <div className="roster-title"><div><p className="kicker">OFFICIAL NFL ROSTERS</p><h2>Team stats & player trends</h2><p className="roster-intro">Tap any player to open graphs, last-five form and the complete game log. Star a player to add them to your Watchlist.</p></div>{nfl.data && <span>Updated {dateTime(nfl.data.fetchedAt)}</span>}</div>
      <label className="select-label" htmlFor="nfl-team">Team</label>
      <select id="nfl-team" value={team} onChange={(e) => { setTeam(e.target.value as NflTeamCode); setSelectedPlayer(null); }}>{nflTeams.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
      {teamMoneylines.length > 0 && <section className="team-moneyline"><div className="section-heading"><div><p className="kicker">NEXT GAME</p><h3>Moneyline board</h3></div><span>Best · DraftKings · FanDuel · BetMGM</span></div><div className="moneyline-grid">{teamMoneylines.map((group) => { const side = strongestSide(group); if (!side) return null; const added = parlay.some((item) => item.id === side.id); const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side }; return <article className="moneyline-card" key={group.id}><div className="moneyline-open"><small>{group.matchup}</small><h4>{group.entity}</h4><div><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DraftKings <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>FanDuel <b>{formatAmerican(side.fanDuel?.odds ?? null)}</b></span><span>BetMGM <b>{formatAmerican(side.betMGM?.odds ?? null)}</b></span></div><FlipMeter sport="nfl" market={group} nhlStandings={null} nflStandings={nflOverview.data?.standings ?? null} nbaStandings={null} /><p className={side.evPercent !== null && side.evPercent > 0 ? "signal positive" : "signal"}>{side.evPercent !== null && side.evPercent > 0 ? `+${side.evPercent.toFixed(1)}% fair-odds EV` : "Market favorite"}</p></div><button className={added ? "pick-button added" : "pick-button"} onClick={() => setParlay(added ? parlay.filter((item) => item.id !== side.id) : [...parlay, pick])}>{added ? "Remove" : "Add ML"}</button></article>;})}</div></section>}
      {nfl.isPending ? (
        <div className="loading"><span />Loading official roster…</div>
      ) : nfl.isError ? (
        <div className="inline-error">Official NFL data is temporarily unavailable. <button onClick={() => nfl.refetch()}>Retry</button></div>
      ) : nfl.data ? (
        <>
          <div className="roster-summary"><div><b>{nfl.data.players.length}</b><span>skill players</span></div><div><b>{nfl.data.groups.offense ?? 0}</b><span>offense</span></div><div><b>{nfl.data.groups.specialTeam ?? 0}</b><span>special teams</span></div></div>
          <div className="table-scroll"><div className="roster-table nfl-roster-table" role="table">
            <div className="roster-header" role="row"><span>Player</span><span>GP</span><span>Pass yds</span><span>Rush yds</span><span>Rec yds</span><span>TD</span></div>
            {nfl.data.players.map((player) => {
              const starredEntry = { playerId: player.id, team, name: player.name, position: player.position };
              const nflStats: [string, string][] = [["GP", `${player.games ?? "—"}`], ["Pass yds", `${player.passYards ?? "—"}`], ["Rush yds", `${player.rushYards ?? "—"}`], ["Rec yds", `${player.recYards ?? "—"}`], ["TD", `${(player.passTds ?? 0) + (player.rushTds ?? 0) + (player.recTds ?? 0)}`]];
              return <div className="roster-card" key={player.id}>
                <button className="roster-card-main" onClick={() => setSelectedPlayer(player)} aria-label={`Open ${player.name} game log and charts`}>
                  <span className="roster-card-head"><b>{player.jersey ? `#${player.jersey} ` : ""}{player.name}</b><small>{player.position}</small></span>
                  <span className="roster-stat-grid">{nflStats.map(([label, value]) => <span key={label} className="roster-stat"><small>{label}</small><b>{value}</b></span>)}</span>
                </button>
                <PlayerWatchStar sport="nfl" playerId={starredEntry.playerId} team={starredEntry.team} name={starredEntry.name} position={starredEntry.position} />
              </div>;
            })}
          </div></div>
          <div className="source-box"><span>Source</span><a href={nfl.data.sourceUrl} target="_blank" rel="noreferrer">ESPN NFL data ↗</a><small>2026 regular season · aggregated from official game logs</small></div>
        </>
      ) : null}
    </section>
    {selectedPlayer && <NflPlayerStatsSheet key={selectedPlayer.id} player={selectedPlayer} team={team} onClose={() => setSelectedPlayer(null)} />}
    </>
  );
}

function NflHotStreaksView() {
  const [category, setCategory] = useState("Heat index");
  const [selected, setSelected] = useState<{ player: NflPlayer; team: NflTeamCode } | null>(null);
  const hot = useQuery({ queryKey: ["nfl-hot-streaks"], queryFn: () => api.getNflHotStreaks({ force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getNflHotStreaks({ force: true }), onSuccess: () => hot.refetch() });
  const players = [...(hot.data?.players ?? [])].sort((a, b) => {
    if (category === "TD streak") return b.tdStreak - a.tdStreak || b.lastThreeTds - a.lastThreeTds;
    if (category === "Yard streak") return b.yardStreak - a.yardStreak || b.lastThreeYards - a.lastThreeYards;
    if (category === "Last-3 TDs") return b.lastThreeTds - a.lastThreeTds;
    return b.heatScore - a.heatScore;
  });
  const toPlayer = (row: NflHotStreaks["players"][number]): NflPlayer => ({
    id: row.playerId, name: row.name, jersey: null, position: row.position, group: "offense",
    games: row.games.length, passYards: row.games.reduce((s, g) => s + g.passYards, 0), passTds: row.games.reduce((s, g) => s + g.passTds, 0),
    interceptions: null, rushYards: row.games.reduce((s, g) => s + g.rushYards, 0), rushTds: row.games.reduce((s, g) => s + g.rushTds, 0),
    receptions: null, recYards: row.games.reduce((s, g) => s + g.recYards, 0), recTds: row.games.reduce((s, g) => s + g.recTds, 0),
  });
  return <section className="hot-section"><div className="roster-title"><div><p className="kicker">HOT STREAKS · NFL</p><h2>Who's cooking right now</h2><p className="roster-intro">Every qualifying streak is calculated from official recent NFL game data. Tap a player for the full stat file.</p></div>{hot.data && <div className="roster-update"><span>Updated {dateTime(hot.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh streaks"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Heat index", "TD streak", "Yard streak", "Last-3 TDs"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{hot.isPending ? <div className="loading"><span />Reading recent NFL game data…</div> : hot.isError ? <div className="error-state"><h2>Streak board unavailable.</h2><p>The ESPN feed did not answer.</p><button onClick={() => hot.refetch()}>Retry</button></div> : players.length === 0 ? <div className="history-empty"><strong>No qualifying streaks in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying hot signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <div className="hot-row-wrap" key={row.playerId}><button className="hot-row" onClick={() => setSelected({ player: toPlayer(row), team: row.team as NflTeamCode })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · NFL</small></span><span className="streak-badges">{row.tdStreak >= 2 && <b>{row.tdStreak}G TD streak</b>}{row.yardStreak >= 2 && <b>{row.yardStreak}G 100+ yd</b>}</span><span className="hot-totals"><b>{row.lastThreeTds} TD</b><small>{row.lastThreeYards} yds · last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`Week ${game.week} vs ${game.opponent}`}>{game.totalTds} TD · {game.scrimmageYards + game.passYards} yds</i>)}</span></button><PlayerWatchStar sport="nfl" playerId={row.playerId} team={row.team} name={row.name} position={row.position} /></div>)}</div>}{hot.data && <div className="source-box"><span>Source</span><a href={hot.data.sourceUrl} target="_blank" rel="noreferrer">ESPN NFL game data ↗</a><small>{nflGameDate(hot.data.windowStart)}–{nflGameDate(hot.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <NflPlayerStatsSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)} />}</section>;
}

function NflCuttingBoard() {
  const [category, setCategory] = useState("Coldest");
  const [selected, setSelected] = useState<{ player: NflPlayer; team: NflTeamCode } | null>(null);
  const cold = useQuery({ queryKey: ["nfl-cold-streaks"], queryFn: () => api.getNflColdStreaks({ force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getNflColdStreaks({ force: true }), onSuccess: () => cold.refetch() });
  const showTeams = category === "Teams";
  const players = [...(cold.data?.players ?? [])].sort((a, b) => {
    if (category === "TD drought") return b.tdDrought - a.tdDrought || b.coldScore - a.coldScore;
    if (category === "Last-3 yards") return a.lastThreeYards - b.lastThreeYards;
    return b.coldScore - a.coldScore;
  });
  const teams = [...(cold.data?.teams ?? [])].sort((a, b) => b.losses - a.losses);
  const toPlayer = (row: NflColdStreaks["players"][number]): NflPlayer => ({
    id: row.playerId, name: row.name, jersey: null, position: row.position, group: "offense",
    games: row.games.length, passYards: row.games.reduce((s, g) => s + g.passYards, 0), passTds: row.games.reduce((s, g) => s + g.passTds, 0),
    interceptions: null, rushYards: row.games.reduce((s, g) => s + g.rushYards, 0), rushTds: row.games.reduce((s, g) => s + g.rushTds, 0),
    receptions: null, recYards: row.games.reduce((s, g) => s + g.recYards, 0), recTds: row.games.reduce((s, g) => s + g.recTds, 0),
  });
  return <section className="hot-section cutting-board"><div className="roster-title"><div><p className="kicker">THE CUTTING BOARD · NFL</p><h2>Who's gone cold</h2><p className="roster-intro">Every slump is calculated from official recent NFL game data. Tap a player for the full stat file.</p></div>{cold.data && <div className="roster-update"><span>Updated {dateTime(cold.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh board"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Coldest", "TD drought", "Last-3 yards", "Teams"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{cold.isPending ? <div className="loading"><span />Reading recent NFL game data…</div> : cold.isError ? <div className="error-state"><h2>Cutting board unavailable.</h2><p>The ESPN feed did not answer.</p><button onClick={() => cold.refetch()}>Retry</button></div> : showTeams ? (teams.length === 0 ? <div className="history-empty"><strong>No team on a 2+ game slide right now.</strong><span>Every team has won at least one of its last two.</span></div> : <div className="hot-list">{teams.map((row, index) => <div className="hot-row-wrap" key={row.team}><div className="hot-row"><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {row.gamesPlayed} GP</small></span><span className="streak-badges cold"><b>{row.streak} skid</b></span></div><TeamWatchStar sport="nfl" team={row.team} name={row.name} /></div>)}</div>) : players.length === 0 ? <div className="history-empty"><strong>No qualifying slumps in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying cold signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <div className="hot-row-wrap" key={row.playerId}><button className="hot-row" onClick={() => setSelected({ player: toPlayer(row), team: row.team as NflTeamCode })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · NFL</small></span><span className="streak-badges cold">{row.tdDrought >= 2 && <b>{row.tdDrought}G TD drought</b>}</span><span className="hot-totals"><b>{row.lastThreeTds} TD</b><small>{row.lastThreeYards} yds · last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`Week ${game.week} vs ${game.opponent}`}>{game.totalTds} TD · {game.scrimmageYards + game.passYards} yds</i>)}</span></button><PlayerWatchStar sport="nfl" playerId={row.playerId} team={row.team} name={row.name} position={row.position} /></div>)}</div>}{cold.data && <div className="source-box"><span>Source</span><a href={cold.data.sourceUrl} target="_blank" rel="noreferrer">ESPN NFL game data ↗</a><small>{nflGameDate(cold.data.windowStart)}–{nflGameDate(cold.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <NflPlayerStatsSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)} />}</section>;
}

function WatchlistView({ onViewTeam }: { onViewTeam: (sport: League, team: string) => void }) {
  const [list, setList] = useState<WatchedEntry[]>(() => loadWatchlist());
  const [selected, setSelected] = useState<{ sport: League; player: { id: number; name: string; position: string; team: string } } | null>(null);
  const [teamSheet, setTeamSheet] = useState<{ sport: League; team: string } | null>(null);
  useEffect(() => {
    const onChange = () => setList(loadWatchlist());
    window.addEventListener("dh-watchlist-change", onChange);
    return () => window.removeEventListener("dh-watchlist-change", onChange);
  }, []);
  // NHL player files need the full roster row; fetch it on demand.
  const [nhlPlayer, setNhlPlayer] = useState<{ team: string; id: number } | null>(null);
  const nhlRoster = useQuery({ queryKey: ["nhl-roster", nhlPlayer?.team ?? ""], queryFn: () => api.getNhlRoster({ team: (nhlPlayer?.team ?? "WSH") as TeamCode }), enabled: nhlPlayer !== null, retry: 1 });
  useEffect(() => {
    if (nhlPlayer && nhlRoster.data) {
      const found = nhlRoster.data.players.find((p) => p.id === nhlPlayer.id);
      if (found) setSelected({ sport: "nhl", player: { id: found.id, name: found.name, position: found.position, team: nhlPlayer.team } });
    }
  }, [nhlPlayer, nhlRoster.data]);
  const openPlayer = (entry: WatchedPlayer) => {
    if (entry.sport === "nfl") {
      setSelected({ sport: "nfl", player: { id: entry.playerId, name: entry.name, position: entry.position, team: entry.team } });
    } else if (entry.sport === "nba") {
      setSelected({ sport: "nba", player: { id: entry.playerId, name: entry.name, position: entry.position, team: entry.team } });
    } else if (entry.sport === "soccer") {
      setSelected({ sport: "soccer", player: { id: entry.playerId, name: entry.name, position: entry.position, team: entry.team } });
    } else {
      setNhlPlayer({ team: entry.team, id: entry.playerId });
    }
  };
  const themeOf = (entry: WatchedEntry) => themeFor(entry.sport, entry.team);
  const teamName = (entry: WatchedTeam) => themeFor(entry.sport, entry.team)?.name ?? entry.name;
  return <section className="watchlist-section">
    <div className="roster-title"><div><p className="kicker">YOUR WATCHLIST</p><h2>Players & teams you're tracking</h2><p className="roster-intro">Star any player or team across all four leagues and they'll live here. Tap a player for the full stat file, tap a team to open its roster.</p></div><span>{list.length} watched</span></div>
    {list.length === 0 ? <div className="history-empty"><strong>Nothing watched yet.</strong><span>Hit the ★ on any player or team — NHL, NFL, NBA or soccer — and they'll show up here.</span></div> :
    <div className="watchlist-grid">{list.map((entry) => {
      const theme = themeOf(entry);
      const key = entry.kind === "player" ? `player-${entry.sport}-${entry.playerId}` : `team-${entry.sport}-${entry.team}`;
      const sub = entry.kind === "player" ? `${entry.team} · ${entry.position} · ${entry.sport.toUpperCase()}` : `${entry.sport.toUpperCase()} · tap for depth chart & stats`;
      const label = entry.kind === "player" ? entry.name : teamName(entry);
      return <article className="watch-card" key={key} style={theme ? ({ "--team-color": theme.color } as CSSProperties) : undefined}>
        <button className="watch-open" onClick={() => entry.kind === "player" ? openPlayer(entry) : setTeamSheet({ sport: entry.sport, team: entry.team })} aria-label={entry.kind === "player" ? `Open ${entry.name} stat file` : `Open ${label} team file`}>
          <span className="watch-team-bar" aria-hidden="true" />
          <span className="watch-player"><strong>{label}</strong><small>{sub}</small></span>
          <span className="watch-league">{entry.kind === "team" ? "TEAM" : entry.sport === "nfl" ? "NFL" : entry.sport === "nba" ? "NBA" : entry.sport === "soccer" ? (soccerLeagueForTeam(entry.team) === "epl" ? "EPL" : "MLS") : "NHL"}</span>
        </button>
        <button type="button" className="watch-remove" onClick={() => removeWatchedEntry(entry)} aria-label={`Remove ${label} from watchlist`}>×</button>
      </article>;
    })}</div>}
    {selected?.sport === "nfl" && <NflPlayerStatsSheet player={{ id: selected.player.id, name: selected.player.name, jersey: null, position: selected.player.position, group: "offense", games: null, passYards: null, passTds: null, interceptions: null, rushYards: null, rushTds: null, receptions: null, recYards: null, recTds: null }} team={selected.player.team as NflTeamCode} onClose={() => setSelected(null)} />}
    {selected?.sport === "nba" && <NbaPlayerSheet player={{ id: selected.player.id, name: selected.player.name, jersey: null, position: selected.player.position, group: nbaGroupFor(selected.player.position), games: null, points: null, rebounds: null, assists: null, steals: null, blocks: null, turnovers: null, minutes: null }} team={selected.player.team as NbaTeamCode} onClose={() => setSelected(null)} />}
    {selected?.sport === "soccer" && <SoccerPlayerSheet league={soccerLeagueForTeam(selected.player.team)} player={{ id: selected.player.id, name: selected.player.name, jersey: null, position: selected.player.position, games: null, goals: null, assists: null }} team={selected.player.team} onClose={() => setSelected(null)} />}
    {selected?.sport === "nhl" && nhlRoster.data && (() => {
      const found = nhlRoster.data.players.find((p) => p.id === selected.player.id);
      return found ? <PlayerStatsSheet player={found} team={nhlPlayer?.team as TeamCode} onClose={() => { setSelected(null); setNhlPlayer(null); }} /> : null;
    })()}
    {teamSheet && <TeamDetailSheet sport={teamSheet.sport} team={teamSheet.team} onClose={() => setTeamSheet(null)} onViewRoster={onViewTeam} />}
  </section>;
}

const NBA_DEPTH_GROUPS: { title: string; positions: string[] }[] = [
  { title: "Guards", positions: ["PG", "SG", "G"] },
  { title: "Forwards", positions: ["SF", "PF", "F"] },
  { title: "Centers", positions: ["C"] },
];

const NFL_DEPTH_GROUPS: { title: string; positions: string[] }[] = [
  { title: "Quarterbacks", positions: ["QB"] },
  { title: "Running Backs", positions: ["RB", "FB"] },
  { title: "Wide Receivers", positions: ["WR"] },
  { title: "Tight Ends", positions: ["TE"] },
  { title: "Offensive Line", positions: ["C", "G", "T", "OT", "OG", "OL"] },
  { title: "Defensive Line", positions: ["DE", "DT", "NT", "DL", "EDGE"] },
  { title: "Linebackers", positions: ["LB", "ILB", "OLB", "MLB"] },
  { title: "Secondary", positions: ["CB", "S", "FS", "SS", "DB", "NB"] },
  { title: "Special Teams", positions: ["K", "P", "LS", "KR", "PR"] },
];

function TeamDetailSheet({ sport, team, onClose, onViewRoster }: { sport: League; team: string; onClose: () => void; onViewRoster: (sport: League, team: string) => void }) {
  const [tab, setTab] = useState<"depth" | "stats">("depth");
  const [selectedNfl, setSelectedNfl] = useState<NflPlayer | null>(null);
  const [selectedNhl, setSelectedNhl] = useState<NhlPlayer | null>(null);
  const [selectedNba, setSelectedNba] = useState<NbaPlayer | null>(null);
  const [selectedSoccer, setSelectedSoccer] = useState<SoccerPlayer | null>(null);
  const theme = themeFor(sport, team);
  const teamName = theme?.name ?? team;
  // Soccer clubs carry their league in the code (no MLS/EPL collisions).
  const teamSoccerLeague: SoccerLeague = soccerLeagueForTeam(team);

  const nflRoster = useQuery({ queryKey: ["nfl-roster", team], queryFn: () => api.getNflRoster({ team: team as NflTeamCode }), enabled: sport === "nfl", retry: 1 });
  const nhlRoster = useQuery({ queryKey: ["nhl-roster", team], queryFn: () => api.getNhlRoster({ team: team as TeamCode }), enabled: sport === "nhl", retry: 1 });
  const nbaRoster = useQuery({ queryKey: ["nba-roster", team], queryFn: () => api.getNbaRoster({ team: nbaServerTeam(team) as NbaTeamCode }), enabled: sport === "nba", retry: 1 });
  const soccerRoster = useQuery({ queryKey: ["soccer-roster", teamSoccerLeague, team], queryFn: () => api.getSoccerRoster({ league: teamSoccerLeague, team }), enabled: sport === "soccer", retry: 1 });
  const nflOverview = useQuery({ queryKey: ["nfl-overview"], queryFn: () => api.getNflOverview({}), enabled: sport === "nfl", staleTime: 15 * 60 * 1000, retry: 1 });
  const nhlOverview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), enabled: sport === "nhl", staleTime: 15 * 60 * 1000, retry: 1 });
  const nbaOverview = useQuery({ queryKey: ["nba-overview"], queryFn: () => api.getNbaOverview({}), enabled: sport === "nba", staleTime: 15 * 60 * 1000, retry: 1 });
  const soccerOverview = useQuery({ queryKey: ["soccer-overview", teamSoccerLeague], queryFn: () => api.getSoccerOverview({ league: teamSoccerLeague }), enabled: sport === "soccer", staleTime: 15 * 60 * 1000, retry: 1 });

  const nflStanding = nflOverview.data?.standings.find((row) => row.team === team);
  const nhlStanding = nhlOverview.data?.standings.find((row) => row.team === team);
  const nbaStanding = nbaOverview.data?.standings.find((row) => row.team === team);
  const soccerStanding = soccerOverview.data?.standings.find((row) => row.team === team);

  const nflGroups = useMemo(() => {
    const players = nflRoster.data?.players ?? [];
    return NFL_DEPTH_GROUPS.map((group) => ({
      title: group.title,
      players: players.filter((p) => group.positions.includes(p.position)).sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name)),
    })).filter((group) => group.players.length > 0);
  }, [nflRoster.data]);
  const nbaGroups = useMemo(() => {
    const players = nbaRoster.data?.players ?? [];
    return NBA_DEPTH_GROUPS.map((group) => ({
      title: group.title,
      players: players.filter((p) => group.positions.includes(p.position)).sort((a, b) => ((b as NbaPlayer).points ?? 0) - ((a as NbaPlayer).points ?? 0) || a.name.localeCompare(b.name)),
    })).filter((group) => group.players.length > 0);
  }, [nbaRoster.data]);
  const nhlGroups = useMemo(() => {
    const players = nhlRoster.data?.players ?? [];
    const forwards = players.filter((p) => ["C", "LW", "RW"].includes(p.position)).sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const defense = players.filter((p) => p.position === "D").sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
    const goalies = players.filter((p) => p.position === "G").sort((a, b) => (b.games ?? 0) - (a.games ?? 0));
    return [
      { title: "Forwards", players: forwards },
      { title: "Defensemen", players: defense },
      { title: "Goalies", players: goalies },
    ].filter((group) => group.players.length > 0);
  }, [nhlRoster.data]);
  const soccerGroups = useMemo(() => {
    const players = soccerRoster.data?.players ?? [];
    return SOCCER_DEPTH_GROUPS.map((group) => ({
      title: group.title,
      players: players.filter((p) => group.positions.includes(p.position)).sort((a, b) => ((b.goals ?? 0) + (b.assists ?? 0)) - ((a.goals ?? 0) + (a.assists ?? 0)) || a.name.localeCompare(b.name)),
    })).filter((group) => group.players.length > 0);
  }, [soccerRoster.data]);

  const loading = sport === "soccer" ? soccerRoster.isPending : sport === "nba" ? nbaRoster.isPending : sport === "nfl" ? nflRoster.isPending : nhlRoster.isPending;
  const groups = sport === "soccer" ? soccerGroups : sport === "nba" ? nbaGroups : sport === "nfl" ? nflGroups : nhlGroups;

  const recordLine = sport === "soccer"
    ? soccerStanding ? `${soccerStanding.wins}–${soccerStanding.draws}–${soccerStanding.losses} · ${soccerStanding.points} pts` : "—"
    : sport === "nba"
    ? nbaStanding ? `${nbaStanding.wins}–${nbaStanding.losses}` : "—"
    : sport === "nfl"
    ? nflStanding ? `${nflStanding.wins}–${nflStanding.losses}${nflStanding.ties ? `–${nflStanding.ties}` : ""}` : "—"
    : nhlStanding ? `${nhlStanding.wins}–${nhlStanding.losses}–${nhlStanding.otLosses}` : "—";
  const division = (sport === "soccer" ? "" : sport === "nba" ? nbaStanding?.division : sport === "nfl" ? nflStanding?.division : nhlStanding?.division) ?? "";

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet team-sheet" role="dialog" aria-modal="true" aria-labelledby="team-detail-title" style={theme ? ({ "--team-color": theme.color } as CSSProperties) : undefined}>
      <button className="close" onClick={onClose} aria-label="Close team detail">×</button>
      <span className="watch-team-bar sheet-team-bar" aria-hidden="true" />
      <p className="kicker">{sport.toUpperCase()} TEAM FILE</p>
      <div className="team-sheet-head">
        <h2 id="team-detail-title">{teamName}</h2>
        <TeamWatchStar sport={sport} team={team} name={teamName} />
      </div>
      <p className="matchup">{recordLine}{division ? ` · ${division}` : ""}</p>
      <button className="refresh" onClick={() => { onViewRoster(sport, team); onClose(); }}>Open full roster →</button>
      <div className="metric-tabs" role="tablist" aria-label="Team detail">
        <button className={tab === "depth" ? "active" : ""} onClick={() => setTab("depth")}>Depth chart</button>
        <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>Team stats</button>
      </div>
      {tab === "depth" && (loading ? <div className="loading"><span />Loading roster…</div> :
        <div className="depth-chart">
          <p className="depth-note">Roster organized by position from official {sport === "nhl" ? "NHL" : "ESPN"} data. Tap a player for the full stat file.</p>
          {groups.map((group) => <details className="depth-group" key={group.title} open={groups.length <= 4}>
            <summary>{group.title} <span>{group.players.length}</span></summary>
            <div className="depth-players">
              {group.players.map((player) => <div className="depth-player-wrap" key={player.id}><button className="depth-player" onClick={() => sport === "soccer" ? setSelectedSoccer(player as SoccerPlayer) : sport === "nba" ? setSelectedNba(player as NbaPlayer) : sport === "nfl" ? setSelectedNfl(player as NflPlayer) : setSelectedNhl(player as NhlPlayer)}>
                <b>{(player as { jersey?: string | null }).jersey ? `#${(player as { jersey?: string | null }).jersey} ` : ""}{(player as { number?: number | null }).number ? `#${(player as { number?: number | null }).number} ` : ""}{player.name}</b>
                <small>{player.position}{sport === "nhl" && (player as NhlPlayer).points !== undefined && (player as NhlPlayer).position !== "G" ? ` · ${(player as NhlPlayer).points} PTS` : ""}</small>
                <span className="depth-tap">›</span>
              </button><PlayerWatchStar sport={sport} playerId={player.id} team={team} name={player.name} position={player.position} /></div>)}
            </div>
          </details>)}
        </div>)}
      {tab === "stats" && <div className="team-stats-grid">
        {sport === "soccer" && soccerStanding ? <>
          <div><span>Record</span><strong>{soccerStanding.wins}–{soccerStanding.draws}–{soccerStanding.losses}</strong></div>
          <div><span>Points</span><strong>{soccerStanding.points}</strong></div>
          <div><span>Goals for</span><strong>{soccerStanding.goalsFor}</strong></div>
          <div><span>Goals against</span><strong>{soccerStanding.goalsAgainst}</strong></div>
          <div><span>Differential</span><strong className={soccerStanding.goalsFor - soccerStanding.goalsAgainst > 0 ? "positive" : ""}>{soccerStanding.goalsFor - soccerStanding.goalsAgainst > 0 ? "+" : ""}{soccerStanding.goalsFor - soccerStanding.goalsAgainst}</strong></div>
          <div><span>League</span><strong>{teamSoccerLeague === "epl" ? "Premier League" : "MLS"}</strong></div>
        </> : sport === "nba" && nbaStanding ? <>
          <div><span>Record</span><strong>{nbaStanding.wins}–{nbaStanding.losses}</strong></div>
          <div><span>Points for</span><strong>{nbaStanding.pointsFor}</strong></div>
          <div><span>Points against</span><strong>{nbaStanding.pointsAgainst}</strong></div>
          <div><span>Differential</span><strong className={nbaStanding.pointsFor - nbaStanding.pointsAgainst > 0 ? "positive" : ""}>{nbaStanding.pointsFor - nbaStanding.pointsAgainst > 0 ? "+" : ""}{nbaStanding.pointsFor - nbaStanding.pointsAgainst}</strong></div>
          <div><span>Division</span><strong>{nbaStanding.division || "—"}</strong></div>
          <div><span>Conference</span><strong>{nbaStanding.conference || "—"}</strong></div>
        </> : sport === "nfl" && nflStanding ? <>
          <div><span>Record</span><strong>{nflStanding.wins}–{nflStanding.losses}{nflStanding.ties ? `–${nflStanding.ties}` : ""}</strong></div>
          <div><span>Points for</span><strong>{nflStanding.pointsFor}</strong></div>
          <div><span>Points against</span><strong>{nflStanding.pointsAgainst}</strong></div>
          <div><span>Differential</span><strong className={nflStanding.pointsFor - nflStanding.pointsAgainst > 0 ? "positive" : ""}>{nflStanding.pointsFor - nflStanding.pointsAgainst > 0 ? "+" : ""}{nflStanding.pointsFor - nflStanding.pointsAgainst}</strong></div>
          <div><span>Division</span><strong>{nflStanding.division || "—"}</strong></div>
          <div><span>Conference</span><strong>{nflStanding.conference || "—"}</strong></div>
        </> : sport === "nhl" && nhlStanding ? <>
          <div><span>Record</span><strong>{nhlStanding.wins}–{nhlStanding.losses}–{nhlStanding.otLosses}</strong></div>
          <div><span>Points</span><strong>{nhlStanding.points}</strong></div>
          <div><span>Goals for</span><strong>{nhlStanding.goalsFor}</strong></div>
          <div><span>Goals against</span><strong>{nhlStanding.goalsAgainst}</strong></div>
          <div><span>Differential</span><strong className={nhlStanding.goalsFor - nhlStanding.goalsAgainst > 0 ? "positive" : ""}>{nhlStanding.goalsFor - nhlStanding.goalsAgainst > 0 ? "+" : ""}{nhlStanding.goalsFor - nhlStanding.goalsAgainst}</strong></div>
          <div><span>Streak</span><strong>{nhlStanding.streak || "—"}</strong></div>
        </> : <div className="history-empty"><strong>Team stats unavailable.</strong><span>The league feed did not answer.</span></div>}
        <div className="source-box"><span>Source</span><span>{sport === "nfl" ? "ESPN NFL data" : "NHL official data"}</span></div>
      </div>}
    </section>
    {selectedNfl && <NflPlayerStatsSheet player={{ id: selectedNfl.id, name: selectedNfl.name, jersey: selectedNfl.jersey, position: selectedNfl.position, group: selectedNfl.group, games: null, passYards: null, passTds: null, interceptions: null, rushYards: null, rushTds: null, receptions: null, recYards: null, recTds: null }} team={team as NflTeamCode} onClose={() => setSelectedNfl(null)} />}
    {selectedNba && <NbaPlayerSheet player={{ id: selectedNba.id, name: selectedNba.name, jersey: selectedNba.jersey, position: selectedNba.position, group: selectedNba.group, games: null, points: null, rebounds: null, assists: null, steals: null, blocks: null, turnovers: null, minutes: null }} team={team as NbaTeamCode} onClose={() => setSelectedNba(null)} />}
    {selectedNhl && <PlayerStatsSheet player={selectedNhl} team={team as TeamCode} onClose={() => setSelectedNhl(null)} />}
    {selectedSoccer && <SoccerPlayerSheet league={teamSoccerLeague} player={selectedSoccer} team={team} onClose={() => setSelectedSoccer(null)} />}
  </div>;
}

function isOwnerRoute() {
  try {
    // Hash route (#/owner) plus real path (/owner): the path form survives
    // PWA interception and link sharing where fragments can get dropped.
    return window.location.hash.startsWith("#/owner") || /(^|\/)owner(\/|$)/.test(window.location.pathname);
  } catch { return false; }
}

export function App(){
  const [isOwner, setIsOwner] = useState(isOwnerRoute);
  useEffect(() => {
    const onHash = () => setIsOwner(isOwnerRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    // Dismiss the branded startup splash once the app has painted, keeping it
    // up long enough for the branding to register.
    const splash = document.getElementById("dh-splash");
    if (!splash) return;
    const t0 = performance.now();
    const dismiss = () => {
      const wait = 5500 - (performance.now() - t0);
      if (wait > 0) { setTimeout(dismiss, wait); return; }
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 400);
    };
    dismiss();
  }, []);
  const [mode, setMode] = useState<Mode>("board");
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const [sport, setSport] = useState<Sport>(() => loadSport());
  const [parlay, setParlay] = useState<ParlayPick[]>([]);
  const [teamFocus, setTeamFocus] = useState<{ sport: League; team: string; nonce: number } | null>(null);
  useEffect(() => {
    const favs = loadFavorites();
    applyLeagueTheme(sport, favs[sport]);
    try { document.body.setAttribute("data-sport", sport); } catch { /* decorative */ }
  }, [sport]);
  function chooseSport(next: Sport) {
    setSport(next);
    try { localStorage.setItem(SPORT_KEY, next); } catch { /* private mode */ }
  }
  function viewTeam(targetSport: League, team: string) {
    setSport(targetSport);
    try { localStorage.setItem(SPORT_KEY, targetSport); } catch { /* private mode */ }
    setTeamFocus({ sport: targetSport, team, nonce: Date.now() });
    setMode("rosters");
  }
  const boardLabel = sport === "nfl" ? "Gridiron" : sport === "nba" ? "Hardwood" : sport === "soccer" ? "Pitch" : "Ice board";
  const [soccerLeague, setSoccerLeague] = useState<SoccerLeague>(() => loadSoccerLeague());
  function chooseSoccerLeague(next: SoccerLeague) {
    setSoccerLeague(next);
    try { localStorage.setItem(SOCCER_LEAGUE_KEY, next); } catch { /* private mode */ }
  }
  return isOwner ? <div className="app-shell owner-shell"><SafeAreaTopScrim backgroundColor="var(--paper)"/><ToastHost/><main><OwnerConsole/></main></div>
  : <div className="app-shell"><SafeAreaTopScrim backgroundColor="var(--paper)"/><ToastHost/><InstallPrompt/><main>{mode==="board"&&<WelcomeBanner sport={sport} onTour={() => setTutorialOpen(true)}/>}<div className="topbar"><div className="sport-switch" role="group" aria-label="League"><button type="button" className={"sport-shape" + (sport === "nhl" ? " active" : "")} onClick={() => chooseSport("nhl")} aria-pressed={sport === "nhl"} aria-label="Hockey side"><span className="shape puck" aria-hidden="true" /><em>NHL</em></button><button type="button" className={"sport-shape" + (sport === "nfl" ? " active" : "")} onClick={() => chooseSport("nfl")} aria-pressed={sport === "nfl"} aria-label="Football side"><span className="shape ball" aria-hidden="true" /><em>NFL</em></button><button type="button" className={"sport-shape" + (sport === "nba" ? " active" : "")} onClick={() => chooseSport("nba")} aria-pressed={sport === "nba"} aria-label="Basketball side"><span className="shape hoop" aria-hidden="true" /><em>NBA</em></button><button type="button" className={"sport-shape" + (sport === "soccer" ? " active" : "")} onClick={() => chooseSport("soccer")} aria-pressed={sport === "soccer"} aria-label="Soccer side"><span className="shape soccerball" aria-hidden="true" /><em>SOC</em></button></div><nav className="mode-tabs shapes" aria-label="Data view">{([
        ["board", boardLabel],
        ["record", "Record"],
        ["jamon", "Jamón Ibérico"],
        ["parlay", parlay.length > 0 ? `Parlay (${parlay.length})` : "Parlay"],
        ["matchup", "Matchup"],
        ["rosters", "Players"],
        ["streaks", "Streaks"],
        ["standings", "League"],
        ["watchlist", "Watchlist"],
        ["settings", "Settings"],
      ] as [Mode, string][]).map(([key, label]) => <button key={key} type="button" className={"mode-shape" + (mode === key ? " active" : "")} onClick={() => setMode(key)} aria-pressed={mode === key} aria-label={label}><span className={"rink " + (key === "jamon" ? "platter" : sport === "nhl" ? "ice" : sport === "nfl" ? "turf" : sport === "nba" ? "court" : "pitch")} aria-hidden="true"><span className={"shape " + (key === "jamon" ? "plate" : sport === "nhl" ? "puck" : sport === "nfl" ? "ball" : sport === "nba" ? "hoop" : "soccerball")} /></span>{mode === key && <i className="mode-glow" aria-hidden="true" />}<em>{label}</em></button>)}</nav></div>{mode==="board"&&<ProView parlay={parlay} setParlay={setParlay} home sport={sport} soccerLeague={soccerLeague} onSoccerLeague={chooseSoccerLeague}/>} {mode==="record"&&<RecordView/>} {mode==="jamon"&&<JamonView sport={sport}/>} {mode==="parlay"&&<ParlayView parlay={parlay} setParlay={setParlay} sport={sport} onGoBoard={()=>setMode("board")}/>} {mode==="matchup"&&<MatchupView sport={sport} soccerLeague={soccerLeague} onSoccerLeague={chooseSoccerLeague}/>} {mode==="rosters"&&<RosterView parlay={parlay} setParlay={setParlay} sport={sport} soccerLeague={soccerLeague} onSoccerLeague={chooseSoccerLeague} teamFocus={teamFocus}/>} {mode==="streaks"&&<StreaksView sport={sport} soccerLeague={soccerLeague} onSoccerLeague={chooseSoccerLeague}/>} {mode==="standings"&&<LeagueView sport={sport} soccerLeague={soccerLeague} onSoccerLeague={chooseSoccerLeague}/>} {mode==="watchlist"&&<WatchlistView onViewTeam={viewTeam}/>} {mode==="settings"&&<SiteSettings/>}{tutorialOpen&&<TutorialSheet onClose={() => setTutorialOpen(false)}/>}</main></div>;
}

// NBA views. Mirror the NFL sections: schedule strip, league, matchup
// calculator, rosters + player files, hot streaks — all on ESPN keyless
// feeds, with the same Deep-Dive stat-file treatment as football.
// ---------------------------------------------------------------------------

function nbaGameDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)); }

// ESPN and the NBA server leg use "UTAH" for the Jazz, matching the client
// theme list. These helpers are a safety net at the boundaries.
function nbaServerTeam(code: string): string { return code === "UTA" ? "UTAH" : code; }
function nbaClientTeam(code: string): string { return code === "UTAH" ? "UTA" : code; }

function nbaGroupFor(position: string): string {
  return NBA_DEPTH_GROUPS.find((group) => group.positions.includes(position))?.title ?? position;
}

function NbaScheduleStrip({ compact = false }: { compact?: boolean }) {
  const overview = useQuery({ queryKey: ["nba-overview", "current"], queryFn: () => api.getNbaOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const injuries = useKeyInjuries("nba");
  if (overview.isPending) return <div className="slate-loading">Loading the official NBA slate…</div>;
  if (overview.isError || !overview.data) return <div className="inline-error slate-error"><strong>NBA schedule unavailable.</strong><button onClick={() => overview.refetch()}>Retry</button></div>;
  const data = overview.data;
  const live = data.games.filter((g) => g.state === "live");
  const games = compact ? [...live, ...data.games.filter((g) => g.state !== "live")].slice(0, 6) : data.games;
  const stateLabel = (g: NbaOverview["games"][number]) => g.state === "final" ? "Final" : g.state === "live" ? g.detail || "Live" : dateTime(g.startsAt);
  return <section className="slate-section">
    <div className="section-heading"><div><p className="kicker">OFFICIAL NBA SCHEDULE</p><h3>{compact ? "Tonight on the hardwood" : "Scores & schedule"}</h3></div><span>Updated {dateTime(data.fetchedAt)}</span></div>
    {games.length ? <div className="slate-grid">{games.map((game) => <article className="game-tile" key={game.id}>
      <div className="game-time"><span>{nbaGameDate(game.date)}</span><b>{stateLabel(game)}</b></div>
      <div className="score-team"><strong>{game.away.name}</strong><TeamWatchStar sport="nba" team={nbaClientTeam(game.away.abbrev)} name={game.away.name} /><b>{game.away.score ?? "—"}</b></div>
      <div className="score-team"><strong>{game.home.name}</strong><TeamWatchStar sport="nba" team={nbaClientTeam(game.home.abbrev)} name={game.home.name} /><b>{game.home.score ?? "—"}</b></div><InjuryChips sport="nba" awayCode={game.away.abbrev} homeCode={game.home.abbrev} injuries={injuries.data ?? null} />
    </article>)}</div> : <div className="history-empty"><strong>No games on today's official slate.</strong><span>Future games will appear when the NBA schedule posts them.</span></div>}
    <div className="source-box"><span>Source</span><a href={data.scheduleSourceUrl} target="_blank" rel="noreferrer">ESPN NBA scoreboard ↗</a><small>2026–27 regular season · keyless feed</small></div>
  </section>;
}

function NbaLeagueView() {
  const overview = useQuery({ queryKey: ["nba-overview", "current"], queryFn: () => api.getNbaOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const [conference, setConference] = useState("All");
  if (overview.isPending) return <div className="loading"><span />Loading NBA schedule and standings…</div>;
  if (overview.isError || !overview.data) return <div className="error-state"><h2>League center is between quarters.</h2><p>The ESPN feed did not answer.</p><button onClick={() => overview.refetch()}>Retry</button></div>;
  const standings = overview.data.standings.filter((row) => conference === "All" || row.conference === conference);
  return <><NbaScheduleStrip/><section className="standings-section">
    <div className="section-heading"><div><p className="kicker">LEAGUE TABLE</p><h3>2026–27 standings</h3></div><span>{overview.data.standings.length} clubs</span></div>
    <div className="metric-tabs"><button className={conference === "All" ? "active" : ""} onClick={() => setConference("All")}>All</button>{["East", "West"].map((name) => <button key={name} className={conference === name ? "active" : ""} onClick={() => setConference(name)}>{name}</button>)}</div>
    <div className="standings-scroll"><div className="standings-table" role="table">
      <div className="standings-row header" role="row"><span>Team</span><span>W</span><span>L</span><span>PF</span><span>PA</span><span>DIFF</span></div>
      {standings.map((row, index) => <div className="standings-row" role="row" key={row.team}><span><b>{index + 1}</b><strong>{row.name}</strong><small>{row.division}</small><span className="standings-star"><TeamWatchStar sport="nba" team={nbaClientTeam(row.team)} name={row.name} /></span></span><span><b>{row.wins}</b></span><span>{row.losses}</span><span>{row.pointsFor}</span><span>{row.pointsAgainst}</span><span className={row.pointsFor - row.pointsAgainst > 0 ? "positive" : ""}>{row.pointsFor - row.pointsAgainst > 0 ? "+" : ""}{row.pointsFor - row.pointsAgainst}</span></div>)}
    </div></div>
    <div className="source-box"><span>Source</span><a href={overview.data.standingsSourceUrl} target="_blank" rel="noreferrer">ESPN NBA standings ↗</a><small>Point differential is computed from the listed official totals.</small></div>
  </section></>;
}

function NbaMatchupCalculator() {
  const [awayTeam, setAwayTeam] = useState<NbaTeamCode>("BOS");
  const [homeTeam, setHomeTeam] = useState<NbaTeamCode>("NY");
  const [matchup, setMatchup] = useState<{ away: NbaTeamCode; home: NbaTeamCode }>({ away: "BOS", home: "NY" });
  const overview = useQuery({ queryKey: ["nba-overview", "current"], queryFn: () => api.getNbaOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const board = useQuery({ queryKey: ["premium-board", "nba"], queryFn: () => api.getPremiumBoard({ sport: "nba" }), retry: false });
  const boardGroups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const result = useQuery({ queryKey: ["nba-matchup", matchup.away, matchup.home], queryFn: () => api.getNbaMatchup({ awayTeam: nbaServerTeam(matchup.away) as NbaTeamCode, homeTeam: nbaServerTeam(matchup.home) as NbaTeamCode, force: false }), retry: 1 });
  const scorers = useQuery({ queryKey: ["likely-scorers", "nba"], queryFn: () => api.getLikelyScorers({ sport: "nba" }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const injuries = useKeyInjuries("nba");
  const refresh = useMutation({ mutationFn: () => api.getNbaMatchup({ awayTeam: nbaServerTeam(matchup.away) as NbaTeamCode, homeTeam: nbaServerTeam(matchup.home) as NbaTeamCode, force: true }), onSuccess: () => result.refetch() });
  const data: NbaMatchup | undefined = result.data;
  const chooseGame = (away: string, home: string) => {
    const awayClient = nbaClientTeam(away); const homeClient = nbaClientTeam(home);
    if (!nbaTeams.some((t) => t.code === awayClient) || !nbaTeams.some((t) => t.code === homeClient)) return;
    const next = { away: awayClient as NbaTeamCode, home: homeClient as NbaTeamCode };
    setAwayTeam(next.away); setHomeTeam(next.home); setMatchup(next);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (awayTeam !== homeTeam) setMatchup({ away: awayTeam, home: homeTeam }); };
  const modelChart = data ? [
    { metric: "1H over 115.5", probability: Number(((data.firstHalfOver115Probability ?? 0) * 100).toFixed(1)) },
    { metric: "Blowout 15+", probability: Number(((data.blowoutProbability ?? 0) * 100).toFixed(1)) },
    { metric: "Both 110+", probability: Number(((data.bothTeams110Probability ?? 0) * 100).toFixed(1)) },
    { metric: "Overtime", probability: Number(((data.overtimeProbability ?? 0) * 100).toFixed(1)) },
  ] : [];
  const teamChart = data ? [
    { team: data.away.team, "Score first": Number(((data.away.firstBasketPct ?? 0) * 100).toFixed(1)), "Allow first": Number((((data.away.firstBasketGames - data.away.firstBasket) / Math.max(1, data.away.firstBasketGames)) * 100).toFixed(1)) },
    { team: data.home.team, "Score first": Number(((data.home.firstBasketPct ?? 0) * 100).toFixed(1)), "Allow first": Number((((data.home.firstBasketGames - data.home.firstBasket) / Math.max(1, data.home.firstBasketGames)) * 100).toFixed(1)) },
  ] : [];
  const slateGames = overview.data?.games.filter((g) => g.state !== "final") ?? [];
  return <section className="matchup-lab">
    <div className="matchup-heading"><div><p className="kicker">MATCHUP CALCULATOR</p><h1>Who takes it?</h1><p>Predict the winner, compare first-basket chances, and read first-half and full-game scripts from official recent results.</p></div>{data && <button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Recalculating…" : "Refresh data"}</button>}</div>
    {slateGames.length > 0 && <div className="slate-flips" aria-label="Today's NBA matchups with model flip percentages">{slateGames.slice(0, 12).map((game) => <SlateFlipCard key={game.id} awayAbbrev={game.away.abbrev} homeAbbrev={game.home.abbrev} standings={overview.data?.standings ?? null} active={matchup.away === nbaClientTeam(game.away.abbrev) && matchup.home === nbaClientTeam(game.home.abbrev)} onPick={() => chooseGame(game.away.abbrev, game.home.abbrev)} />)}</div>}
    <form className="matchup-form" onSubmit={submit}>
      <label>Away team<select value={awayTeam} onChange={(event) => setAwayTeam(event.target.value as NbaTeamCode)}>{nbaTeams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <span aria-hidden="true">@</span>
      <label>Home team<select value={homeTeam} onChange={(event) => setHomeTeam(event.target.value as NbaTeamCode)}>{nbaTeams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <button className="primary" type="submit" disabled={awayTeam === homeTeam || result.isFetching}>{result.isFetching ? "Calculating…" : "Calculate matchup"}</button>
    </form>
    {awayTeam === homeTeam && <p className="calculator-note error" role="alert">Choose two different teams.</p>}
    {result.isPending ? <div className="loading calculator-loading"><span />Reading recent game data…</div> : result.isError ? <div className="error-state calculator-error"><h2>Matchup data is unavailable.</h2><p>{result.error instanceof Error ? result.error.message : "The ESPN feed did not answer."}</p><button onClick={() => result.refetch()}>Retry</button></div> : data ? <>
      <section className="winner-card">
        <div className="section-heading"><div><p className="kicker">GAME WINNER</p><h2>{data.winnerTeam ? `${data.winnerTeam} to win` : "Insufficient sample"}</h2></div><span>{data.winnerTeam ? `${data.winnerTeam} +${data.winnerEdgePoints?.toFixed(1) ?? "0.0"} pts` : "No model edge"}</span></div>
        <div className="winner-score"><div><span>{data.away.team} · away</span><strong>{percentage(data.awayWinProbability)}</strong><small>{data.away.wins}/{data.away.games} recent wins</small></div><div className="winner-track" role="img" aria-label={`${data.away.team} ${percentage(data.awayWinProbability)} and ${data.home.team} ${percentage(data.homeWinProbability)} predicted win probability`}><i style={{ width: `${(data.awayWinProbability ?? .5) * 100}%` }}/><b style={{ width: `${(data.homeWinProbability ?? .5) * 100}%` }}/></div><div className="home"><span>{data.home.team} · home</span><strong>{percentage(data.homeWinProbability)}</strong><small>{data.home.wins}/{data.home.games} recent wins</small></div></div>
        <InjuryChips sport="nba" awayCode={matchup.away} homeCode={matchup.home} injuries={injuries.data ?? null} scorers={scorers.data ?? null} />
        <p className="winner-explain">The winner model blends each club's recent win rate with the opponent's loss rate, weighting away and home splits when at least three matching games exist. This is a model estimate, not a sportsbook line.</p>
      </section>
      {data && <ModelVsBooks sport="nba" awayCode={data.away.team} homeCode={data.home.team} awayModel={data.awayWinProbability} homeModel={data.homeWinProbability} groups={boardGroups} />}
      {data && <MatchupScorersSection sport="nba" awayCode={data.away.team} homeCode={data.home.team} />}
      <section className="first-goal-card">
        <div className="section-heading"><div><p className="kicker">MODEL ESTIMATE</p><h2>First basket probability</h2></div><span>{data.firstBasketEdgeTeam ? `${data.firstBasketEdgeTeam} +${data.firstBasketEdgePoints?.toFixed(1) ?? "0.0"} pts` : "Insufficient sample"}</span></div>
        <div className="first-goal-score"><div><span>{data.away.team} · away</span><strong>{percentage(data.firstBasketAwayProbability)}</strong></div><div className="first-goal-track" role="img" aria-label={`${data.away.team} ${percentage(data.firstBasketAwayProbability)} and ${data.home.team} ${percentage(data.firstBasketHomeProbability)} to score first`}><i style={{ width: `${(data.firstBasketAwayProbability ?? .5) * 100}%` }}/><b style={{ width: `${(data.firstBasketHomeProbability ?? .5) * 100}%` }}/></div><div className="home"><span>{data.home.team} · home</span><strong>{percentage(data.firstBasketHomeProbability)}</strong></div></div>
        <p className="model-explain">Estimate blends each club's recent first-basket rate, venue split when at least three matching games exist, and how often the opponent allowed the opening basket. It is a statistical model, not a sportsbook line.</p>
      </section>
      <section className="scenario-grid" aria-label="Matchup model estimates">
        <article><span>1st half over 115.5</span><strong>{percentage(data.firstHalfOver115Probability)}</strong><small>116 or more first-half points</small></article>
        <article><span>Blowout game</span><strong>{percentage(data.blowoutProbability)}</strong><small>Final margin of 15 or more</small></article>
        <article><span>Both teams 110+</span><strong>{percentage(data.bothTeams110Probability)}</strong><small>Each club scores at least 110</small></article>
        <article><span>Overtime</span><strong>{percentage(data.overtimeProbability)}</strong><small>Game goes beyond regulation</small></article>
      </section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">GAME SCRIPT</p><h3>Matchup probabilities</h3></div><span>Model estimates</span></div><div className="scenario-chart" role="img" aria-label="Bar chart of first half over 115.5, blowout, both teams 110 plus, and overtime probabilities"><ResponsiveContainer width="100%" height="100%"><BarChart data={modelChart} layout="vertical" margin={{ top: 4, right: 26, bottom: 4, left: 12 }}><CartesianGrid stroke="var(--rule)" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="metric" width={92} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`, "Model estimate"]}/><Bar dataKey="probability" fill="var(--orange)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">RECENT TENDENCY</p><h3>First-basket profile</h3></div><span>Last {Math.max(data.away.games, data.home.games)} games max</span></div><div className="team-tendency-chart" role="img" aria-label="Team scored first and allowed first percentages"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="team" axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`]}/><Legend/><Bar dataKey="Score first" fill="var(--green)" radius={[3,3,0,0]}/><Bar dataKey="Allow first" fill="var(--red)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
        <div className="team-sample-grid"><div><strong>{data.away.team}</strong><span>{data.away.firstBasket}/{data.away.firstBasketGames} scored first</span><small>{data.away.venueGames} recent away games in venue split</small></div><div><strong>{data.home.team}</strong><span>{data.home.firstBasket}/{data.home.firstBasketGames} scored first</span><small>{data.home.venueGames} recent home games in venue split</small></div></div>
      </section>
      <section className="head-to-head"><div><span>Recent head-to-head</span><strong>{data.headToHead.games ? `${data.away.team} ${data.headToHead.awayWins} · ${data.home.team} ${data.headToHead.homeWins}` : "No games in sample"}</strong></div><p>{data.sampleNote}</p></section>
      <div className="source-box"><span>Source</span><a href={data.sourceUrl} target="_blank" rel="noreferrer">ESPN NBA scoreboard ↗</a><small>Calculated {dateTime(data.fetchedAt)} · cached 12 hours</small></div>
    </> : null}
  </section>;
}

function NbaPlayerSheet({ player, team, onClose }: { player: NbaPlayer; team: NbaTeamCode; onClose: () => void }) {
  const log = useQuery({ queryKey: ["nba-player-log", team, player.id], queryFn: () => api.getNbaPlayerGameLog({ team: nbaServerTeam(team) as NbaTeamCode, playerId: player.id }), retry: false });
  const metrics = [
    { id: "points", label: "PTS" }, { id: "rebounds", label: "REB" }, { id: "assists", label: "AST" },
    { id: "steals", label: "STL" }, { id: "blocks", label: "BLK" },
  ];
  const [metric, setMetric] = useState("points");
  const games = log.data?.games ?? [];
  const metricValue = (game: NbaPlayerGameLog["games"][number], id: string): number | null => {
    if (id === "points") return game.points;
    if (id === "rebounds") return game.rebounds;
    if (id === "assists") return game.assists;
    if (id === "steals") return game.steals;
    if (id === "blocks") return game.blocks;
    return null;
  };
  const chartData = games.slice(0, 8).reverse().map((game) => ({
    date: nbaGameDate(game.gameDate),
    points: game.points, rebounds: game.rebounds, assists: game.assists, steals: game.steals, blocks: game.blocks,
  }));
  const lastFive = games.slice(0, 5);
  const seasonAverage = average(games.map((game) => metricValue(game, metric)));
  const lastFiveAverage = average(lastFive.map((game) => metricValue(game, metric)));
  const modelProjection = seasonAverage === null ? null : seasonAverage * .5 + (lastFiveAverage ?? seasonAverage) * .5;
  const metricLabel = metrics.find((item) => item.id === metric)?.label ?? "Stat";
  const totals = (fn: (g: NbaPlayerGameLog["games"][number]) => number | null) => lastFive.reduce((s, g) => s + (fn(g) ?? 0), 0);
  const [sheetTab, setSheetTab] = useState<"overview" | "trend" | "last5" | "log">("overview");
  const perGame = (total: number | null) => player.games ? ((total ?? 0) / player.games).toFixed(1) : "—";

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet player-sheet" role="dialog" aria-modal="true" aria-labelledby="nba-player-stats-title">
      <button className="close" onClick={onClose} aria-label="Close player stats">×</button>
      <p className="kicker">{team} PLAYER FILE · NBA</p>
      <div className="sheet-title-row"><h2 id="nba-player-stats-title">{player.name}</h2><PlayerWatchStar sport="nba" playerId={player.id} team={team} name={player.name} position={player.position} /></div>
      <p className="matchup">{player.jersey ? `#${player.jersey} · ` : ""}{player.position} · 2026–27 regular season</p>
      <div className="player-season-line">
        <div><span>Games</span><strong>{player.games ?? "—"}</strong></div>
        <div><span>PPG</span><strong>{perGame(player.points)}</strong></div>
        <div><span>RPG</span><strong>{perGame(player.rebounds)}</strong></div>
        <div><span>APG</span><strong>{perGame(player.assists)}</strong></div>
        <div><span>SPG</span><strong>{perGame(player.steals)}</strong></div>
        <div><span>BPG</span><strong>{perGame(player.blocks)}</strong></div>
      </div>
      <div className="sheet-tabs" role="tablist" aria-label="Player stat sections">
        {(["overview", "trend", "last5", "log"] as const).map((tab) => <button key={tab} role="tab" aria-selected={sheetTab === tab} className={sheetTab === tab ? "active" : ""} onClick={() => setSheetTab(tab)}>{tab === "overview" ? "Overview" : tab === "trend" ? "Trend" : tab === "last5" ? "Last 5" : "Game log"}</button>)}
      </div>
      {log.isPending ? <div className="player-log-loading"><span />Loading game-by-game stats…</div> : log.isError ? <div className="inline-log-error"><strong>Game log unavailable.</strong><span>{log.error instanceof Error ? log.error.message : "Try again shortly."}</span><button onClick={() => log.refetch()}>Retry</button></div> : games.length === 0 ? <div className="history-empty"><strong>No games logged yet.</strong><span>The graph, projection and last-five record will populate after official game data posts.</span></div> : <>
        {sheetTab === "overview" && <section className="model-panel">
          <div><p className="kicker">DAILY HAM MODEL</p><h3>{metricLabel} projection</h3><span>Statistical projection — not a market lean</span></div>
          <strong>{modelProjection === null ? "—" : modelProjection.toFixed(1)}</strong>
          <div className="model-inputs"><span>Season <b>{seasonAverage?.toFixed(1) ?? "—"}</b></span><span>Last 5 <b>{lastFiveAverage?.toFixed(1) ?? "—"}</b></span></div>
          <p>Weighted from official season and last-5 game logs. Missing context stays neutral.</p>
        </section>}
        {sheetTab === "trend" && <section className="trend-section">
          <div className="section-heading"><div><p className="kicker">RECENT TREND</p><h3>Last {Math.min(8, games.length)} games</h3></div><span>{metricLabel}</span></div>
          <div className="metric-tabs" aria-label="Chart stat">{metrics.map((item) => <button key={item.id} className={metric === item.id ? "active" : ""} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div>
          <div className="player-trend-chart" role="img" aria-label={`${player.name} ${metricLabel} over the last ${Math.min(8, games.length)} games`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 14, right: 10, bottom: 0, left: -22 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Line type="monotone" dataKey={metric} stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: "var(--paper)", strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer></div>
        </section>}
        {sheetTab === "last5" && <section className="last-five-section">
          <div className="section-heading"><div><p className="kicker">FORM CHECK</p><h3>Last five</h3></div><span>{lastFive.length} official games</span></div>
          <div className="last-five-summary"><div><span>PTS</span><strong>{totals((g) => g.points)}</strong></div><div><span>REB</span><strong>{totals((g) => g.rebounds)}</strong></div><div><span>AST</span><strong>{totals((g) => g.assists)}</strong></div><div><span>STL+BLK</span><strong>{totals((g) => (g.steals ?? 0) + (g.blocks ?? 0))}</strong></div></div>
          <div className="game-card-list">{lastFive.map((game) => <article className="game-card" key={game.gameId}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{nbaGameDate(game.gameDate)} · {game.result} {game.teamScore}-{game.oppScore}</span></div></div><div className="game-stat-grid"><div><span>Scoring</span><b>{game.points ?? "—"} PTS</b></div><div><span>Boards</span><b>{game.rebounds ?? "—"} REB</b></div><div><span>Playmaking</span><b>{game.assists ?? "—"} AST</b></div></div></article>)}</div>
        </section>}
        {sheetTab === "log" && <details className="full-log" open><summary>Full season game log <span>{games.length} games</span></summary><div className="game-card-list compact">{games.map((game) => <article className="game-card" key={`full-${game.gameId}`}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{nbaGameDate(game.gameDate)} · {game.result} {game.teamScore}-{game.oppScore}</span></div></div><div className="game-stat-grid"><div><span>PTS</span><b>{game.points ?? "—"}</b></div><div><span>REB</span><b>{game.rebounds ?? "—"}</b></div><div><span>AST</span><b>{game.assists ?? "—"}</b></div><div><span>STL</span><b>{game.steals ?? "—"}</b></div><div><span>BLK</span><b>{game.blocks ?? "—"}</b></div><div><span>FG</span><b>{game.fieldGoalsMade ?? "—"}/{game.fieldGoalsAttempted ?? "—"}</b></div><div><span>3PT</span><b>{game.threePointMade ?? "—"}/{game.threePointAttempted ?? "—"}</b></div><div><span>FT</span><b>{game.freeThrowsMade ?? "—"}/{game.freeThrowsAttempted ?? "—"}</b></div></div></article>)}</div></details>}
        <div className="source-box"><span>Source</span><a href={log.data?.sourceUrl} target="_blank" rel="noreferrer">ESPN NBA game data ↗</a><small>Fetched {log.data ? dateTime(log.data.fetchedAt) : "—"}</small></div>
      </>}
    </section>
  </div>;
}

function NbaRosterView({ parlay, setParlay, teamFocus }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; teamFocus: { sport: League; team: string; nonce: number } | null }) {
  const [team, setTeam] = useState<NbaTeamCode>("BOS");
  useEffect(() => {
    if (teamFocus && teamFocus.sport === "nba" && nbaTeams.some((t) => t.code === nbaClientTeam(teamFocus.team))) setTeam(nbaClientTeam(teamFocus.team) as NbaTeamCode);
  }, [teamFocus]);
  const [selectedPlayer, setSelectedPlayer] = useState<NbaPlayer | null>(null);
  const [watched, setWatched] = useState(0);
  const nba = useQuery({ queryKey: ["nba-roster", team], queryFn: () => api.getNbaRoster({ team: nbaServerTeam(team) as NbaTeamCode }) });
  const teamBoard = useQuery({ queryKey: ["premium-board", "nba"], queryFn: () => api.getPremiumBoard({ sport: "nba" }), retry: false });
  const nbaOverview = useQuery({ queryKey: ["nba-overview", "current"], queryFn: () => api.getNbaOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const selectedTeamName = nbaTeams.find((item) => item.code === team)?.name ?? team;
  const teamMoneylines = useMemo(() => moneylinePicks(groupPremiumOffers(teamBoard.data?.offers ?? [])).filter((group) => group.matchup.includes(selectedTeamName)), [teamBoard.data, selectedTeamName]);
  useEffect(() => {
    const onChange = () => setWatched((w) => w + 1);
    window.addEventListener("dh-watchlist-change", onChange);
    return () => window.removeEventListener("dh-watchlist-change", onChange);
  }, []);
  void watched;

  return (
    <>
    <section className="roster-panel">
      <div className="roster-title"><div><p className="kicker">OFFICIAL NBA ROSTERS</p><h2>Team stats & player trends</h2><p className="roster-intro">Tap any player to open graphs, last-five form and the complete game log. Star a player to add them to your Watchlist.</p></div>{nba.data && <span>Updated {dateTime(nba.data.fetchedAt)}</span>}</div>
      <label className="select-label" htmlFor="nba-team">Team</label>
      <select id="nba-team" value={team} onChange={(e) => { setTeam(e.target.value as NbaTeamCode); setSelectedPlayer(null); }}>{nbaTeams.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
      {teamMoneylines.length > 0 && <section className="team-moneyline"><div className="section-heading"><div><p className="kicker">NEXT GAME</p><h3>Moneyline board</h3></div><span>Best · DraftKings · FanDuel · BetMGM</span></div><div className="moneyline-grid">{teamMoneylines.map((group) => { const side = strongestSide(group); if (!side) return null; const added = parlay.some((item) => item.id === side.id); const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side }; return <article className="moneyline-card" key={group.id}><div className="moneyline-open"><small>{group.matchup}</small><h4>{group.entity}</h4><div><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DraftKings <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>FanDuel <b>{formatAmerican(side.fanDuel?.odds ?? null)}</b></span><span>BetMGM <b>{formatAmerican(side.betMGM?.odds ?? null)}</b></span></div><FlipMeter sport="nba" market={group} nhlStandings={null} nflStandings={null} nbaStandings={nbaOverview.data?.standings ?? null} /><p className={side.evPercent !== null && side.evPercent > 0 ? "signal positive" : "signal"}>{side.evPercent !== null && side.evPercent > 0 ? `+${side.evPercent.toFixed(1)}% fair-odds EV` : "Market favorite"}</p></div><button className={added ? "pick-button added" : "pick-button"} onClick={() => setParlay(added ? parlay.filter((item) => item.id !== side.id) : [...parlay, pick])}>{added ? "Remove" : "Add ML"}</button></article>;})}</div></section>}
      {nba.isPending ? (
        <div className="loading"><span />Loading official roster…</div>
      ) : nba.isError ? (
        <div className="inline-error">Official NBA data is temporarily unavailable. <button onClick={() => nba.refetch()}>Retry</button></div>
      ) : nba.data ? (
        <>
          <div className="roster-summary"><div><b>{nba.data.players.length}</b><span>players</span></div><div><b>{nba.data.players.filter((p) => ["PG", "SG", "G"].includes(p.position)).length}</b><span>guards</span></div><div><b>{nba.data.players.filter((p) => ["SF", "PF", "F"].includes(p.position)).length}</b><span>forwards</span></div><div><b>{nba.data.players.filter((p) => p.position === "C").length}</b><span>centers</span></div></div>
          <div className="table-scroll"><div className="roster-table" role="table">
            <div className="roster-header" role="row"><span>Player</span><span>GP</span><span>PPG</span><span>RPG</span><span>APG</span></div>
            {nba.data.players.map((player) => {
              const starredEntry = { playerId: player.id, team, name: player.name, position: player.position };
              const ppg = player.games ? ((player.points ?? 0) / player.games).toFixed(1) : "—";
              const rpg = player.games ? ((player.rebounds ?? 0) / player.games).toFixed(1) : "—";
              const apg = player.games ? ((player.assists ?? 0) / player.games).toFixed(1) : "—";
              const spg = player.games ? ((player.steals ?? 0) / player.games).toFixed(1) : "—";
              const bpg = player.games ? ((player.blocks ?? 0) / player.games).toFixed(1) : "—";
              const nbaStats: [string, string][] = [["GP", `${player.games ?? "—"}`], ["PPG", ppg], ["RPG", rpg], ["APG", apg], ["STL", spg], ["BLK", bpg]];
              return <div className="roster-card" key={player.id}>
                <button className="roster-card-main" onClick={() => setSelectedPlayer(player)} aria-label={`Open ${player.name} game log and charts`}>
                  <span className="roster-card-head"><b>{player.jersey ? `#${player.jersey} ` : ""}{player.name}</b><small>{player.position}</small></span>
                  <span className="roster-stat-grid">{nbaStats.map(([label, value]) => <span key={label} className="roster-stat"><small>{label}</small><b>{value}</b></span>)}</span>
                </button>
                <PlayerWatchStar sport="nba" playerId={starredEntry.playerId} team={starredEntry.team} name={starredEntry.name} position={starredEntry.position} />
              </div>;
            })}
          </div></div>
          <div className="source-box"><span>Source</span><a href={nba.data.sourceUrl} target="_blank" rel="noreferrer">ESPN NBA data ↗</a><small>2026–27 regular season · aggregated from official game logs</small></div>
        </>
      ) : null}
    </section>
    {selectedPlayer && <NbaPlayerSheet key={selectedPlayer.id} player={selectedPlayer} team={team} onClose={() => setSelectedPlayer(null)} />}
    </>
  );
}

function NbaHotStreaksView() {
  const [category, setCategory] = useState("Heat index");
  const [selected, setSelected] = useState<{ player: NbaPlayer; team: NbaTeamCode } | null>(null);
  const hot = useQuery({ queryKey: ["nba-hot-streaks"], queryFn: () => api.getNbaHotStreaks({ force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getNbaHotStreaks({ force: true }), onSuccess: () => hot.refetch() });
  const players = [...(hot.data?.players ?? [])].sort((a, b) => {
    if (category === "Point streak") return b.pointStreak - a.pointStreak || b.lastFivePoints - a.lastFivePoints;
    if (category === "Double-double streak") return b.doubleDoubleStreak - a.doubleDoubleStreak || b.lastFivePoints - a.lastFivePoints;
    if (category === "Last-5 points") return b.lastFivePoints - a.lastFivePoints;
    if (category === "Last-5 assists") return b.lastFiveAssists - a.lastFiveAssists;
    return b.heatScore - a.heatScore;
  });
  const toPlayer = (row: NbaHotStreaks["players"][number]): NbaPlayer => ({
    id: row.playerId, name: row.name, jersey: null, position: row.position, group: nbaGroupFor(row.position),
    games: row.games.length, points: row.games.reduce((s, g) => s + g.points, 0), rebounds: row.games.reduce((s, g) => s + g.rebounds, 0),
    assists: row.games.reduce((s, g) => s + g.assists, 0), steals: row.games.reduce((s, g) => s + (g.steals ?? 0), 0), blocks: row.games.reduce((s, g) => s + (g.blocks ?? 0), 0),
    turnovers: null, minutes: null,
  });
  return <section className="hot-section"><div className="roster-title"><div><p className="kicker">HOT STREAKS · NBA</p><h2>Who's cooking right now</h2><p className="roster-intro">Every qualifying streak is calculated from official recent NBA game data. Tap a player for the full stat file.</p></div>{hot.data && <div className="roster-update"><span>Updated {dateTime(hot.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh streaks"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Heat index", "Point streak", "Double-double streak", "Last-5 points", "Last-5 assists"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{hot.isPending ? <div className="loading"><span />Reading recent NBA game data…</div> : hot.isError ? <div className="error-state"><h2>Streak board unavailable.</h2><p>The ESPN feed did not answer.</p><button onClick={() => hot.refetch()}>Retry</button></div> : players.length === 0 ? <div className="history-empty"><strong>No qualifying streaks in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying hot signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <div className="hot-row-wrap" key={row.playerId}><button className="hot-row" onClick={() => setSelected({ player: toPlayer(row), team: nbaClientTeam(row.team) as NbaTeamCode })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · NBA</small></span><span className="streak-badges">{row.pointStreak >= 2 && <b>{row.pointStreak}G 20+ PTS</b>}{row.doubleDoubleStreak >= 2 && <b>{row.doubleDoubleStreak}G dbl-dbl</b>}</span><span className="hot-totals"><b>{row.lastFivePoints} PTS</b><small>{row.lastFiveRebounds} REB · {row.lastFiveAssists} AST · last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`${nbaGameDate(game.date)} vs ${game.opponent}`}>{game.points} PTS · {game.rebounds} REB · {game.assists} AST</i>)}</span></button><PlayerWatchStar sport="nba" playerId={row.playerId} team={nbaClientTeam(row.team)} name={row.name} position={row.position} /></div>)}</div>}{hot.data && <div className="source-box"><span>Source</span><a href={hot.data.sourceUrl} target="_blank" rel="noreferrer">ESPN NBA game data ↗</a><small>{nbaGameDate(hot.data.windowStart)}–{nbaGameDate(hot.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <NbaPlayerSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)} />}</section>;
}

function NbaCuttingBoard() {
  const [category, setCategory] = useState("Coldest");
  const [selected, setSelected] = useState<{ player: NbaPlayer; team: NbaTeamCode } | null>(null);
  const cold = useQuery({ queryKey: ["nba-cold-streaks"], queryFn: () => api.getNbaColdStreaks({ force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getNbaColdStreaks({ force: true }), onSuccess: () => cold.refetch() });
  const showTeams = category === "Teams";
  const players = [...(cold.data?.players ?? [])].sort((a, b) => {
    if (category === "Scoring drought") return b.scoringDrought - a.scoringDrought || b.coldScore - a.coldScore;
    if (category === "Point drought") return a.lastFivePoints - b.lastFivePoints;
    return b.coldScore - a.coldScore;
  });
  const teams = [...(cold.data?.teams ?? [])].sort((a, b) => b.losses - a.losses);
  const toPlayer = (row: NbaColdStreaks["players"][number]): NbaPlayer => ({
    id: row.playerId, name: row.name, jersey: null, position: row.position, group: nbaGroupFor(row.position),
    games: row.games.length, points: row.games.reduce((s, g) => s + g.points, 0), rebounds: row.games.reduce((s, g) => s + g.rebounds, 0),
    assists: row.games.reduce((s, g) => s + g.assists, 0), steals: row.games.reduce((s, g) => s + (g.steals ?? 0), 0), blocks: row.games.reduce((s, g) => s + (g.blocks ?? 0), 0),
    turnovers: null, minutes: null,
  });
  return <section className="hot-section cutting-board"><div className="roster-title"><div><p className="kicker">THE CUTTING BOARD · NBA</p><h2>Who's gone cold</h2><p className="roster-intro">Every slump is calculated from official recent NBA game data. Tap a player for the full stat file.</p></div>{cold.data && <div className="roster-update"><span>Updated {dateTime(cold.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh board"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Coldest", "Scoring drought", "Point drought", "Teams"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{cold.isPending ? <div className="loading"><span />Reading recent NBA game data…</div> : cold.isError ? <div className="error-state"><h2>Cutting board unavailable.</h2><p>The ESPN feed did not answer.</p><button onClick={() => cold.refetch()}>Retry</button></div> : showTeams ? (teams.length === 0 ? <div className="history-empty"><strong>No team on a 3+ game slide right now.</strong><span>Every team has won at least one of its last three.</span></div> : <div className="hot-list">{teams.map((row, index) => <div className="hot-row-wrap" key={row.team}><div className="hot-row"><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {row.gamesPlayed} GP</small></span><span className="streak-badges cold"><b>{row.streak} skid</b></span></div><TeamWatchStar sport="nba" team={nbaClientTeam(row.team)} name={row.name} /></div>)}</div>) : players.length === 0 ? <div className="history-empty"><strong>No qualifying slumps in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying cold signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <div className="hot-row-wrap" key={row.playerId}><button className="hot-row" onClick={() => setSelected({ player: toPlayer(row), team: nbaClientTeam(row.team) as NbaTeamCode })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · NBA</small></span><span className="streak-badges cold">{row.scoringDrought >= 2 && <b>{row.scoringDrought}G scoring drought</b>}</span><span className="hot-totals"><b>{row.lastFivePoints} PTS</b><small>last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`${nbaGameDate(game.date)} vs ${game.opponent}`}>{game.points} PTS · {game.rebounds} REB · {game.assists} AST</i>)}</span></button><PlayerWatchStar sport="nba" playerId={row.playerId} team={nbaClientTeam(row.team)} name={row.name} position={row.position} /></div>)}</div>}{cold.data && <div className="source-box"><span>Source</span><a href={cold.data.sourceUrl} target="_blank" rel="noreferrer">ESPN NBA game data ↗</a><small>{nbaGameDate(cold.data.windowStart)}–{nbaGameDate(cold.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <NbaPlayerSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)} />}</section>;
}

// ---------------------------------------------------------------------------
// Soccer views. Mirror the NBA sections: league picker (MLS | Premier
// League), schedule strip, league table, matchup calculator (three-way),
// rosters + player files, hot streaks — all on ESPN keyless feeds.
// The server leg is landing in parallel: every view below fails gracefully
// (nothing invented, sections hidden) until the getSoccer* actions resolve.
// ---------------------------------------------------------------------------

function soccerGameDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)); }

const SOCCER_DEPTH_GROUPS: { title: string; positions: string[] }[] = [
  { title: "Goalkeepers", positions: ["GK"] },
  { title: "Defenders", positions: ["DF", "D"] },
  { title: "Midfielders", positions: ["MF", "M"] },
  { title: "Forwards", positions: ["FW", "F", "ST"] },
];

function SoccerLeagueTabs({ league, onLeagueChange }: { league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void }) {
  if (!onLeagueChange) return null;
  return <div className="metric-tabs" role="tablist" aria-label="Soccer league">{SOCCER_LEAGUES.map((l) => <button key={l.code} type="button" role="tab" aria-selected={league === l.code} className={league === l.code ? "active" : ""} onClick={() => onLeagueChange(l.code)}>{l.name}</button>)}</div>;
}

function soccerStateLabel(game: SoccerGame): string {
  if (game.state === "post" || game.state === "final") return "Final";
  if (game.state === "in" || game.state === "live") return game.detail || "Live";
  return dateTime(game.startsAt);
}

function SoccerScheduleStrip({ compact = false, league }: { compact?: boolean; league: SoccerLeague }) {
  const overview = useQuery({ queryKey: ["soccer-overview", league], queryFn: () => api.getSoccerOverview({ league }), staleTime: 15 * 60 * 1000, retry: 1 });
  const injuries = useSoccerKeyInjuries(league);
  if (overview.isPending) return <div className="slate-loading">Loading the official soccer slate…</div>;
  if (overview.isError || !overview.data) return <div className="inline-error slate-error"><strong>Soccer schedule unavailable.</strong><span>The league feed hasn't served this side yet.</span><button onClick={() => overview.refetch()}>Retry</button></div>;
  const data = overview.data;
  const live = data.games.filter((g) => g.state === "in" || g.state === "live");
  const games = compact ? [...live, ...data.games.filter((g) => g.state !== "in" && g.state !== "live")].slice(0, 6) : data.games;
  const leagueName = league === "epl" ? "Premier League" : "MLS";
  return <section className="slate-section">
    <div className="section-heading"><div><p className="kicker">OFFICIAL {leagueName.toUpperCase()} SCHEDULE</p><h3>{compact ? "Tonight on the pitch" : "Scores & schedule"}</h3></div><span>Updated {dateTime(data.fetchedAt)}</span></div>
    {games.length ? <div className="slate-grid">{games.map((game) => <article className="game-tile" key={game.id}>
      <div className="game-time"><span>{soccerGameDate(game.date)}</span><b>{soccerStateLabel(game)}</b></div>
      <div className="score-team"><strong>{game.away.name}</strong><TeamWatchStar sport="soccer" team={game.away.abbrev} name={game.away.name} /><b>{game.away.score ?? "—"}</b></div>
      <div className="score-team"><strong>{game.home.name}</strong><TeamWatchStar sport="soccer" team={game.home.abbrev} name={game.home.name} /><b>{game.home.score ?? "—"}</b></div><InjuryChips sport="soccer" awayCode={game.away.abbrev} homeCode={game.home.abbrev} injuries={injuries.data ?? null} />
    </article>)}</div> : <div className="history-empty"><strong>No games on today's official slate.</strong><span>Future games will appear when the {leagueName} schedule posts them.</span></div>}
    <div className="source-box"><span>Source</span><a href={data.scheduleSourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} scoreboard ↗</a><small>{String(data.season)} season · keyless feed</small></div>
  </section>;
}

function SoccerLeagueView({ league, onLeagueChange }: { league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void }) {
  const overview = useQuery({ queryKey: ["soccer-overview", league], queryFn: () => api.getSoccerOverview({ league }), staleTime: 15 * 60 * 1000, retry: 1 });
  if (overview.isPending) return <div className="loading"><span />Loading soccer schedule and standings…</div>;
  if (overview.isError || !overview.data) return <div className="error-state"><h2>League center is between matches.</h2><p>The league feed hasn't served this side yet.</p><button onClick={() => overview.refetch()}>Retry</button></div>;
  const data = overview.data;
  const leagueName = league === "epl" ? "Premier League" : "MLS";
  return <><SoccerScheduleStrip league={league} /><section className="standings-section">
    <div className="section-heading"><div><p className="kicker">LEAGUE TABLE</p><h3>{leagueName} standings</h3></div><span>{data.standings.length} clubs</span></div>
    <SoccerLeagueTabs league={league} onLeagueChange={onLeagueChange} />
    <div className="standings-scroll"><div className="standings-table" role="table">
      <div className="standings-row header" role="row"><span>Team</span><span>W</span><span>D</span><span>L</span><span>PTS</span><span>GD</span></div>
      {data.standings.map((row, index) => <div className="standings-row" role="row" key={row.team}><span><b>{index + 1}</b><strong>{row.name}</strong><span className="standings-star"><TeamWatchStar sport="soccer" team={row.team} name={row.name} /></span></span><span><b>{row.wins}</b></span><span>{row.draws}</span><span>{row.losses}</span><span><b>{row.points}</b></span><span className={row.goalsFor - row.goalsAgainst > 0 ? "positive" : ""}>{row.goalsFor - row.goalsAgainst > 0 ? "+" : ""}{row.goalsFor - row.goalsAgainst}</span></div>)}
    </div></div>
    <div className="source-box"><span>Source</span><a href={data.standingsSourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} standings ↗</a><small>Goal difference is computed from the listed official totals.</small></div>
  </section></>;
}

// Three-way Flip % for soccer: home / draw / away from the standings.
// Strength is points-per-game regressed toward the league average (1.37)
// until 8 games, with a simple home edge; the draw share comes from the two
// clubs' observed draw rate. Labeled a model estimate everywhere it renders.
function soccerFlipProbs(homeRow: SoccerStandingRow | null, awayRow: SoccerStandingRow | null): { home: number; draw: number; away: number } | null {
  if (!homeRow || !awayRow || homeRow.team === awayRow.team) return null;
  const gp = (r: SoccerStandingRow) => Math.max(1, r.wins + r.draws + r.losses);
  const strength = (r: SoccerStandingRow) => { const g = gp(r); return ((r.points / g) * Math.min(g, 8) + 1.37 * Math.max(0, 8 - g)) / 8; };
  const totalGames = gp(homeRow) + gp(awayRow);
  const drawRate = totalGames > 4 ? Math.min(0.35, Math.max(0.15, (homeRow.draws + awayRow.draws) / totalGames)) : 0.25;
  const hs = strength(homeRow) * 1.15;
  const as = strength(awayRow);
  const split = hs + as;
  if (split <= 0) return null;
  return { home: (hs / split) * (1 - drawRate), draw: drawRate, away: (as / split) * (1 - drawRate) };
}

function SoccerFlipBars({ homeAbbrev, awayAbbrev, probs }: { homeAbbrev: string; awayAbbrev: string; probs: { home: number; draw: number; away: number } }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return <>
    <div className="winner-track three-way" role="img" aria-label={`Model result probability: ${homeAbbrev} ${pct(probs.home)}, draw ${pct(probs.draw)}, ${awayAbbrev} ${pct(probs.away)}. Model estimate, not a sportsbook line.`}>
      <i style={{ width: `${probs.home * 100}%` }} /><u style={{ width: `${probs.draw * 100}%` }} /><b style={{ width: `${probs.away * 100}%` }} />
    </div>
    <div className="flip-labels three"><span>{homeAbbrev} <b>{pct(probs.home)}</b></span><span>Draw <b>{pct(probs.draw)}</b></span><span><b>{pct(probs.away)}</b> {awayAbbrev}</span></div>
  </>;
}

function soccerMarketTeamCodes(market: MarketGroup, standings: SoccerStandingRow[] | null): [string, string] | null {
  if (!standings || standings.length === 0) return null;
  const matchupParts = market.matchup.split(/@|vs\.?/i).map((part) => part.trim()).filter(Boolean);
  const candidates = matchupParts.length >= 2 ? matchupParts : [market.entity];
  const matchCode = (label: string): string | null => {
    const needle = label.toLowerCase();
    const row = standings.find((item) => {
      const name = (item.name ?? "").toLowerCase();
      const abbrev = (item.team ?? "").toLowerCase();
      return name !== "" && (needle === name || needle === abbrev || needle.includes(name) || name.includes(needle));
    });
    return row?.team ?? null;
  };
  const homeLabel = candidates[candidates.length - 1];
  const awayLabel = candidates[0];
  const away = awayLabel ? matchCode(awayLabel) : null;
  const home = homeLabel ? matchCode(homeLabel) : null;
  return away && home ? [away, home] : null;
}

function SoccerSlateFlipCard({ league, awayAbbrev, homeAbbrev, active, onPick }: {
  league: SoccerLeague; awayAbbrev: string; homeAbbrev: string; active: boolean; onPick: () => void;
}) {
  const overview = useQuery({ queryKey: ["soccer-overview", league], queryFn: () => api.getSoccerOverview({ league }), staleTime: 15 * 60 * 1000, retry: 1 });
  const standings = overview.data?.standings ?? null;
  const fixture = overview.data?.games.find((g) => g.away.abbrev === awayAbbrev && g.home.abbrev === homeAbbrev);
  // Prefer the server's Poisson fixture model when available; fall back to the
  // transparent record-based estimate.
  const serverProbs = fixture?.modelThreeWay ?? null;
  const probs = serverProbs ?? soccerFlipProbs(standings?.find((row) => row.team === homeAbbrev) ?? null, standings?.find((row) => row.team === awayAbbrev) ?? null);
  return <button className={active ? "slate-flip active" : "slate-flip"} onClick={onPick} aria-label={`Load ${awayAbbrev} at ${homeAbbrev} into the calculator`}>
    <strong>{awayAbbrev} @ {homeAbbrev}</strong>
    {probs ? <SoccerFlipBars homeAbbrev={homeAbbrev} awayAbbrev={awayAbbrev} probs={probs} /> : <span className="slate-flip-empty">Not enough games yet</span>}
  </button>;
}

function SoccerFlipMeter({ league, market }: { league: SoccerLeague; market: MarketGroup }) {
  const overview = useQuery({ queryKey: ["soccer-overview", league], queryFn: () => api.getSoccerOverview({ league }), staleTime: 15 * 60 * 1000, retry: 1 });
  const standings = overview.data?.standings ?? null;
  if (!standings || standings.length === 0) return null;
  const codes = soccerMarketTeamCodes(market, standings);
  if (!codes) return null;
  const homeRow = standings.find((row) => row.team === codes[1]) ?? null;
  const awayRow = standings.find((row) => row.team === codes[0]) ?? null;
  const probs = soccerFlipProbs(homeRow, awayRow);
  if (!probs || !homeRow || !awayRow) return null;
  return <div className="flip-meter">
    <div className="flip-head"><span>Flip %</span><em>model estimate</em></div>
    <SoccerFlipBars homeAbbrev={homeRow.team} awayAbbrev={awayRow.team} probs={probs} />
  </div>;
}

function isThreeWayGroup(group: MarketGroup): boolean {
  const text = `${group.marketName} ${group.stat} ${group.betType}`.toLowerCase();
  if (/moneyline|h2h|full.?time|match.?result|3.?way|1x2/.test(text)) return true;
  const sides = group.sides.map((s) => s.side.toLowerCase());
  return sides.length === 3 && sides.some((s) => s.includes("draw"));
}

// Split a three-way group's sides into home / draw / away outcomes,
// matching side labels against club names when the feed uses them.
function threeWaySides(group: MarketGroup, standings: SoccerStandingRow[] | null): { home: MarketSide | null; draw: MarketSide | null; away: MarketSide | null; homeCode: string | null; awayCode: string | null } {
  const codes = soccerMarketTeamCodes(group, standings);
  const homeName = codes ? standings?.find((r) => r.team === codes[1])?.name.toLowerCase() ?? "" : "";
  const awayName = codes ? standings?.find((r) => r.team === codes[0])?.name.toLowerCase() ?? "" : "";
  let home: MarketSide | null = null, draw: MarketSide | null = null, away: MarketSide | null = null;
  for (const side of group.sides) {
    const label = side.side.toLowerCase();
    if (label.includes("draw") || label === "x") { draw = side; continue; }
    if (homeName && (label === homeName || label.includes(homeName) || homeName.includes(label))) { home = side; continue; }
    if (awayName && (label === awayName || label.includes(awayName) || awayName.includes(label))) { away = side; continue; }
    if (["home", "1"].includes(label)) { home = side; continue; }
    if (["away", "2"].includes(label)) { away = side; continue; }
  }
  if (!home || !away) {
    const ordered = [...group.sides];
    home = home ?? ordered[0] ?? null;
    draw = draw ?? ordered[1] ?? null;
    away = away ?? ordered[ordered.length - 1] ?? null;
  }
  return { home, draw, away, homeCode: codes?.[1] ?? null, awayCode: codes?.[0] ?? null };
}

function topSoccerScorers(scorers: { teams: Record<string, { name: string; team: string; games: number; stat: number; rate: number }[]> }, awayCode: string, homeCode: string) {
  return [...(scorers.teams[awayCode] ?? []), ...(scorers.teams[homeCode] ?? [])]
    .sort((a, b) => b.rate - a.rate || b.stat - a.stat || a.name.localeCompare(b.name))
    .slice(0, 2);
}

function SoccerScorersStrip({ awayCode, homeCode, scorers }: { awayCode: string | null; homeCode: string | null; scorers: { teams: Record<string, { name: string; team: string; games: number; stat: number; rate: number }[]> } | null }) {
  if (!awayCode || !homeCode || !scorers) return null;
  const top = topSoccerScorers(scorers, awayCode, homeCode);
  if (top.length === 0) return null;
  return <div className="scorer-strip">
    <div className="scorer-head"><span>🎯 Likely scorers</span><em>season leaders</em></div>
    <div className="scorer-names">{top.map((player) => <span key={`${player.team}-${player.name}`}><b>{player.name}</b><i>{player.team} · {player.stat}G</i></span>)}</div>
    <small className="scorer-note">Most goals per game this season — a stat, not a sportsbook line.</small>
  </div>;
}

function SoccerBoardView({ league, onLeagueChange, parlay, setParlay, home = false }: {
  league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void;
  parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; home?: boolean;
}) {
  const board = useQuery({ queryKey: ["soccer-board", league], queryFn: () => api.getSoccerBoard({ league }), retry: false });
  const overview = useQuery({ queryKey: ["soccer-overview", league], queryFn: () => api.getSoccerOverview({ league }), staleTime: 15 * 60 * 1000, retry: 1 });
  const scorers = useQuery({ queryKey: ["soccer-likely-scorers", league], queryFn: () => api.getSoccerLikelyScorers({ league }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const injuries = useSoccerKeyInjuries(league);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedMarket, setSelectedMarket] = useState<MarketGroup | null>(null);
  const [stake, setStake] = useState("10");
  const [priceMode, setPriceMode] = useState<PriceMode>("draftkings");
  const groups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const leagueName = league === "epl" ? "Premier League" : "MLS";
  const threeWay = useMemo(() => groups.filter(isThreeWayGroup), [groups]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(groups.map((g) => offerCategory(g, "soccer")))).sort()], [groups]);
  const visible = groups.filter((group) => (category === "All" || offerCategory(group, "soccer") === category) && `${group.matchup} ${group.marketName} ${group.stat} ${group.entity} ${group.sides.map((side) => side.side).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const combined = combinedAmerican(parlay, priceMode);
  const decimal = decimalOdds(combined);
  const stakeValue = Number(stake);
  const payout = decimal !== null && Number.isFinite(stakeValue) ? stakeValue * decimal : 0;
  const toggleParlay = (group: MarketGroup, side: MarketSide) => {
    const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side };
    setParlay(parlay.some((item) => item.id === pick.id) ? parlay.filter((item) => item.id !== pick.id) : [...parlay, pick]);
  };
  const outcomeRow = (group: MarketGroup, outcome: MarketSide | null, label: string) => {
    if (!outcome) return null;
    const added = parlay.some((item) => item.id === outcome.id);
    return <div className="soccer-outcome" key={outcome.id}>
      <strong>{label}</strong>
      <div className="quote-books"><span>Best <b>{bookName(outcome.best.book)} {formatAmerican(outcome.best.odds)}</b></span><span>DK <b>{formatAmerican(outcome.draftKings?.odds ?? null)}</b></span><span>FD <b>{formatAmerican(outcome.fanDuel?.odds ?? null)}</b></span><span>MGM <b>{formatAmerican(outcome.betMGM?.odds ?? null)}</b></span></div>
      <button className={added ? "pick-button added" : "pick-button"} onClick={() => toggleParlay(group, outcome)}>{added ? "Remove" : "Add"}</button>
    </div>;
  };
  return <>
    {home && <><InstallCard/><SoccerScheduleStrip compact league={league} /></>}
    <div className="section-heading soccer-board-head"><div><p className="kicker">SOCCER BOARD</p><h2>{leagueName}</h2></div><SoccerLeagueTabs league={league} onLeagueChange={onLeagueChange} /></div>
    <ProviderStatus pending={board.isPending || board.isFetching} error={board.error instanceof Error ? board.error.message : null} onRetry={() => board.refetch()} />
    {board.data ? <section className="pro-board">
      <div className="roster-title"><div><p className="kicker">{home ? "TODAY'S COMPLETE BOARD" : "LIVE SPORTSBOOK BOARD"}</p><h2>{groups.length.toLocaleString()} markets · {board.data.offerCount.toLocaleString()} book prices</h2><p className="roster-intro">Three-way results — home, draw, away — paired across books.</p></div><span>{board.data.eventCount} events · {dateTime(board.data.fetchedAt)}</span></div>
      <div className={board.data.cacheStatus === "fresh" ? "refresh-health fresh" : "refresh-health stale"} role="status"><span className="health-dot"/><div><strong>{board.data.cacheStatus === "fresh" ? "Odds feed healthy" : "Showing last successful update"}</strong><small>{board.data.healthMessage} · Updated {dateTime(board.data.fetchedAt)}</small></div></div>
      {threeWay.length > 0 && <section className="moneyline-rail" aria-labelledby="soccer-ml-title"><div className="section-heading"><div><p className="kicker">FIRST LOOK</p><h3 id="soccer-ml-title">Match result picks</h3></div><span>Best · DraftKings · FanDuel · BetMGM</span></div><div className="moneyline-grid">{threeWay.map((group) => {
        const split = threeWaySides(group, overview.data?.standings ?? null);
        const homeLabel = split.homeCode ?? group.sides[0]?.side ?? "Home";
        const awayLabel = split.awayCode ?? group.sides[group.sides.length - 1]?.side ?? "Away";
        return <article className="moneyline-card" key={group.id}><div className="moneyline-open"><small>{group.matchup}</small><h4>{group.entity}</h4>
          {outcomeRow(group, split.home, `${homeLabel} win`)}
          {outcomeRow(group, split.draw, "Draw")}
          {outcomeRow(group, split.away, `${awayLabel} win`)}
        </div><SoccerFlipMeter league={league} market={group} />
        <InjuryChips sport="soccer" awayCode={split.awayCode ?? ""} homeCode={split.homeCode ?? ""} injuries={injuries.data ?? null} />
        <SoccerScorersStrip awayCode={split.awayCode} homeCode={split.homeCode} scorers={scorers.data ?? null} /></article>;
      })}</div></section>}
      {parlay.length>0&&<aside className="parlay-panel" aria-label="Parlay builder"><div><p className="kicker">PARLAY BUILDER</p><h3>{parlay.length} legs · {combined}</h3></div><label>Price at<select value={priceMode} onChange={(event)=>setPriceMode(event.target.value as PriceMode)} aria-label="Parlay sportsbook"><option value="draftkings">DraftKings</option><option value="fanduel">FanDuel</option><option value="betmgm">BetMGM</option><option value="best">Best price</option></select></label><label>Stake<input inputMode="decimal" value={stake} onChange={(event)=>setStake(event.target.value)} aria-label="Parlay stake"/></label><div><small>Estimated return</small><strong>${payout.toFixed(2)}</strong></div><button onClick={()=>setParlay([])}>Clear</button><ul>{parlay.map((item)=>{const priced=offerForMode(item.side,priceMode);return <li key={item.id}><span>{item.entity} · {titleCase(item.side.side)} {item.side.line??""}</span><b>{priced ? `${bookName(priced.book)} ${formatAmerican(priced.odds)}` : "Not offered"}</b></li>;})}</ul><p>Planning tool only. Every leg must be offered by the selected sportsbook; unavailable legs are never substituted.</p></aside>}
      <div className="pro-controls"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, team or market" aria-label="Search live odds"/><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter market type">{categories.map((name) => <option key={name}>{name}</option>)}</select><button onClick={() => board.refetch()} disabled={board.isFetching}>{board.isFetching ? "Refreshing…" : "Refresh lines"}</button></div>
      <div className="market-table complete-market-table">{visible.map((market) => { const matchupLine = market.matchup.includes(market.entity) ? `${market.matchup} · ${titleCase(market.period)}` : `${market.entity} · ${market.matchup} · ${titleCase(market.period)}`; return <article className="complete-market" key={market.id}><button className="market-open" onClick={()=>setSelectedMarket(market)} aria-label={`Open ${market.marketName} for ${market.entity}`}><b>{market.marketName}</b><small>{matchupLine}</small></button><div className="side-quotes">{market.sides.map((side) => { const added = parlay.some((item) => item.id === side.id); const openingProbability=impliedProbability(side.best.openingOdds); const currentProbability=impliedProbability(side.best.odds); const move=openingProbability!==null&&currentProbability!==null?(currentProbability-openingProbability)*100:null; return <div className="side-quote" key={side.id}><div className="quote-main"><strong>{titleCase(side.side)} {side.line ?? ""}</strong><div className="quote-books"><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DK <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>FD <b>{formatAmerican(side.fanDuel?.odds ?? null)}</b></span><span>MGM <b>{formatAmerican(side.betMGM?.odds ?? null)}</b></span></div><div className="quote-chips">{side.evPercent !== null && side.evPercent > 0 && <em>+{side.evPercent.toFixed(1)}% EV</em>}{move!==null&&Math.abs(move)>=2&&<em className="steam-chip">Move {move>0?"+":""}{move.toFixed(1)} pts</em>}</div></div><button className={added ? "pick-button added" : "pick-button"} onClick={() => toggleParlay(market, side)}>{added ? "Remove" : "Add"}</button></div>;})}</div></article>;})}</div>
      {visible.length===0&&<div className="history-empty"><strong>No matching markets.</strong><span>Clear the filters or refresh the provider board.</span></div>}
    </section> : !board.isPending && <div className="history-empty"><strong>Soccer odds aren't posted yet.</strong><span>The sportsbook feed hasn't served this league. Official scores, standings and models still work below the provider board.</span></div>}
    {selectedMarket&&<OddsDetailSheet market={selectedMarket} onClose={()=>setSelectedMarket(null)}/>}</>;
}

function SoccerModelVsBooks({ league, homeCode, awayCode, homeModel, drawModel, awayModel, groups }: {
  league: SoccerLeague; homeCode: string; awayCode: string;
  homeModel: number | null; drawModel: number | null; awayModel: number | null;
  groups: MarketGroup[];
}) {
  const homeName = soccerTeamsFor(league).find((t) => t.code === homeCode)?.name ?? homeCode;
  const awayName = soccerTeamsFor(league).find((t) => t.code === awayCode)?.name ?? awayCode;
  const threeWay = groups.filter(isThreeWayGroup);
  const groupFor = (name: string) => threeWay.find((g) =>
    g.entity.toLowerCase() === name.toLowerCase() ||
    g.matchup.toLowerCase().includes(name.toLowerCase()) ||
    g.sides.some((side) => side.side.toLowerCase() === name.toLowerCase()));
  const outcomeOdds = (name: string, kind: "home" | "draw" | "away"): string | null => {
    const group = groupFor(name);
    if (!group) return null;
    const split = threeWaySides(group, null);
    const side = kind === "home" ? split.home : kind === "draw" ? split.draw : split.away;
    return side?.best.odds ?? null;
  };
  const homeImplied = impliedProbability(outcomeOdds(homeName, "home") ?? outcomeOdds(homeCode, "home"));
  const drawImplied = impliedProbability(outcomeOdds("draw", "draw"));
  const awayImplied = impliedProbability(outcomeOdds(awayName, "away") ?? outcomeOdds(awayCode, "away"));
  if (homeModel === null || drawModel === null || awayModel === null || homeImplied === null || drawImplied === null || awayImplied === null) return null;
  const total = homeImplied + drawImplied + awayImplied;
  if (total <= 0) return null;
  const book = { home: homeImplied / total, draw: drawImplied / total, away: awayImplied / total };
  const modelTop = homeModel >= drawModel && homeModel >= awayModel ? "home" : drawModel >= awayModel ? "draw" : "away";
  const bookTop = book.home >= book.draw && book.home >= book.away ? "home" : book.draw >= book.away ? "draw" : "away";
  const isFlip = modelTop !== bookTop;
  const label = (k: string) => k === "home" ? homeCode : k === "draw" ? "Draw" : awayCode;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return <section className="model-vs-books" aria-label="Model versus sportsbook comparison">
    <div className="section-heading"><div><p className="kicker">MODEL VS BOOKS</p><h3>Does it flip?</h3></div>
    <span>{isFlip ? "⚡ Flip alert" : "✓ Aligned"}</span></div>
    <div className="mvb-rows">
      <div className="mvb-row"><span>Model</span><div className="winner-track three-way"><i style={{ width: `${homeModel * 100}%` }} /><u style={{ width: `${drawModel * 100}%` }} /><b style={{ width: `${awayModel * 100}%` }} /></div><span>{homeCode} <b>{pct(homeModel)}</b> · D <b>{pct(drawModel)}</b> · {awayCode} <b>{pct(awayModel)}</b></span></div>
      <div className="mvb-row"><span>Books</span><div className="winner-track books three-way"><i style={{ width: `${book.home * 100}%` }} /><u style={{ width: `${book.draw * 100}%` }} /><b style={{ width: `${book.away * 100}%` }} /></div><span>{homeCode} <b>{pct(book.home)}</b> · D <b>{pct(book.draw)}</b> · {awayCode} <b>{pct(book.away)}</b></span></div>
    </div>
    <p className="mvb-note">
      {isFlip
        ? `The model flips the books: it leans ${label(modelTop)} while the books lean ${label(bookTop)}.`
        : `Both lean ${label(modelTop)}.`}
      {" "}Book percentages are vig-stripped from the best available three-way prices; the model is a statistical estimate, not a pick.
    </p>
  </section>;
}

function SoccerMatchupCalculator({ league, onLeagueChange }: { league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void }) {
  const leagueTeams = soccerTeamsFor(league);
  const defaults: Record<SoccerLeague, [string, string]> = { mls: ["LAFC", "MIA"], epl: ["ARS", "LIV"] };
  const [awayTeam, setAwayTeam] = useState(defaults[league][0]);
  const [homeTeam, setHomeTeam] = useState(defaults[league][1]);
  const [matchup, setMatchup] = useState<{ away: string; home: string }>({ away: defaults[league][0], home: defaults[league][1] });
  useEffect(() => {
    const d = defaults[league];
    setAwayTeam(d[0]); setHomeTeam(d[1]); setMatchup({ away: d[0], home: d[1] });
  }, [league]);
  const overview = useQuery({ queryKey: ["soccer-overview", league], queryFn: () => api.getSoccerOverview({ league }), staleTime: 15 * 60 * 1000, retry: 1 });
  const board = useQuery({ queryKey: ["soccer-board", league], queryFn: () => api.getSoccerBoard({ league }), retry: false });
  const boardGroups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const result = useQuery({ queryKey: ["soccer-matchup", league, matchup.away, matchup.home], queryFn: () => api.getSoccerMatchup({ league, awayTeam: matchup.away, homeTeam: matchup.home, force: false }), retry: 1 });
  const injuries = useSoccerKeyInjuries(league);
  const refresh = useMutation({ mutationFn: () => api.getSoccerMatchup({ league, awayTeam: matchup.away, homeTeam: matchup.home, force: true }), onSuccess: () => result.refetch() });
  const data: SoccerMatchup | undefined = result.data;
  const leagueName = league === "epl" ? "Premier League" : "MLS";
  const chooseGame = (away: string, home: string) => {
    if (!leagueTeams.some((t) => t.code === away) || !leagueTeams.some((t) => t.code === home)) return;
    setAwayTeam(away); setHomeTeam(home); setMatchup({ away, home });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (awayTeam !== homeTeam) setMatchup({ away: awayTeam, home: homeTeam }); };
  const modelChart = data ? [
    { metric: "Over 2.5 goals", probability: Number(((data.over25Probability ?? 0) * 100).toFixed(1)) },
    { metric: "Both teams score", probability: Number(((data.bttsProbability ?? 0) * 100).toFixed(1)) },
    { metric: "3+ goal margin", probability: Number(((data.margin3PlusProbability ?? 0) * 100).toFixed(1)) },
    { metric: "Draw", probability: Number(((data.drawProbability ?? 0) * 100).toFixed(1)) },
  ] : [];
  const slateGames = overview.data?.games.filter((g) => g.state !== "post" && g.state !== "final") ?? [];
  const edgeLabel = !data?.edgeTeam ? "Insufficient sample" : data.edgeTeam.toLowerCase() === "draw" ? `Draw ${percentage(data.edgeProbability)}` : `${data.edgeTeam} to win ${percentage(data.edgeProbability)}`;
  return <section className="matchup-lab">
    <div className="matchup-heading"><div><p className="kicker">MATCHUP CALCULATOR · {leagueName.toUpperCase()}</p><h1>Who takes it?</h1><p>Three-way result probabilities — home, draw, away — plus goals markets, from official recent results.</p></div>{data && <button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Recalculating…" : "Refresh data"}</button>}</div>
    <SoccerLeagueTabs league={league} onLeagueChange={onLeagueChange} />
    {slateGames.length > 0 && <div className="slate-flips" aria-label={`Today's ${leagueName} matchups with model flip percentages`}>{slateGames.slice(0, 12).map((game) => <SoccerSlateFlipCard key={game.id} league={league} awayAbbrev={game.away.abbrev} homeAbbrev={game.home.abbrev} active={matchup.away === game.away.abbrev && matchup.home === game.home.abbrev} onPick={() => chooseGame(game.away.abbrev, game.home.abbrev)} />)}</div>}
    <form className="matchup-form" onSubmit={submit}>
      <label>Away team<select value={awayTeam} onChange={(event) => setAwayTeam(event.target.value)}>{leagueTeams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <span aria-hidden="true">@</span>
      <label>Home team<select value={homeTeam} onChange={(event) => setHomeTeam(event.target.value)}>{leagueTeams.map((team) => <option key={team.code} value={team.code}>{team.name}</option>)}</select></label>
      <button className="primary" type="submit" disabled={awayTeam === homeTeam || result.isFetching}>{result.isFetching ? "Calculating…" : "Calculate matchup"}</button>
    </form>
    {awayTeam === homeTeam && <p className="calculator-note error" role="alert">Choose two different clubs.</p>}
    {result.isPending ? <div className="loading calculator-loading"><span />Reading recent match data…</div> : result.isError ? <div className="error-state calculator-error"><h2>Matchup data is unavailable.</h2><p>The league feed hasn't served this side yet.</p><button onClick={() => result.refetch()}>Retry</button></div> : data ? <>
      <section className="winner-card">
        <div className="section-heading"><div><p className="kicker">MATCH RESULT</p><h2>{edgeLabel}</h2></div><span>Model estimate</span></div>
        <SoccerFlipBars homeAbbrev={data.home.team} awayAbbrev={data.away.team} probs={{ home: data.homeWinProbability ?? 0, draw: data.drawProbability ?? 0, away: data.awayWinProbability ?? 0 }} />
        <div className="team-sample-grid"><div><strong>{data.away.team}</strong><span>{data.away.wins}W–{data.away.draws}D–{data.away.losses}L recent</span><small>{data.away.goalsFor} scored · {data.away.goalsAgainst} allowed{data.awayExpectedGoals !== null ? ` · xG ${data.awayExpectedGoals.toFixed(2)}` : ""}</small></div><div><strong>{data.home.team}</strong><span>{data.home.wins}W–{data.home.draws}D–{data.home.losses}L recent</span><small>{data.home.goalsFor} scored · {data.home.goalsAgainst} allowed{data.homeExpectedGoals !== null ? ` · xG ${data.homeExpectedGoals.toFixed(2)}` : ""}</small></div></div>
        <InjuryChips sport="soccer" awayCode={matchup.away} homeCode={matchup.home} injuries={injuries.data ?? null} />
        <p className="winner-explain">The result model blends each club's recent home/away form with goals scored and allowed, weighting venue splits when the sample allows. Draws are a real outcome here — always price all three. This is a model estimate, not a sportsbook line.</p>
      </section>
      <SoccerModelVsBooks league={league} homeCode={data.home.team} awayCode={data.away.team} homeModel={data.homeWinProbability} drawModel={data.drawProbability} awayModel={data.awayWinProbability} groups={boardGroups} />
      {data && <MatchupScorersSection sport="soccer" awayCode={data.away.team} homeCode={data.home.team} league={league} />}
      <section className="scenario-grid" aria-label="Matchup model estimates">
        <article><span>Over 2.5 goals</span><strong>{percentage(data.over25Probability)}</strong><small>Three or more total goals</small></article>
        <article><span>Both teams to score</span><strong>{percentage(data.bttsProbability)}</strong><small>Each side scores at least once</small></article>
        <article><span>Draw</span><strong>{percentage(data.drawProbability)}</strong><small>Level after 90 minutes</small></article>
      </section>
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">GAME SCRIPT</p><h3>Matchup probabilities</h3></div><span>Model estimates</span></div><div className="scenario-chart" role="img" aria-label="Bar chart of over 2.5 goals, both teams to score, and draw probabilities"><ResponsiveContainer width="100%" height="100%"><BarChart data={modelChart} layout="vertical" margin={{ top: 4, right: 26, bottom: 4, left: 12 }}><CartesianGrid stroke="var(--rule)" horizontal={false}/><XAxis type="number" domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="metric" width={92} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`, "Model estimate"]}/><Bar dataKey="probability" fill="var(--orange)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="head-to-head"><div><span>Recent head-to-head</span><strong>{data.headToHead.games ? `${data.away.team} ${data.headToHead.awayWins} · Draws ${data.headToHead.draws} · ${data.home.team} ${data.headToHead.homeWins}` : "No games in sample"}</strong></div><p>{data.sampleNote}</p></section>
      <div className="source-box"><span>Source</span><a href={data.sourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} data ↗</a><small>Calculated {dateTime(data.fetchedAt)} · cached 12 hours</small></div>
    </> : null}
  </section>;
}

function SoccerPlayerSheet({ league, player, team, onClose }: { league: SoccerLeague; player: SoccerPlayer; team: string; onClose: () => void }) {
  const log = useQuery({ queryKey: ["soccer-player-log", league, team, player.id], queryFn: () => api.getSoccerPlayerGameLog({ league, team, playerId: player.id }), retry: false });
  const goalie = player.position === "G";
  const metrics = goalie
    ? [{ id: "cleanSheets", label: "CS" }, { id: "goals", label: "Goals" }, { id: "assists", label: "Assists" }]
    : [{ id: "goals", label: "Goals" }, { id: "assists", label: "Assists" }];
  const [metric, setMetric] = useState(goalie ? "cleanSheets" : "goals");
  const games = log.data?.games ?? [];
  // Clean sheets are derived from official match logs (an appearance plus
  // zero conceded) — computed, never invented.
  const isCleanSheet = (game: SoccerPlayerGameLog["games"][number]) => game.appearances > 0 && game.oppScore === 0 ? 1 : 0;
  const logCleanSheets = games.reduce((s, g) => s + isCleanSheet(g), 0);
  const metricValue = (game: SoccerPlayerGameLog["games"][number], id: string): number | null => {
    if (id === "goals") return game.goals;
    if (id === "assists") return game.assists;
    if (id === "cleanSheets") return isCleanSheet(game);
    return null;
  };
  const chartData = games.slice(0, 8).reverse().map((game) => ({
    date: soccerGameDate(game.gameDate),
    goals: game.goals, assists: game.assists,
    cleanSheets: isCleanSheet(game),
  }));
  const lastFive = games.slice(0, 5);
  const seasonAverage = average(games.map((game) => metricValue(game, metric)));
  const lastFiveAverage = average(lastFive.map((game) => metricValue(game, metric)));
  const modelProjection = seasonAverage === null ? null : seasonAverage * .5 + (lastFiveAverage ?? seasonAverage) * .5;
  const metricLabel = metrics.find((item) => item.id === metric)?.label ?? "Stat";
  const totals = (fn: (g: SoccerPlayerGameLog["games"][number]) => number | null) => lastFive.reduce((s, g) => s + (fn(g) ?? 0), 0);
  const [sheetTab, setSheetTab] = useState<"overview" | "trend" | "last5" | "log">("overview");
  const perGame = (total: number | null) => player.games ? ((total ?? 0) / player.games).toFixed(2) : "—";
  const leagueName = league === "epl" ? "Premier League" : "MLS";

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet player-sheet" role="dialog" aria-modal="true" aria-labelledby="soccer-player-stats-title">
      <button className="close" onClick={onClose} aria-label="Close player stats">×</button>
      <p className="kicker">{team} PLAYER FILE · {leagueName.toUpperCase()}</p>
      <div className="sheet-title-row"><h2 id="soccer-player-stats-title">{player.name}</h2><PlayerWatchStar sport="soccer" playerId={player.id} team={team} name={player.name} position={player.position} /></div>
      <p className="matchup">{player.jersey ? `#${player.jersey} · ` : ""}{player.position} · {String(leagueName)} season</p>
      <div className="player-season-line">
        <div><span>Apps</span><strong>{player.games ?? "—"}</strong></div>
        <div><span>Goals</span><strong>{player.goals ?? "—"}</strong></div>
        <div><span>Assists</span><strong>{player.assists ?? "—"}</strong></div>
        {goalie && <div><span>Clean sheets</span><strong>{log.isPending ? "—" : logCleanSheets}</strong></div>}
        {!goalie && <div><span>G/app*</span><strong>{perGame(player.goals)}</strong></div>}
      </div>
      <div className="sheet-tabs" role="tablist" aria-label="Player stat sections">
        {(["overview", "trend", "last5", "log"] as const).map((tab) => <button key={tab} role="tab" aria-selected={sheetTab === tab} className={sheetTab === tab ? "active" : ""} onClick={() => setSheetTab(tab)}>{tab === "overview" ? "Overview" : tab === "trend" ? "Trend" : tab === "last5" ? "Last 5" : "Match log"}</button>)}
      </div>
      {log.isPending ? <div className="player-log-loading"><span />Loading match-by-match stats…</div> : log.isError ? <div className="inline-log-error"><strong>Match log unavailable.</strong><span>The league feed hasn't served this player yet.</span><button onClick={() => log.refetch()}>Retry</button></div> : games.length === 0 ? <div className="history-empty"><strong>No matches logged yet.</strong><span>The graph, projection and last-five record will populate after official match data posts.</span></div> : <>
        {sheetTab === "overview" && <section className="model-panel">
          <div><p className="kicker">DAILY HAM MODEL</p><h3>{metricLabel} projection</h3><span>Statistical projection — not a market lean</span></div>
          <strong>{modelProjection === null ? "—" : modelProjection.toFixed(2)}</strong>
          <div className="model-inputs"><span>Season <b>{seasonAverage?.toFixed(2) ?? "—"}</b></span><span>Last 5 <b>{lastFiveAverage?.toFixed(2) ?? "—"}</b></span></div>
          <p>Weighted from official season and last-5 match logs. Missing context stays neutral.</p>
        </section>}
        {sheetTab === "trend" && <section className="trend-section">
          <div className="section-heading"><div><p className="kicker">RECENT TREND</p><h3>Last {Math.min(8, games.length)} matches</h3></div><span>{metricLabel}</span></div>
          <div className="metric-tabs" aria-label="Chart stat">{metrics.map((item) => <button key={item.id} className={metric === item.id ? "active" : ""} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div>
          <div className="player-trend-chart" role="img" aria-label={`${player.name} ${metricLabel} over the last ${Math.min(8, games.length)} matches`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 14, right: 10, bottom: 0, left: -22 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Line type="monotone" dataKey={metric} stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: "var(--paper)", strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer></div>
        </section>}
        {sheetTab === "last5" && <section className="last-five-section">
          <div className="section-heading"><div><p className="kicker">FORM CHECK</p><h3>Last five</h3></div><span>{lastFive.length} official matches</span></div>
          <div className="last-five-summary"><div><span>GOALS</span><strong>{totals((g) => g.goals)}</strong></div><div><span>ASSISTS</span><strong>{totals((g) => g.assists)}</strong></div>{goalie && <div><span>CLEAN SHEETS</span><strong>{lastFive.reduce((s, g) => s + isCleanSheet(g), 0)}</strong></div>}</div>
          <div className="game-card-list">{lastFive.map((game) => <article className="game-card" key={game.gameId}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{soccerGameDate(game.gameDate)} · {game.result} {game.teamScore ?? "—"}-{game.oppScore ?? "—"}</span></div></div><div className="game-stat-grid"><div><span>Goals</span><b>{game.goals}</b></div><div><span>Assists</span><b>{game.assists}</b></div><div><span>App</span><b>{game.appearances > 0 ? "✓" : "—"}</b></div>{goalie && <div><span>CS</span><b>{game.appearances > 0 && game.oppScore === 0 ? "Yes" : "No"}</b></div>}</div></article>)}</div>
        </section>}
        {sheetTab === "log" && <details className="full-log" open><summary>Full season match log <span>{games.length} matches</span></summary><div className="game-card-list compact">{games.map((game) => <article className="game-card" key={`full-${game.gameId}`}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{soccerGameDate(game.gameDate)} · {game.result} {game.teamScore ?? "—"}-{game.oppScore ?? "—"}</span></div></div><div className="game-stat-grid"><div><span>G</span><b>{game.goals}</b></div><div><span>A</span><b>{game.assists}</b></div><div><span>App</span><b>{game.appearances > 0 ? "✓" : "—"}</b></div>{goalie && <div><span>CS</span><b>{game.appearances > 0 && game.oppScore === 0 ? "Yes" : "No"}</b></div>}</div></article>)}</div></details>}
        <div className="source-box"><span>Source</span><a href={log.data?.sourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} match data ↗</a><small>Fetched {log.data ? dateTime(log.data.fetchedAt) : "—"}</small></div>
      </>}
    </section>
  </div>;
}

function SoccerRosterView({ league, onLeagueChange, parlay, setParlay, teamFocus }: {
  league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void;
  parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void;
  teamFocus: { sport: League; team: string; nonce: number } | null;
}) {
  const [team, setTeam] = useState<string>(() => defaultsFor(league)[0] ?? "LAFC");
  function defaultsFor(l: SoccerLeague): string[] { return soccerTeamsFor(l).map((t) => t.code); }
  useEffect(() => {
    if (teamFocus && teamFocus.sport === "soccer" && soccerTeams.some((t) => t.code === teamFocus.team)) {
      setTeam(teamFocus.team);
      onLeagueChange?.(soccerLeagueForTeam(teamFocus.team));
    }
  }, [teamFocus]);
  useEffect(() => { setTeam(defaultsFor(league)[0] ?? "LAFC"); }, [league]);
  const [selectedPlayer, setSelectedPlayer] = useState<SoccerPlayer | null>(null);
  const [watched, setWatched] = useState(0);
  const teamLeague = soccerLeagueForTeam(team);
  const roster = useQuery({ queryKey: ["soccer-roster", teamLeague, team], queryFn: () => api.getSoccerRoster({ league: teamLeague, team }) });
  const teamBoard = useQuery({ queryKey: ["soccer-board", teamLeague], queryFn: () => api.getSoccerBoard({ league: teamLeague }), retry: false });
  const selectedTeamName = soccerTeams.find((item) => item.code === team)?.name ?? team;
  const teamThreeWay = useMemo(() => groupPremiumOffers(teamBoard.data?.offers ?? []).filter(isThreeWayGroup).filter((group) => group.matchup.includes(selectedTeamName)), [teamBoard.data, selectedTeamName]);
  useEffect(() => {
    const onChange = () => setWatched((w) => w + 1);
    window.addEventListener("dh-watchlist-change", onChange);
    return () => window.removeEventListener("dh-watchlist-change", onChange);
  }, []);
  void watched;
  const leagueName = teamLeague === "epl" ? "Premier League" : "MLS";

  return (
    <>
    <section className="roster-panel">
      <div className="roster-title"><div><p className="kicker">OFFICIAL {leagueName.toUpperCase()} SQUADS</p><h2>Team stats & player trends</h2><p className="roster-intro">Tap any player to open graphs, last-five form and the complete match log. Star a player to add them to your Watchlist.</p></div>{roster.data && <span>Updated {dateTime(roster.data.fetchedAt)}</span>}</div>
      <SoccerLeagueTabs league={league} onLeagueChange={onLeagueChange} />
      <label className="select-label" htmlFor="soccer-team">Club</label>
      <select id="soccer-team" value={team} onChange={(e) => { setTeam(e.target.value); setSelectedPlayer(null); }}>{soccerTeamsFor(league).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
      {teamThreeWay.length > 0 && <section className="team-moneyline"><div className="section-heading"><div><p className="kicker">NEXT MATCH</p><h3>Result board</h3></div><span>Best · DraftKings · FanDuel · BetMGM</span></div><div className="moneyline-grid">{teamThreeWay.map((group) => { const split = threeWaySides(group, null); const outcomes: [string, MarketSide | null][] = [["Home", split.home], ["Draw", split.draw], ["Away", split.away]]; return <article className="moneyline-card" key={group.id}><div className="moneyline-open"><small>{group.matchup}</small><h4>{group.entity}</h4>{outcomes.map(([label, side]) => { if (!side) return null; const added = parlay.some((item) => item.id === side.id); const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side }; return <div className="soccer-outcome" key={side.id}><strong>{label}</strong><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><button className={added ? "pick-button added" : "pick-button"} onClick={() => setParlay(added ? parlay.filter((item) => item.id !== side.id) : [...parlay, pick])}>{added ? "Remove" : "Add"}</button></div>; })}</div></article>;})}</div></section>}
      {roster.isPending ? (
        <div className="loading"><span />Loading official squad…</div>
      ) : roster.isError ? (
        <div className="inline-error">Official squad data is temporarily unavailable — the league feed hasn't served this side yet. <button onClick={() => roster.refetch()}>Retry</button></div>
      ) : roster.data ? (
        <>
          <div className="roster-summary"><div><b>{roster.data.players.length}</b><span>players</span></div><div><b>{roster.data.players.filter((p) => p.position === "G").length}</b><span>keepers</span></div><div><b>{roster.data.players.filter((p) => ["DF", "D"].includes(p.position)).length}</b><span>defenders</span></div><div><b>{roster.data.players.filter((p) => ["MF", "M"].includes(p.position)).length}</b><span>midfield</span></div><div><b>{roster.data.players.filter((p) => ["FW", "F", "ST"].includes(p.position)).length}</b><span>forwards</span></div></div>
          <div className="table-scroll"><div className="roster-table" role="table">
            <div className="roster-header" role="row"><span>Player</span><span>Apps</span><span>G</span><span>A</span><span>CS</span></div>
            {roster.data.players.map((player) => {
              const starredEntry = { playerId: player.id, team, name: player.name, position: player.position };
              const stats: [string, string][] = [
                ["Apps", `${player.games ?? "—"}`],
                ["G", `${player.goals ?? "—"}`],
                ["A", `${player.assists ?? "—"}`],
                ["CS", "–"],
              ];
              return <div className="roster-card" key={player.id}>
                <button className="roster-card-main" onClick={() => setSelectedPlayer(player)} aria-label={`Open ${player.name} match log and charts`}>
                  <span className="roster-card-head"><b>{player.jersey ? `#${player.jersey} ` : ""}{player.name}</b><small>{player.position}</small></span>
                  <span className="roster-stat-grid">{stats.map(([label, value]) => <span key={label} className="roster-stat"><small>{label}</small><b>{value}</b></span>)}</span>
                </button>
                <PlayerWatchStar sport="soccer" playerId={starredEntry.playerId} team={starredEntry.team} name={starredEntry.name} position={starredEntry.position} />
              </div>;
            })}
          </div></div>
          <div className="source-box"><span>Source</span><a href={roster.data.sourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} data ↗</a><small>{String(leagueName)} season · aggregated from official match logs</small></div>
        </>
      ) : null}
    </section>
    {selectedPlayer && <SoccerPlayerSheet key={selectedPlayer.id} league={teamLeague} player={selectedPlayer} team={team} onClose={() => setSelectedPlayer(null)} />}
    </>
  );
}

function SoccerHotStreaksView({ league, onLeagueChange }: { league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void }) {
  const [tab, setTab] = useState("Scorers");
  const [selected, setSelected] = useState<{ player: SoccerPlayer; team: string } | null>(null);
  const hot = useQuery({ queryKey: ["soccer-hot-streaks", league], queryFn: () => api.getSoccerHotStreaks({ league, force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getSoccerHotStreaks({ league, force: true }), onSuccess: () => hot.refetch() });
  const players = [...(hot.data?.players ?? [])].sort((a, b) => b.goals - a.goals || b.braces - a.braces || a.name.localeCompare(b.name));
  const leagueName = league === "epl" ? "Premier League" : "MLS";
  // Resolve full player records (for stat files + watch stars) from each
  // represented club's roster, matched by name. Official data only.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const teamCodes = useMemo(() => [...new Set(players.map((row) => row.team))], [players]);
  const rosterQueries = useQueries({ queries: teamCodes.map((code) => ({ queryKey: ["soccer-roster", league, code], queryFn: () => api.getSoccerRoster({ league, team: code }), staleTime: 24 * 60 * 60 * 1000, retry: 1 })) });
  const resolved = useMemo(() => {
    const map = new Map<string, { player: SoccerPlayer; team: string }>();
    rosterQueries.forEach((q, i) => q.data?.players.forEach((pl) => { if (!map.has(norm(pl.name))) map.set(norm(pl.name), { player: pl, team: teamCodes[i] ?? "" }); }));
    return map;
  }, [rosterQueries, teamCodes]);
  const openPlayer = (row: SoccerHotStreaks["players"][number]) => {
    const hit = resolved.get(norm(row.name));
    if (hit) setSelected({ player: hit.player, team: hit.team });
  };
  return <section className="hot-section"><div className="roster-title"><div><p className="kicker">HOT STREAKS · {leagueName.toUpperCase()}</p><h2>Who's scoring right now</h2><p className="roster-intro">Ranked by goals in the recent official window. Tap a player for the full stat file.</p></div>{hot.data && <div className="roster-update"><span>Updated {dateTime(hot.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh streaks"}</button></div>}</div><SoccerLeagueTabs league={league} onLeagueChange={onLeagueChange} /><div className="metric-tabs hot-tabs">{["Scorers", "Teams"].map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</div>{hot.isPending ? <div className="loading"><span />Reading recent match data…</div> : hot.isError ? <div className="error-state"><h2>Streak board unavailable.</h2><p>The league feed hasn't served this side yet.</p><button onClick={() => hot.refetch()}>Retry</button></div> : tab === "Teams" ? (hot.data?.teams.length ? <div className="hot-list">{hot.data.teams.map((t, index) => <div className="hot-row-wrap" key={t.team}><div className="hot-row"><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{t.name}</strong><small>{leagueName}</small></span><span className="streak-badges">{t.streak && <b>{t.streak}</b>}</span><span className="hot-totals"><b>{t.points} pts</b><small>in the window</small></span></div><TeamWatchStar sport="soccer" team={t.team} name={t.name} /></div>)}</div> : <div className="history-empty"><strong>No hot teams in the official window.</strong></div>) : players.length === 0 ? <div className="history-empty"><strong>No qualifying streaks in the official window.</strong><span>Only real scorers from official match data are shown.</span></div> : <div className="hot-list">{players.map((row, index) => { const hit = resolved.get(norm(row.name)); return <div className="hot-row-wrap" key={`${row.team}-${row.name}`}><button className="hot-row" onClick={() => openPlayer(row)} aria-label={hit ? `Open ${row.name} full stat file` : `${row.name} stat file unavailable`} disabled={!hit}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team}{row.position ? ` · ${row.position}` : ""} · {leagueName}</small></span><span className="streak-badges">{row.braces > 0 && <b>{row.braces} multi-goal {row.braces === 1 ? "game" : "games"}</b>}</span><span className="hot-totals"><b>{row.goals} G</b><small>{row.games} apps</small></span></button>{hit && <PlayerWatchStar sport="soccer" playerId={hit.player.id} team={hit.team} name={hit.player.name} position={hit.player.position} />}</div>; })}</div>}{hot.data && <div className="source-box"><span>Source</span><a href={hot.data.sourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} match data ↗</a><small>{soccerGameDate(hot.data.windowStart)}–{soccerGameDate(hot.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <SoccerPlayerSheet league={soccerLeagueForTeam(selected.team)} player={selected.player} team={selected.team} onClose={() => setSelected(null)} />}</section>;
}
function SoccerCuttingBoard({ league, onLeagueChange }: { league: SoccerLeague; onLeagueChange?: (next: SoccerLeague) => void }) {
  const [tab, setTab] = useState("Cold players");
  const [selected, setSelected] = useState<{ player: SoccerPlayer; team: string } | null>(null);
  const cold = useQuery({ queryKey: ["soccer-cold-streaks", league], queryFn: () => api.getSoccerColdStreaks({ league, force: false }), staleTime: 12 * 60 * 60 * 1000, retry: 1 });
  const refresh = useMutation({ mutationFn: () => api.getSoccerColdStreaks({ league, force: true }), onSuccess: () => cold.refetch() });
  const players = [...(cold.data?.players ?? [])].sort((a, b) => a.seasonGoals - b.seasonGoals || b.appearances - a.appearances);
  const leagueName = league === "epl" ? "Premier League" : "MLS";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const teamCodes = useMemo(() => [...new Set(players.map((row) => row.team))], [players]);
  const rosterQueries = useQueries({ queries: teamCodes.map((code) => ({ queryKey: ["soccer-roster", league, code], queryFn: () => api.getSoccerRoster({ league, team: code }), staleTime: 24 * 60 * 60 * 1000, retry: 1 })) });
  const resolved = useMemo(() => {
    const map = new Map<string, { player: SoccerPlayer; team: string }>();
    rosterQueries.forEach((q, i) => q.data?.players.forEach((pl) => { if (!map.has(norm(pl.name))) map.set(norm(pl.name), { player: pl, team: teamCodes[i] ?? "" }); }));
    return map;
  }, [rosterQueries, teamCodes]);
  const openPlayer = (row: SoccerColdStreaks["players"][number]) => {
    const hit = resolved.get(norm(row.name));
    if (hit) setSelected({ player: hit.player, team: hit.team });
  };
  return <section className="hot-section cutting-board"><div className="roster-title"><div><p className="kicker">THE CUTTING BOARD · {leagueName.toUpperCase()}</p><h2>Slumps, officially</h2><p className="roster-intro">Scoreless stretches and skidding clubs from official match data. Tap a player for the full stat file.</p></div>{cold.data && <div className="roster-update"><span>Updated {dateTime(cold.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh board"}</button></div>}</div><SoccerLeagueTabs league={league} onLeagueChange={onLeagueChange} /><div className="metric-tabs hot-tabs">{["Cold players", "Teams"].map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</div>{cold.isPending ? <div className="loading"><span />Reading recent match data…</div> : cold.isError ? <div className="error-state"><h2>Cutting board unavailable.</h2><p>The league feed hasn't served this side yet.</p><button onClick={() => cold.refetch()}>Retry</button></div> : tab === "Teams" ? (cold.data?.teams.length ? <div className="hot-list">{cold.data.teams.map((t, index) => <div className="hot-row-wrap" key={t.team}><div className="hot-row"><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{t.name}</strong><small>{leagueName}</small></span><span className="streak-badges">{t.streak && <b>{t.streak}</b>}</span><span className="hot-totals"><b>{t.points} pts</b><small>in the window</small></span></div><TeamWatchStar sport="soccer" team={t.team} name={t.name} /></div>)}</div> : <div className="history-empty"><strong>No skidding clubs in the official window.</strong></div>) : players.length === 0 ? <div className="history-empty"><strong>Nobody on the board.</strong><span>Only real contributors with scoreless stretches from official match data are shown.</span></div> : <div className="hot-list">{players.map((row, index) => { const hit = resolved.get(norm(row.name)); return <div className="hot-row-wrap" key={`${row.team}-${row.name}`}><button className="hot-row" onClick={() => openPlayer(row)} aria-label={hit ? `Open ${row.name} full stat file` : `${row.name} stat file unavailable`} disabled={!hit}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {leagueName}</small></span><span className="streak-badges">{row.seasonGoals === 0 && <b>scoreless season</b>}</span><span className="hot-totals"><b>{row.seasonGoals} G</b><small>{row.appearances} apps</small></span></button>{hit && <PlayerWatchStar sport="soccer" playerId={hit.player.id} team={hit.team} name={hit.player.name} position={hit.player.position} />}</div>; })}</div>}{cold.data && <div className="source-box"><span>Source</span><a href={cold.data.sourceUrl} target="_blank" rel="noreferrer">ESPN {leagueName} match data ↗</a><small>{soccerGameDate(cold.data.windowStart)}–{soccerGameDate(cold.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <SoccerPlayerSheet league={soccerLeagueForTeam(selected.team)} player={selected.player} team={selected.team} onClose={() => setSelected(null)} />}</section>;
}