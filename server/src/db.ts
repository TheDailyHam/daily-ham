import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";

// Database: Turso (persistent cloud SQLite) in production, local file in dev.
// Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Render for persistence.
// Without them, falls back to local ./data/app.db (ephemeral on Render free tier).
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

let db: any;

if (tursoUrl && tursoToken) {
  // Production: Turso cloud SQLite — survives deploys and restarts.
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const client = createClient({ url: tursoUrl, authToken: tursoToken });
  db = drizzle(client, { schema });
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? "./drizzle");
  if (existsSync(migrationsFolder)) {
    await migrate(db, { migrationsFolder });
  } else {
    console.warn(`[db] migrations folder not found at ${migrationsFolder}; skipping migrate()`);
  }
  console.log("[db] using Turso cloud database");
} else {
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
}

export { db };
export type Db = typeof db;
