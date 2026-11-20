import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projections = sqliteTable(
  "projections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).notNull(),
    player: text("player").notNull(),
    market: text("market").notNull(),
    statKey: text("stat_key").notNull(),
    line: real("line").notNull(),
    projectionValue: real("projection_value"),
    overOdds: integer("over_odds"),
    underOdds: integer("under_odds"),
    lean: text("lean", { enum: ["over", "under"] }).notNull(),
    leanProbability: real("lean_probability"),
    edgeText: text("edge_text"),
    rationale: text("rationale"),
    eventId: text("event_id").notNull(),
    game: text("game").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceKind: text("source_kind", { enum: ["market", "analyst"] }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
    snapshotDate: text("snapshot_date").notNull(),
  },
  (table) => [
    index("projections_sport_date_idx").on(table.sport, table.snapshotDate),
    index("projections_identity_idx").on(
      table.sport,
      table.eventId,
      table.player,
      table.statKey,
      table.fetchedAt,
    ),
  ],
);

export const refreshRuns = sqliteTable("refresh_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["running", "success", "partial", "failed"] }).notNull(),
  message: text("message").notNull(),
  rowCount: integer("row_count").notNull().default(0),
});

export const providerCredentials = sqliteTable("provider_credentials", {
  provider: text("provider").primaryKey(),
  secretValue: text("secret_value").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const premiumOddsCache = sqliteTable("premium_odds_cache", {
  sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).primaryKey(),
  payloadJson: text("payload_json").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["fresh", "stale"] }).notNull(),
  message: text("message").notNull(),
});

export const nhlInsightCache = sqliteTable("nhl_insight_cache", {
  key: text("key").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const codyPlates = sqliteTable("cody_plates", {
  id: text("id").primaryKey(),
  sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).notNull(),
  matchup: text("matchup").notNull(),
  pick: text("pick").notNull(),
  note: text("note"),
  isPublic: integer("is_public").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const hamSelectionPlates = sqliteTable("ham_selection_plates", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  tierLabel: text("tier_label").notNull(),
  tierOdds: text("tier_odds").notNull(),
  imageData: text("image_data"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Transparent model-vs-books tracker: one row per game per day, snapshotting
// the pregame model probabilities and best book prices, then graded against
// the final result. source='backtest' rows are the Oct 7-12 launch backtest
// (model vs final scores only — historical book lines were never stored).
export const modelSnapshots = sqliteTable(
  "model_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).notNull(),
    league: text("league"),
    awayTeam: text("away_team").notNull(),
    homeTeam: text("home_team").notNull(),
    gameDate: text("game_date").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    snapshotAt: integer("snapshot_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    modelAway: real("model_away"),
    modelHome: real("model_home"),
    modelDraw: real("model_draw"),
    modelPick: text("model_pick", { enum: ["away", "home", "draw"] }),
    bookAwayPrice: integer("book_away_price"),
    bookHomePrice: integer("book_home_price"),
    bookDrawPrice: integer("book_draw_price"),
    bookAwayProb: real("book_away_prob"),
    bookHomeProb: real("book_home_prob"),
    bookDrawProb: real("book_draw_prob"),
    bookPick: text("book_pick", { enum: ["away", "home", "draw"] }),
    source: text("source", { enum: ["live", "backtest"] }).notNull().default("live"),
    winner: text("winner", { enum: ["away", "home", "draw"] }),
    gradedAt: integer("graded_at", { mode: "timestamp_ms" }),
    modelCorrect: integer("model_correct"),
    bookCorrect: integer("book_correct"),
  },
  (table) => [
    // UNIQUE: the tracker's upsertSnapshot() uses ON CONFLICT (sport, league,
    // away_team, home_team, game_date) DO UPDATE, which SQLite only allows
    // against a UNIQUE index. A plain index makes every upsert throw
    // "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint".
    uniqueIndex("model_snapshots_identity_idx").on(
      table.sport, table.league, table.awayTeam, table.homeTeam, table.gameDate,
    ),
    index("model_snapshots_graded_idx").on(table.gradedAt),
  ],
);

// User feedback: messages from public visitors, visible only to Cody in the
// owner console. No auth required to submit; reading is admin-gated.
export const userFeedback = sqliteTable("user_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Privacy-respecting usage counts: one row per (day, anonymized visitor,
// sport). visitor_hash is SHA-256(IP + day + user-agent) — raw IPs are never
// stored, and hashes are unlinkable across days.
export const usageDaily = sqliteTable(
  "usage_daily",
  {
    date: text("date").notNull(),
    visitorHash: text("visitor_hash").notNull(),
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf", "other"] }).notNull(),
    views: integer("views").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.date, table.visitorHash, table.sport] })],
);

// ---------------------------------------------------------------------------
// The databank — the model's own memory (added 2026-11-20, after the Nov 19
// TNF 3-legger went 0/3 on advice the model had already forgotten how to
// grade). Every game log the model ever uses, every pick it ever states,
// every grade, and the rolling rates built from them live here — in the same
// database as the tracker, renewed daily by the same refresh. Nothing the
// model says is allowed to exist only in a chat transcript anymore.
//   - game logs: raw per-player per-game stat lines (the memory).
//   - picks: one row per stated pick (winner / total / prop), with the
//     stated probability and the price it was given at.
//   - grades: one row per graded pick. outcome "dnp" (did not play) is
//     NEVER a miss — a leg that never had a chance grades as dnp.
//   - rates: rolling hit rates recomputed from the grades on every
//     renewal, always with the sample size beside the rate, plus the
//     volume behind it (targets / shots per game) and a thin-volume flag.
//   - renewals: one row per renewal run — the audit trail. A run that
//     ingested 0 rows for a sport that should have data is partial/failed,
//     never success, and the previous good copy stays.
// ---------------------------------------------------------------------------
export const databankGameLogs = sqliteTable(
  "databank_game_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).notNull(),
    playerName: text("player_name").notNull(),
    playerId: text("player_id").notNull(),
    gameDate: text("game_date").notNull(),
    opponent: text("opponent"),
    homeAway: text("home_away", { enum: ["home", "away"] }),
    statsJson: text("stats_json").notNull(),
    source: text("source", { enum: ["nhl_api", "espn"] }).notNull(),
    ingestedAt: integer("ingested_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("databank_game_logs_identity_idx").on(table.sport, table.playerId, table.gameDate),
    index("databank_game_logs_player_idx").on(table.sport, table.playerId),
  ],
);

export const databankPicks = sqliteTable(
  "databank_picks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).notNull(),
    pickKind: text("pick_kind", { enum: ["winner", "total", "prop"] }).notNull(),
    playerName: text("player_name"),
    playerId: text("player_id"),
    team: text("team"),
    market: text("market").notNull(),
    line: real("line"),
    statedProbability: real("stated_probability").notNull(),
    price: integer("price"),
    gameDate: text("game_date").notNull(),
    opponent: text("opponent"),
    snapshotAt: integer("snapshot_at", { mode: "timestamp_ms" }).notNull(),
    source: text("source", { enum: ["live", "backtest", "chat"] }).notNull().default("live"),
    // Game-script shading and other grading notes live here — e.g. a
    // blowout-favorite shade ("stated 0.67, shaded to 0.57: HOU -12.5").
    // When shading applies, stated_probability stores the SHADED (effective)
    // belief and the note preserves the original.
    note: text("note"),
  },
  (table) => [
    uniqueIndex("databank_picks_identity_idx").on(
      table.sport, table.pickKind, table.playerId, table.team, table.market, table.line, table.gameDate,
    ),
    index("databank_picks_ungraded_idx").on(table.gameDate),
  ],
);

export const databankGrades = sqliteTable(
  "databank_grades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pickId: integer("pick_id").notNull(),
    outcome: text("outcome", { enum: ["hit", "miss", "dnp", "void"] }).notNull(),
    actualValue: text("actual_value"),
    gradedAt: integer("graded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("databank_grades_pick_idx").on(table.pickId)],
);

export const databankRates = sqliteTable(
  "databank_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "soccer", "ncaaf"] }).notNull(),
    playerName: text("player_name").notNull(),
    playerId: text("player_id").notNull(),
    market: text("market").notNull(),
    line: real("line"),
    hits: integer("hits").notNull().default(0),
    games: integer("games").notNull().default(0),
    rate: real("rate").notNull().default(0),
    // Volume behind the rate, e.g. {"targetsPerGame": 3.1} or
    // {"shotsPerGame": 2.4}, plus "thinVolume": true when the volume is too
    // thin to trust the rate at full strength (<3 targets/game for a
    // receiver, <2 shots/game for NHL).
    volumeJson: text("volume_json"),
    lastGameDate: text("last_game_date"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("databank_rates_identity_idx").on(table.sport, table.playerId, table.market, table.line),
  ],
);

export const databankRenewals = sqliteTable("databank_renewals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["success", "partial", "failed"] }).notNull(),
  rowsIngested: integer("rows_ingested").notNull().default(0),
  picksSnapshot: integer("picks_snapshot").notNull().default(0),
  picksGraded: integer("picks_graded").notNull().default(0),
  ratesRecomputed: integer("rates_recomputed").notNull().default(0),
  errorMessage: text("error_message"),
  note: text("note"),
});
