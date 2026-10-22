import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";

// Database: Turso (persistent cloud SQLite) in production, local file in dev.
// Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Render for persistence.
// Without them, falls back to local ./data/app.db (ephemeral on Render free tier).
//
// Hardened boot: when Turso env vars are present the connection is retried
// with backoff before falling back, so a transient network/DNS blip at boot
// can't silently swap the app onto the throwaway database. `dbSource` names
// which database is actually live — the owner console surfaces it through
// getTrackerStatus, so a fallback can never hide again.
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let db: any;
let dbSource: "turso" | "local" = "local";
let dbNote: string | null = "local by configuration (no Turso env vars)";

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

// Retry delays (ms) for the Turso connection at boot. Total budget ~31s plus
// the attempt time — well within Render's boot window, and short enough that
// a real outage still fails over to local instead of crash-looping.
const TURSO_RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

async function connectTurso(): Promise<any> {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const client = createClient({ url: tursoUrl!, authToken: tursoToken! });
  // Verify the connection works before committing to it.
  await client.execute("SELECT 1");
  const dbClient = drizzle(client, { schema });
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? "./drizzle");
  if (existsSync(migrationsFolder)) {
    await migrate(dbClient, { migrationsFolder });
  } else {
    console.warn(`[db] migrations folder not found at ${migrationsFolder}; skipping migrate()`);
  }
  return dbClient;
}

if (tursoUrl && tursoToken) {
  // Production: Turso cloud SQLite — survives deploys and restarts.
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= TURSO_RETRY_DELAYS.length; attempt++) {
    try {
      db = await connectTurso();
      dbSource = "turso";
      dbNote = null;
      console.log(`[db] using Turso cloud database${attempt > 0 ? ` (connected on attempt ${attempt + 1})` : ""}`);
      break;
    } catch (err) {
      lastError = err;
      const delay = TURSO_RETRY_DELAYS[attempt];
      if (delay !== undefined) {
        console.warn(`[db] Turso connection attempt ${attempt + 1} failed (${err instanceof Error ? err.message : err}); retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  if (!db) {
    dbNote = `Turso configured but unreachable after ${TURSO_RETRY_DELAYS.length + 1} attempts: ${lastError instanceof Error ? lastError.message : lastError}`;
    console.error(`[db] WARNING — ${dbNote}. Falling back to local SQLite (EPHEMERAL on Render: tracker snapshots and grades written here will be lost on the next restart).`);
  }
}

if (!db) {
  // Local/dev: file-based SQLite.
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const dbPath = resolve(process.env.DB_PATH ?? "./data/app.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  db = drizzle(sqlite, { schema });
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? "./drizzle");
  if (existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  } else {
    console.warn(`[db] migrations folder not found at ${migrationsFolder}; skipping migrate()`);
  }
  console.log("[db] using local SQLite database");
  if (!dbNote) dbNote = "local by configuration (no Turso env vars)";
}

export { db, dbSource, dbNote };
export type Db = typeof db;
