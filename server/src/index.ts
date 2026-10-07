import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import express from "express";
import { z } from "zod";
import { db } from "./db.js";
import { Actions, type Ctx } from "./actions.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

type ActionDef = {
  request: z.ZodTypeAny;
  response: z.ZodTypeAny;
  handler: (ctx: Ctx, args: never) => Promise<unknown>;
};
const registry = Actions as unknown as Record<string, ActionDef>;
const ctx: Ctx = { db };

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), actions: Object.keys(registry).length });
});

app.post("/api/actions", async (req, res) => {
  const actionName = typeof req.body?.action === "string" ? req.body.action : "";
  const def = registry[actionName];
  if (!def) {
    res.json({ ok: false, error: `Unknown action: ${actionName || "(missing)"}` });
    return;
  }
  try {
    const args = def.request.parse(req.body?.args ?? {});
    const result = await def.handler(ctx, args as never);
    const data = def.response.parse(result);
    res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request could not be completed.";
    res.json({ ok: false, error: message });
  }
});

// Serve the built React client (client/dist) when present; otherwise the API
// still works on its own.
const clientDir = resolve(process.env.CLIENT_DIR ?? "./client/dist");
if (existsSync(clientDir)) {
  app.use(express.static(clientDir, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(clientDir, "index.html"));
  });
} else {
  console.warn(`[server] client build not found at ${clientDir}; serving API only`);
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[daily-ham] listening on :${port} (health: /api/health)`);
});
