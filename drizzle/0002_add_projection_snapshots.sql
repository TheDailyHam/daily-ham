DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE projections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sport TEXT NOT NULL,
  player TEXT NOT NULL,
  market TEXT NOT NULL,
  stat_key TEXT NOT NULL,
  line REAL NOT NULL,
  projection_value REAL,
  over_odds INTEGER,
  under_odds INTEGER,
  lean TEXT NOT NULL,
  lean_probability REAL,
  edge_text TEXT,
  rationale TEXT,
  event_id TEXT NOT NULL,
  game TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  snapshot_date TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX projections_sport_date_idx ON projections (sport, snapshot_date);
--> statement-breakpoint
CREATE INDEX projections_identity_idx ON projections (sport, event_id, player, stat_key, fetched_at);
--> statement-breakpoint
CREATE TABLE refresh_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0
);