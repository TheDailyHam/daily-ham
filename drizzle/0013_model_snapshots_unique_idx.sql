-- Fix model_snapshots identity index: the tracker's upsertSnapshot() uses
-- INSERT ... ON CONFLICT (sport, league, away_team, home_team, game_date)
-- DO UPDATE, which SQLite only permits against a UNIQUE index. If the table
-- was created via drizzle-kit push (schema declared a plain index), every
-- upsert threw "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE
-- constraint" and was swallowed by the tracker's best-effort catch, so no
-- live snapshots ever persisted. Recreate the index as UNIQUE (idempotent:
-- safe to run whether the current index is plain or already unique).
DROP INDEX IF EXISTS `model_snapshots_identity_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `model_snapshots_identity_idx` ON `model_snapshots` (`sport`,`league`,`away_team`,`home_team`,`game_date`);
