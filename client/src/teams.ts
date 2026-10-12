// Favorite-team theme data: 32 NHL clubs with a UI accent color (curated to
// look good as the site's highlight color) plus a secondary for the picker
// swatch. Colors are approximate club colors.

export type TeamTheme = { code: string; name: string; color: string; secondary: string };

export const TEAM_THEMES: TeamTheme[] = [
  { code: "ANA", name: "Anaheim Ducks", color: "#F47A38", secondary: "#000000" },
  { code: "BOS", name: "Boston Bruins", color: "#FFB81C", secondary: "#000000" },
  { code: "BUF", name: "Buffalo Sabres", color: "#FCB514", secondary: "#002654" },
  { code: "CAR", name: "Carolina Hurricanes", color: "#CC0000", secondary: "#000000" },
  { code: "CBJ", name: "Columbus Blue Jackets", color: "#CE1126", secondary: "#002654" },
  { code: "CGY", name: "Calgary Flames", color: "#C8102E", secondary: "#F1BE48" },
  { code: "CHI", name: "Chicago Blackhawks", color: "#CF0A2C", secondary: "#000000" },
  { code: "COL", name: "Colorado Avalanche", color: "#6F263D", secondary: "#236192" },
  { code: "DAL", name: "Dallas Stars", color: "#006847", secondary: "#000000" },
  { code: "DET", name: "Detroit Red Wings", color: "#CE1126", secondary: "#FFFFFF" },
  { code: "EDM", name: "Edmonton Oilers", color: "#FC4C02", secondary: "#041E42" },
  { code: "FLA", name: "Florida Panthers", color: "#C8102E", secondary: "#B9975B" },
  { code: "LAK", name: "Los Angeles Kings", color: "#A2AAAD", secondary: "#111111" },
  { code: "MIN", name: "Minnesota Wild", color: "#154734", secondary: "#DDCBA4" },
  { code: "MTL", name: "Montréal Canadiens", color: "#AF1E2D", secondary: "#192168" },
  { code: "NJD", name: "New Jersey Devils", color: "#CE1126", secondary: "#000000" },
  { code: "NSH", name: "Nashville Predators", color: "#FFB81C", secondary: "#041E42" },
  { code: "NYI", name: "New York Islanders", color: "#F47D30", secondary: "#00539B" },
  { code: "NYR", name: "New York Rangers", color: "#0038A8", secondary: "#CE1126" },
  { code: "OTT", name: "Ottawa Senators", color: "#E31837", secondary: "#000000" },
  { code: "PHI", name: "Philadelphia Flyers", color: "#F74902", secondary: "#000000" },
  { code: "PIT", name: "Pittsburgh Penguins", color: "#FCB514", secondary: "#000000" },
  { code: "SEA", name: "Seattle Kraken", color: "#68A2B9", secondary: "#001628" },
  { code: "SJS", name: "San Jose Sharks", color: "#006D75", secondary: "#000000" },
  { code: "STL", name: "St. Louis Blues", color: "#FCB514", secondary: "#002F87" },
  { code: "TBL", name: "Tampa Bay Lightning", color: "#002868", secondary: "#FFFFFF" },
  { code: "TOR", name: "Toronto Maple Leafs", color: "#00205B", secondary: "#FFFFFF" },
  { code: "UTA", name: "Utah Mammoth", color: "#6CACE4", secondary: "#101010" },
  { code: "VAN", name: "Vancouver Canucks", color: "#00843D", secondary: "#00205B" },
  { code: "VGK", name: "Vegas Golden Knights", color: "#B4975A", secondary: "#333F42" },
  { code: "WPG", name: "Winnipeg Jets", color: "#004B8D", secondary: "#AC162C" },
  { code: "WSH", name: "Washington Capitals", color: "#C8102E", secondary: "#041E42" },
];

export const FAVORITE_TEAM_KEY = "dh-favorite-team";

// 32 NFL clubs, same shape. Codes that collide with NHL clubs (BUF, DAL,
// PIT) are disambiguated by league wherever they are used.
export const NFL_TEAM_THEMES: TeamTheme[] = [
  { code: "ARI", name: "Arizona Cardinals", color: "#a40227", secondary: "#ffffff" },
  { code: "ATL", name: "Atlanta Falcons", color: "#a71930", secondary: "#000000" },
  { code: "BAL", name: "Baltimore Ravens", color: "#29126f", secondary: "#000000" },
  { code: "BUF", name: "Buffalo Bills", color: "#00338d", secondary: "#d50a0a" },
  { code: "CAR", name: "Carolina Panthers", color: "#0085ca", secondary: "#000000" },
  { code: "CHI", name: "Chicago Bears", color: "#0b1c3a", secondary: "#e64100" },
  { code: "CIN", name: "Cincinnati Bengals", color: "#fb4f14", secondary: "#000000" },
  { code: "CLE", name: "Cleveland Browns", color: "#472a08", secondary: "#ff3c00" },
  { code: "DAL", name: "Dallas Cowboys", color: "#002a5c", secondary: "#b0b7bc" },
  { code: "DEN", name: "Denver Broncos", color: "#0a2343", secondary: "#fc4c02" },
  { code: "DET", name: "Detroit Lions", color: "#0076b6", secondary: "#bbbbbb" },
  { code: "GB", name: "Green Bay Packers", color: "#204e32", secondary: "#ffb612" },
  { code: "HOU", name: "Houston Texans", color: "#021018", secondary: "#eb0028" },
  { code: "IND", name: "Indianapolis Colts", color: "#003b75", secondary: "#ffffff" },
  { code: "JAX", name: "Jacksonville Jaguars", color: "#007487", secondary: "#d7a22a" },
  { code: "KC", name: "Kansas City Chiefs", color: "#e31837", secondary: "#ffb612" },
  { code: "LAC", name: "Los Angeles Chargers", color: "#0080c6", secondary: "#ffc20e" },
  { code: "LAR", name: "Los Angeles Rams", color: "#003594", secondary: "#ffd100" },
  { code: "LV", name: "Las Vegas Raiders", color: "#000000", secondary: "#a5acaf" },
  { code: "MIA", name: "Miami Dolphins", color: "#008e97", secondary: "#fc4c02" },
  { code: "MIN", name: "Minnesota Vikings", color: "#4f2683", secondary: "#ffc62f" },
  { code: "NE", name: "New England Patriots", color: "#002a5c", secondary: "#c60c30" },
  { code: "NO", name: "New Orleans Saints", color: "#d3bc8d", secondary: "#000000" },
  { code: "NYG", name: "New York Giants", color: "#003c7f", secondary: "#c9243f" },
  { code: "NYJ", name: "New York Jets", color: "#115740", secondary: "#ffffff" },
  { code: "PHI", name: "Philadelphia Eagles", color: "#06424d", secondary: "#000000" },
  { code: "PIT", name: "Pittsburgh Steelers", color: "#000000", secondary: "#ffb612" },
  { code: "SEA", name: "Seattle Seahawks", color: "#002a5c", secondary: "#69be28" },
  { code: "SF", name: "San Francisco 49ers", color: "#aa0000", secondary: "#b3995d" },
  { code: "TB", name: "Tampa Bay Buccaneers", color: "#bd1c36", secondary: "#3e3a35" },
  { code: "TEN", name: "Tennessee Titans", color: "#4495d2", secondary: "#001532" },
  { code: "WSH", name: "Washington Commanders", color: "#5a1414", secondary: "#ffb612" },
];

// 30 NBA clubs, same shape. Codes use ESPN's abbreviations (GS, SA, NY, NO).
// Collisions with NHL/NFL codes (ATL, BOS, CHI, CLE, DAL, DEN, DET, HOU, IND,
// MEM, MIA, MIL, MIN, NO, NY, OKC, ORL, PHI, PHX, POR, SAC, SA, TOR, UTA, WSH)
// are disambiguated by league wherever they are used.
export const NBA_TEAM_THEMES: TeamTheme[] = [
  { code: "ATL", name: "Atlanta Hawks", color: "#E03A3E", secondary: "#000000" },
  { code: "BOS", name: "Boston Celtics", color: "#007A33", secondary: "#000000" },
  { code: "BKN", name: "Brooklyn Nets", color: "#000000", secondary: "#FFFFFF" },
  { code: "CHA", name: "Charlotte Hornets", color: "#1D1160", secondary: "#00788C" },
  { code: "CHI", name: "Chicago Bulls", color: "#CE1141", secondary: "#000000" },
  { code: "CLE", name: "Cleveland Cavaliers", color: "#860038", secondary: "#FDBB30" },
  { code: "DAL", name: "Dallas Mavericks", color: "#00538C", secondary: "#002B5E" },
  { code: "DEN", name: "Denver Nuggets", color: "#0E2240", secondary: "#FEC524" },
  { code: "DET", name: "Detroit Pistons", color: "#C8102E", secondary: "#1D42BA" },
  { code: "GS", name: "Golden State Warriors", color: "#1D428A", secondary: "#FFC72C" },
  { code: "HOU", name: "Houston Rockets", color: "#CE1141", secondary: "#000000" },
  { code: "IND", name: "Indiana Pacers", color: "#002D62", secondary: "#FDBB30" },
  { code: "LAC", name: "LA Clippers", color: "#C8102E", secondary: "#1D428A" },
  { code: "LAL", name: "Los Angeles Lakers", color: "#552583", secondary: "#FDB927" },
  { code: "MEM", name: "Memphis Grizzlies", color: "#5D76A9", secondary: "#12173F" },
  { code: "MIA", name: "Miami Heat", color: "#98002E", secondary: "#000000" },
  { code: "MIL", name: "Milwaukee Bucks", color: "#00471B", secondary: "#EEE1C6" },
  { code: "MIN", name: "Minnesota Timberwolves", color: "#0C2340", secondary: "#78BE20" },
  { code: "NO", name: "New Orleans Pelicans", color: "#0C2340", secondary: "#C8102E" },
  { code: "NY", name: "New York Knicks", color: "#006BB6", secondary: "#F58426" },
  { code: "OKC", name: "Oklahoma City Thunder", color: "#007AC1", secondary: "#EF3B24" },
  { code: "ORL", name: "Orlando Magic", color: "#0077C0", secondary: "#000000" },
  { code: "PHI", name: "Philadelphia 76ers", color: "#006BB6", secondary: "#ED174C" },
  { code: "PHX", name: "Phoenix Suns", color: "#1D1160", secondary: "#E56020" },
  { code: "POR", name: "Portland Trail Blazers", color: "#E03A3E", secondary: "#000000" },
  { code: "SAC", name: "Sacramento Kings", color: "#5A2D81", secondary: "#000000" },
  { code: "SA", name: "San Antonio Spurs", color: "#C4CED4", secondary: "#000000" },
  { code: "TOR", name: "Toronto Raptors", color: "#CE1141", secondary: "#000000" },
  { code: "UTAH", name: "Utah Jazz", color: "#002B5C", secondary: "#F9A01B" },
  { code: "WSH", name: "Washington Wizards", color: "#002B5C", secondary: "#E31837" },
];

// 30 MLS clubs (ESPN usa.1) + 20 Premier League clubs (ESPN eng.1).
// Colors are ESPN's official club colors, curated where the primary is too
// dark or too light to work as a UI accent. Codes are unique across the two
// leagues, so one combined list serves themeFor("soccer", code).
export type SoccerLeague = "mls" | "epl";
export const SOCCER_LEAGUES: { code: SoccerLeague; name: string }[] = [
  { code: "mls", name: "MLS" },
  { code: "epl", name: "Premier League" },
];

export const MLS_TEAM_THEMES: TeamTheme[] = [
  { code: "ATL", name: "Atlanta United FC", color: "#9d2235", secondary: "#aa9767" },
  { code: "ATX", name: "Austin FC", color: "#00b140", secondary: "#000000" },
  { code: "MTL", name: "CF Montréal", color: "#003da6", secondary: "#c1c5c8" },
  { code: "CLT", name: "Charlotte FC", color: "#0085ca", secondary: "#000000" },
  { code: "CHI", name: "Chicago Fire FC", color: "#d71e2b", secondary: "#7ccdef" },
  { code: "COL", name: "Colorado Rapids", color: "#8a2432", secondary: "#8ab7e9" },
  { code: "CLB", name: "Columbus Crew", color: "#fedd00", secondary: "#000000" },
  { code: "DC", name: "D.C. United", color: "#d61018", secondary: "#000000" },
  { code: "CIN", name: "FC Cincinnati", color: "#003087", secondary: "#fe5000" },
  { code: "DAL", name: "FC Dallas", color: "#c6093b", secondary: "#001f5b" },
  { code: "HOU", name: "Houston Dynamo FC", color: "#ff6b00", secondary: "#101820" },
  { code: "MIA", name: "Inter Miami CF", color: "#f7b5cd", secondary: "#231f20" },
  { code: "LA", name: "LA Galaxy", color: "#00235d", secondary: "#ffffff" },
  { code: "LAFC", name: "LAFC", color: "#c7a36f", secondary: "#000000" },
  { code: "MIN", name: "Minnesota United FC", color: "#9bcde4", secondary: "#000000" },
  { code: "NSH", name: "Nashville SC", color: "#ece83a", secondary: "#1f1646" },
  { code: "NE", name: "New England Revolution", color: "#022166", secondary: "#ce0e2d" },
  { code: "NYC", name: "New York City FC", color: "#9fd2ff", secondary: "#000229" },
  { code: "ORL", name: "Orlando City SC", color: "#60269e", secondary: "#f0d283" },
  { code: "PHI", name: "Philadelphia Union", color: "#e0d0a6", secondary: "#051f31" },
  { code: "POR", name: "Portland Timbers", color: "#2c5234", secondary: "#c99700" },
  { code: "RSL", name: "Real Salt Lake", color: "#a32035", secondary: "#daa900" },
  { code: "RBNY", name: "Red Bull New York", color: "#ba0c2f", secondary: "#ffc72c" },
  { code: "SD", name: "San Diego FC", color: "#697a7c", secondary: "#f89e1a" },
  { code: "SJ", name: "San Jose Earthquakes", color: "#003da6", secondary: "#ffffff" },
  { code: "SEA", name: "Seattle Sounders FC", color: "#2dc84d", secondary: "#0033a0" },
  { code: "SKC", name: "Sporting Kansas City", color: "#a7c6ed", secondary: "#0a2240" },
  { code: "STL", name: "St. Louis CITY SC", color: "#ec1458", secondary: "#001544" },
  { code: "TOR", name: "Toronto FC", color: "#aa182c", secondary: "#a2a9ad" },
  { code: "VAN", name: "Vancouver Whitecaps", color: "#12284c", secondary: "#ffffff" },
];

export const EPL_TEAM_THEMES: TeamTheme[] = [
  { code: "BOU", name: "AFC Bournemouth", color: "#f42727", secondary: "#b57edc" },
  { code: "ARS", name: "Arsenal", color: "#e20520", secondary: "#003399" },
  { code: "AVL", name: "Aston Villa", color: "#660e36", secondary: "#000000" },
  { code: "BRE", name: "Brentford", color: "#f42727", secondary: "#0f1c3f" },
  { code: "BHA", name: "Brighton & Hove Albion", color: "#0606fa", secondary: "#005f60" },
  { code: "CHE", name: "Chelsea", color: "#144992", secondary: "#ffffff" },
  { code: "COV", name: "Coventry City", color: "#87cced", secondary: "#ffffff" },
  { code: "CRY", name: "Crystal Palace", color: "#0202fb", secondary: "#000000" },
  { code: "EVE", name: "Everton", color: "#0606fa", secondary: "#ffffff" },
  { code: "FUL", name: "Fulham", color: "#cc0000", secondary: "#ffffff" },
  { code: "HUL", name: "Hull City", color: "#f28800", secondary: "#ffffff" },
  { code: "IPS", name: "Ipswich Town", color: "#0000fa", secondary: "#f5f2dc" },
  { code: "LEE", name: "Leeds United", color: "#ffcd00", secondary: "#ffffff" },
  { code: "LIV", name: "Liverpool", color: "#d11317", secondary: "#ffffff" },
  { code: "MNC", name: "Manchester City", color: "#99c5ea", secondary: "#000000" },
  { code: "MAN", name: "Manchester United", color: "#da020e", secondary: "#4169e1" },
  { code: "NEW", name: "Newcastle United", color: "#000000", secondary: "#0b1b3d" },
  { code: "NFO", name: "Nottingham Forest", color: "#c8102e", secondary: "#1b3624" },
  { code: "SUN", name: "Sunderland", color: "#eb172b", secondary: "#ffb6c1" },
  { code: "TOT", name: "Tottenham Hotspur", color: "#0b1426", secondary: "#ffffff" },
];

export const SOCCER_TEAM_THEMES: TeamTheme[] = [...MLS_TEAM_THEMES, ...EPL_TEAM_THEMES];

// Which soccer league a club code belongs to (codes are unique across leagues).
export function soccerLeagueForTeam(code: string): SoccerLeague {
  return EPL_TEAM_THEMES.some((t) => t.code === code) ? "epl" : "mls";
}

export type League = "nhl" | "nfl" | "nba" | "soccer";
export const LEAGUE_THEMES: Record<League, TeamTheme[]> = { nhl: TEAM_THEMES, nfl: NFL_TEAM_THEMES, nba: NBA_TEAM_THEMES, soccer: SOCCER_TEAM_THEMES };

export function themeFor(league: League, code: string): TeamTheme | null {
  return LEAGUE_THEMES[league].find((t) => t.code === code) ?? null;
}

// Per-league favorites: one NHL team, one NFL team, one NBA team, one soccer
// club. The color scheme follows whichever league is active. Legacy
// single-favorite values ("league:CODE" or plain "CODE" from the NHL-only
// era) migrate into the matching league slot on first read.
export type LeagueFavorites = { nhl: string | null; nfl: string | null; nba: string | null; soccer: string | null };
const FAV_NHL_KEY = "dh-favorite-nhl";
const FAV_NFL_KEY = "dh-favorite-nfl";
const FAV_NBA_KEY = "dh-favorite-nba";
const FAV_SOCCER_KEY = "dh-favorite-soccer";

export function loadFavorites(): LeagueFavorites {
  try {
    let nhl = localStorage.getItem(FAV_NHL_KEY);
    let nfl = localStorage.getItem(FAV_NFL_KEY);
    let nba = localStorage.getItem(FAV_NBA_KEY);
    let soccer = localStorage.getItem(FAV_SOCCER_KEY);
    const legacy = localStorage.getItem(FAVORITE_TEAM_KEY);
    if (legacy && !nhl && !nfl && !nba && !soccer) {
      const [league, code] = legacy.includes(":") ? legacy.split(":") : ["nhl", legacy];
      if (league === "nfl" && code && themeFor("nfl", code)) nfl = code;
      else if (league === "nba" && code && themeFor("nba", code)) nba = code;
      else if (league === "soccer" && code && themeFor("soccer", code)) soccer = code;
      else if (code && themeFor("nhl", code)) nhl = code;
      try {
        localStorage.removeItem(FAVORITE_TEAM_KEY);
        if (nhl) localStorage.setItem(FAV_NHL_KEY, nhl);
        if (nfl) localStorage.setItem(FAV_NFL_KEY, nfl);
        if (nba) localStorage.setItem(FAV_NBA_KEY, nba);
        if (soccer) localStorage.setItem(FAV_SOCCER_KEY, soccer);
      } catch { /* migration is best-effort */ }
    }
    return {
      nhl: nhl && themeFor("nhl", nhl) ? nhl : null,
      nfl: nfl && themeFor("nfl", nfl) ? nfl : null,
      nba: nba && themeFor("nba", nba) ? nba : null,
      soccer: soccer && themeFor("soccer", soccer) ? soccer : null,
    };
  } catch {
    return { nhl: null, nfl: null, nba: null, soccer: null };
  }
}

export function saveFavorite(league: League, code: string | null): void {
  try {
    const key = league === "nhl" ? FAV_NHL_KEY : league === "nfl" ? FAV_NFL_KEY : league === "nba" ? FAV_NBA_KEY : FAV_SOCCER_KEY;
    if (code) localStorage.setItem(key, code);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable; theme still applies for the session */
  }
  applyLeagueTheme(league, code);
  try {
    window.dispatchEvent(new CustomEvent("dh-team-change", { detail: { league, code } }));
  } catch {
    /* event dispatch is best-effort */
  }
}

export function applyLeagueTheme(league: League, code: string | null): void {
  try {
    const root = document.documentElement;
    const team = code ? themeFor(league, code) : null;
    if (team) {
      root.style.setProperty("--accent", team.color);
      // Dark team colors need a lightened variant for text sitting on
      // accent-colored buttons/bars; light team colors keep the default
      // dark text via the CSS fallbacks.
      if (luminance(team.color) < 0.18) {
        root.style.setProperty("--accent-ink", lighten(team.color, 0.72));
      } else {
        root.style.removeProperty("--accent-ink");
      }
      root.setAttribute("data-fav-team", `${league}:${team.code}`);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-ink");
      root.removeAttribute("data-fav-team");
    }
  } catch {
    /* theming is decorative; never break the app */
  }
}

// Legacy single-favorite API, kept for any external callers.
export type FavoriteTeam = { league: League; code: string } | null;

export function loadFavoriteTeam(): FavoriteTeam {
  const favs = loadFavorites();
  if (favs.nhl) return { league: "nhl", code: favs.nhl };
  if (favs.nfl) return { league: "nfl", code: favs.nfl };
  if (favs.nba) return { league: "nba", code: favs.nba };
  if (favs.soccer) return { league: "soccer", code: favs.soccer };
  return null;
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function lighten(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const m = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
}
