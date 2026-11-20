// Status — the databank health readout for the owner console: which
// database is live, the last renewal run, row totals, graded picks per
// sport, and the learning status per sport.

import { desc, eq, sql } from "drizzle-orm";
import { dbNote, dbSource } from "../db.js";
import type { Ctx } from "../actions.js";
import * as schema from "../schema.js";
import { getLearningLogData } from "../learning.js";

export interface DatabankStatus {
  dbSource: "turso" | "local";
  dbNote: string | null;
  lastRenewal: {
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    rowsIngested: number;
    picksSnapshot: number;
    picksGraded: number;
    ratesRecomputed: number;
    note: string | null;
  } | null;
  totals: { gameLogs: number; picks: number; grades: number; rates: number };
  gradedBySport: Array<{ sport: string; graded: number; hits: number; winPct: number | null }>;
  learning: Array<{ sport: string; gradedPicks: number; weight: number; status: string }>;
}

async function countTable(db: Ctx["db"], table: string): Promise<number> {
  const rows = (await db.all(sql`SELECT COUNT(*) AS n FROM ${sql.identifier(table)}`)) as Array<Record<string, unknown>>;
  return Number(rows[0]?.n ?? 0);
}

export async function getDatabankStatusData(db: Ctx["db"]): Promise<DatabankStatus> {
  const [gameLogs, picks, grades, rates] = await Promise.all([
    countTable(db, "databank_game_logs"),
    countTable(db, "databank_picks"),
    countTable(db, "databank_grades"),
    countTable(db, "databank_rates"),
  ]);
  const lastRows = await db.select().from(schema.databankRenewals).orderBy(desc(schema.databankRenewals.id)).limit(1);
  const last = lastRows[0];
  const gradedRows = await db.select({
    sport: schema.databankPicks.sport,
    outcome: schema.databankGrades.outcome,
  })
    .from(schema.databankPicks)
    .innerJoin(schema.databankGrades, eq(schema.databankGrades.pickId, schema.databankPicks.id));
  const bySport = new Map<string, { graded: number; hits: number; decided: number }>();
  for (const r of gradedRows) {
    const entry = bySport.get(r.sport) ?? { graded: 0, hits: 0, decided: 0 };
    entry.graded += 1;
    if (r.outcome === "hit") { entry.hits += 1; entry.decided += 1; }
    else if (r.outcome === "miss") entry.decided += 1;
    bySport.set(r.sport, entry);
  }
  const gradedBySport = [...bySport.entries()].map(([sport, v]) => ({
    sport,
    graded: v.graded,
    hits: v.hits,
    winPct: v.decided > 0 ? Math.round((v.hits / v.decided) * 1000) / 10 : null,
  }));
  const learning = await getLearningLogData();
  return {
    dbSource,
    dbNote,
    lastRenewal: last
      ? {
          status: last.status,
          startedAt: last.startedAt.toISOString(),
          finishedAt: last.finishedAt?.toISOString() ?? null,
          rowsIngested: last.rowsIngested,
          picksSnapshot: last.picksSnapshot,
          picksGraded: last.picksGraded,
          ratesRecomputed: last.ratesRecomputed,
          note: last.note,
        }
      : null,
    totals: { gameLogs, picks, grades, rates },
    gradedBySport,
    learning: learning.sports,
  };
}
