// Seed — the picks the model already stated in chat, written into the
// ledger so they can be graded like any other pick. Source "chat": these
// are real model advice given to Cody (Nov 17–19), not live app output, and
// they are labeled as such.
//
// Every stated probability below comes from the chat record of the day it
// was given. The two Nov 19 legs that earned a blowout-script shade
// (Stroud attempts, Fairbairn FGs — Houston a 12.5-point favorite) store the
// SHADED probability as the effective belief, with the original preserved
// in the note. Idempotent: re-running inserts nothing twice.

import { sql } from "drizzle-orm";
import type { Ctx } from "../actions.js";
import * as schema from "../schema.js";
import { applyGameScriptShade } from "./grade.js";

interface SeedPick {
  sport: "nhl" | "nfl" | "nba";
  pickKind: "winner" | "total" | "prop";
  playerName: string | null;
  playerId: string | null;
  team: string | null;
  market: string;
  line: number | null;
  statedProbability: number;
  price: number | null;
  gameDate: string;
  opponent: string | null;
  note: string | null;
}

function at(gameDate: string): Date {
  return new Date(`${gameDate}T12:00:00Z`);
}

// Houston was a 12.5-point home favorite on Thursday Nov 19 — the blowout
// script that killed both of these legs (Stroud threw 27 times, Fairbairn
// made 1 FG as Houston won 26-3 on touchdowns).
const STROUD_SHADE = applyGameScriptShade(0.67, "attempts_over", -12.5);
const FAIRBAIRN_SHADE = applyGameScriptShade(0.67, "fg_over", -12.5);

const SEED_PICKS: SeedPick[] = [
  // --- Thu Nov 19: TNF, Houston 26, Indianapolis 3 ---
  { sport: "nfl", pickKind: "prop", playerName: "Xavier Hutchinson", playerId: "4686422", team: "HOU", market: "anytime_td", line: null, statedProbability: 0.33, price: 250, gameDate: "2026-11-19", opponent: "IND", note: "3-game TD streak; volume thin — 3-catch guy, 3 targets tonight." },
  { sport: "nfl", pickKind: "prop", playerName: "C.J. Stroud", playerId: "4432577", team: "HOU", market: "attempts_over", line: 32.5, statedProbability: STROUD_SHADE.shaded, price: -135, gameDate: "2026-11-19", opponent: "IND", note: STROUD_SHADE.note },
  { sport: "nfl", pickKind: "prop", playerName: "Ka'imi Fairbairn", playerId: "2971573", team: "HOU", market: "fg_over", line: 1.5, statedProbability: FAIRBAIRN_SHADE.shaded, price: -165, gameDate: "2026-11-19", opponent: "IND", note: FAIRBAIRN_SHADE.note },
  { sport: "nfl", pickKind: "prop", playerName: "Nico Collins", playerId: "4258173", team: "HOU", market: "anytime_td", line: null, statedProbability: 0.57, price: -105, gameDate: "2026-11-19", opponent: "IND", note: null },
  // --- Wed Nov 18: Boston 4, Detroit 1 / Montreal 3, New Jersey 2 ---
  { sport: "nhl", pickKind: "prop", playerName: "Alex DeBrincat", playerId: "8479337", team: "DET", market: "shots_2plus", line: 2, statedProbability: 0.905, price: -650, gameDate: "2026-11-18", opponent: "BOS", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "David Pastrnak", playerId: "8477956", team: "BOS", market: "shots_2plus", line: 2, statedProbability: 0.905, price: -900, gameDate: "2026-11-18", opponent: "DET", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Cole Caufield", playerId: "8481540", team: "MTL", market: "shots_2plus", line: 2, statedProbability: 0.818, price: -475, gameDate: "2026-11-18", opponent: "NJD", note: null },
  // --- Tue Nov 17 ---
  { sport: "nhl", pickKind: "prop", playerName: "Sam Reinhart", playerId: "8477933", team: "FLA", market: "shots_2plus", line: 2, statedProbability: 0.955, price: -400, gameDate: "2026-11-17", opponent: "EDM", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Bo Horvat", playerId: "8477500", team: "NYI", market: "shots_2plus", line: 2, statedProbability: 0.95, price: -700, gameDate: "2026-11-17", opponent: "CBJ", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Kyle Connor", playerId: "8478398", team: "WPG", market: "shots_2plus", line: 2, statedProbability: 0.95, price: -950, gameDate: "2026-11-17", opponent: "OTT", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Cutter Gauthier", playerId: "8483445", team: "ANA", market: "shots_3plus", line: 3, statedProbability: 0.8, price: -375, gameDate: "2026-11-17", opponent: "STL", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Kyle Connor", playerId: "8478398", team: "WPG", market: "anytime_goal", line: null, statedProbability: 0.62, price: 140, gameDate: "2026-11-17", opponent: "OTT", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Leon Draisaitl", playerId: "8477934", team: "EDM", market: "anytime_goal", line: null, statedProbability: 0.59, price: 125, gameDate: "2026-11-17", opponent: "FLA", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Sam Reinhart", playerId: "8477933", team: "FLA", market: "anytime_goal", line: null, statedProbability: 0.45, price: 155, gameDate: "2026-11-17", opponent: "EDM", note: null },
  { sport: "nhl", pickKind: "prop", playerName: "Connor McDavid", playerId: "8478402", team: "EDM", market: "points_1plus", line: 1, statedProbability: 0.98, price: -425, gameDate: "2026-11-17", opponent: "FLA", note: null },
  { sport: "nba", pickKind: "prop", playerName: "Karl-Anthony Towns", playerId: "3136195", team: "NY", market: "rebounds_over", line: 9.5, statedProbability: 0.98, price: -475, gameDate: "2026-11-17", opponent: "TOR", note: null },
  { sport: "nba", pickKind: "prop", playerName: "Cade Cunningham", playerId: "4432166", team: "DET", market: "assists_over", line: 6.5, statedProbability: 0.917, price: null, gameDate: "2026-11-17", opponent: "SA", note: null },
  // Avdija sat with a sore foot — this leg never had a chance. The grader
  // must mark it dnp, never a miss.
  { sport: "nba", pickKind: "prop", playerName: "Deni Avdija", playerId: "4683021", team: "POR", market: "points_over", line: 14.5, statedProbability: 0.98, price: null, gameDate: "2026-11-17", opponent: "MIN", note: "DNP watch: sore foot — grade dnp if he sits." },
];

export async function seedChatPicks(db: Ctx["db"]): Promise<number> {
  let inserted = 0;
  for (const p of SEED_PICKS) {
    // Null-safe identity match: `IS` compares NULLs as equal, `=` does not
    // (anytime_td / anytime_goal rows have a null line).
    const existing = await db.select({ id: schema.databankPicks.id }).from(schema.databankPicks).where(sql`
      ${schema.databankPicks.sport} = ${p.sport}
      AND ${schema.databankPicks.pickKind} = ${p.pickKind}
      AND ${schema.databankPicks.playerId} IS ${p.playerId}
      AND ${schema.databankPicks.team} IS ${p.team}
      AND ${schema.databankPicks.market} = ${p.market}
      AND ${schema.databankPicks.line} IS ${p.line}
      AND ${schema.databankPicks.gameDate} = ${p.gameDate}
    `).limit(1);
    if (existing.length > 0) continue;
    await db.insert(schema.databankPicks).values({
      sport: p.sport, pickKind: p.pickKind, playerName: p.playerName, playerId: p.playerId,
      team: p.team, market: p.market, line: p.line, statedProbability: p.statedProbability,
      price: p.price, gameDate: p.gameDate, opponent: p.opponent,
      snapshotAt: at(p.gameDate), source: "chat", note: p.note,
    });
    inserted += 1;
  }
  return inserted;
}
