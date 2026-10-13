import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import express from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "./db.js";
import * as schema from "./schema.js";
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

// Privacy-respecting usage tracker (admin eyes only via getUsageStats).
// One row per (UTC day, anonymized visitor, sport). The visitor hash is
// SHA-256(IP + day + user-agent): raw IPs are never stored, and hashes are
// unlinkable across days by design. Health checks are not tracked — only real
// app traffic through /api/actions. Wrapped so tracking can never break a
// request.
function sportForRequest(actionName: string, args: unknown): "nhl" | "nfl" | "nba" | "other" {
  const sport = (args as { sport?: unknown } | null)?.sport;
  if (sport === "nhl" || sport === "nfl" || sport === "nba") return sport;
  if (/nfl/i.test(actionName)) return "nfl";
  if (/nba/i.test(actionName)) return "nba";
  if (/nhl/i.test(actionName)) return "nhl";
  // Legacy unprefixed actions (dashboard, streaks, matchup) are NHL-era.
  if (/^(getDashboard|getFirstGoalMatchup|getHotStreaks|getColdStreaks)/i.test(actionName)) return "nhl";
  return "other";
}

function trackUsage(req: express.Request): void {
  try {
    const actionName = typeof req.body?.action === "string" ? req.body.action : "";
    if (!actionName) return;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"] ?? "";
    const day = new Date().toISOString().slice(0, 10);
    const visitorHash = createHash("sha256").update(`${ip}|${day}|${ua}`).digest("hex");
    const sport = sportForRequest(actionName, req.body?.args);
    db.insert(schema.usageDaily)
      .values({ date: day, visitorHash, sport, views: 1 })
      .onConflictDoUpdate({
        target: [schema.usageDaily.date, schema.usageDaily.visitorHash, schema.usageDaily.sport],
        set: { views: sql`${schema.usageDaily.views} + 1` },
      })
      .run();
  } catch {
    // Tracking never breaks a request.
  }
}

app.post("/api/actions", async (req, res) => {
  const actionName = typeof req.body?.action === "string" ? req.body.action : "";
  const def = registry[actionName];
  if (!def) {
    res.json({ ok: false, error: `Unknown action: ${actionName || "(missing)"}` });
    return;
  }
  trackUsage(req);
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
  // The owner console gets its own app identity (name, icon, start_url) served
  // server-side so installers see it deterministically — no client race.
  let ownerHtml: string | null = null;
  try {
    ownerHtml = readFileSync(join(clientDir, "index.html"), "utf8")
      .replace('rel="manifest" href="/manifest.json"', 'rel="manifest" href="/owner-manifest.json"\n    <meta name="robots" content="noindex, nofollow" />')
      .replace('<meta name="theme-color" content="#14100b" />', '<meta name="theme-color" content="#1a1410" />')
      .replace("<title>The Daily Ham — NHL, NFL, NBA & Soccer · Fresh Cuts Daily</title>", "<title>Daily Ham Owner — Private Console</title>");
  } catch { ownerHtml = null; /* fall through to the stock shell */ }
  app.get(/^(?!\/api\/).*/, (req, res) => {
    const isOwner = req.path === "/owner" || req.path.startsWith("/owner/");
    if (isOwner && ownerHtml) {
      res.type("html").send(ownerHtml);
      return;
    }
    res.sendFile(join(clientDir, "index.html"));
  });
} else {
  console.warn(`[server] client build not found at ${clientDir}; serving API only`);
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[daily-ham] listening on :${port} (health: /api/health)`);
});
