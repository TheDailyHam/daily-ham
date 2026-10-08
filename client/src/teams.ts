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

export function loadFavoriteTeam(): string | null {
  try {
    const code = localStorage.getItem(FAVORITE_TEAM_KEY);
    return code && TEAM_THEMES.some((t) => t.code === code) ? code : null;
  } catch {
    return null;
  }
}

export function applyTeamTheme(code: string | null): void {
  try {
    const root = document.documentElement;
    const team = TEAM_THEMES.find((t) => t.code === code);
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
      root.setAttribute("data-fav-team", team.code);
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

export function saveFavoriteTeam(code: string | null): void {
  try {
    if (code) localStorage.setItem(FAVORITE_TEAM_KEY, code);
    else localStorage.removeItem(FAVORITE_TEAM_KEY);
  } catch {
    /* storage unavailable; theme still applies for the session */
  }
  applyTeamTheme(code);
  try {
    window.dispatchEvent(new CustomEvent("dh-team-change", { detail: code }));
  } catch {
    /* event dispatch is best-effort */
  }
}
