import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// Local replacement for the platform's SafeAreaTopScrim: a slim bar that
// occupies the device's top safe-area inset (notch / status bar) so content
// never slides underneath it.
function SafeAreaTopScrim({ backgroundColor }: { backgroundColor: string }) {
  return <div aria-hidden="true" style={{ height: "env(safe-area-inset-top)", backgroundColor, position: "sticky", top: 0, zIndex: 60 }} />;
}
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ApiResponse } from "./api";
import logo from "./assets/daily-ham-logo.jpg";

type Mode = "board" | "matchup" | "rosters" | "hot" | "standings" | "settings";
type PremiumBoard = ApiResponse<typeof api, "getPremiumBoard">;
type FirstGoalMatchup = ApiResponse<typeof api, "getFirstGoalMatchup">;
type PremiumOffer = PremiumBoard["offers"][number];
type NhlRoster = ApiResponse<typeof api, "getNhlRoster">;
type NhlPlayer = NhlRoster["players"][number];
type PlayerGameLog = ApiResponse<typeof api, "getNhlPlayerGameLog">;
type NhlOverview = ApiResponse<typeof api, "getNhlOverview">;
type HotStreaks = ApiResponse<typeof api, "getHotStreaks">;
type TeamCode = NhlRoster["team"];
type MarketSide = {
  id: string;
  side: string;
  line: string | null;
  openingLine: string | null;
  offers: PremiumOffer[];
  best: PremiumOffer;
  draftKings: PremiumOffer | null;
  fanatics: PremiumOffer | null;
  evPercent: number | null;
};
type PriceMode = "draftkings" | "fanatics" | "best";
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
function isFanatics(value: string): boolean { return normalizedBook(value).startsWith("fanatics"); }
function bookName(value: string): string {
  if (isDraftKings(value)) return "DraftKings";
  if (isFanatics(value)) return "Fanatics Sportsbook";
  return titleCase(value);
}
function offerForMode(side: MarketSide, mode: PriceMode): PremiumOffer | null {
  if (mode === "draftkings") return side.draftKings;
  if (mode === "fanatics") return side.fanatics;
  return side.best;
}
function offerCategory(group: MarketGroup): string {
  const text = `${group.marketName} ${group.stat} ${group.period}`.toLowerCase();
  if (/stanley|conference|division|hart|vezina|calder|norris|selke|rocket|award|futur/.test(text)) return "Futures & awards";
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
  if (group.betType === "sp" || /puck line|spread/.test(text)) return "Puck lines";
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
      const fanatics = sideRows.find((row) => isFanatics(row.book)) ?? null;
      const fairProbability = impliedProbability(best.fairOdds);
      const bestDecimal = decimalOdds(best.odds);
      const evPercent = fairProbability !== null && bestDecimal !== null ? (fairProbability * bestDecimal - 1) * 100 : null;
      return [{ id: `${id}|${side}`, side, line: firstSide.line, openingLine: firstSide.openingLine, offers: sideRows, best, draftKings, fanatics, evPercent }];
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

  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sheet player-sheet" role="dialog" aria-modal="true" aria-labelledby="player-stats-title">
      <button className="close" onClick={onClose} aria-label="Close player stats">×</button>
      <p className="kicker">{team} PLAYER FILE</p>
      <h2 id="player-stats-title">{player.name}</h2>
      <p className="matchup">#{player.number ?? "—"} · {player.position} · 2026–27 regular season</p>
      <div className="player-season-line">
        {goalie ? <><div><span>Starts / GP</span><strong>{player.games ?? "—"}</strong></div><div><span>Record</span><strong>{player.wins ?? "—"}–{player.losses ?? "—"}</strong></div><div><span>Save %</span><strong>{player.savePct === null ? "—" : player.savePct.toFixed(3)}</strong></div><div><span>GAA</span><strong>{player.gaa === null ? "—" : player.gaa.toFixed(2)}</strong></div></> : <><div><span>Games</span><strong>{player.games ?? "—"}</strong></div><div><span>Goals</span><strong>{player.goals ?? "—"}</strong></div><div><span>Assists</span><strong>{player.assists ?? "—"}</strong></div><div><span>Points</span><strong>{player.points ?? "—"}</strong></div><div><span>Shots</span><strong>{player.shots ?? "—"}</strong></div></>}
      </div>
      {log.isPending ? <div className="player-log-loading"><span />Loading game-by-game stats…</div> : log.isError ? <div className="inline-log-error"><strong>Game log unavailable.</strong><span>{log.error instanceof Error ? log.error.message : "Try again shortly."}</span><button onClick={() => log.refetch()}>Retry</button></div> : games.length === 0 ? <div className="history-empty"><strong>No regular-season games yet.</strong><span>The graph, projection and last-five record will populate after official game logs are posted.</span></div> : <>
        <section className="model-panel">
          <div><p className="kicker">DAILY HAM MODEL</p><h3>{metricLabel} projection</h3><span>Statistical projection — not a market lean</span></div>
          <strong>{modelProjection === null ? "—" : modelProjection.toFixed(metric === "savePct" ? 1 : 2)}</strong>
          <div className="model-inputs"><span>Season <b>{seasonAverage?.toFixed(2) ?? "—"}</b></span><span>Last 10 <b>{lastTenAverage?.toFixed(2) ?? "—"}</b></span><span>Last 5 <b>{lastFiveAverage?.toFixed(2) ?? "—"}</b></span><span>TOI factor <b>{toiFactor.toFixed(2)}×</b></span><span>{opponent ? `vs ${opponent}` : "Next opponent"} <b>{opponentStanding ? `${matchupFactor.toFixed(2)}×` : "TBD"}</b></span></div>
          <p>Weighted from official season, last-10 and last-5 game logs, then adjusted by recent ice time and the next opponent’s goals-against rate. Missing context stays neutral.</p>
        </section>
        <section className="trend-section">
          <div className="section-heading"><div><p className="kicker">RECENT TREND</p><h3>Last {Math.min(10, games.length)} games</h3></div><span>{metricLabel}</span></div>
          <div className="metric-tabs" aria-label="Chart stat">{metrics.map((item) => <button key={item.id} className={metric === item.id ? "active" : ""} onClick={() => setMetric(item.id)}>{item.label}</button>)}</div>
          <div className="player-trend-chart" role="img" aria-label={`${player.name} ${metricLabel} over the last ${Math.min(10, games.length)} games`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 14, right: 10, bottom: 0, left: -22 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} allowDecimals={metric === "savePct"} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Line type="monotone" dataKey={metric} stroke="var(--green)" strokeWidth={3} dot={{ r: 4, fill: "var(--paper)", strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer></div>
        </section>
        <section className="last-five-section">
          <div className="section-heading"><div><p className="kicker">FORM CHECK</p><h3>Last five</h3></div><span>{lastFive.length} official games</span></div>
          <div className="last-five-summary">{goalie ? <><div><span>Record</span><strong>{lastFive.filter((game) => game.decision === "W").length}–{lastFive.filter((game) => game.decision === "L").length}</strong></div><div><span>Saves</span><strong>{saves}</strong></div><div><span>Save %</span><strong>{lastFiveSavePct === null ? "—" : lastFiveSavePct.toFixed(3)}</strong></div></> : <><div><span>G</span><strong>{total("goals")}</strong></div><div><span>A</span><strong>{total("assists")}</strong></div><div><span>PTS</span><strong>{total("points")}</strong></div><div><span>SOG</span><strong>{total("shots")}</strong></div></>}</div>
          <div className="last-five-bars" role="img" aria-label={`${player.name} ${metricLabel} by game over the last five games`}><div className="chart-caption"><strong>{metricLabel} by game</strong><span>Last 5 official games</span></div><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.slice(-5)} margin={{ top: 10, right: 8, bottom: 0, left: -24 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis domain={[0, "auto"]} allowDecimals={metric === "savePct"} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, metricLabel]}/><Bar dataKey={metric} name={metricLabel} fill="var(--orange)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
          <div className="game-card-list">{lastFive.map((game) => <article className="game-card" key={game.gameId}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{gameDate(game.gameDate)}</span></div>{goalie && <b>{game.decision ?? (game.started ? "START" : "APPEARANCE")}</b>}</div><div className="game-stat-grid">{goalie ? <><div><span>SA</span><b>{statValue(game.shotsAgainst)}</b></div><div><span>SV</span><b>{game.shotsAgainst !== null && game.goalsAgainst !== null ? game.shotsAgainst - game.goalsAgainst : "—"}</b></div><div><span>GA</span><b>{statValue(game.goalsAgainst)}</b></div><div><span>SV%</span><b>{statValue(game.savePct, 3)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></> : <><div><span>G</span><b>{statValue(game.goals)}</b></div><div><span>A</span><b>{statValue(game.assists)}</b></div><div><span>PTS</span><b>{statValue(game.points)}</b></div><div><span>SOG</span><b>{statValue(game.shots)}</b></div><div><span>+/-</span><b>{game.plusMinus !== null && game.plusMinus > 0 ? `+${game.plusMinus}` : statValue(game.plusMinus)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></>}</div></article>)}</div>
        </section>
        <details className="full-log" open><summary>Full season game log <span>{games.length} games</span></summary><div className="game-card-list compact">{games.map((game) => <article className="game-card" key={`full-${game.gameId}`}><div className="game-card-head"><div><strong>{game.homeRoad === "away" ? "@" : "vs"} {game.opponent}</strong><span>{gameDate(game.gameDate)}</span></div>{goalie && <b>{game.decision ?? "—"}</b>}</div><div className="game-stat-grid">{goalie ? <><div><span>SA</span><b>{statValue(game.shotsAgainst)}</b></div><div><span>GA</span><b>{statValue(game.goalsAgainst)}</b></div><div><span>SV%</span><b>{statValue(game.savePct, 3)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></> : <><div><span>G</span><b>{statValue(game.goals)}</b></div><div><span>A</span><b>{statValue(game.assists)}</b></div><div><span>PTS</span><b>{statValue(game.points)}</b></div><div><span>SOG</span><b>{statValue(game.shots)}</b></div><div><span>PP PTS</span><b>{statValue(game.powerPlayPoints)}</b></div><div><span>TOI</span><b>{game.toi ?? "—"}</b></div></>}</div></article>)}</div></details>
        <div className="source-box"><span>Source</span><a href={log.data?.sourceUrl} target="_blank" rel="noreferrer">NHL official game log ↗</a><small>Fetched {log.data ? dateTime(log.data.fetchedAt) : "—"}</small></div>
      </>}
    </section>
  </div>;
}

function RosterView({ parlay, setParlay }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void }) {
  const [team, setTeam] = useState<TeamCode>("WSH");
  const [selectedPlayer, setSelectedPlayer] = useState<NhlPlayer | null>(null);
  const nhl = useQuery({ queryKey: ["nhl-roster", team], queryFn: () => api.getNhlRoster({ team }) });
  const teamBoard = useQuery({ queryKey: ["premium-board", "nhl"], queryFn: () => api.getPremiumBoard({ sport: "nhl" }), retry: false });
  const selectedTeamName = teams.find((item) => item.code === team)?.name ?? team;
  const teamMoneylines = useMemo(() => moneylinePicks(groupPremiumOffers(teamBoard.data?.offers ?? [])).filter((group) => group.matchup.includes(selectedTeamName)), [teamBoard.data, selectedTeamName]);

  return (
    <>
    <section className="roster-panel">
      <div className="roster-title"><div><p className="kicker">OFFICIAL NHL ROSTERS</p><h2>Team stats & player trends</h2><p className="roster-intro">Tap any player to open graphs, last-five form and the complete game log.</p></div>{nhl.data && <span>Updated {dateTime(nhl.data.fetchedAt)}</span>}</div>
      <label className="select-label" htmlFor="team">Team</label>
      <select id="team" value={team} onChange={(e) => { setTeam(e.target.value as TeamCode); setSelectedPlayer(null); }}>{teams.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
      {teamMoneylines.length > 0 && <section className="team-moneyline"><div className="section-heading"><div><p className="kicker">NEXT GAME</p><h3>Moneyline board</h3></div><span>Best · DraftKings · Fanatics</span></div><div className="moneyline-grid">{teamMoneylines.map((group) => { const side = strongestSide(group); if (!side) return null; const added = parlay.some((item) => item.id === side.id); const pick: ParlayPick = { id: side.id, groupId: group.id, matchup: group.matchup, entity: group.entity, marketName: group.marketName, side }; return <article className="moneyline-card" key={group.id}><div className="moneyline-open"><small>{group.matchup}</small><h4>{group.entity}</h4><div><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DraftKings <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>Fanatics <b>{formatAmerican(side.fanatics?.odds ?? null)}</b></span></div><p className={side.evPercent !== null && side.evPercent > 0 ? "signal positive" : "signal"}>{side.evPercent !== null && side.evPercent > 0 ? `+${side.evPercent.toFixed(1)}% fair-odds EV` : "Market favorite"}</p></div><button className={added ? "pick-button added" : "pick-button"} onClick={() => setParlay(added ? parlay.filter((item) => item.id !== side.id) : [...parlay, pick])}>{added ? "Remove" : "Add ML"}</button></article>;})}</div></section>}
      {nhl.isPending ? (
        <div className="loading"><span />Loading official roster…</div>
      ) : nhl.isError ? (
        <div className="inline-error">Official NHL data is temporarily unavailable. <button onClick={() => nhl.refetch()}>Retry</button></div>
      ) : nhl.data ? (
        <>
          <div className="roster-summary"><div><b>{nhl.data.players.length}</b><span>active players</span></div><div><b>{nhl.data.groups.forwards}</b><span>forwards</span></div><div><b>{nhl.data.groups.defensemen}</b><span>defense</span></div><div><b>{nhl.data.groups.goalies}</b><span>goalies</span></div></div>
          <div className="roster-table" role="table">
            <div className="roster-header" role="row"><span>Player</span><span>GP</span><span>G</span><span>A</span><span>PTS</span><span>SOG</span></div>
            {nhl.data.players.map((player) => (
              <button className="roster-row" role="row" key={player.id} onClick={() => setSelectedPlayer(player)} aria-label={`Open ${player.name} game log and charts`}>
                <span><b>{player.number !== null ? `#${player.number} ` : ""}{player.name}</b><small>{player.position} · {player.shoots ?? "—"} shot · {player.height ?? "—"} in · {player.weight ?? "—"} lb · tap for game log</small></span>
                {player.position === "G" ? (
                  <><span data-label="GP">{player.games ?? "—"}</span><span data-label="Wins">{player.wins ?? "—"}</span><span data-label="Losses">{player.losses ?? "—"}</span><span data-label="SV%">{player.savePct === null ? "—" : player.savePct.toFixed(3)}</span><span data-label="GAA">{player.gaa === null ? "—" : player.gaa.toFixed(2)}</span></>
                ) : (
                  <><span data-label="GP">{player.games ?? "—"}</span><span data-label="G">{player.goals ?? "—"}</span><span data-label="A">{player.assists ?? "—"}</span><span data-label="PTS">{player.points ?? "—"}</span><span data-label="SOG">{player.shots ?? "—"}</span></>
                )}
              </button>
            ))}
          </div>
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
          <div className="line-callout sportsbook-callout"><div><span>Best price</span><strong>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</strong></div><div><span>DraftKings</span><strong>{formatAmerican(side.draftKings?.odds ?? null)}</strong></div><div><span>Fanatics</span><strong>{formatAmerican(side.fanatics?.odds ?? null)}</strong></div><div><span>Books</span><strong>{side.offers.length}</strong></div></div>
          {steamPoints !== null && Math.abs(steamPoints) >= 2 && <div className="steam-alert"><span>LINE MOVE</span><strong>{steamPoints > 0 ? "+" : ""}{steamPoints.toFixed(1)} implied-probability points</strong><small>Best-book opening price to current price</small></div>}
          <div className="chart-caption"><strong>{lineMovement ? "Line movement" : "Price movement"}</strong><span>Opening → current</span></div>
          {movement.length === 2 ? <div className="history-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={movement} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="point" axisLine={false} tickLine={false}/><YAxis domain={["auto","auto"]} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [value, lineMovement ? "Line" : "American odds"]}/><Line type="linear" dataKey="value" name={lineMovement ? "Line" : "American odds"} stroke="var(--orange)" strokeWidth={3} dot={{ r: 4 }}/></LineChart></ResponsiveContainer></div> : <div className="history-empty"><strong>No opening snapshot supplied.</strong><span>The current market is still available below.</span></div>}
          {priceDistribution.length > 0 && <div className="price-distribution"><div className="chart-caption"><strong>Book price distribution</strong><span>Current snapshot · {side.offers.length} books</span></div><div className="donut-chart" role="img" aria-label={`Current ${titleCase(side.side)} price distribution across ${side.offers.length} sportsbooks`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={priceDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2}>{["var(--green)","var(--accent)","var(--dim)"].map((color) => <Cell key={color} fill={color}/>)}</Pie><Tooltip formatter={(value) => [`${value} books`, "Count"]}/><Legend verticalAlign="bottom" height={34}/></PieChart></ResponsiveContainer></div></div>}
          <div className="book-list">{[...side.offers].sort((a,b)=>(decimalOdds(b.odds)??0)-(decimalOdds(a.odds)??0)).map((offer)=><div className={offer === side.best ? "best-book" : ""} key={`${side.id}-${offer.book}-${offer.odds}`}><span>{bookName(offer.book)}{offer === side.best&&<em className="best-badge">BEST</em>}{isDraftKings(offer.book)&&<em>DK</em>}{isFanatics(offer.book)&&<em className="fanatics-badge">FANATICS</em>}</span><b>{titleCase(side.side)} {side.line ?? ""} {formatAmerican(offer.odds)}</b></div>)}</div>
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

function strongestSide(group: MarketGroup): MarketSide | null {
  if (group.sides.length === 0) return null;
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

function ProView({ parlay, setParlay, home = false }: { parlay: ParlayPick[]; setParlay: (next: ParlayPick[]) => void; home?: boolean }) {
  const board = useQuery({ queryKey: ["premium-board", "nhl"], queryFn: () => api.getPremiumBoard({ sport: "nhl" }), retry: false });
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedMarket, setSelectedMarket] = useState<MarketGroup | null>(null);
  const [stake, setStake] = useState("10");
  const [priceMode, setPriceMode] = useState<PriceMode>("draftkings");
  const groups = useMemo(() => groupPremiumOffers(board.data?.offers ?? []), [board.data]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(groups.map(offerCategory))).sort()], [groups]);
  const visible = groups.filter((group) => (category === "All" || offerCategory(group) === category) && `${group.matchup} ${group.marketName} ${group.stat} ${group.entity} ${group.sides.map((side) => side.side).join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (offerCategory(a) === "Moneyline" ? -1 : 0) - (offerCategory(b) === "Moneyline" ? -1 : 0));
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
    {home && <><section className="brand-banner"><img src={logo} alt="Daily Ham ham chef logo"/><div><p>HOCKEY ONLY</p><strong>Fresh Cuts Daily</strong><span>Every NHL market, official league data, model projections and sharp price comparison.</span></div></section><ScheduleStrip compact/></>}
    <ProviderStatus pending={board.isPending || board.isFetching} error={board.error instanceof Error ? board.error.message : null} onRetry={() => board.refetch()} />
    {board.data && <section className="pro-board">
      <div className="roster-title"><div><p className="kicker">{home ? "TODAY'S COMPLETE BOARD" : "LIVE SPORTSBOOK BOARD"}</p><h2>{groups.length.toLocaleString()} markets · {board.data.offerCount.toLocaleString()} book prices</h2><p className="roster-intro">Every market returned by the feed, paired across sides when both are offered.</p></div><span>{board.data.eventCount} events · {dateTime(board.data.fetchedAt)}</span></div>
      <div className={board.data.cacheStatus === "fresh" ? "refresh-health fresh" : "refresh-health stale"} role="status"><span className="health-dot"/><div><strong>{board.data.cacheStatus === "fresh" ? "Odds feed healthy" : "Showing last successful update"}</strong><small>{board.data.healthMessage} · Updated {dateTime(board.data.fetchedAt)}</small></div></div>
      {moneylines.length > 0 && <section className="moneyline-rail" aria-labelledby="moneyline-title"><div className="section-heading"><div><p className="kicker">FIRST LOOK</p><h3 id="moneyline-title">Moneyline picks</h3></div><span>Best · DraftKings · Fanatics</span></div><div className="moneyline-grid">{moneylines.map((group) => { const side = strongestSide(group); if (!side) return null; const added = parlay.some((item) => item.id === side.id); const positiveEv = side.evPercent !== null && side.evPercent > 0; return <article className="moneyline-card" key={group.id}><button className="moneyline-open" onClick={() => setSelectedMarket(group)} aria-label={`Open moneyline prices for ${group.entity}`}><small>{group.matchup}</small><h4>{group.entity}</h4><div><span>Best <b>{bookName(side.best.book)} {formatAmerican(side.best.odds)}</b></span><span>DraftKings <b>{formatAmerican(side.draftKings?.odds ?? null)}</b></span><span>Fanatics <b>{formatAmerican(side.fanatics?.odds ?? null)}</b></span></div><GameGoalieLine market={group} games={overview.data?.games ?? []}/><p className={positiveEv ? "signal positive" : "signal"}>{positiveEv ? `+${side.evPercent?.toFixed(1)}% fair-odds EV` : "Market favorite"}</p></button><button className={added ? "pick-button added" : "pick-button"} onClick={() => toggleParlay(group, side)}>{added ? "Remove" : "Add ML"}</button></article>;})}</div></section>}
      {parlay.length>0&&<aside className="parlay-panel" aria-label="Parlay builder"><div><p className="kicker">PARLAY BUILDER</p><h3>{parlay.length} legs · {combined}</h3></div><label>Price at<select value={priceMode} onChange={(event)=>setPriceMode(event.target.value as PriceMode)} aria-label="Parlay sportsbook"><option value="draftkings">DraftKings</option><option value="fanatics">Fanatics</option><option value="best">Best price</option></select></label><label>Stake<input inputMode="decimal" value={stake} onChange={(event)=>setStake(event.target.value)} aria-label="Parlay stake"/></label><div><small>Estimated return</small><strong>${payout.toFixed(2)}</strong></div><button onClick={()=>setParlay([])}>Clear</button><ul>{parlay.map((item)=>{const priced=offerForMode(item.side,priceMode);return <li key={item.id}><span>{item.entity} · {titleCase(item.side.side)} {item.side.line??""}</span><b>{priced ? `${bookName(priced.book)} ${formatAmerican(priced.odds)}` : "Not offered"}</b></li>;})}</ul><p>Planning tool only. Every leg must be offered by the selected sportsbook; unavailable legs are never substituted.</p></aside>}
      <div className="pro-controls"><input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player, team or market" aria-label="Search live odds"/><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter market type">{categories.map((name) => <option key={name}>{name}</option>)}</select><button onClick={() => board.refetch()} disabled={board.isFetching}>{board.isFetching ? "Refreshing…" : "Refresh lines"}</button></div>
      <div className="market-table complete-market-table">{visible.map((market) => <article className="complete-market" key={market.id}><button className="market-open" onClick={()=>setSelectedMarket(market)} aria-label={`Open ${market.marketName} for ${market.entity}`}><b>{market.marketName}</b><small>{market.entity} · {market.matchup} · {titleCase(market.period)}</small><GameGoalieLine market={market} games={overview.data?.games ?? []}/></button><div className="side-quotes">{market.sides.map((side) => { const added = parlay.some((item) => item.id === side.id); const openingProbability=impliedProbability(side.best.openingOdds); const currentProbability=impliedProbability(side.best.odds); const move=openingProbability!==null&&currentProbability!==null?(currentProbability-openingProbability)*100:null; return <div className="side-quote" key={side.id}><div><strong>{titleCase(side.side)} {side.line ?? ""}</strong><span><b>Best</b> {bookName(side.best.book)} {formatAmerican(side.best.odds)}</span><span><b>DK</b> {formatAmerican(side.draftKings?.odds ?? null)}</span><span><b>Fanatics</b> {formatAmerican(side.fanatics?.odds ?? null)}</span>{side.evPercent !== null && side.evPercent > 0 && <em>+{side.evPercent.toFixed(1)}% EV</em>}{move!==null&&Math.abs(move)>=2&&<em className="steam-chip">Move {move>0?"+":""}{move.toFixed(1)} pts</em>}</div><button className={added ? "pick-button added" : "pick-button"} onClick={() => toggleParlay(market, side)}>{added ? "Remove" : `Add ${titleCase(side.side)}`}</button></div>;})}</div></article>)}</div>
      {visible.length===0&&<div className="history-empty"><strong>No matching markets.</strong><span>Clear the filters or refresh the provider board.</span></div>}
    </section>}
    {selectedMarket&&<OddsDetailSheet market={selectedMarket} onClose={()=>setSelectedMarket(null)}/>}</>;
}

function GoalieIndicator({ label, goalie }: { label: string; goalie: NhlOverview["games"][number]["away"]["goalie"] }) {
  return <div className={`goalie-indicator ${goalie.status}`}><span>{label}</span><strong>{goalie.names.length ? goalie.names.join(" / ") : "Starter not posted"}</strong><small>{goalie.status === "confirmed" ? "Confirmed starter" : goalie.status === "watch" ? "Official NHL goalie watch · not confirmed" : "Awaiting official lineup data"}</small></div>;
}

function ScheduleStrip({ compact = false }: { compact?: boolean }) {
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  if (overview.isPending) return <div className="slate-loading">Loading the official NHL slate…</div>;
  if (overview.isError || !overview.data) return <div className="inline-error slate-error"><strong>NHL schedule unavailable.</strong><button onClick={() => overview.refetch()}>Retry</button></div>;
  const games = compact ? overview.data.games.filter((game) => game.date === overview.data?.date) : overview.data.games;
  return <section className="slate-section"><div className="section-heading"><div><p className="kicker">OFFICIAL NHL SCHEDULE</p><h3>{compact ? "Tonight on the ice" : "Scores & schedule"}</h3></div><span>Updated {dateTime(overview.data.fetchedAt)}</span></div>{games.length ? <div className="slate-grid">{games.map((game) => <article className="game-tile" key={game.id}><div className="game-time"><span>{gameDate(game.date)}</span><b>{game.state === "FINAL" || game.state === "OFF" ? "Final" : dateTime(game.startsAt)}</b></div><div className="score-team"><strong>{game.away.name}</strong><b>{game.away.score ?? "—"}</b></div><div className="score-team"><strong>{game.home.name}</strong><b>{game.home.score ?? "—"}</b></div><div className="goalie-grid"><GoalieIndicator label={game.away.abbrev} goalie={game.away.goalie}/><GoalieIndicator label={game.home.abbrev} goalie={game.home.goalie}/></div>{game.broadcasts.length > 0 && <small className="broadcasts">{game.broadcasts.join(" · ")}</small>}</article>)}</div> : <div className="history-empty"><strong>No games on today’s official slate.</strong><span>Future games will appear when the NHL schedule posts them.</span></div>}<div className="source-box"><span>Source</span><a href={overview.data.scheduleSourceUrl} target="_blank" rel="noreferrer">NHL official schedule ↗</a><small>Starter labels appear only when official game data supports them.</small></div></section>;
}

function LeagueView() {
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const [conference, setConference] = useState("All");
  if (overview.isPending) return <div className="loading"><span />Loading NHL schedule and standings…</div>;
  if (overview.isError || !overview.data) return <div className="error-state"><h2>League center is between shifts.</h2><p>The official NHL feed did not answer.</p><button onClick={() => overview.refetch()}>Retry</button></div>;
  const standings = overview.data.standings.filter((row) => conference === "All" || row.conference === conference);
  return <><ScheduleStrip/><section className="standings-section"><div className="section-heading"><div><p className="kicker">LEAGUE TABLE</p><h3>2026–27 standings</h3></div><span>{overview.data.standings.length} clubs</span></div><div className="metric-tabs"><button className={conference === "All" ? "active" : ""} onClick={() => setConference("All")}>All</button>{Array.from(new Set(overview.data.standings.map((row) => row.conference))).filter(Boolean).map((name) => <button key={name} className={conference === name ? "active" : ""} onClick={() => setConference(name)}>{name}</button>)}</div><div className="standings-table" role="table"><div className="standings-row header" role="row"><span>Team</span><span>GP</span><span>W</span><span>L</span><span>OT</span><span>PTS</span><span>DIFF</span></div>{standings.map((row, index) => <div className="standings-row" role="row" key={row.team}><span><b>{index + 1}</b><strong>{row.name}</strong><small>{row.division}</small></span><span>{row.gamesPlayed}</span><span>{row.wins}</span><span>{row.losses}</span><span>{row.otLosses}</span><span><b>{row.points}</b></span><span className={row.goalsFor - row.goalsAgainst > 0 ? "positive" : ""}>{row.goalsFor - row.goalsAgainst > 0 ? "+" : ""}{row.goalsFor - row.goalsAgainst}</span></div>)}</div><div className="source-box"><span>Source</span><a href={overview.data.standingsSourceUrl} target="_blank" rel="noreferrer">NHL official standings ↗</a><small>Goals differential is computed from the listed official totals.</small></div></section></>;
}

function hotPlayerRef(row: HotStreaks["players"][number]): NhlPlayer {
  return { id: row.playerId, name: row.name, number: null, position: row.position, shoots: null, height: null, weight: null, games: null, goals: null, assists: null, points: null, shots: null, toiSeconds: null, savePct: null, gaa: null, wins: null, losses: null, shotsAgainst: null, saves: null };
}

function HotStreaksView() {
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
  return <section className="hot-section"><div className="roster-title"><div><p className="kicker">HOT STREAKS</p><h2>Who’s cooking right now</h2><p className="roster-intro">Every qualifying streak is calculated from official recent NHL boxscores. Tap a player for the full stat file.</p></div>{hot.data && <div className="roster-update"><span>Updated {dateTime(hot.data.fetchedAt)}</span><button className="refresh" onClick={() => refresh.mutate()} disabled={refresh.isPending}>{refresh.isPending ? "Refreshing…" : "Refresh streaks"}</button></div>}</div><div className="metric-tabs hot-tabs">{["Heat index","Point streak","Goal streak","Last-5 points","Last-5 goals","Goalies"].map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}</div>{hot.isPending ? <div className="loading"><span />Reading recent NHL boxscores…</div> : hot.isError ? <div className="error-state"><h2>Streak board unavailable.</h2><p>The official boxscore feed did not answer.</p><button onClick={() => hot.refetch()}>Retry</button></div> : players.length === 0 ? <div className="history-empty"><strong>No qualifying streaks in the official window.</strong><span>Only real players with at least two recent appearances and a qualifying hot signal are shown.</span></div> : <div className="hot-list">{players.map((row, index) => <button className="hot-row" key={row.playerId} onClick={() => setSelected({ player: hotPlayerRef(row), team: row.team })} aria-label={`Open ${row.name} full stat file`}><span className="hot-rank">#{index + 1}</span><span className="hot-player"><strong>{row.name}</strong><small>{row.team} · {row.position}</small></span><span className="streak-badges">{row.pointStreak >= 2 && <b>{row.pointStreak}G point streak</b>}{row.goalStreak >= 2 && <b>{row.goalStreak}G goal streak</b>}{row.lastFiveSavePct !== null && <b>{(row.lastFiveSavePct * 100).toFixed(1)} SV%</b>}</span><span className="hot-totals"><b>{row.lastFivePoints} PTS</b><small>{row.lastFiveGoals} G · last {row.games.length}</small></span><span className="spark-games">{row.games.map((game) => <i key={game.gameId} title={`${game.date} vs ${game.opponent}`}>{row.position === "G" ? `${game.saves ?? "—"} SV` : `${game.goals}G ${game.assists}A`}</i>)}</span></button>)}</div>}{hot.data && <div className="source-box"><span>Source</span><a href={hot.data.sourceUrl} target="_blank" rel="noreferrer">NHL official boxscores ↗</a><small>{gameDate(hot.data.windowStart)}–{gameDate(hot.data.windowEnd)} · refreshed daily without sportsbook quota</small></div>}{selected && <PlayerStatsSheet player={selected.player} team={selected.team} onClose={() => setSelected(null)}/>}</section>;
}

function percentage(value: number | null): string { return value === null ? "—" : `${Math.round(value * 100)}%`; }

function MatchupCalculator() {
  const [awayTeam, setAwayTeam] = useState<TeamCode>("WSH");
  const [homeTeam, setHomeTeam] = useState<TeamCode>("PIT");
  const [matchup, setMatchup] = useState<{ away: TeamCode; home: TeamCode }>({ away: "WSH", home: "PIT" });
  const overview = useQuery({ queryKey: ["nhl-overview"], queryFn: () => api.getNhlOverview({}), staleTime: 15 * 60 * 1000, retry: 1 });
  const result = useQuery({ queryKey: ["first-goal-matchup", matchup.away, matchup.home], queryFn: () => api.getFirstGoalMatchup({ awayTeam: matchup.away, homeTeam: matchup.home, force: false }), retry: 1 });
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
    {todayGames.length > 0 && <div className="slate-picks" aria-label="Today’s NHL matchups">{todayGames.map((game) => <button key={game.id} onClick={() => chooseGame(game.away.abbrev, game.home.abbrev)}>{game.away.abbrev} @ {game.home.abbrev}</button>)}</div>}
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
        <p className="winner-explain">The winner model blends each club’s recent win rate with the opponent’s loss rate, weighting away and home splits when at least five matching games exist. Overtime and shootout winners count. This is a model estimate, not a sportsbook line.</p>
      </section>
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
      <section className="matchup-chart-panel"><div className="section-heading"><div><p className="kicker">RECENT TENDENCY</p><h3>First-goal profile</h3></div><span>Last {Math.max(data.away.games, data.home.games)} games max</span></div><div className="team-tendency-chart" role="img" aria-label="Team scored first and allowed first percentages"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--rule)" vertical={false}/><XAxis dataKey="team" axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => [`${value}%`]}/><Legend/><Bar dataKey="Score first" fill="var(--green)" radius={[3,3,0,0]}/><Bar dataKey="Allow first" fill="var(--accent)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div>
        <div className="team-sample-grid"><div><strong>{data.away.team}</strong><span>{data.away.scoredFirst}/{data.away.firstGoalGames} scored first</span><small>{data.away.venueGames} recent away games in venue split</small></div><div><strong>{data.home.team}</strong><span>{data.home.scoredFirst}/{data.home.firstGoalGames} scored first</span><small>{data.home.venueGames} recent home games in venue split</small></div></div>
      </section>
      <section className="head-to-head"><div><span>Recent head-to-head</span><strong>{data.headToHead.games ? `${data.away.team} ${data.headToHead.awayScoredFirst} · ${data.home.team} ${data.headToHead.homeScoredFirst}` : "No games in sample"}</strong></div><p>{data.sampleNote}</p></section>
      <div className="source-box"><span>Source</span><a href={data.sourceUrl} target="_blank" rel="noreferrer">NHL official play-by-play ↗</a><small>Calculated {dateTime(data.fetchedAt)} · cached 12 hours</small></div>
    </> : null}
  </section>;
}

function ProviderCard({ storageKey, providerLabel, statusQueryKey, getStatus, saveKey, removeKey, helpText }: {
  storageKey: string;
  providerLabel: string;
  statusQueryKey: string;
  getStatus: () => Promise<{ configured: boolean; updatedAt: string | null }>;
  saveKey: (args: { key: string }) => Promise<unknown>;
  removeKey: () => Promise<unknown>;
  helpText: string;
}) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: [statusQueryKey], queryFn: getStatus });
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useMutation({
    mutationFn: removeKey,
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
      await saveKey({ key: secret });
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
  return <div className="credential-card">
    <div className="credential-status" aria-live="polite">
      <span className={status.data?.configured ? "status-dot configured" : "status-dot"} />
      <div><small>{providerLabel.replace(/\s+/g, "").toUpperCase()}</small><strong>{status.isPending ? "Checking…" : status.data?.configured ? "Configured" : "Not configured"}</strong>{status.data?.updatedAt && <span>Updated {dateTime(status.data.updatedAt)}</span>}</div>
    </div>
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
  </div>;
}

function SettingsView() {
  return <section className="settings-panel">
    <div className="settings-heading"><p className="kicker">PROVIDER SETTINGS</p><h1>Sportsbook connection</h1><p>Connect a sportsbook odds provider — SportsGameOdds or The Odds API — to power the complete NHL odds board. Your keys are used only for hockey markets.</p></div>
    <ProviderCard storageKey="sportsgameodds" providerLabel="SportsGameOdds" statusQueryKey="sports-game-odds-key-status" getStatus={() => api.getSportsGameOddsKeyStatus({})} saveKey={(args) => api.saveSportsGameOddsKey(args)} removeKey={() => api.removeSportsGameOddsKey({})} helpText="The field is cleared immediately after submission. The saved value is never displayed." />
    <ProviderCard storageKey="theoddsapi" providerLabel="The Odds API" statusQueryKey="odds-api-key-status" getStatus={() => api.getOddsApiKeyStatus({})} saveKey={(args) => api.saveOddsApiKey(args)} removeKey={() => api.removeOddsApiKey({})} helpText="Free tier: 500 requests/month, no credit card — one board refresh costs a single request. Get a key at the-odds-api.com. The field is cleared immediately after submission." />
  </section>;
}

export function App(){
  const [mode, setMode] = useState<Mode>("board");
  const [parlay, setParlay] = useState<ParlayPick[]>([]);
  return <div className="app-shell"><SafeAreaTopScrim backgroundColor="var(--paper)"/><main><div className="topbar"><nav className="mode-tabs" aria-label="Data view"><button className={mode==="board"?"active":""} onClick={()=>setMode("board")}>Ice board</button><button className={mode==="matchup"?"active":""} onClick={()=>setMode("matchup")}>Matchup</button><button className={mode==="rosters"?"active":""} onClick={()=>setMode("rosters")}>Players</button><button className={mode==="hot"?"active":""} onClick={()=>setMode("hot")}>Hot streaks</button><button className={mode==="standings"?"active":""} onClick={()=>setMode("standings")}>League</button><button className={mode==="settings"?"active":""} onClick={()=>setMode("settings")}>Settings</button></nav></div>{mode==="board"&&<ProView parlay={parlay} setParlay={setParlay} home/>} {mode==="matchup"&&<MatchupCalculator/>} {mode==="rosters"&&<RosterView parlay={parlay} setParlay={setParlay}/>} {mode==="hot"&&<HotStreaksView/>} {mode==="standings"&&<LeagueView/>} {mode==="settings"&&<SettingsView/>}</main></div>;
}
