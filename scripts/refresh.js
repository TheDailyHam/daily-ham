// Daily refresh for a self-hosted Daily Ham.
// Invokes the same refreshDaily + refreshAllSportsbooks actions the app's
// Settings/UI uses, against the local server. Designed to run from the system
// cron (see README) or any scheduler. Exits non-zero when a refresh fails.
//
//   APP_URL=http://localhost:3000 ADMIN_TOKEN=your-admin-token node scripts/refresh.js
//   # or: APP_URL=https://ham.example.com ADMIN_TOKEN=your-admin-token node scripts/refresh.js
//
// The sportsbook leg requires ADMIN_TOKEN (same value as the server's
// ADMIN_TOKEN env var). The free-data leg (refreshDaily) needs no token.

const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function callAction(action, args = {}) {
  const response = await fetch(`${base}/api/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(`${action}: ${payload.error ?? "unknown error"}`);
  return payload.data;
}

async function main() {
  const started = new Date().toISOString();
  console.log(`[refresh] starting daily refresh at ${started} -> ${base}`);

  const daily = await callAction("refreshDaily", {});
  console.log(`[refresh] refreshDaily: status=${daily.status} rows=${daily.rowCount} message=${daily.message}`);

  let books = null;
  try {
    books = await callAction("refreshAllSportsbooks", { adminToken: process.env.ADMIN_TOKEN });
    console.log(`[refresh] refreshAllSportsbooks: status=${books.status} refreshed=${books.refreshedSports} message=${books.message}`);
  } catch (error) {
    // The sportsbook leg is allowed to fail (missing key, provider quota);
    // the free-data refresh above already landed.
    console.warn(`[refresh] refreshAllSportsbooks skipped: ${error.message}`);
  }

  // Only the free-data refresh gates success. The sportsbook leg is allowed to
  // fail (missing key, provider quota) — the app honestly reports Pro Odds as
  // unavailable in that case, and the free-data refresh above already landed.
  if (daily.status === "failed") {
    console.error("[refresh] daily refresh FAILED");
    process.exitCode = 1;
  } else {
    console.log("[refresh] done");
  }
}

main().catch((error) => {
  console.error(`[refresh] fatal: ${error.message}`);
  process.exitCode = 1;
});
