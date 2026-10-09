// Plain network helpers for The Odds API (the-odds-api.com) v4 provider.
// Mirrors the style of provider.ts: plain functions, local helpers, no new
// dependencies. One request per odds-board refresh regardless of game count,
// so the free tier (500 requests/month) comfortably covers a daily refresh.

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function num(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function failure(status: number, detail?: string) {
  const base = { ok: false as const, status, detail: detail ?? null };
  if (status === 401 || status === 403) return { ...base, reason: "rejected" as const };
  if (status === 429) return { ...base, reason: "rate_limited" as const };
  return { ...base, reason: "provider_error" as const };
}

// The Odds API explains parameter problems in the response body — capture it
// so the UI can show something useful instead of a bare status code.
async function errorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as unknown;
    const message = record(body)?.message;
    return typeof message === "string" && message.trim() ? message.trim().slice(0, 200) : undefined;
  } catch { return undefined; }
}

// Full NHL team-name -> team-code map, keyed on a normalized form
// (lowercase, accents stripped, whitespace collapsed). Included for future
// use; unknown names are skipped warning-free and never crash parsing.
function normalizeTeamName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
const NHL_TEAM_CODES: Record<string, string> = {
  "anaheim ducks": "ANA", "boston bruins": "BOS", "buffalo sabres": "BUF", "calgary flames": "CGY",
  "carolina hurricanes": "CAR", "chicago blackhawks": "CHI", "colorado avalanche": "COL", "columbus blue jackets": "CBJ",
  "dallas stars": "DAL", "detroit red wings": "DET", "edmonton oilers": "EDM", "florida panthers": "FLA",
  "los angeles kings": "LAK", "minnesota wild": "MIN", "montreal canadiens": "MTL", "nashville predators": "NSH",
  "new jersey devils": "NJD", "new york islanders": "NYI", "new york rangers": "NYR", "ottawa senators": "OTT",
  "philadelphia flyers": "PHI", "pittsburgh penguins": "PIT", "san jose sharks": "SJS", "seattle kraken": "SEA",
  "st louis blues": "STL", "tampa bay lightning": "TBL", "toronto maple leafs": "TOR", "utah mammoth": "UTA",
  "vancouver canucks": "VAN", "vegas golden knights": "VGK", "washington capitals": "WSH", "winnipeg jets": "WPG",
};
const NFL_TEAM_CODES: Record<string, string> = {
  "arizona cardinals": "ARI", "atlanta falcons": "ATL", "baltimore ravens": "BAL", "buffalo bills": "BUF",
  "carolina panthers": "CAR", "chicago bears": "CHI", "cincinnati bengals": "CIN", "cleveland browns": "CLE",
  "dallas cowboys": "DAL", "denver broncos": "DEN", "detroit lions": "DET", "green bay packers": "GB",
  "houston texans": "HOU", "indianapolis colts": "IND", "jacksonville jaguars": "JAX", "kansas city chiefs": "KC",
  "los angeles chargers": "LAC", "los angeles rams": "LAR", "las vegas raiders": "LV", "miami dolphins": "MIA",
  "minnesota vikings": "MIN", "new england patriots": "NE", "new orleans saints": "NO", "new york giants": "NYG",
  "new york jets": "NYJ", "philadelphia eagles": "PHI", "pittsburgh steelers": "PIT", "seattle seahawks": "SEA",
  "san francisco 49ers": "SF", "tampa bay buccaneers": "TB", "tennessee titans": "TEN", "washington commanders": "WSH",
};
export function oddsApiTeamCode(name: string, sport: "nhl" | "nfl" = "nhl"): string | null {
  const map = sport === "nfl" ? NFL_TEAM_CODES : NHL_TEAM_CODES;
  return map[normalizeTeamName(name)] ?? null;
}

function marketNames(sport: "nhl" | "nfl"): Record<string, string> {
  return sport === "nfl"
    ? { h2h: "Moneyline", spreads: "Spread", totals: "Total Points" }
    : { h2h: "Moneyline", spreads: "Puck Line", totals: "Total Goals" };
}
const SPORT_KEYS = { nhl: "icehockey_nhl", nfl: "americanfootball_nfl" } as const;

export async function validateOddsApiKey(args: { apiKey: string }) {
  // One cheap request: a single market keeps validation inside the free budget.
  const params = new URLSearchParams({ apiKey: args.apiKey, regions: "us", markets: "h2h" });
  const response = await fetch(`https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return failure(response.status, await errorDetail(response));
  return { ok: true as const };
}

// Rolling short window (yesterday 00:00 UTC through 3 days out 23:59 UTC) —
// the same philosophy as the SportsGameOdds window fix: the board only ever
// shows the near-term slate, and one response carries every game, market and
// bookmaker, so this costs exactly 1 request per refresh.
const WINDOW_DAYS_BEFORE = 1;
const WINDOW_DAYS_AFTER = 3;

export async function fetchOddsApiEvents(args: { apiKey: string; sport?: "nhl" | "nfl" }) {
  const sport = args.sport ?? "nhl";
  const sportKey = SPORT_KEYS[sport];
  const names = marketNames(sport);
  const now = new Date();
  // The Odds API requires commence times as YYYY-MM-DDTHH:MM:SSZ — no
  // milliseconds. Date.toISOString() emits ".000Z", which the API rejects
  // with 422 INVALID_COMMENCE_TIME_FROM.
  const isoNoMs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const commenceTimeFrom = isoNoMs(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - WINDOW_DAYS_BEFORE, 0, 0, 0)));
  const commenceTimeTo = isoNoMs(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + WINDOW_DAYS_AFTER, 23, 59, 59)));
  const params = new URLSearchParams({
    apiKey: args.apiKey, regions: "us", markets: "h2h,spreads,totals",
    oddsFormat: "american", dateFormat: "iso", commenceTimeFrom, commenceTimeTo,
  });
  const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return failure(response.status, await errorDetail(response));
  const payload = (await response.json()) as unknown;
  const events = Array.isArray(payload) ? payload : [];
  return { ok: true as const, status: 200 as const, payload: { data: events, sport, marketNames: names } };
}

export type OddsApiOffer = {
  eventId: string; matchup: string; startsAt: string | null; oddId: string;
  stat: string; marketName: string; entity: string; entityType: "player" | "team" | "event";
  period: string; betType: string; side: string; book: string;
  odds: string | null; fairOdds: string | null; line: string | null;
  openingOdds: string | null; openingLine: string | null;
};

export function parseOddsApiPayload(raw: unknown, opts?: { sport?: "nhl" | "nfl"; marketNames?: Record<string, string> }): { eventCount: number; marketCount: number; offerCount: number; offers: OddsApiOffer[] } {
  const sport = opts?.sport ?? "nhl";
  const names = opts?.marketNames ?? marketNames(sport);
  const events = Array.isArray(raw) ? raw : [];
  const offers: OddsApiOffer[] = [];
  let marketCount = 0;
  for (const eventValue of events) {
    const event = record(eventValue);
    if (!event) continue;
    const eventId = text(event.id) ?? "event";
    const awayTeam = text(event.away_team) ?? "";
    const homeTeam = text(event.home_team) ?? "";
    // Validate names against the team map; unknown names are skipped
    // warning-free and never crash — the feed's names are used as-is.
    oddsApiTeamCode(awayTeam, sport);
    oddsApiTeamCode(homeTeam, sport);
    const matchup = awayTeam && homeTeam ? `${awayTeam} @ ${homeTeam}` : eventId;
    const startsAt = text(event.commence_time);
    const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];
    for (const bookmakerValue of bookmakers) {
      const bookmaker = record(bookmakerValue);
      if (!bookmaker) continue;
      const book = text(bookmaker.title) ?? text(bookmaker.key) ?? "Book";
      const markets = Array.isArray(bookmaker.markets) ? bookmaker.markets : [];
      for (const marketValue of markets) {
        const market = record(marketValue);
        if (!market) continue;
        const marketKey = text(market.key) ?? "market";
        const marketName = names[marketKey] ?? marketKey;
        marketCount += 1;
        const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
        for (const outcomeValue of outcomes) {
          const outcome = record(outcomeValue);
          if (!outcome) continue;
          const price = num(outcome.price);
          if (price === null) continue; // skip non-finite prices
          const outcomeName = text(outcome.name) ?? "—";
          const point = num(outcome.point);
          const isTotals = marketKey === "totals";
          offers.push({
            eventId, matchup, startsAt, oddId: `${eventId}:${marketKey}`,
            stat: "market", marketName,
            entity: isTotals ? "All" : outcomeName,
            entityType: isTotals ? "event" : "team",
            period: "game", betType: marketKey, side: outcomeName,
            book, odds: String(price), fairOdds: null,
            line: point === null ? null : String(point),
            openingOdds: null, openingLine: null,
          });
        }
      }
    }
  }
  return { eventCount: events.length, marketCount, offerCount: offers.length, offers };
}
