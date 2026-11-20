// The tracked player pool — the players the databank watches.
//
// Every ID here was verified live 2026-11-20: NHL ids against the NHL
// landing endpoint, NBA/NFL ids re-derived through the ESPN athlete search
// API. Never add an id from memory alone — verify it first (the 2026-11-17
// scout run proved how easily a wrong id silently counts another player's
// games: Walman is not Point, Krebs is not Bedard).
//
// The pool starts with the players Cody's picks already ride on (the Nov
// 17–19 tickets). It grows by adding a row here — the renewal picks it up
// on the next run; nothing else needs to change.

export type DatabankSport = "nhl" | "nfl" | "nba";
export type NflPosition = "WR" | "RB" | "QB" | "K";

export interface TrackedPlayer {
  sport: DatabankSport;
  name: string;
  // External id as text (NHL id / ESPN athlete id).
  playerId: string;
  // Team abbrev as the app uses it (NHL code, NBA code, NFL code).
  team: string;
  // NFL only: drives which TD column is which in the ESPN gamelog — the
  // TD indices are position-dependent, so the position is part of the pool.
  position?: NflPosition;
}

export const NHL_SEASON = "20262027";
export const NBA_SEASON = 2027;
export const NFL_SEASON = 2026;

export const TRACKED_PLAYERS: TrackedPlayer[] = [
  // NHL — verified via /v1/player/{id}/landing, 2026-11-20.
  { sport: "nhl", name: "Connor McDavid", playerId: "8478402", team: "EDM" },
  { sport: "nhl", name: "Leon Draisaitl", playerId: "8477934", team: "EDM" },
  { sport: "nhl", name: "Sam Reinhart", playerId: "8477933", team: "FLA" },
  { sport: "nhl", name: "Cole Caufield", playerId: "8481540", team: "MTL" },
  { sport: "nhl", name: "David Pastrnak", playerId: "8477956", team: "BOS" },
  { sport: "nhl", name: "Kyle Connor", playerId: "8478398", team: "WPG" },
  { sport: "nhl", name: "Bo Horvat", playerId: "8477500", team: "NYI" },
  { sport: "nhl", name: "Cutter Gauthier", playerId: "8483445", team: "ANA" },
  { sport: "nhl", name: "Alex DeBrincat", playerId: "8479337", team: "DET" },
  { sport: "nhl", name: "Macklin Celebrini", playerId: "8484801", team: "SJS" },
  { sport: "nhl", name: "Alexis Lafrenière", playerId: "8482109", team: "NYR" },
  { sport: "nhl", name: "Pavel Dorofeyev", playerId: "8481604", team: "NYR" },
  { sport: "nhl", name: "Zach Werenski", playerId: "8478460", team: "CBJ" },
  // NBA — verified via the ESPN athlete search API, 2026-11-20.
  { sport: "nba", name: "Jalen Brunson", playerId: "3934672", team: "NY" },
  { sport: "nba", name: "RJ Barrett", playerId: "4395625", team: "TOR" },
  { sport: "nba", name: "Karl-Anthony Towns", playerId: "3136195", team: "NY" },
  { sport: "nba", name: "Scottie Barnes", playerId: "4433134", team: "TOR" },
  { sport: "nba", name: "Cade Cunningham", playerId: "4432166", team: "DET" },
  { sport: "nba", name: "Dylan Harper", playerId: "5037871", team: "SA" },
  { sport: "nba", name: "Duncan Robinson", playerId: "3157465", team: "DET" },
  { sport: "nba", name: "Victor Wembanyama", playerId: "5104157", team: "SA" },
  { sport: "nba", name: "De'Aaron Fox", playerId: "4066259", team: "SA" },
  { sport: "nba", name: "Deni Avdija", playerId: "4683021", team: "POR" },
  // NFL — verified via the ESPN athlete search API, 2026-11-20.
  { sport: "nfl", name: "Xavier Hutchinson", playerId: "4686422", team: "HOU", position: "WR" },
  { sport: "nfl", name: "Nico Collins", playerId: "4258173", team: "HOU", position: "WR" },
  { sport: "nfl", name: "Luther Burden III", playerId: "4685278", team: "CHI", position: "WR" },
  { sport: "nfl", name: "D'Andre Swift", playerId: "4259545", team: "CHI", position: "RB" },
  { sport: "nfl", name: "James Cook", playerId: "4379399", team: "BUF", position: "RB" },
  { sport: "nfl", name: "Derrick Henry", playerId: "3043078", team: "BAL", position: "RB" },
  { sport: "nfl", name: "Tony Pollard", playerId: "3916148", team: "TEN", position: "RB" },
  { sport: "nfl", name: "Jahmyr Gibbs", playerId: "4429795", team: "DET", position: "RB" },
  { sport: "nfl", name: "Josh Allen", playerId: "3918298", team: "BUF", position: "QB" },
  { sport: "nfl", name: "Javonte Williams", playerId: "4361579", team: "DAL", position: "RB" },
  { sport: "nfl", name: "David Montgomery", playerId: "4035538", team: "HOU", position: "RB" },
  { sport: "nfl", name: "Daniel Jones", playerId: "3917792", team: "IND", position: "QB" },
  { sport: "nfl", name: "C.J. Stroud", playerId: "4432577", team: "HOU", position: "QB" },
  { sport: "nfl", name: "Ka'imi Fairbairn", playerId: "2971573", team: "HOU", position: "K" },
];
