// Keyless ESPN data client for the NCAAF (college football) leg of the Daily Ham.
//
// Mirrors the two-river architecture: everything here is free and unlimited
// (official ESPN JSON feeds). The quota-limited odds providers (oddsapi.ts /
// provider.ts) supply sportsbook prices only and never gate this data.
//
// Verified 2026-10-14 against the live feeds:
//   scoreboard  site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard
//   standings   sports.core.api.espn.com/.../leagues/college-football/seasons/2026/types/2/groups/80/standings/0
//   teams       site API teams feed, filtered to FBS via core group 80 (138 teams)
//   roster      site.api.espn.com/.../college-football/teams/{id}/roster
//   summary     site.api.espn.com/.../college-football/summary?event={gameId}

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";
export const NCAAF_SEASON = 2026;
export const NCAAF_REGULAR_SEASON_WEEKS = 15;

export type NcaafTeamMeta = { abbr: string; id: number; name: string; color: string; secondary: string };

// FBS teams from the ESPN feeds (core API ids + official colors), generated 2026-10-14.
export const NCAAF_TEAMS: NcaafTeamMeta[] = [
  { abbr: "AFA", id: 2005, name: "Air Force Falcons", color: "#003594", secondary: "#ffffff" },
  { abbr: "AKR", id: 2006, name: "Akron Zips", color: "#041e42", secondary: "#c5b783" },
  { abbr: "ALA", id: 333, name: "Alabama Crimson Tide", color: "#9e1b32", secondary: "#ffffff" },
  { abbr: "APP", id: 2026, name: "App State Mountaineers", color: "#000000", secondary: "#ffcd00" },
  { abbr: "ARIZ", id: 12, name: "Arizona Wildcats", color: "#cc0033", secondary: "#003366" },
  { abbr: "ARK", id: 8, name: "Arkansas Razorbacks", color: "#a32136", secondary: "#ffffff" },
  { abbr: "ARMY", id: 349, name: "Army Black Knights", color: "#000000", secondary: "#d3bc8d" },
  { abbr: "ARST", id: 2032, name: "Arkansas State Red Wolves", color: "#cc092f", secondary: "#000000" },
  { abbr: "ASU", id: 9, name: "Arizona State Sun Devils", color: "#ffc627", secondary: "#8c1d40" },
  { abbr: "AUB", id: 2, name: "Auburn Tigers", color: "#002b5c", secondary: "#f26522" },
  { abbr: "BALL", id: 2050, name: "Ball State Cardinals", color: "#ba0c2f", secondary: "#ffffff" },
  { abbr: "BAY", id: 239, name: "Baylor Bears", color: "#154734", secondary: "#ffb81c" },
  { abbr: "BC", id: 103, name: "Boston College Eagles", color: "#8c2232", secondary: "#dbcca6" },
  { abbr: "BGSU", id: 189, name: "Bowling Green Falcons", color: "#fd5000", secondary: "#4f2c1d" },
  { abbr: "BOIS", id: 68, name: "Boise State Broncos", color: "#0033a0", secondary: "#d64309" },
  { abbr: "BUFF", id: 2084, name: "Buffalo Bulls", color: "#005bbb", secondary: "#ffffff" },
  { abbr: "BYU", id: 252, name: "BYU Cougars", color: "#0047ba", secondary: "#002e5d" },
  { abbr: "CAL", id: 25, name: "California Golden Bears", color: "#041e42", secondary: "#ffc72c" },
  { abbr: "CCU", id: 324, name: "Coastal Carolina Chanticleers", color: "#006f71", secondary: "#a27752" },
  { abbr: "CIN", id: 2132, name: "Cincinnati Bearcats", color: "#000000", secondary: "#e00122" },
  { abbr: "CLEM", id: 228, name: "Clemson Tigers", color: "#f56600", secondary: "#ffffff" },
  { abbr: "CLT", id: 2429, name: "Charlotte 49ers", color: "#005035", secondary: "#a49665" },
  { abbr: "CMU", id: 2117, name: "Central Michigan Chippewas", color: "#4c0027", secondary: "#fbab18" },
  { abbr: "COLO", id: 38, name: "Colorado Buffaloes", color: "#cfb87c", secondary: "#000000" },
  { abbr: "CONN", id: 41, name: "UConn Huskies", color: "#0c2340", secondary: "#a2aaad" },
  { abbr: "CSU", id: 36, name: "Colorado State Rams", color: "#004c23", secondary: "#c8c372" },
  { abbr: "DEL", id: 48, name: "Delaware Blue Hens", color: "#00539f", secondary: "#ffd200" },
  { abbr: "DUKE", id: 150, name: "Duke Blue Devils", color: "#00539b", secondary: "#ffffff" },
  { abbr: "ECU", id: 151, name: "East Carolina Pirates", color: "#582c83", secondary: "#ffc72c" },
  { abbr: "EMU", id: 2199, name: "Eastern Michigan Eagles", color: "#006938", secondary: "#ffffff" },
  { abbr: "FAU", id: 2226, name: "Florida Atlantic Owls", color: "#003366", secondary: "#cc0000" },
  { abbr: "FIU", id: 2229, name: "Florida International Panthers", color: "#091f3f", secondary: "#c3993f" },
  { abbr: "FLA", id: 57, name: "Florida Gators", color: "#0021a5", secondary: "#fa4616" },
  { abbr: "FRES", id: 278, name: "Fresno State Bulldogs", color: "#b1102b", secondary: "#13284c" },
  { abbr: "FSU", id: 52, name: "Florida State Seminoles", color: "#782f40", secondary: "#ceb888" },
  { abbr: "GASO", id: 290, name: "Georgia Southern Eagles", color: "#041e42", secondary: "#a3aaae" },
  { abbr: "GAST", id: 2247, name: "Georgia State Panthers", color: "#0039a6", secondary: "#ffffff" },
  { abbr: "GT", id: 59, name: "Georgia Tech Yellow Jackets", color: "#b3a369", secondary: "#ffffff" },
  { abbr: "HAW", id: 62, name: "Hawai\'i Rainbow Warriors", color: "#005737", secondary: "#000000" },
  { abbr: "HOU", id: 248, name: "Houston Cougars", color: "#c8102e", secondary: "#ffffff" },
  { abbr: "ILL", id: 356, name: "Illinois Fighting Illini", color: "#ff5f05", secondary: "#13294b" },
  { abbr: "IOWA", id: 2294, name: "Iowa Hawkeyes", color: "#231f20", secondary: "#fcd116" },
  { abbr: "ISU", id: 66, name: "Iowa State Cyclones", color: "#ae192d", secondary: "#ffc72a" },
  { abbr: "IU", id: 84, name: "Indiana Hoosiers", color: "#970310", secondary: "#ffffff" },
  { abbr: "JMU", id: 256, name: "James Madison Dukes", color: "#450084", secondary: "#cbb677" },
  { abbr: "JXST", id: 55, name: "Jacksonville State Gamecocks", color: "#cc0000", secondary: "#000000" },
  { abbr: "KENN", id: 338, name: "Kennesaw State Owls", color: "#fdbb30", secondary: "#0b1315" },
  { abbr: "KENT", id: 2309, name: "Kent State Golden Flashes", color: "#002664", secondary: "#eaab00" },
  { abbr: "KSU", id: 2306, name: "Kansas State Wildcats", color: "#330a57", secondary: "#e2e3e4" },
  { abbr: "KU", id: 2305, name: "Kansas Jayhawks", color: "#0051ba", secondary: "#e8000d" },
  { abbr: "LIB", id: 2335, name: "Liberty Flames", color: "#0a254e", secondary: "#b72025" },
  { abbr: "LOU", id: 97, name: "Louisville Cardinals", color: "#c9001f", secondary: "#ffffff" },
  { abbr: "LSU", id: 99, name: "LSU Tigers", color: "#461d76", secondary: "#fdd023" },
  { abbr: "LT", id: 2348, name: "Louisiana Tech Bulldogs", color: "#003087", secondary: "#cb333b" },
  { abbr: "M-OH", id: 193, name: "Miami (OH) RedHawks", color: "#c41230", secondary: "#ffffff" },
  { abbr: "MASS", id: 113, name: "Massachusetts Minutemen", color: "#881c1c", secondary: "#ffffff" },
  { abbr: "MD", id: 120, name: "Maryland Terrapins", color: "#ce1126", secondary: "#ffffff" },
  { abbr: "MEM", id: 235, name: "Memphis Tigers", color: "#004991", secondary: "#8e908f" },
  { abbr: "MIA", id: 2390, name: "Miami Hurricanes", color: "#f47423", secondary: "#035131" },
  { abbr: "MICH", id: 130, name: "Michigan Wolverines", color: "#00274c", secondary: "#ffcb05" },
  { abbr: "MINN", id: 135, name: "Minnesota Golden Gophers", color: "#5e0a2f", secondary: "#fab41c" },
  { abbr: "MISS", id: 145, name: "Ole Miss Rebels", color: "#13294b", secondary: "#cf142b" },
  { abbr: "MIZ", id: 142, name: "Missouri Tigers", color: "#f1b82d", secondary: "#000000" },
  { abbr: "MOST", id: 2623, name: "Missouri State Bears", color: "#5e0009", secondary: "#ffffff" },
  { abbr: "MRSH", id: 276, name: "Marshall Thundering Herd", color: "#00b140", secondary: "#000000" },
  { abbr: "MSST", id: 344, name: "Mississippi State Bulldogs", color: "#5d1725", secondary: "#c1c6c8" },
  { abbr: "MSU", id: 127, name: "Michigan State Spartans", color: "#173f35", secondary: "#ffffff" },
  { abbr: "MTSU", id: 2393, name: "Middle Tennessee Blue Raiders", color: "#036eb7", secondary: "#ffffff" },
  { abbr: "NAVY", id: 2426, name: "Navy Midshipmen", color: "#00225b", secondary: "#b5a67c" },
  { abbr: "NCSU", id: 152, name: "NC State Wolfpack", color: "#cc0000", secondary: "#ffffff" },
  { abbr: "ND", id: 87, name: "Notre Dame Fighting Irish", color: "#062340", secondary: "#c99700" },
  { abbr: "NDSU", id: 2449, name: "North Dakota State Bison", color: "#01402A", secondary: "#ffffff" },
  { abbr: "NEB", id: 158, name: "Nebraska Cornhuskers", color: "#e31937", secondary: "#ffffff" },
  { abbr: "NEV", id: 2440, name: "Nevada Wolf Pack", color: "#041e42", secondary: "#8a8d8f" },
  { abbr: "NIU", id: 2459, name: "Northern Illinois Huskies", color: "#c8102e", secondary: "#000000" },
  { abbr: "NMSU", id: 166, name: "New Mexico State Aggies", color: "#7e141b", secondary: "#231f20" },
  { abbr: "NU", id: 77, name: "Northwestern Wildcats", color: "#492f92", secondary: "#ffffff" },
  { abbr: "ODU", id: 295, name: "Old Dominion Monarchs", color: "#003768", secondary: "#a1d2f1" },
  { abbr: "OHIO", id: 195, name: "Ohio Bobcats", color: "#154734", secondary: "#ffffff" },
  { abbr: "OKST", id: 197, name: "Oklahoma State Cowboys", color: "#fe5c00", secondary: "#000000" },
  { abbr: "ORE", id: 2483, name: "Oregon Ducks", color: "#00934b", secondary: "#fff41b" },
  { abbr: "ORST", id: 204, name: "Oregon State Beavers", color: "#dc4405", secondary: "#000000" },
  { abbr: "OSU", id: 194, name: "Ohio State Buckeyes", color: "#ba0c2f", secondary: "#a8adb4" },
  { abbr: "OU", id: 201, name: "Oklahoma Sooners", color: "#990000", secondary: "#ffffff" },
  { abbr: "PITT", id: 221, name: "Pittsburgh Panthers", color: "#003594", secondary: "#ffb81c" },
  { abbr: "PSU", id: 213, name: "Penn State Nittany Lions", color: "#061440", secondary: "#ffffff" },
  { abbr: "PUR", id: 2509, name: "Purdue Boilermakers", color: "#ceb888", secondary: "#000000" },
  { abbr: "RICE", id: 242, name: "Rice Owls", color: "#00205b", secondary: "#c1c6c8" },
  { abbr: "RUTG", id: 164, name: "Rutgers Scarlet Knights", color: "#ce0e2d", secondary: "#ffffff" },
  { abbr: "SAC", id: 16, name: "Sacramento State Hornets", color: "#00573C", secondary: "#cdb97d" },
  { abbr: "SC", id: 2579, name: "South Carolina Gamecocks", color: "#73000a", secondary: "#000000" },
  { abbr: "SDSU", id: 21, name: "San Diego State Aztecs", color: "#a6192e", secondary: "#000000" },
  { abbr: "SHSU", id: 2534, name: "Sam Houston Bearkats", color: "#f56423", secondary: "#ffffff" },
  { abbr: "SJSU", id: 23, name: "San José State Spartans", color: "#0038a8", secondary: "#ffb81a" },
  { abbr: "SMU", id: 2567, name: "SMU Mustangs", color: "#a80000", secondary: "#0033a1" },
  { abbr: "STAN", id: 24, name: "Stanford Cardinal", color: "#8c1515", secondary: "#ffffff" },
  { abbr: "SYR", id: 183, name: "Syracuse Orange", color: "#000e54", secondary: "#ff431b" },
  { abbr: "TA&M", id: 245, name: "Texas A&M Aggies", color: "#500000", secondary: "#ffffff" },
  { abbr: "TCU", id: 2628, name: "TCU Horned Frogs", color: "#4d1979", secondary: "#ffffff" },
  { abbr: "TEM", id: 218, name: "Temple Owls", color: "#a41e35", secondary: "#ffffff" },
  { abbr: "TENN", id: 2633, name: "Tennessee Volunteers", color: "#ff8200", secondary: "#ffffff" },
  { abbr: "TEX", id: 251, name: "Texas Longhorns", color: "#af5c37", secondary: "#ffffff" },
  { abbr: "TLSA", id: 202, name: "Tulsa Golden Hurricane", color: "#003595", secondary: "#d0b787" },
  { abbr: "TOL", id: 2649, name: "Toledo Rockets", color: "#0b2240", secondary: "#ffcd00" },
  { abbr: "TROY", id: 2653, name: "Troy Trojans", color: "#862633", secondary: "#b1b1b1" },
  { abbr: "TTU", id: 2641, name: "Texas Tech Red Raiders", color: "#da291c", secondary: "#000000" },
  { abbr: "TULN", id: 2655, name: "Tulane Green Wave", color: "#006747", secondary: "#418fde" },
  { abbr: "TXST", id: 326, name: "Texas State Bobcats", color: "#501214", secondary: "#6a5638" },
  { abbr: "UAB", id: 5, name: "UAB Blazers", color: "#1a5632", secondary: "#fdb913" },
  { abbr: "UCF", id: 2116, name: "UCF Knights", color: "#000000", secondary: "#b4a169" },
  { abbr: "UCLA", id: 26, name: "UCLA Bruins", color: "#2774ae", secondary: "#f2a900" },
  { abbr: "UGA", id: 61, name: "Georgia Bulldogs", color: "#ba0c2f", secondary: "#2c2a29" },
  { abbr: "UK", id: 96, name: "Kentucky Wildcats", color: "#0033a0", secondary: "#ffffff" },
  { abbr: "UL", id: 309, name: "Louisiana Ragin\' Cajuns", color: "#ce181e", secondary: "#000000" },
  { abbr: "ULM", id: 2433, name: "UL Monroe Warhawks", color: "#840029", secondary: "#fdb913" },
  { abbr: "UNC", id: 153, name: "North Carolina Tar Heels", color: "#7bafd4", secondary: "#13294b" },
  { abbr: "UNLV", id: 2439, name: "UNLV Rebels", color: "#cf0a2c", secondary: "#cac8c8" },
  { abbr: "UNM", id: 167, name: "New Mexico Lobos", color: "#ba0c2f", secondary: "#a7a8aa" },
  { abbr: "UNT", id: 249, name: "North Texas Mean Green", color: "#068f33", secondary: "#ffffff" },
  { abbr: "USA", id: 6, name: "South Alabama Jaguars", color: "#00205b", secondary: "#bf0d3e" },
  { abbr: "USC", id: 30, name: "USC Trojans", color: "#9d2235", secondary: "#ffc72c" },
  { abbr: "USF", id: 58, name: "South Florida Bulls", color: "#006747", secondary: "#cfc493" },
  { abbr: "USM", id: 2572, name: "Southern Miss Golden Eagles", color: "#ffc72c", secondary: "#231f20" },
  { abbr: "USU", id: 328, name: "Utah State Aggies", color: "#0f2439", secondary: "#ffffff" },
  { abbr: "UTAH", id: 254, name: "Utah Utes", color: "#be0000", secondary: "#ffffff" },
  { abbr: "UTEP", id: 2638, name: "UTEP Miners", color: "#ff8200", secondary: "#041e42" },
  { abbr: "UTSA", id: 2636, name: "UTSA Roadrunners", color: "#0c2340", secondary: "#f15a22" },
  { abbr: "UVA", id: 258, name: "Virginia Cavaliers", color: "#232d4b", secondary: "#f84c1e" },
  { abbr: "VAN", id: 238, name: "Vanderbilt Commodores", color: "#000000", secondary: "#cfae70" },
  { abbr: "VT", id: 259, name: "Virginia Tech Hokies", color: "#6a2c3e", secondary: "#cf4520" },
  { abbr: "WAKE", id: 154, name: "Wake Forest Demon Deacons", color: "#ceb888", secondary: "#2c2a29" },
  { abbr: "WASH", id: 264, name: "Washington Huskies", color: "#33006f", secondary: "#e8d3a2" },
  { abbr: "WIS", id: 275, name: "Wisconsin Badgers", color: "#a00000", secondary: "#ffffff" },
  { abbr: "WKU", id: 98, name: "Western Kentucky Hilltoppers", color: "#e13a3e", secondary: "#ffffff" },
  { abbr: "WMU", id: 2711, name: "Western Michigan Broncos", color: "#532e1f", secondary: "#f1c500" },
  { abbr: "WSU", id: 265, name: "Washington State Cougars", color: "#a60f2d", secondary: "#4d4d4d" },
  { abbr: "WVU", id: 277, name: "West Virginia Mountaineers", color: "#eaaa00", secondary: "#002855" },
  { abbr: "WYO", id: 2751, name: "Wyoming Cowboys", color: "#492f24", secondary: "#ffc425" },
];
export const NCAAF_TEAM_CODES = NCAAF_TEAMS.map((t) => t.abbr) as unknown as [string, ...string[]];
const teamByAbbr = new Map(NCAAF_TEAMS.map((t) => [t.abbr, t]));
const teamById = new Map(NCAAF_TEAMS.map((t) => [t.id, t]));
export function ncaafTeamMeta(abbr: string): NcaafTeamMeta | null { return teamByAbbr.get(abbr) ?? null; }
export function ncaafAbbrById(id: number): string | null { return teamById.get(id)?.abbr ?? null; }

// Conference lookup: generated from the ESPN feeds 2026-10-14.
const NCAAF_CONFERENCES: Record<string, string> = {
  BC: "ACC",
  CAL: "ACC",
  CLEM: "ACC",
  DUKE: "ACC",
  FSU: "ACC",
  GT: "ACC",
  LOU: "ACC",
  MIA: "ACC",
  NCSU: "ACC",
  PITT: "ACC",
  SMU: "ACC",
  STAN: "ACC",
  SYR: "ACC",
  UNC: "ACC",
  UVA: "ACC",
  VT: "ACC",
  WAKE: "ACC",
  ARMY: "American",
  CLT: "American",
  ECU: "American",
  FAU: "American",
  MEM: "American",
  NAVY: "American",
  RICE: "American",
  TEM: "American",
  TLSA: "American",
  TULN: "American",
  UAB: "American",
  UNT: "American",
  USF: "American",
  UTSA: "American",
  ARIZ: "Big 12",
  ASU: "Big 12",
  BAY: "Big 12",
  BYU: "Big 12",
  CIN: "Big 12",
  COLO: "Big 12",
  HOU: "Big 12",
  ISU: "Big 12",
  KSU: "Big 12",
  KU: "Big 12",
  OKST: "Big 12",
  TCU: "Big 12",
  TTU: "Big 12",
  UCF: "Big 12",
  UTAH: "Big 12",
  WVU: "Big 12",
  ILL: "Big Ten",
  IOWA: "Big Ten",
  IU: "Big Ten",
  MD: "Big Ten",
  MICH: "Big Ten",
  MINN: "Big Ten",
  MSU: "Big Ten",
  NEB: "Big Ten",
  NU: "Big Ten",
  ORE: "Big Ten",
  OSU: "Big Ten",
  PSU: "Big Ten",
  PUR: "Big Ten",
  RUTG: "Big Ten",
  UCLA: "Big Ten",
  USC: "Big Ten",
  WASH: "Big Ten",
  WIS: "Big Ten",
  DEL: "CUSA",
  FIU: "CUSA",
  JXST: "CUSA",
  KENN: "CUSA",
  LIB: "CUSA",
  MOST: "CUSA",
  MTSU: "CUSA",
  NMSU: "CUSA",
  SHSU: "CUSA",
  WKU: "CUSA",
  CONN: "FBS Indep.",
  ND: "FBS Indep.",
  AKR: "MAC",
  BALL: "MAC",
  BGSU: "MAC",
  BUFF: "MAC",
  CMU: "MAC",
  EMU: "MAC",
  KENT: "MAC",
  "M-OH": "MAC",
  MASS: "MAC",
  OHIO: "MAC",
  SAC: "MAC",
  TOL: "MAC",
  WMU: "MAC",
  AFA: "Mountain West",
  HAW: "Mountain West",
  NDSU: "Mountain West",
  NEV: "Mountain West",
  NIU: "Mountain West",
  SJSU: "Mountain West",
  UNLV: "Mountain West",
  UNM: "Mountain West",
  UTEP: "Mountain West",
  WYO: "Mountain West",
  BOIS: "Pac-12",
  CSU: "Pac-12",
  FRES: "Pac-12",
  ORST: "Pac-12",
  SDSU: "Pac-12",
  TXST: "Pac-12",
  USU: "Pac-12",
  WSU: "Pac-12",
  ALA: "SEC",
  ARK: "SEC",
  AUB: "SEC",
  FLA: "SEC",
  LSU: "SEC",
  MISS: "SEC",
  MIZ: "SEC",
  MSST: "SEC",
  OU: "SEC",
  SC: "SEC",
  "TA&M": "SEC",
  TENN: "SEC",
  TEX: "SEC",
  UGA: "SEC",
  UK: "SEC",
  VAN: "SEC",
  APP: "Sun Belt - East",
  CCU: "Sun Belt - East",
  GASO: "Sun Belt - East",
  GAST: "Sun Belt - East",
  JMU: "Sun Belt - East",
  MRSH: "Sun Belt - East",
  ODU: "Sun Belt - East",
  ARST: "Sun Belt - West",
  LT: "Sun Belt - West",
  TROY: "Sun Belt - West",
  UL: "Sun Belt - West",
  ULM: "Sun Belt - West",
  USA: "Sun Belt - West",
  USM: "Sun Belt - West",
};
export function ncaafConference(abbr: string): string { return NCAAF_CONFERENCES[abbr] ?? ""; }

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function arr(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // ESPN is inconsistent: scores/ids sometimes arrive as numeric strings.
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function int(value: unknown): number | null { const n = num(value); return n === null ? null : Math.trunc(n); }
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ESPN request failed (${response.status}): ${url}`);
  return response.json() as Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

export type NcaafGameSide = { abbr: string; name: string; score: number | null; winner: boolean; linescores: number[] };
export type NcaafGame = {
  id: number; week: number; date: string; name: string; shortName: string;
  state: "pre" | "live" | "final"; detail: string;
  away: NcaafGameSide; home: NcaafGameSide;
};

function parseGame(event: unknown, week: number): NcaafGame | null {
  const e = record(event);
  if (!e) return null;
  const id = int(e.id);
  const date = text(e.date);
  const competitions = arr(e.competitions);
  const c0 = record(competitions[0]);
  if (id === null || !date || !c0) return null;
  const statusName = text(record(c0.status)?.type ? record(record(c0.status)?.type)?.name : null) ?? "";
  const detail = text(record(c0.status)?.type ? record(record(c0.status)?.type)?.shortDetail : null) ?? "";
  const state: NcaafGame["state"] = statusName === "STATUS_FINAL" ? "final" : statusName === "STATUS_IN_PROGRESS" ? "live" : "pre";
  const sides: Record<string, NcaafGameSide> = {};
  for (const compValue of arr(c0.competitors)) {
    const competitor = record(compValue);
    if (!competitor) continue;
    const team = record(competitor.team);
    const abbr = text(team?.abbreviation) ?? "—";
    const homeAway = text(competitor.homeAway) ?? "";
    const linescores = arr(competitor.linescores).flatMap((ls) => { const v = num(record(ls)?.value); return v === null ? [] : [v]; });
    sides[homeAway] = {
      abbr,
      name: text(team?.displayName) ?? abbr,
      score: int(competitor.score),
      winner: competitor.winner === true,
      linescores,
    };
  }
  const away = sides.away;
  const home = sides.home;
  if (!away || !home) return null;
  return { id, week, date, name: text(e.name) ?? `${away.abbr} @ ${home.abbr}`, shortName: text(e.shortName) ?? `${away.abbr} @ ${home.abbr}`, state, detail, away, home };
}

export async function fetchNcaafScoreboard(week?: number): Promise<{ week: number; season: number; games: NcaafGame[] }> {
  const url = week ? `${ESPN_SITE}/scoreboard?week=${week}` : `${ESPN_SITE}/scoreboard`;
  const payload = await getJson(url);
  const root = record(payload);
  const wk = int(record(root?.week)?.number) ?? week ?? 1;
  const season = int(record(root?.season)?.year) ?? NCAAF_SEASON;
  const games = arr(root?.events).flatMap((event) => { const g = parseGame(event, wk); return g ? [g] : []; });
  return { week: wk, season, games };
}

// ---------------------------------------------------------------------------
// Standings (core API, per conference)
// ---------------------------------------------------------------------------

export type NcaafStanding = {
  team: string; name: string; conference: string; division: string;
  wins: number; losses: number; ties: number;
  pointsFor: number; pointsAgainst: number;
  streak: string | null; playoffSeed: number | null;
};

function statValue(stats: unknown[], name: string): string | null {
  for (const s of stats) {
    const r = record(s);
    if (r && text(r.name) === name) return text(r.displayValue) ?? text(r.value);
  }
  return null;
}

export async function fetchNcaafStandings(): Promise<{ fetchedAt: string; sourceUrl: string; standings: NcaafStanding[] }> {
  // Group 80 is the FBS group in ESPN's taxonomy.
  const url = `${ESPN_CORE}/seasons/${NCAAF_SEASON}/types/2/groups/80/standings/0?lang=en&region=us`;
  const payload = await getJson(url);
  const entries = arr(record(payload)?.standings);
  const seen = new Set<string>();
  const out: NcaafStanding[] = [];
  for (const entryValue of entries) {
    const entry = record(entryValue);
    if (!entry) continue;
    const teamRef = text(record(entry.team)?.$ref) ?? "";
    const idMatch = teamRef.match(/\/teams\/(\d+)/);
    const abbr = idMatch ? ncaafAbbrById(Number(idMatch[1])) : null;
    if (!abbr || seen.has(abbr)) continue;
    seen.add(abbr);
    const meta = ncaafTeamMeta(abbr);
    const rec = record(arr(entry.records)[0]);
    const stats = arr(rec?.stats);
    const intStat = (name: string) => { const v = statValue(stats, name); const n = v === null ? null : parseInt(v, 10); return Number.isFinite(n) ? (n as number) : 0; };
    const conference = ncaafConference(abbr);
    out.push({
      team: abbr,
      name: meta?.name ?? abbr,
      conference,
      division: conference,
      wins: intStat("wins"),
      losses: intStat("losses"),
      ties: intStat("ties"),
      pointsFor: intStat("pointsFor"),
      pointsAgainst: intStat("pointsAgainst"),
      streak: statValue(stats, "streak"),
      playoffSeed: (() => { const v = statValue(stats, "playoffSeed"); const n = v === null ? null : parseInt(v, 10); return Number.isFinite(n) ? (n as number) : null; })(),
    });
  }
  out.sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst));
  return { fetchedAt: new Date().toISOString(), sourceUrl: url, standings: out };
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export type NcaafRosterPlayer = { id: number; name: string; jersey: string | null; position: string; group: string };
export async function fetchNcaafRoster(abbr: string): Promise<{ team: string; fetchedAt: string; sourceUrl: string; players: NcaafRosterPlayer[]; groups: Record<string, number> }> {
  const meta = ncaafTeamMeta(abbr);
  if (!meta) throw new Error(`Unknown NCAAF team ${abbr}`);
  const url = `${ESPN_SITE}/teams/${meta.id}/roster`;
  const payload = await getJson(url);
  const players: NcaafRosterPlayer[] = [];
  const groups: Record<string, number> = {};
  for (const groupValue of arr(record(payload)?.athletes)) {
    const group = record(groupValue);
    const groupName = text(group?.position) ?? "squad";
    for (const itemValue of arr(group?.items)) {
      const item = record(itemValue);
      const id = int(item?.id);
      const name = text(item?.displayName);
      if (id === null || !name) continue;
      const pos = record(item?.position);
      players.push({ id, name, jersey: text(item?.jersey), position: text(pos?.abbreviation) ?? "—", group: groupName });
      groups[groupName] = (groups[groupName] ?? 0) + 1;
    }
  }
  return { team: abbr, fetchedAt: new Date().toISOString(), sourceUrl: url, players, groups };
}

// ---------------------------------------------------------------------------
// Game summary: per-player boxscore + scoring plays
// ---------------------------------------------------------------------------

export type NcaafBoxAthlete = { id: number; name: string; stats: Record<string, string> };
export type NcaafBoxCategory = { category: string; keys: string[]; athletes: NcaafBoxAthlete[] };
export type NcaafBoxTeam = { abbr: string; categories: NcaafBoxCategory[] };
export type NcaafScoringPlay = { team: string; period: number; clock: string | null; text: string };

export async function fetchNcaafGameSummary(gameId: number): Promise<{ teams: NcaafBoxTeam[]; scoringPlays: NcaafScoringPlay[] }> {
  const payload = await getJson(`${ESPN_SITE}/summary?event=${gameId}`);
  const root = record(payload);
  const boxscore = record(root?.boxscore);
  const teams: NcaafBoxTeam[] = [];
  for (const teamValue of arr(boxscore?.players)) {
    const team = record(teamValue);
    const abbr = text(record(team?.team)?.abbreviation) ?? "—";
    const categories: NcaafBoxCategory[] = [];
    for (const catValue of arr(team?.statistics)) {
      const cat = record(catValue);
      const keys = arr(cat?.keys).flatMap((k) => { const t = text(k); return t ? [t] : []; });
      const athletes: NcaafBoxAthlete[] = [];
      for (const athValue of arr(cat?.athletes)) {
        const row = record(athValue);
        const athlete = record(row?.athlete);
        const id = int(athlete?.id);
        const name = text(athlete?.displayName);
        if (id === null || !name) continue;
        const values = arr(row?.stats).map((v) => text(v) ?? "");
        const stats: Record<string, string> = {};
        keys.forEach((key, i) => { stats[key] = values[i] ?? ""; });
        athletes.push({ id, name, stats });
      }
      categories.push({ category: text(cat?.name) ?? "stats", keys, athletes });
    }
    teams.push({ abbr, categories });
  }
  const scoringPlays: NcaafScoringPlay[] = [];
  for (const playValue of arr(root?.scoringPlays)) {
    const play = record(playValue);
    const team = text(record(play?.team)?.abbreviation);
    if (!team) continue;
    scoringPlays.push({ team, period: int(record(play?.period)?.number) ?? 0, clock: text(play?.clock), text: text(play?.text) ?? "" });
  }
  return { teams, scoringPlays };
}

// ---------------------------------------------------------------------------
// Team game history (scoreboard scan, no summaries needed for team stats)
// ---------------------------------------------------------------------------

export type NcaafTeamGame = {
  gameId: number; week: number; date: string;
  opponent: string; homeAway: "home" | "away";
  teamScore: number; oppScore: number; won: boolean;
  firstHalfFor: number; firstHalfAgainst: number;
  margin: number; overtime: boolean;
  firstScoringTeam: string | null; // filled by enrichNcaafFirstScores
};

export async function fetchNcaafTeamGames(abbr: string, maxGames = 10): Promise<{ games: NcaafTeamGame[]; currentWeek: number; sourceUrl: string }> {
  const current = await fetchNcaafScoreboard();
  const games: NcaafTeamGame[] = [];
  for (let week = current.week; week >= 1 && games.length < maxGames; week--) {
    const board = week === current.week ? current : await fetchNcaafScoreboard(week);
    for (const game of board.games) {
      if (game.state !== "final") continue;
      const isAway = game.away.abbr === abbr;
      const isHome = game.home.abbr === abbr;
      if (!isAway && !isHome) continue;
      const side = isAway ? game.away : game.home;
      const opp = isAway ? game.home : game.away;
      if (side.score === null || opp.score === null) continue;
      const q1 = side.linescores[0] ?? 0;
      const q2 = side.linescores[1] ?? 0;
      const oq1 = opp.linescores[0] ?? 0;
      const oq2 = opp.linescores[1] ?? 0;
      games.push({
        gameId: game.id, week: game.week, date: game.date,
        opponent: opp.abbr, homeAway: isAway ? "away" : "home",
        teamScore: side.score, oppScore: opp.score, won: side.winner,
        firstHalfFor: q1 + q2, firstHalfAgainst: oq1 + oq2,
        margin: Math.abs(side.score - opp.score),
        overtime: side.linescores.length > 4 || opp.linescores.length > 4,
        firstScoringTeam: null,
      });
    }
  }
  games.sort((a, b) => b.date.localeCompare(a.date));
  return { games: games.slice(0, maxGames), currentWeek: current.week, sourceUrl: `${ESPN_SITE}/scoreboard` };
}

export async function enrichNcaafFirstScores(games: NcaafTeamGame[]): Promise<void> {
  for (let i = 0; i < games.length; i += 4) {
    await Promise.all(games.slice(i, i + 4).map(async (game) => {
      try {
        const summary = await fetchNcaafGameSummary(game.gameId);
        game.firstScoringTeam = summary.scoringPlays[0]?.team ?? null;
      } catch { game.firstScoringTeam = null; }
    }));
  }
}
