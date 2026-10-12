// Typed RPC client for the standalone server. Types come straight from
// `server/src/actions.ts` — no codegen. Each `api.<action>(args)` call POSTs
// `{action, args}` to `/api/actions` and returns the typed response payload,
// preserving the exact call style used across App.tsx.
//
// `import type { Actions }` is type-only by design: the client bundle never
// pulls in any server runtime (better-sqlite3, express, etc.). With
// `verbatimModuleSyntax: true`, dropping `type` is a compile error.

import type { z } from "zod";
import type { Actions } from "@server/actions";

type ActionName = keyof typeof Actions;
type ActionArgs<N extends ActionName> = z.input<(typeof Actions)[N]["request"]>;
type ActionData<N extends ActionName> = z.output<(typeof Actions)[N]["response"]>;

async function callAction<N extends ActionName>(action: N, args: ActionArgs<N>): Promise<ActionData<N>> {
  const response = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const payload = (await response.json()) as { ok: boolean; data?: unknown; error?: string };
  if (!payload.ok) {
    throw new Error(typeof payload.error === "string" && payload.error ? payload.error : "The request could not be completed.");
  }
  return payload.data as ActionData<N>;
}

// Server actions that are landing in a parallel server leg (not yet in
// `server/src/actions.ts`). These are typed loosely here so the client builds
// and degrades gracefully until then; once the server exposes them, collapse
// these onto `callAction` like the rest.
async function callPending<T>(action: string, args: unknown): Promise<T> {
  const response = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const payload = (await response.json()) as { ok: boolean; data?: unknown; error?: string };
  if (!payload.ok) {
    throw new Error(typeof payload.error === "string" && payload.error ? payload.error : "The request could not be completed.");
  }
  return payload.data as T;
}

export type KeyInjuryPlayer = { name: string; position: string | null; status: string; note: string | null };
export type KeyInjuries = { fetchedAt: string | null; teams: { team: string; players: KeyInjuryPlayer[] }[] };
export type UsageStats = {
  today: { uniques: number; views: number };
  yesterday: { uniques: number; views: number };
  last14: { date: string; uniques: number; views: number }[];
  bySport: { sport: string; views: number }[];
};

// ---------------------------------------------------------------------------
// Soccer (server leg: server/src/soccer.ts). Shapes mirror the server's
// zod contracts exactly; every soccer view hides gracefully until the
// getSoccer* actions resolve.
// ---------------------------------------------------------------------------
export type SoccerLeague = "mls" | "epl";
export type SoccerGameSide = { abbrev: string; name: string; score: number | null; winner: boolean };
export type SoccerThreeWay = { home: number; draw: number; away: number };
export type SoccerGame = {
  id: number; date: string; startsAt: string; state: string; detail: string;
  shortName: string; away: SoccerGameSide; home: SoccerGameSide;
  modelThreeWay: SoccerThreeWay | null;
};
export type SoccerStandingRow = {
  team: string; name: string; played: number; wins: number; draws: number; losses: number; points: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; streak: string | null;
  attackRating: number | null; defenseRating: number | null;
  modelHome: number | null; modelDraw: number | null; modelAway: number | null;
};
export type SoccerOverview = {
  league: SoccerLeague; season: number; fetchedAt: string;
  scheduleSourceUrl: string; standingsSourceUrl: string;
  games: SoccerGame[]; standings: SoccerStandingRow[];
};
export type SoccerMatchupTeam = {
  team: string; games: number; wins: number; draws: number; losses: number;
  venueGames: number; venueWins: number; venueDraws: number; venueLosses: number;
  goalsFor: number; goalsAgainst: number; venueGoalsFor: number; venueGoalsAgainst: number;
  form: string;
};
export type SoccerMatchup = {
  league: SoccerLeague; away: SoccerMatchupTeam; home: SoccerMatchupTeam;
  homeWinProbability: number | null; drawProbability: number | null; awayWinProbability: number | null;
  edgeTeam: string | null; edgeProbability: number | null;
  over25Probability: number | null; bttsProbability: number | null; margin3PlusProbability: number | null;
  homeExpectedGoals: number | null; awayExpectedGoals: number | null;
  headToHead: { games: number; homeWins: number; draws: number; awayWins: number };
  fetchedAt: string; sourceUrl: string; sampleNote: string;
};
export type SoccerPlayer = {
  id: number; name: string; jersey: string | null; position: string;
  games: number | null; goals: number | null; assists: number | null;
};
export type SoccerRoster = { league: SoccerLeague; team: string; season: number; fetchedAt: string; sourceUrl: string; players: SoccerPlayer[] };
export type SoccerPlayerGame = {
  gameId: number; gameDate: string; opponent: string; homeRoad: "home" | "away";
  result: "W" | "D" | "L"; teamScore: number; oppScore: number;
  goals: number; assists: number; appearances: number;
};
export type SoccerPlayerGameLog = {
  league: SoccerLeague; playerId: number; playerName: string | null; team: string; season: number;
  fetchedAt: string; sourceUrl: string; games: SoccerPlayerGame[];
};
export type SoccerHotPlayer = { name: string; team: string; position: string | null; goals: number; games: number; braces: number };
export type SoccerStreakTeam = { team: string; name: string; streak: string; points: number };
export type SoccerHotStreaks = {
  league: SoccerLeague; fetchedAt: string; sourceUrl: string;
  windowStart: string; windowEnd: string; players: SoccerHotPlayer[]; teams: SoccerStreakTeam[];
};
export type SoccerColdPlayer = { name: string; team: string; seasonGoals: number; appearances: number };
export type SoccerColdStreaks = {
  league: SoccerLeague; fetchedAt: string; sourceUrl: string;
  windowStart: string; windowEnd: string; players: SoccerColdPlayer[]; teams: SoccerStreakTeam[];
};
export type ScorerEntry = { name: string; team: string; position?: string | null; games: number; stat: number; rate: number };
export type ScorerBoard = { teams: Record<string, ScorerEntry[]> };

export const api = {
  getDashboard: (args: ActionArgs<"getDashboard">) => callAction("getDashboard", args),  refreshDaily: (args: ActionArgs<"refreshDaily">) => callAction("refreshDaily", args),
  getNhlOverview: (args: ActionArgs<"getNhlOverview">) => callAction("getNhlOverview", args),
  getFirstGoalMatchup: (args: ActionArgs<"getFirstGoalMatchup">) => callAction("getFirstGoalMatchup", args),
  getHotStreaks: (args: ActionArgs<"getHotStreaks">) => callAction("getHotStreaks", args),
  getColdStreaks: (args: ActionArgs<"getColdStreaks">) => callAction("getColdStreaks", args),
  getNhlRoster: (args: ActionArgs<"getNhlRoster">) => callAction("getNhlRoster", args),
  getNhlPlayerGameLog: (args: ActionArgs<"getNhlPlayerGameLog">) => callAction("getNhlPlayerGameLog", args),
  getNflOverview: (args: ActionArgs<"getNflOverview">) => callAction("getNflOverview", args),
  getNflMatchup: (args: ActionArgs<"getNflMatchup">) => callAction("getNflMatchup", args),
  getNflHotStreaks: (args: ActionArgs<"getNflHotStreaks">) => callAction("getNflHotStreaks", args),
  getNflColdStreaks: (args: ActionArgs<"getNflColdStreaks">) => callAction("getNflColdStreaks", args),
  getLikelyScorers: (args: ActionArgs<"getLikelyScorers">) => callAction("getLikelyScorers", args),
  getPublicPlates: (args: ActionArgs<"getPublicPlates">) => callAction("getPublicPlates", args),
  getMyPlates: (args: ActionArgs<"getMyPlates">) => callAction("getMyPlates", args),
  savePlate: (args: ActionArgs<"savePlate">) => callAction("savePlate", args),
  deletePlate: (args: ActionArgs<"deletePlate">) => callAction("deletePlate", args),
  getNflRoster: (args: ActionArgs<"getNflRoster">) => callAction("getNflRoster", args),
  getNflPlayerGameLog: (args: ActionArgs<"getNflPlayerGameLog">) => callAction("getNflPlayerGameLog", args),
  getNbaOverview: (args: ActionArgs<"getNbaOverview">) => callAction("getNbaOverview", args),
  getNbaMatchup: (args: ActionArgs<"getNbaMatchup">) => callAction("getNbaMatchup", args),
  getNbaHotStreaks: (args: ActionArgs<"getNbaHotStreaks">) => callAction("getNbaHotStreaks", args),
  getNbaColdStreaks: (args: ActionArgs<"getNbaColdStreaks">) => callAction("getNbaColdStreaks", args),
  getNbaRoster: (args: ActionArgs<"getNbaRoster">) => callAction("getNbaRoster", args),
  getNbaPlayerGameLog: (args: ActionArgs<"getNbaPlayerGameLog">) => callAction("getNbaPlayerGameLog", args),
  getPremiumBoard: (args: ActionArgs<"getPremiumBoard">) => callAction("getPremiumBoard", args),
  getAdminStatus: (args: ActionArgs<"getAdminStatus">) => callAction("getAdminStatus", args),
  refreshAllSportsbooks: (args: ActionArgs<"refreshAllSportsbooks">) => callAction("refreshAllSportsbooks", args),
  getSportsGameOddsKeyStatus: (args: ActionArgs<"getSportsGameOddsKeyStatus">) => callAction("getSportsGameOddsKeyStatus", args),
  saveSportsGameOddsKey: (args: ActionArgs<"saveSportsGameOddsKey">) => callAction("saveSportsGameOddsKey", args),
  removeSportsGameOddsKey: (args: ActionArgs<"removeSportsGameOddsKey">) => callAction("removeSportsGameOddsKey", args),
  getOddsApiKeyStatus: (args: ActionArgs<"getOddsApiKeyStatus">) => callAction("getOddsApiKeyStatus", args),
  saveOddsApiKey: (args: ActionArgs<"saveOddsApiKey">) => callAction("saveOddsApiKey", args),
  removeOddsApiKey: (args: ActionArgs<"removeOddsApiKey">) => callAction("removeOddsApiKey", args),
  // Pending server actions (see callPending above): fail gracefully client-side until the server lands them.
  getKeyInjuries: (args: { sport: "nhl" | "nfl" | "nba" }) => callPending<KeyInjuries>("getKeyInjuries", args),
  getUsageStats: (args: { adminToken?: string }) => callPending<UsageStats>("getUsageStats", args),
  // Soccer leg (server landing in parallel): every view hides gracefully until these resolve.
  getSoccerOverview: (args: { league: SoccerLeague }) => callPending<SoccerOverview>("getSoccerOverview", args),
  getSoccerMatchup: (args: { league: SoccerLeague; awayTeam: string; homeTeam: string; force?: boolean }) => callPending<SoccerMatchup>("getSoccerMatchup", args),
  getSoccerHotStreaks: (args: { league: SoccerLeague; force?: boolean }) => callPending<SoccerHotStreaks>("getSoccerHotStreaks", args),
  getSoccerColdStreaks: (args: { league: SoccerLeague; force?: boolean }) => callPending<SoccerColdStreaks>("getSoccerColdStreaks", args),
  getSoccerRoster: (args: { league: SoccerLeague; team: string }) => callPending<SoccerRoster>("getSoccerRoster", args),
  getSoccerPlayerGameLog: (args: { league: SoccerLeague; team: string; playerId: number }) => callPending<SoccerPlayerGameLog>("getSoccerPlayerGameLog", args),
  getSoccerBoard: (args: { league: SoccerLeague }) => callPending<SoccerBoardData>("getPremiumBoard", { sport: "soccer", league: args.league }),
  getSoccerKeyInjuries: (args: { league: SoccerLeague }) => callPending<KeyInjuries>("getKeyInjuries", { sport: "soccer", league: args.league }),
  getSoccerLikelyScorers: (args: { league: SoccerLeague }) => callPending<ScorerBoard>("getLikelyScorers", { sport: "soccer", league: args.league }),
};

// Re-exported for convenience so client code can do
//
//     import { api, type ApiResponse } from "./api";
//     type Board = ApiResponse<typeof api, "getPremiumBoard">;
export type ApiRequest<TApi, TName extends keyof TApi> = TApi[TName] extends (...args: infer P) => unknown ? P[0] : never;
export type ApiResponse<TApi, TName extends keyof TApi> = TApi[TName] extends (...args: never[]) => infer R ? Awaited<R> : never;

// Premium board payload shape, reused by the soccer board (same server
// action, sport="soccer").
export type SoccerBoardData = ApiResponse<typeof api, "getPremiumBoard">;
