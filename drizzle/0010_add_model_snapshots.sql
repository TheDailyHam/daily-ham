CREATE TABLE `model_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sport` text NOT NULL,
  `league` text,
  `away_team` text NOT NULL,
  `home_team` text NOT NULL,
  `game_date` text NOT NULL,
  `starts_at` integer,
  `snapshot_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `model_away` real,
  `model_home` real,
  `model_draw` real,
  `model_pick` text,
  `book_away_price` integer,
  `book_home_price` integer,
  `book_draw_price` integer,
  `book_away_prob` real,
  `book_home_prob` real,
  `book_draw_prob` real,
  `book_pick` text,
  `source` text NOT NULL DEFAULT 'live',
  `winner` text,
  `graded_at` integer,
  `model_correct` integer,
  `book_correct` integer
);
CREATE UNIQUE INDEX `model_snapshots_identity_idx` ON `model_snapshots` (`sport`,`league`,`away_team`,`home_team`,`game_date`);
CREATE INDEX `model_snapshots_graded_idx` ON `model_snapshots` (`graded_at`);
