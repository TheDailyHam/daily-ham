import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

const dbPath = resolve(process.env.DB_PATH ?? "./data/app.db");
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });

const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? "./drizzle");
if (existsSync(migrationsFolder)) {
  migrate(db, { migrationsFolder });
} else {
  console.warn(`[db] migrations folder not found at ${migrationsFolder}; skipping migrate()`);
}
