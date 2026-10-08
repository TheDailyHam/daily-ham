// Plain network helpers for the SportsGameOdds provider.
// Ported from the Muse-platform privileged handlers; identical request/response
// shapes, no platform imports.

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function failure(status: number) {
  if (status === 401 || status === 403) return { ok: false as const, status, reason: "rejected" as const };
  if (status === 429) return { ok: false as const, status, reason: "rate_limited" as const };
  return { ok: false as const, status, reason: "provider_error" as const };
}

export async function validateSportsGameOddsKey(args: { apiKey: string }) {
  const response = await fetch("https://api.sportsgameodds.com/v2/events?leagueID=NHL&limit=1", { headers: { Accept: "application/json", "x-api-key": args.apiKey } });
  if (!response.ok) return failure(response.status);
  return { ok: true as const };
}

// The free quota is counted per EVENT, not per market or bookmaker — one
// event carries every market and book for a single object. The old code
// fetched every upcoming NHL event with no date bound, which is exactly why
// the 2,500/month free budget died in one refresh: early in the season the
// feed returns hundreds of upcoming events.
//
// The board only ever shows the near-term slate, so this pulls a rolling
// short window (yesterday through 3 days out). The window rolls forward on
// every refresh, so games further out still get fresh odds as they enter it.
// At ~15 NHL games/day that costs roughly 40-70 objects per refresh —
// comfortably inside the free allowance with a single daily refresh.
// MAX_EVENTS is a hard guard so even a misbehaving date filter can't burn
// the budget in one go.
const FETCH_WINDOW_DAYS_BEFORE = 1;
const FETCH_WINDOW_DAYS_AFTER = 3;
const MAX_EVENTS = 300;

export async function fetchSportsGameOddsEvents(args: { apiKey: string }) {
  const now = new Date();
  const startsAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - FETCH_WINDOW_DAYS_BEFORE)).toISOString();
  const startsBefore = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + FETCH_WINDOW_DAYS_AFTER + 1)).toISOString();
  const events: unknown[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let status = 200;
  do {
    const params = new URLSearchParams({ oddsAvailable: "true", leagueID: "NHL", limit: "25", includeOpposingOdds: "true", includeAltLines: "true", includeOpenCloseOdds: "true", startsAfter, startsBefore });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`https://api.sportsgameodds.com/v2/events?${params.toString()}`, { headers: { Accept: "application/json", "x-api-key": args.apiKey } });
    status = response.status;
    if (!response.ok) return failure(response.status);
    const payload = await response.json() as unknown;
    const root = record(payload);
    const page = root && Array.isArray(root.data) ? root.data : root && Array.isArray(root.items) ? root.items : [];
    events.push(...page);
    if (events.length >= MAX_EVENTS) break;
    const nextCursor = text(root?.nextCursor);
    if (!nextCursor || page.length === 0 || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);
  return { ok: true as const, status, payload: { data: events.slice(0, MAX_EVENTS) } };
}
