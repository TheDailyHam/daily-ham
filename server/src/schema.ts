import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    index("model_snapshots_identity_idx").on(
      table.sport, table.league, table.awayTeam, table.homeTeam, table.gameDate,
    ),
    index("model_snapshots_graded_idx").on(table.gradedAt),
  ],
);

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
