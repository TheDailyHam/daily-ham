// Slip Check photo reader — pure text parsing for sportsbook slip
// screenshots after OCR. It only ever produces DRAFT legs: the user
// confirms every row against the real rosters before anything is
// analyzed, so a misread can never turn into a fake insight. Matching is
// deliberately conservative — a player or stat that can't be matched is
// skipped, never guessed.

export type SlipSportKey = "nhl" | "nfl" | "nba" | "soccer" | "ncaaf";
export type SlipComparator = "gte" | "gt" | "lt" | "lte";

export interface SlipCandidate { id: number; name: string; team: string }
export interface SlipDraftLeg {
  playerId: number;
  playerName: string;
  team: string;
  stat: string;
  threshold: number;
  comparator: SlipComparator;
  price: number | null;
}

interface StatKeyword { pattern: RegExp; stat: string; sports: SlipSportKey[] }

const FOOTBALL: SlipSportKey[] = ["nfl", "ncaaf"];
const ALL: SlipSportKey[] = ["nhl", "nfl", "nba", "soccer", "ncaaf"];

// Most specific first — the first keyword that matches in a leg's window wins.
const STAT_KEYWORDS: StatKeyword[] = [
  { pattern: /anytime\s+(touchdown|td)/, stat: "anytimeTd", sports: FOOTBALL },
  { pattern: /anytime\s+goal/, stat: "anytimeGoal", sports: ["nhl", "soccer"] },
  { pattern: /anytime\s+scorer/, stat: "anytimeTd", sports: FOOTBALL },
  { pattern: /anytime\s+scorer/, stat: "anytimeGoal", sports: ["nhl", "soccer"] },
  { pattern: /passing\s+touchdowns?|passing\s+tds?|pass\s+tds?/, stat: "passTds", sports: FOOTBALL },
  { pattern: /passing\s+yards?|pass\s+yards?/, stat: "passYards", sports: FOOTBALL },
  { pattern: /rushing\s+touchdowns?|rushing\s+tds?/, stat: "rushTds", sports: FOOTBALL },
  { pattern: /rushing\s+yards?|rush\s+yards?/, stat: "rushYards", sports: FOOTBALL },
  { pattern: /receiving\s+touchdowns?|receiving\s+tds?/, stat: "recTds", sports: FOOTBALL },
  { pattern: /receiving\s+yards?|rec(?:eption)?\s+yards?/, stat: "recYards", sports: FOOTBALL },
  { pattern: /alt\s+receptions|receptions|catches/, stat: "receptions", sports: FOOTBALL },
  { pattern: /3[\s-]?pointers?|three[\s-]?pointers?|3pt|threes\s+made/, stat: "threePointMade", sports: ["nba"] },
  { pattern: /shots\s+on\s+goal/, stat: "shots", sports: ["nhl"] },
  { pattern: /interceptions/, stat: "interceptions", sports: FOOTBALL },
  { pattern: /rebounds/, stat: "rebounds", sports: ["nba"] },
  { pattern: /steals/, stat: "steals", sports: ["nba"] },
  { pattern: /blocks/, stat: "blocks", sports: ["nba"] },
  { pattern: /saves/, stat: "saves", sports: ["nhl"] },
  { pattern: /assists/, stat: "assists", sports: ALL },
  { pattern: /goals/, stat: "goals", sports: ["nhl", "soccer"] },
  { pattern: /points/, stat: "points", sports: ["nba", "nhl"] },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, " ");
}

// Spot the game on a slip photo: sportsbooks print "Away at Home" on every
// leg, so the first two team names in the text identify the matchup. This
// lets the reader switch the game picker to the slip's actual game instead
// of failing silently against the wrong two rosters.
export function detectSlipTeams(rawText: string, teamList: { code: string; name: string }[]): [string, string] | null {
  const text = normalize(rawText);
  const hits: { code: string; idx: number }[] = [];
  for (const t of teamList) {
    const idx = text.indexOf(normalize(t.name));
    if (idx >= 0) hits.push({ code: t.code, idx });
  }
  if (hits.length < 2) {
    for (const t of teamList) {
      const nick = normalize(t.name).split(" ").pop() ?? "";
      if (nick.length < 4) continue;
      if (teamList.filter((o) => (normalize(o.name).split(" ").pop() ?? "") === nick).length > 1) continue;
      const idx = text.search(new RegExp(`\\b${nick}\\b`));
      if (idx >= 0 && !hits.some((h) => h.code === t.code)) hits.push({ code: t.code, idx });
    }
  }
  if (hits.length < 2) return null;
  hits.sort((a, b) => a.idx - b.idx);
  return [hits[0].code, hits[1].code];
}

function lastNameOf(name: string): string {
  const parts = normalize(name).split(" ").filter((p) => !["jr", "sr", "ii", "iii", "iv"].includes(p));
  return parts[parts.length - 1] ?? "";
}

export function parseSlipText(rawText: string, candidates: SlipCandidate[], sport: SlipSportKey): SlipDraftLeg[] {
  const lines = rawText.split(/\r?\n/);
  const normLines = lines.map(normalize);
  const drafts: { line: number; leg: SlipDraftLeg }[] = [];

  // Every occurrence of every candidate: a player can carry several legs
  // on one slip (Stevenson rushing AND Stevenson anytime TD), so a single
  // first-match scan would silently drop legs. Full-name matches claim
  // their line; a last-name-only match is ignored on a claimed line, so
  // "A.J. Brown" can never also draft his teammate Ben Brown.
  interface Occurrence { cand: SlipCandidate; idx: number; full: boolean }
  const occurrences: Occurrence[] = [];
  const claimed = new Set<number>();
  for (const cand of candidates) {
    const full = normalize(cand.name);
    normLines.forEach((l, idx) => { if (l.includes(full)) { occurrences.push({ cand, idx, full: true }); claimed.add(idx); } });
  }
  for (const cand of candidates) {
    const last = lastNameOf(cand.name);
    if (last.length < 4) continue;
    const re = new RegExp(`\\b${last}\\b`);
    normLines.forEach((l, idx) => { if (!claimed.has(idx) && re.test(l)) occurrences.push({ cand, idx, full: false }); });
  }
  occurrences.sort((a, b) => a.idx - b.idx);

  for (const { cand, idx } of occurrences) {
    // Window: the name line plus the two lines after it (sportsbooks print
    // name + line on one row, the stat label on the next), and the line
    // before it for books that stack the stat above the name.
    const windowText = normLines.slice(Math.max(0, idx - 1), idx + 3).join(" · ");
    let rest = windowText;

    let threshold: number | null = null;
    let comparator: SlipComparator = "gte";
    const plusMatch = rest.match(/(\d+(?:\.\d+)?)\s*\+/);
    const overMatch = rest.match(/over\s+(\d+(?:\.\d+)?)/);
    const underMatch = rest.match(/under\s+(\d+(?:\.\d+)?)/);
    if (plusMatch) { threshold = parseFloat(plusMatch[1]); comparator = "gte"; rest = rest.replace(plusMatch[0], " "); }
    else if (overMatch) { threshold = parseFloat(overMatch[1]); comparator = "gt"; rest = rest.replace(overMatch[0], " "); }
    else if (underMatch) { threshold = parseFloat(underMatch[1]); comparator = "lt"; rest = rest.replace(underMatch[0], " "); }

    let price: number | null = null;
    const priceMatch = rest.match(/([+-])\s?(\d{2,5})\b/);
    if (priceMatch) {
      const value = parseInt(priceMatch[2], 10);
      if (value >= 50 && value <= 100000) price = priceMatch[1] === "-" ? -value : value;
    }

    const keyword = STAT_KEYWORDS.find((k) => k.sports.includes(sport) && k.pattern.test(windowText));
    if (!keyword) continue;
    const stat = keyword.stat;
    if (stat === "anytimeTd" || stat === "anytimeGoal") { threshold = 1; comparator = "gte"; }
    if (threshold === null) continue;

    drafts.push({ line: idx, leg: { playerId: cand.id, playerName: cand.name, team: cand.team, stat, threshold, comparator, price } });
  }

  drafts.sort((a, b) => a.line - b.line);
  const seen = new Set<string>();
  return drafts.filter(({ leg }) => {
    const key = `${leg.playerId}:${leg.stat}:${leg.threshold}:${leg.comparator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ leg }) => leg);
}
