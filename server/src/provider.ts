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

export async function fetchSportsGameOddsEvents(args: { apiKey: string }) {
  const events: unknown[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let status = 200;
  do {
    const params = new URLSearchParams({ oddsAvailable: "true", leagueID: "NHL", limit: "25", includeOpposingOdds: "true", includeAltLines: "true", includeOpenCloseOdds: "true" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`https://api.sportsgameodds.com/v2/events?${params.toString()}`, { headers: { Accept: "application/json", "x-api-key": args.apiKey } });
    status = response.status;
    if (!response.ok) return failure(response.status);
    const payload = await response.json() as unknown;
    const root = record(payload);
    const page = root && Array.isArray(root.data) ? root.data : root && Array.isArray(root.items) ? root.items : [];
    events.push(...page);
    const nextCursor = text(root?.nextCursor);
    if (!nextCursor || page.length === 0 || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);
  return { ok: true as const, status, payload: { data: events } };
}
