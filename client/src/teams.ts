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

export type League = "nhl" | "nfl";
export const LEAGUE_THEMES: Record<League, TeamTheme[]> = { nhl: TEAM_THEMES, nfl: NFL_TEAM_THEMES };

export function themeFor(league: League, code: string): TeamTheme | null {
  return LEAGUE_THEMES[league].find((t) => t.code === code) ?? null;
}

// Favorite team is stored as "league:CODE" (e.g. "nfl:KC"). A legacy
// plain-code value from the NHL-only era is read as an NHL team.
export type FavoriteTeam = { league: League; code: string } | null;

export function loadFavoriteTeam(): FavoriteTeam {
  try {
    const raw = localStorage.getItem(FAVORITE_TEAM_KEY);
    if (!raw) return null;
    const [league, code] = raw.includes(":") ? raw.split(":") : ["nhl", raw];
    if ((league === "nhl" || league === "nfl") && code && themeFor(league as League, code)) {
      return { league: league as League, code };
    }
    return null;
  } catch {
    return null;
  }
}

export function applyTeamTheme(fav: FavoriteTeam): void {
  try {
    const root = document.documentElement;
    const team = fav ? themeFor(fav.league, fav.code) : null;
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
      root.setAttribute("data-fav-team", `${fav!.league}:${team.code}`);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-ink");
      root.removeAttribute("data-fav-team");
    }
  } catch {
    /* theming is decorative; never break the app */
  }
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

export function saveFavoriteTeam(fav: FavoriteTeam): void {
  try {
    if (fav) localStorage.setItem(FAVORITE_TEAM_KEY, `${fav.league}:${fav.code}`);
    else localStorage.removeItem(FAVORITE_TEAM_KEY);
  } catch {
    /* storage unavailable; theme still applies for the session */
  }
  applyTeamTheme(fav);
  try {
    window.dispatchEvent(new CustomEvent("dh-team-change", { detail: fav }));
  } catch {
    /* event dispatch is best-effort */
  }
}
