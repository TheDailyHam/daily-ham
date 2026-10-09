// Favorite-players (and teams) watchlist: per-device localStorage, same as
// the favorite team picker. Player entries record enough to open the full
// player file later; team entries jump to that team's roster.
// The watchlist UI tints every row with the entry's own team color, while
// the global accent theming (favorite team) keeps working on top of it.

import type { League } from "./teams";

export type WatchedPlayer = {
  kind: "player";
  sport: League;
  playerId: number;
  team: string;
  name: string;
  position: string;
};

export type WatchedTeam = {
  kind: "team";
  sport: League;
  team: string;
  name: string;
};

export type WatchedEntry = WatchedPlayer | WatchedTeam;

const WATCHLIST_KEY = "dh-watchlist";

function normalizeEntry(item: unknown): WatchedEntry | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const sport = row.sport === "nfl" ? "nfl" : row.sport === "nhl" ? "nhl" : null;
  const team = typeof row.team === "string" ? row.team : null;
  const name = typeof row.name === "string" ? row.name : null;
  if (!sport || !team || !name) return null;
  if (row.kind === "team") return { kind: "team", sport, team, name };
  // Legacy entries (and explicit players) carry a playerId.
  const playerId = typeof row.playerId === "number" ? row.playerId : null;
  if (playerId === null) return null;
  return {
    kind: "player",
    sport,
    playerId,
    team,
    name,
    position: typeof row.position === "string" ? row.position : "—",
  };
}

export function loadWatchlist(): WatchedEntry[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const entry = normalizeEntry(item);
      return entry ? [entry] : [];
    });
  } catch {
    return [];
  }
}

function persist(list: WatchedEntry[]): void {
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

function entryKey(entry: WatchedEntry): string {
  return entry.kind === "player"
    ? `player:${entry.sport}:${entry.playerId}`
    : `team:${entry.sport}:${entry.team}`;
}

export function isWatchedPlayer(sport: League, playerId: number): boolean {
  return loadWatchlist().some((p) => p.kind === "player" && p.sport === sport && p.playerId === playerId);
}

export function isWatchedTeam(sport: League, team: string): boolean {
  return loadWatchlist().some((p) => p.kind === "team" && p.sport === sport && p.team === team);
}

// Back-compat alias used by older call sites.
export const isWatched = isWatchedPlayer;

export function toggleWatch(entry: WatchedEntry): boolean {
  const list = loadWatchlist();
  const key = entryKey(entry);
  const index = list.findIndex((p) => entryKey(p) === key);
  if (index >= 0) {
    list.splice(index, 1);
    persist(list);
    return false;
  }
  list.push(entry);
  persist(list);
  return true;
}

export function removeWatchedEntry(entry: WatchedEntry): void {
  const key = entryKey(entry);
  persist(loadWatchlist().filter((p) => entryKey(p) !== key));
}

// Back-compat: remove a player by sport + id.
export function removeWatched(sport: League, playerId: number): void {
  removeWatchedEntry({ kind: "player", sport, playerId, team: "", name: "", position: "—" });
}
