import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projections = sqliteTable(
  "projections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sport: text("sport", { enum: ["nhl", "nfl", "nba"] }).notNull(),
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
  sport: text("sport", { enum: ["nhl", "nfl", "nba"] }).primaryKey(),
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
  sport: text("sport", { enum: ["nhl", "nfl", "nba"] }).notNull(),
  matchup: text("matchup").notNull(),
  pick: text("pick").notNull(),
  note: text("note"),
  isPublic: integer("is_public").notNull().default(1),
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
    sport: text("sport", { enum: ["nhl", "nfl", "nba", "other"] }).notNull(),
    views: integer("views").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.date, table.visitorHash, table.sport] })],
);
