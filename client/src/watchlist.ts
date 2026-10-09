// Favorite-players watchlist: per-device localStorage, same as the favorite
// team picker. Each entry records enough to open the full player file later.
// The watchlist UI tints every row with the player's own team color, while
// the global accent theming (favorite team) keeps working on top of it.

import type { League } from "./teams";

export type WatchedPlayer = {
  sport: League;
  playerId: number;
  team: string;
  name: string;
  position: string;
};

const WATCHLIST_KEY = "dh-watchlist";

export function loadWatchlist(): WatchedPlayer[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const sport = row.sport === "nfl" ? "nfl" : row.sport === "nhl" ? "nhl" : null;
      const playerId = typeof row.playerId === "number" ? row.playerId : null;
      const team = typeof row.team === "string" ? row.team : null;
      const name = typeof row.name === "string" ? row.name : null;
      if (!sport || playerId === null || !team || !name) return [];
      return [{
        sport,
        playerId,
        team,
        name,
        position: typeof row.position === "string" ? row.position : "—",
      }];
    });
  } catch {
    return [];
  }
}

function persist(list: WatchedPlayer[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable; watchlist lasts for this page view only */
  }
  try {
    window.dispatchEvent(new CustomEvent("dh-watchlist-change"));
  } catch {
    /* best-effort */
  }
}

export function isWatched(sport: League, playerId: number): boolean {
  return loadWatchlist().some((p) => p.sport === sport && p.playerId === playerId);
}

export function toggleWatch(player: WatchedPlayer): boolean {
  const list = loadWatchlist();
  const index = list.findIndex((p) => p.sport === player.sport && p.playerId === player.playerId);
  if (index >= 0) {
    list.splice(index, 1);
    persist(list);
    return false;
  }
  list.push(player);
  persist(list);
  return true;
}

export function removeWatched(sport: League, playerId: number): void {
  persist(loadWatchlist().filter((p) => !(p.sport === sport && p.playerId === playerId)));
}
