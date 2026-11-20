-- The databank: the model's own memory. One row per player per game
-- (raw stat lines), one row per stated pick, one grade per pick, rolling
-- rates with the sample size beside them, and one audit row per renewal run.
CREATE TABLE `databank_game_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sport` text NOT NULL,
  `player_name` text NOT NULL,
  `player_id` text NOT NULL,
  `game_date` text NOT NULL,
  `opponent` text,
  `home_away` text,
  `stats_json` text NOT NULL,
  `source` text NOT NULL,
  `ingested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `databank_game_logs_identity_idx` ON `databank_game_logs` (`sport`,`player_id`,`game_date`);
--> statement-breakpoint
CREATE INDEX `databank_game_logs_player_idx` ON `databank_game_logs` (`sport`,`player_id`);
--> statement-breakpoint
CREATE TABLE `databank_picks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sport` text NOT NULL,
  `pick_kind` text NOT NULL,
  `player_name` text,
  `player_id` text,
  `team` text,
  `market` text NOT NULL,
  `line` real,
  `stated_probability` real NOT NULL,
  `price` integer,
  `game_date` text NOT NULL,
  `opponent` text,
  `snapshot_at` integer NOT NULL,
  `source` text NOT NULL DEFAULT 'live',
  `note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `databank_picks_identity_idx` ON `databank_picks` (`sport`,`pick_kind`,`player_id`,`team`,`market`,`line`,`game_date`);
--> statement-breakpoint
CREATE INDEX `databank_picks_ungraded_idx` ON `databank_picks` (`game_date`);
--> statement-breakpoint
CREATE TABLE `databank_grades` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `pick_id` integer NOT NULL,
  `outcome` text NOT NULL,
  `actual_value` text,
  `graded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `databank_grades_pick_idx` ON `databank_grades` (`pick_id`);
--> statement-breakpoint
CREATE TABLE `databank_rates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sport` text NOT NULL,
  `player_name` text NOT NULL,
  `player_id` text NOT NULL,
  `market` text NOT NULL,
  `line` real,
  `hits` integer NOT NULL DEFAULT 0,
  `games` integer NOT NULL DEFAULT 0,
  `rate` real NOT NULL DEFAULT 0,
  `volume_json` text,
  `last_game_date` text,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `databank_rates_identity_idx` ON `databank_rates` (`sport`,`player_id`,`market`,`line`);
--> statement-breakpoint
CREATE TABLE `databank_renewals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer,
  `status` text NOT NULL,
  `rows_ingested` integer NOT NULL DEFAULT 0,
  `picks_snapshot` integer NOT NULL DEFAULT 0,
  `picks_graded` integer NOT NULL DEFAULT 0,
  `rates_recomputed` integer NOT NULL DEFAULT 0,
  `error_message` text,
  `note` text
);
