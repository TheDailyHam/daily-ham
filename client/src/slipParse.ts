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

// ---- Multi-game parlay-list parsing (Slip Check v2) ----
// A sportsbook betslip list prints one block per leg:
//   <icon junk> Boston Bruins -155
//   Winner (Incl. Overtime and Penalties)
//   NHL • Nashville Predators at Boston Bruins Today 7:05pm
// SGP groups print a header carrying the game, then legs with no context
// of their own. Ownership rule: a context line belongs to the block above
// it when it directly follows that block's descriptor line; otherwise it
// sets the "section game" that following context-less blocks inherit.
// Every leg in the picture becomes a draft — markets the app can't grade
// (kicker extra points, tackles, ...) come through as "market" drafts and
// are shown honestly as unchecked instead of vanishing.

export interface SlipDirectory { sport: SlipSportKey; league?: "mls" | "epl"; teams: { code: string; name: string }[] }
export interface SlipDraftV2 {
  kind: "prop" | "winner" | "total" | "market";
  sport: SlipSportKey;
  league?: "mls" | "epl";
  away?: string;
  home?: string;
  team?: string;
  playerName?: string;
  stat?: string;
  threshold?: number;
  comparator?: SlipComparator;
  price: number | null;
  label: string;
}

interface SlipGameRef { sport: SlipSportKey; league?: "mls" | "epl"; away: string; home: string }

function matchTeamInDir(text: string, dir: SlipDirectory): { code: string; idx: number } | null {
  const t = normalize(text);
  let best: { code: string; idx: number } | null = null;
  for (const team of dir.teams) {
    const idx = t.indexOf(normalize(team.name));
    if (idx >= 0 && (!best || idx < best.idx)) best = { code: team.code, idx };
  }
  if (best) return best;
  // Nickname fallback (unique last token), e.g. OCR loses the city.
  for (const team of dir.teams) {
    const nick = normalize(team.name).split(" ").pop() ?? "";
    if (nick.length < 4) continue;
    if (dir.teams.filter((o) => (normalize(o.name).split(" ").pop() ?? "") === nick).length > 1) continue;
    const m = t.match(new RegExp(`\\b${nick}\\b`));
    if (m && m.index !== undefined) return { code: team.code, idx: m.index };
  }
  return null;
}

const LEAGUE_HINTS: { re: RegExp; sport: SlipSportKey; league?: "mls" | "epl" }[] = [
  { re: /\bnhl\b/, sport: "nhl" },
  { re: /\bnfl\b/, sport: "nfl" },
  { re: /\bnba\b/, sport: "nba" },
  { re: /\bncaaf\b|\bcfb\b|college football/, sport: "ncaaf" },
  { re: /\bmls\b/, sport: "soccer", league: "mls" },
  { re: /\bepl\b|premier league/, sport: "soccer", league: "epl" },
];

// DraftKings-style game bar: two team CODES with the start time between
// them and no separator word — "NSH Today 7:10 PM BOS". Books abbreviate
// codes differently from this directory (SJ for San Jose, LA for the
// Kings), so a small alias map applies per sport, and only when the raw
// token is not itself a code in that directory.
const CODE_ALIASES: Partial<Record<SlipSportKey, Record<string, string>>> = {
  nhl: { SJ: "SJS", LA: "LAK", TB: "TBL", NJ: "NJD" },
  nba: { GS: "GSW", WAS: "WSH" },
  nfl: { WAS: "WSH", JAC: "JAX", LA: "LAR" },
};

function parseCodeBar(line: string, dirs: SlipDirectory[]): SlipGameRef | null {
  if (!/\b(today|tomorrow)\b|\d{1,2}:\d{2}/i.test(line)) return null;
  if (/[+-]\d{2,4}\s*$/.test(line.trim())) return null; // a pick line, not a bar
  const tokens = line.toUpperCase().split(/[^A-Z]+/).filter((t) => t.length >= 2 && t.length <= 4);
  if (tokens.length < 2) return null;
  for (const dir of dirs) {
    const codes = new Set(dir.teams.map((t) => t.code));
    const aliases = CODE_ALIASES[dir.sport] ?? {};
    const resolved: string[] = [];
    for (const tok of tokens) {
      const alias = aliases[tok];
      if (codes.has(tok)) resolved.push(tok);
      else if (alias && codes.has(alias)) resolved.push(alias);
    }
    const distinct = [...new Set(resolved)];
    if (distinct.length === 2 && resolved.length === 2) {
      return { sport: dir.sport, league: dir.league, away: distinct[0]!, home: distinct[1]! };
    }
  }
  return null;
}

function parseContextLine(line: string, dirs: SlipDirectory[]): SlipGameRef | null {
  const norm = normalize(line);
  const cut = (norm.split(/\b(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)\b/)[0] ?? "").split(/\d{1,2}:\d{2}/)[0] ?? "";
  const sep = cut.match(/\s+(?:at|vs|v)\s+/);
  if (!sep || sep.index === undefined) return null;
  const left = cut.slice(0, sep.index);
  const right = cut.slice(sep.index + sep[0].length);
  const hint = LEAGUE_HINTS.find((h) => h.re.test(norm));
  const ordered = hint ? [...dirs.filter((d) => d.sport === hint.sport && d.league === hint.league), ...dirs.filter((d) => !(d.sport === hint.sport && d.league === hint.league))] : dirs;
  for (const dir of ordered) {
    const a = matchTeamInDir(left, dir);
    const b = matchTeamInDir(right, dir);
    if (a && b && a.code !== b.code) return { sport: dir.sport, league: dir.league, away: a.code, home: b.code };
  }
  return null;
}

function cleanName(raw: string): string {
  let s = raw.replace(/^[^a-zA-Z]+/, "").trim();
  // Drop short OCR icon junk tokens ("ij", "iw", "ti") ahead of the name.
  const parts = s.split(/\s+/);
  while (parts.length > 2 && (parts[0] ?? "").length <= 2 && !/[.']/.test(parts[0] ?? "")) parts.shift();
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function priceIn(text: string): number | null {
  const m = text.match(/([+-])\s?(\d{2,4})\b(?!\+)/);
  if (!m) return null;
  const v = parseInt(m[2] ?? "0", 10);
  if (v < 50 || v > 100000) return null;
  return m[1] === "-" ? -v : v;
}

function ouIn(text: string): { threshold: number; comparator: SlipComparator } | null {
  const over = text.match(/over\s+(\d+(?:\.\d+)?)/);
  if (over) return { threshold: parseFloat(over[1] ?? "0"), comparator: "gt" };
  const under = text.match(/under\s+(\d+(?:\.\d+)?)/);
  if (under) return { threshold: parseFloat(under[1] ?? "0"), comparator: "lt" };
  const o = text.match(/\bo\s?(\d+(?:\.\d+)?)\b/);
  if (o) return { threshold: parseFloat(o[1] ?? "0"), comparator: "gt" };
  const u = text.match(/\bu\s?(\d+(?:\.\d+)?)\b/);
  if (u) return { threshold: parseFloat(u[1] ?? "0"), comparator: "lt" };
  return null;
}

interface RawBlock { headline: string; price: number | null; descriptor: string; subs: string[]; game: SlipGameRef | null; section: SlipGameRef | null }

const NOISE_RE = /betslip|remove all|straights|parlays|squads|wager|to win|place bet|total payout|deposit|not enough funds|odds\/lines changed|review betslip|accept and|includes:\s*\d+\s*sgp|\bsgp\b.*boost|opt in|boost/i;

export function parseParlayList(rawText: string, dirs: SlipDirectory[]): SlipDraftV2[] {
  const rawLines = rawText.split(/\r?\n/);
  const blocks: RawBlock[] = [];
  let section: SlipGameRef | null = null;
  let lastWasDescriptor = false;
  let lastBlock: RawBlock | null = null;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const norm = normalize(line);
    if (/^\d+\s*leg\b/.test(norm) || /^leg\s/.test(norm)) { lastWasDescriptor = false; continue; }
    const ctx = parseContextLine(line, dirs) ?? parseCodeBar(line, dirs);
    if (ctx) {
      if (lastWasDescriptor && lastBlock && !lastBlock.game) lastBlock.game = ctx;
      else section = ctx;
      lastWasDescriptor = false;
      continue;
    }
    if (NOISE_RE.test(norm)) { lastWasDescriptor = false; continue; }
    // Pick line: trailing price, or a bare Over/Under headline.
    const priceMatch = line.match(/^(.+?)\s+([+-]\d{2,4})\s*$/);
    const ouHead = norm.match(/^(over|under)\s+(\d+(?:\.\d+)?)/);
    if (priceMatch || ouHead) {
      const headline = ouHead ? `${ouHead[1] ?? "over"} ${ouHead[2] ?? ""}` : cleanName(priceMatch![1]!);
      lastBlock = { headline, price: priceMatch ? priceIn(line) : priceIn(norm), descriptor: "", subs: [], game: null, section };
      blocks.push(lastBlock);
      lastWasDescriptor = false;
      continue;
    }
    if (lastBlock && !lastBlock.descriptor && line.length > 2 && !/^\d/.test(line)) {
      lastBlock.descriptor = line;
      lastWasDescriptor = true;
      continue;
    }
    if (lastBlock) { lastBlock.subs.push(line); lastWasDescriptor = false; }
  }

  const drafts: SlipDraftV2[] = [];
  const statLabel = (s: string) => s.replace(/\s+/g, " ").trim();
  for (const b of blocks) {
    const game = b.game ?? b.section;
    const descNorm = normalize(`${b.descriptor} ${b.subs.join(" ")}`);
    const headNorm = normalize(b.headline);
    const price = b.price ?? priceIn(descNorm) ?? priceIn(b.subs.join(" "));
    const gameFields = game ? { sport: game.sport, league: game.league, away: game.away, home: game.home } : null;
    // Winner / moneyline: the headline is one of the two teams.
    if (/\bwinner\b|\bmoneyline\b/.test(descNorm) && game && gameFields) {
      const dir = dirs.find((d) => d.sport === game.sport && d.league === game.league);
      const picked = dir ? matchTeamInDir(b.headline, { ...dir, teams: dir.teams.filter((t) => t.code === game.away || t.code === game.home) }) : null;
      if (picked) {
        const canonical = dir?.teams.find((t) => t.code === picked.code)?.name ?? b.headline;
        drafts.push({ kind: "winner", ...gameFields, team: picked.code, price, label: `${canonical} to win` });
        continue;
      }
    }
    // Player props: a known stat phrase anywhere in the block.
    const keyword = STAT_KEYWORDS.find((k) => (!game || k.sports.includes(game.sport)) && k.pattern.test(`${headNorm} ${descNorm}`));
    if (keyword && game && gameFields) {
      const stat = keyword.stat;
      let threshold: number | null = null;
      let comparator: SlipComparator = "gte";
      if (stat === "anytimeTd" || stat === "anytimeGoal") { threshold = 1; comparator = "gte"; }
      else {
        const plus = `${headNorm} ${descNorm}`.match(/(\d+(?:\.\d+)?)\s*\+/);
        const ou = ouIn(`${headNorm} ${descNorm}`);
        if (plus) { threshold = parseFloat(plus[1] ?? "0"); comparator = "gte"; }
        else if (ou) { threshold = ou.threshold; comparator = ou.comparator; }
      }
      if (threshold !== null) { drafts.push({ kind: "prop", ...gameFields, playerName: b.headline, stat, threshold, comparator, price, label: b.headline }); continue; }
    }
    // Game total: an over/under with a totals descriptor, or a bare
    // over/under headline in a known game.
    const ou = ouIn(headNorm) ?? ouIn(descNorm);
    if (ou && game && gameFields && (/\btotal/.test(descNorm) || /^(over|under)/.test(headNorm))) {
      drafts.push({ kind: "total", ...gameFields, team: game.away, threshold: ou.threshold, comparator: ou.comparator, price, label: `${ou.comparator === "gt" ? "Over" : "Under"} ${ou.threshold} — ${game.away} @ ${game.home}` });
      continue;
    }
    // Anything else with a headline: an honestly-unchecked market leg.
    if (b.headline && b.headline.length > 2) {
      const marketSport = game?.sport ?? "nfl";
      drafts.push({ kind: "market", sport: marketSport, league: game?.league, away: game?.away, home: game?.home, team: game?.home, price, label: statLabel(`${b.headline}${b.descriptor ? ` — ${b.descriptor}` : ""}`) });
    }
  }

  const seen = new Set<string>();
  return drafts.filter((d) => {
    const key = slipDraftKey(d);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Structural identity of a draft — never the label, because OCR junk
// tokens ("Tir", "ij") vary between photos of the same slip.
export function slipDraftKey(d: SlipDraftV2): string {
  if (d.kind === "market") return `market|${d.sport}|${normalize(d.label)}`;
  return `${d.kind}|${d.sport}|${d.league ?? ""}|${d.away ?? ""}@${d.home ?? ""}|${d.team ?? ""}|${normalize(d.playerName ?? "")}|${d.stat ?? ""}|${d.threshold ?? ""}|${d.comparator ?? ""}`;
}

// Merge the drafts from several photos of one slip: structural dedupe,
// then drop market fragments that a clean leg already covers (a garbled
// duplicate of a winner pick must not ride along as an unchecked leg).
export function mergeSlipDrafts(lists: SlipDraftV2[][], dirs: SlipDirectory[]): SlipDraftV2[] {
  const all = lists.flat();
  const seen = new Set<string>();
  const merged = all.filter((d) => {
    const key = slipDraftKey(d);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const coveredNames: string[] = [];
  for (const d of merged) {
    if (d.kind === "winner" && d.team) {
      const dir = dirs.find((x) => x.sport === d.sport && x.league === d.league);
      const name = dir?.teams.find((t) => t.code === d.team)?.name;
      if (name) coveredNames.push(normalize(name));
    }
    if (d.kind === "prop" && d.playerName) coveredNames.push(normalize(d.playerName));
  }
  return merged.filter((d) => d.kind !== "market" || !coveredNames.some((n) => n.length > 3 && normalize(d.label).includes(n)));
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
