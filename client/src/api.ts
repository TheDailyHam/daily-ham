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

export const api = {
  getDashboard: (args: ActionArgs<"getDashboard">) => callAction("getDashboard", args),
  refreshDaily: (args: ActionArgs<"refreshDaily">) => callAction("refreshDaily", args),
  getNhlOverview: (args: ActionArgs<"getNhlOverview">) => callAction("getNhlOverview", args),
  getFirstGoalMatchup: (args: ActionArgs<"getFirstGoalMatchup">) => callAction("getFirstGoalMatchup", args),
  getHotStreaks: (args: ActionArgs<"getHotStreaks">) => callAction("getHotStreaks", args),
  getNhlRoster: (args: ActionArgs<"getNhlRoster">) => callAction("getNhlRoster", args),
  getNhlPlayerGameLog: (args: ActionArgs<"getNhlPlayerGameLog">) => callAction("getNhlPlayerGameLog", args),
  getPremiumBoard: (args: ActionArgs<"getPremiumBoard">) => callAction("getPremiumBoard", args),
  getAdminStatus: (args: ActionArgs<"getAdminStatus">) => callAction("getAdminStatus", args),
  refreshAllSportsbooks: (args: ActionArgs<"refreshAllSportsbooks">) => callAction("refreshAllSportsbooks", args),
  getSportsGameOddsKeyStatus: (args: ActionArgs<"getSportsGameOddsKeyStatus">) => callAction("getSportsGameOddsKeyStatus", args),
  saveSportsGameOddsKey: (args: ActionArgs<"saveSportsGameOddsKey">) => callAction("saveSportsGameOddsKey", args),
  removeSportsGameOddsKey: (args: ActionArgs<"removeSportsGameOddsKey">) => callAction("removeSportsGameOddsKey", args),
  getOddsApiKeyStatus: (args: ActionArgs<"getOddsApiKeyStatus">) => callAction("getOddsApiKeyStatus", args),
  saveOddsApiKey: (args: ActionArgs<"saveOddsApiKey">) => callAction("saveOddsApiKey", args),
  removeOddsApiKey: (args: ActionArgs<"removeOddsApiKey">) => callAction("removeOddsApiKey", args),
};

// Re-exported for convenience so client code can do
//
//     import { api, type ApiResponse } from "./api";
//     type Board = ApiResponse<typeof api, "getPremiumBoard">;
export type ApiRequest<TApi, TName extends keyof TApi> = TApi[TName] extends (...args: infer P) => unknown ? P[0] : never;
export type ApiResponse<TApi, TName extends keyof TApi> = TApi[TName] extends (...args: never[]) => infer R ? Awaited<R> : never;
