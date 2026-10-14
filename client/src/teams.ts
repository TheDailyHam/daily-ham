// Favorite-team theme data: 32 NHL clubs with a UI accent color (curated to
// look good as the site's highlight color) plus a secondary for the picker
// swatch. Colors are approximate club colors.

export type TeamTheme = { code: string; name: string; color: string; secondary: string };

export const TEAM_THEMES: TeamTheme[] = [
  { code: "ANA", name: "Anaheim Ducks", color: "#F47A38", secondary: "#000000" },
  { code: "BOS", name: "Boston Bruins", color: "#FFB81C", secondary: "#000000" },
  { code: "BUF", name: "Buffalo Sabres", color: "#FCB514", secondary: "#002654" },
  { code: "CAR", name: "Carolina Hurricanes", color: "#CC0000", secondary: "#000000" },
  { code: "CBJ", name: "Columbus Blue Jackets", color: "#CE1126", secondary: "#002654" },
  { code: "CGY", name: "Calgary Flames", color: "#C8102E", secondary: "#F1BE48" },
  { code: "CHI", name: "Chicago Blackhawks", color: "#CF0A2C", secondary: "#000000" },
  { code: "COL", name: "Colorado Avalanche", color: "#6F263D", secondary: "#236192" },
  { code: "DAL", name: "Dallas Stars", color: "#006847", secondary: "#000000" },
  { code: "DET", name: "Detroit Red Wings", color: "#CE1126", secondary: "#FFFFFF" },
  { code: "EDM", name: "Edmonton Oilers", color: "#FC4C02", secondary: "#041E42" },
  { code: "FLA", name: "Florida Panthers", color: "#C8102E", secondary: "#B9975B" },
  { code: "LAK", name: "Los Angeles Kings", color: "#A2AAAD", secondary: "#111111" },
  { code: "MIN", name: "Minnesota Wild", color: "#154734", secondary: "#DDCBA4" },
  { code: "MTL", name: "Montréal Canadiens", color: "#AF1E2D", secondary: "#192168" },
  { code: "NJD", name: "New Jersey Devils", color: "#CE1126", secondary: "#000000" },
  { code: "NSH", name: "Nashville Predators", color: "#FFB81C", secondary: "#041E42" },
  { code: "NYI", name: "New York Islanders", color: "#F47D30", secondary: "#00539B" },
  { code: "NYR", name: "New York Rangers", color: "#0038A8", secondary: "#CE1126" },
  { code: "OTT", name: "Ottawa Senators", color: "#E31837", secondary: "#000000" },
  { code: "PHI", name: "Philadelphia Flyers", color: "#F74902", secondary: "#000000" },
  { code: "PIT", name: "Pittsburgh Penguins", color: "#FCB514", secondary: "#000000" },
  { code: "SEA", name: "Seattle Kraken", color: "#68A2B9", secondary: "#001628" },
  { code: "SJS", name: "San Jose Sharks", color: "#006D75", secondary: "#000000" },
  { code: "STL", name: "St. Louis Blues", color: "#FCB514", secondary: "#002F87" },
  { code: "TBL", name: "Tampa Bay Lightning", color: "#002868", secondary: "#FFFFFF" },
  { code: "TOR", name: "Toronto Maple Leafs", color: "#00205B", secondary: "#FFFFFF" },
  { code: "UTA", name: "Utah Mammoth", color: "#6CACE4", secondary: "#101010" },
  { code: "VAN", name: "Vancouver Canucks", color: "#00843D", secondary: "#00205B" },
  { code: "VGK", name: "Vegas Golden Knights", color: "#B4975A", secondary: "#333F42" },
  { code: "WPG", name: "Winnipeg Jets", color: "#004B8D", secondary: "#AC162C" },
  { code: "WSH", name: "Washington Capitals", color: "#C8102E", secondary: "#041E42" },
];

export const FAVORITE_TEAM_KEY = "dh-favorite-team";

// 32 NFL clubs, same shape. Codes that collide with NHL clubs (BUF, DAL,
// PIT) are disambiguated by league wherever they are used.
export const NFL_TEAM_THEMES: TeamTheme[] = [
  { code: "ARI", name: "Arizona Cardinals", color: "#a40227", secondary: "#ffffff" },
  { code: "ATL", name: "Atlanta Falcons", color: "#a71930", secondary: "#000000" },
  { code: "BAL", name: "Baltimore Ravens", color: "#29126f", secondary: "#000000" },
  { code: "BUF", name: "Buffalo Bills", color: "#00338d", secondary: "#d50a0a" },
  { code: "CAR", name: "Carolina Panthers", color: "#0085ca", secondary: "#000000" },
  { code: "CHI", name: "Chicago Bears", color: "#0b1c3a", secondary: "#e64100" },
  { code: "CIN", name: "Cincinnati Bengals", color: "#fb4f14", secondary: "#000000" },
  { code: "CLE", name: "Cleveland Browns", color: "#472a08", secondary: "#ff3c00" },
  { code: "DAL", name: "Dallas Cowboys", color: "#002a5c", secondary: "#b0b7bc" },
  { code: "DEN", name: "Denver Broncos", color: "#0a2343", secondary: "#fc4c02" },
  { code: "DET", name: "Detroit Lions", color: "#0076b6", secondary: "#bbbbbb" },
  { code: "GB", name: "Green Bay Packers", color: "#204e32", secondary: "#ffb612" },
  { code: "HOU", name: "Houston Texans", color: "#021018", secondary: "#eb0028" },
  { code: "IND", name: "Indianapolis Colts", color: "#003b75", secondary: "#ffffff" },
  { code: "JAX", name: "Jacksonville Jaguars", color: "#007487", secondary: "#d7a22a" },
  { code: "KC", name: "Kansas City Chiefs", color: "#e31837", secondary: "#ffb612" },
  { code: "LAC", name: "Los Angeles Chargers", color: "#0080c6", secondary: "#ffc20e" },
  { code: "LAR", name: "Los Angeles Rams", color: "#003594", secondary: "#ffd100" },
  { code: "LV", name: "Las Vegas Raiders", color: "#000000", secondary: "#a5acaf" },
  { code: "MIA", name: "Miami Dolphins", color: "#008e97", secondary: "#fc4c02" },
  { code: "MIN", name: "Minnesota Vikings", color: "#4f2683", secondary: "#ffc62f" },
  { code: "NE", name: "New England Patriots", color: "#002a5c", secondary: "#c60c30" },
  { code: "NO", name: "New Orleans Saints", color: "#d3bc8d", secondary: "#000000" },
  { code: "NYG", name: "New York Giants", color: "#003c7f", secondary: "#c9243f" },
  { code: "NYJ", name: "New York Jets", color: "#115740", secondary: "#ffffff" },
  { code: "PHI", name: "Philadelphia Eagles", color: "#06424d", secondary: "#000000" },
  { code: "PIT", name: "Pittsburgh Steelers", color: "#000000", secondary: "#ffb612" },
  { code: "SEA", name: "Seattle Seahawks", color: "#002a5c", secondary: "#69be28" },
  { code: "SF", name: "San Francisco 49ers", color: "#aa0000", secondary: "#b3995d" },
  { code: "TB", name: "Tampa Bay Buccaneers", color: "#bd1c36", secondary: "#3e3a35" },
  { code: "TEN", name: "Tennessee Titans", color: "#4495d2", secondary: "#001532" },
  { code: "WSH", name: "Washington Commanders", color: "#5a1414", secondary: "#ffb612" },
];

// 30 NBA clubs, same shape. Codes use ESPN's abbreviations (GS, SA, NY, NO).
// Collisions with NHL/NFL codes (ATL, BOS, CHI, CLE, DAL, DEN, DET, HOU, IND,
// MEM, MIA, MIL, MIN, NO, NY, OKC, ORL, PHI, PHX, POR, SAC, SA, TOR, UTA, WSH)
// are disambiguated by league wherever they are used.
export const NBA_TEAM_THEMES: TeamTheme[] = [
  { code: "ATL", name: "Atlanta Hawks", color: "#E03A3E", secondary: "#000000" },
  { code: "BOS", name: "Boston Celtics", color: "#007A33", secondary: "#000000" },
  { code: "BKN", name: "Brooklyn Nets", color: "#000000", secondary: "#FFFFFF" },
  { code: "CHA", name: "Charlotte Hornets", color: "#1D1160", secondary: "#00788C" },
  { code: "CHI", name: "Chicago Bulls", color: "#CE1141", secondary: "#000000" },
  { code: "CLE", name: "Cleveland Cavaliers", color: "#860038", secondary: "#FDBB30" },
  { code: "DAL", name: "Dallas Mavericks", color: "#00538C", secondary: "#002B5E" },
  { code: "DEN", name: "Denver Nuggets", color: "#0E2240", secondary: "#FEC524" },
  { code: "DET", name: "Detroit Pistons", color: "#C8102E", secondary: "#1D42BA" },
  { code: "GS", name: "Golden State Warriors", color: "#1D428A", secondary: "#FFC72C" },
  { code: "HOU", name: "Houston Rockets", color: "#CE1141", secondary: "#000000" },
  { code: "IND", name: "Indiana Pacers", color: "#002D62", secondary: "#FDBB30" },
  { code: "LAC", name: "LA Clippers", color: "#C8102E", secondary: "#1D428A" },
  { code: "LAL", name: "Los Angeles Lakers", color: "#552583", secondary: "#FDB927" },
  { code: "MEM", name: "Memphis Grizzlies", color: "#5D76A9", secondary: "#12173F" },
  { code: "MIA", name: "Miami Heat", color: "#98002E", secondary: "#000000" },
  { code: "MIL", name: "Milwaukee Bucks", color: "#00471B", secondary: "#EEE1C6" },
  { code: "MIN", name: "Minnesota Timberwolves", color: "#0C2340", secondary: "#78BE20" },
  { code: "NO", name: "New Orleans Pelicans", color: "#0C2340", secondary: "#C8102E" },
  { code: "NY", name: "New York Knicks", color: "#006BB6", secondary: "#F58426" },
  { code: "OKC", name: "Oklahoma City Thunder", color: "#007AC1", secondary: "#EF3B24" },
  { code: "ORL", name: "Orlando Magic", color: "#0077C0", secondary: "#000000" },
  { code: "PHI", name: "Philadelphia 76ers", color: "#006BB6", secondary: "#ED174C" },
  { code: "PHX", name: "Phoenix Suns", color: "#1D1160", secondary: "#E56020" },
  { code: "POR", name: "Portland Trail Blazers", color: "#E03A3E", secondary: "#000000" },
  { code: "SAC", name: "Sacramento Kings", color: "#5A2D81", secondary: "#000000" },
  { code: "SA", name: "San Antonio Spurs", color: "#C4CED4", secondary: "#000000" },
  { code: "TOR", name: "Toronto Raptors", color: "#CE1141", secondary: "#000000" },
  { code: "UTAH", name: "Utah Jazz", color: "#002B5C", secondary: "#F9A01B" },
  { code: "WSH", name: "Washington Wizards", color: "#002B5C", secondary: "#E31837" },
];

// 30 MLS clubs (ESPN usa.1) + 20 Premier League clubs (ESPN eng.1).
// Colors are ESPN's official club colors, curated where the primary is too
// dark or too light to work as a UI accent. Codes are unique across the two
// leagues, so one combined list serves themeFor("soccer", code).
export type SoccerLeague = "mls" | "epl";
export const SOCCER_LEAGUES: { code: SoccerLeague; name: string }[] = [
  { code: "mls", name: "MLS" },
  { code: "epl", name: "Premier League" },
];

export const MLS_TEAM_THEMES: TeamTheme[] = [
  { code: "ATL", name: "Atlanta United FC", color: "#9d2235", secondary: "#aa9767" },
  { code: "ATX", name: "Austin FC", color: "#00b140", secondary: "#000000" },
  { code: "MTL", name: "CF Montréal", color: "#003da6", secondary: "#c1c5c8" },
  { code: "CLT", name: "Charlotte FC", color: "#0085ca", secondary: "#000000" },
  { code: "CHI", name: "Chicago Fire FC", color: "#d71e2b", secondary: "#7ccdef" },
  { code: "COL", name: "Colorado Rapids", color: "#8a2432", secondary: "#8ab7e9" },
  { code: "CLB", name: "Columbus Crew", color: "#fedd00", secondary: "#000000" },
  { code: "DC", name: "D.C. United", color: "#d61018", secondary: "#000000" },
  { code: "CIN", name: "FC Cincinnati", color: "#003087", secondary: "#fe5000" },
  { code: "DAL", name: "FC Dallas", color: "#c6093b", secondary: "#001f5b" },
  { code: "HOU", name: "Houston Dynamo FC", color: "#ff6b00", secondary: "#101820" },
  { code: "MIA", name: "Inter Miami CF", color: "#f7b5cd", secondary: "#231f20" },
  { code: "LA", name: "LA Galaxy", color: "#00235d", secondary: "#ffffff" },
  { code: "LAFC", name: "LAFC", color: "#c7a36f", secondary: "#000000" },
  { code: "MIN", name: "Minnesota United FC", color: "#9bcde4", secondary: "#000000" },
  { code: "NSH", name: "Nashville SC", color: "#ece83a", secondary: "#1f1646" },
  { code: "NE", name: "New England Revolution", color: "#022166", secondary: "#ce0e2d" },
  { code: "NYC", name: "New York City FC", color: "#9fd2ff", secondary: "#000229" },
  { code: "ORL", name: "Orlando City SC", color: "#60269e", secondary: "#f0d283" },
  { code: "PHI", name: "Philadelphia Union", color: "#e0d0a6", secondary: "#051f31" },
  { code: "POR", name: "Portland Timbers", color: "#2c5234", secondary: "#c99700" },
  { code: "RSL", name: "Real Salt Lake", color: "#a32035", secondary: "#daa900" },
  { code: "RBNY", name: "Red Bull New York", color: "#ba0c2f", secondary: "#ffc72c" },
  { code: "SD", name: "San Diego FC", color: "#697a7c", secondary: "#f89e1a" },
  { code: "SJ", name: "San Jose Earthquakes", color: "#003da6", secondary: "#ffffff" },
  { code: "SEA", name: "Seattle Sounders FC", color: "#2dc84d", secondary: "#0033a0" },
  { code: "SKC", name: "Sporting Kansas City", color: "#a7c6ed", secondary: "#0a2240" },
  { code: "STL", name: "St. Louis CITY SC", color: "#ec1458", secondary: "#001544" },
  { code: "TOR", name: "Toronto FC", color: "#aa182c", secondary: "#a2a9ad" },
  { code: "VAN", name: "Vancouver Whitecaps", color: "#12284c", secondary: "#ffffff" },
];

export const EPL_TEAM_THEMES: TeamTheme[] = [
  { code: "BOU", name: "AFC Bournemouth", color: "#f42727", secondary: "#b57edc" },
  { code: "ARS", name: "Arsenal", color: "#e20520", secondary: "#003399" },
  { code: "AVL", name: "Aston Villa", color: "#660e36", secondary: "#000000" },
  { code: "BRE", name: "Brentford", color: "#f42727", secondary: "#0f1c3f" },
  { code: "BHA", name: "Brighton & Hove Albion", color: "#0606fa", secondary: "#005f60" },
  { code: "CHE", name: "Chelsea", color: "#144992", secondary: "#ffffff" },
  { code: "COV", name: "Coventry City", color: "#87cced", secondary: "#ffffff" },
  { code: "CRY", name: "Crystal Palace", color: "#0202fb", secondary: "#000000" },
  { code: "EVE", name: "Everton", color: "#0606fa", secondary: "#ffffff" },
  { code: "FUL", name: "Fulham", color: "#cc0000", secondary: "#ffffff" },
  { code: "HUL", name: "Hull City", color: "#f28800", secondary: "#ffffff" },
  { code: "IPS", name: "Ipswich Town", color: "#0000fa", secondary: "#f5f2dc" },
  { code: "LEE", name: "Leeds United", color: "#ffcd00", secondary: "#ffffff" },
  { code: "LIV", name: "Liverpool", color: "#d11317", secondary: "#ffffff" },
  { code: "MNC", name: "Manchester City", color: "#99c5ea", secondary: "#000000" },
  { code: "MAN", name: "Manchester United", color: "#da020e", secondary: "#4169e1" },
  { code: "NEW", name: "Newcastle United", color: "#000000", secondary: "#0b1b3d" },
  { code: "NFO", name: "Nottingham Forest", color: "#c8102e", secondary: "#1b3624" },
  { code: "SUN", name: "Sunderland", color: "#eb172b", secondary: "#ffb6c1" },
  { code: "TOT", name: "Tottenham Hotspur", color: "#0b1426", secondary: "#ffffff" },
];

export const SOCCER_TEAM_THEMES: TeamTheme[] = [...MLS_TEAM_THEMES, ...EPL_TEAM_THEMES];

// Which soccer league a club code belongs to (codes are unique across leagues).
export function soccerLeagueForTeam(code: string): SoccerLeague {
  return EPL_TEAM_THEMES.some((t) => t.code === code) ? "epl" : "mls";
}

export const NCAAF_TEAM_THEMES: TeamTheme[] = [
  { code: "AFA", name: "Air Force Falcons", color: "#003594", secondary: "#ffffff" },
  { code: "AKR", name: "Akron Zips", color: "#041e42", secondary: "#c5b783" },
  { code: "ALA", name: "Alabama Crimson Tide", color: "#9e1b32", secondary: "#ffffff" },
  { code: "APP", name: "App State Mountaineers", color: "#000000", secondary: "#ffcd00" },
  { code: "ARIZ", name: "Arizona Wildcats", color: "#cc0033", secondary: "#003366" },
  { code: "ARK", name: "Arkansas Razorbacks", color: "#a32136", secondary: "#ffffff" },
  { code: "ARMY", name: "Army Black Knights", color: "#000000", secondary: "#d3bc8d" },
  { code: "ARST", name: "Arkansas State Red Wolves", color: "#cc092f", secondary: "#000000" },
  { code: "ASU", name: "Arizona State Sun Devils", color: "#ffc627", secondary: "#8c1d40" },
  { code: "AUB", name: "Auburn Tigers", color: "#002b5c", secondary: "#f26522" },
  { code: "BALL", name: "Ball State Cardinals", color: "#ba0c2f", secondary: "#ffffff" },
  { code: "BAY", name: "Baylor Bears", color: "#154734", secondary: "#ffb81c" },
  { code: "BC", name: "Boston College Eagles", color: "#8c2232", secondary: "#dbcca6" },
  { code: "BGSU", name: "Bowling Green Falcons", color: "#fd5000", secondary: "#4f2c1d" },
  { code: "BOIS", name: "Boise State Broncos", color: "#0033a0", secondary: "#d64309" },
  { code: "BUFF", name: "Buffalo Bulls", color: "#005bbb", secondary: "#ffffff" },
  { code: "BYU", name: "BYU Cougars", color: "#0047ba", secondary: "#002e5d" },
  { code: "CAL", name: "California Golden Bears", color: "#041e42", secondary: "#ffc72c" },
  { code: "CCU", name: "Coastal Carolina Chanticleers", color: "#006f71", secondary: "#a27752" },
  { code: "CIN", name: "Cincinnati Bearcats", color: "#000000", secondary: "#e00122" },
  { code: "CLEM", name: "Clemson Tigers", color: "#f56600", secondary: "#ffffff" },
  { code: "CLT", name: "Charlotte 49ers", color: "#005035", secondary: "#a49665" },
  { code: "CMU", name: "Central Michigan Chippewas", color: "#4c0027", secondary: "#fbab18" },
  { code: "COLO", name: "Colorado Buffaloes", color: "#cfb87c", secondary: "#000000" },
  { code: "CONN", name: "UConn Huskies", color: "#0c2340", secondary: "#a2aaad" },
  { code: "CSU", name: "Colorado State Rams", color: "#004c23", secondary: "#c8c372" },
  { code: "DEL", name: "Delaware Blue Hens", color: "#00539f", secondary: "#ffd200" },
  { code: "DUKE", name: "Duke Blue Devils", color: "#00539b", secondary: "#ffffff" },
  { code: "ECU", name: "East Carolina Pirates", color: "#582c83", secondary: "#ffc72c" },
  { code: "EMU", name: "Eastern Michigan Eagles", color: "#006938", secondary: "#ffffff" },
  { code: "FAU", name: "Florida Atlantic Owls", color: "#003366", secondary: "#cc0000" },
  { code: "FIU", name: "Florida International Panthers", color: "#091f3f", secondary: "#c3993f" },
  { code: "FLA", name: "Florida Gators", color: "#0021a5", secondary: "#fa4616" },
  { code: "FRES", name: "Fresno State Bulldogs", color: "#b1102b", secondary: "#13284c" },
  { code: "FSU", name: "Florida State Seminoles", color: "#782f40", secondary: "#ceb888" },
  { code: "GASO", name: "Georgia Southern Eagles", color: "#041e42", secondary: "#a3aaae" },
  { code: "GAST", name: "Georgia State Panthers", color: "#0039a6", secondary: "#ffffff" },
  { code: "GT", name: "Georgia Tech Yellow Jackets", color: "#b3a369", secondary: "#ffffff" },
  { code: "HAW", name: "Hawai\'i Rainbow Warriors", color: "#005737", secondary: "#000000" },
  { code: "HOU", name: "Houston Cougars", color: "#c8102e", secondary: "#ffffff" },
  { code: "ILL", name: "Illinois Fighting Illini", color: "#ff5f05", secondary: "#13294b" },
  { code: "IOWA", name: "Iowa Hawkeyes", color: "#231f20", secondary: "#fcd116" },
  { code: "ISU", name: "Iowa State Cyclones", color: "#ae192d", secondary: "#ffc72a" },
  { code: "IU", name: "Indiana Hoosiers", color: "#970310", secondary: "#ffffff" },
  { code: "JMU", name: "James Madison Dukes", color: "#450084", secondary: "#cbb677" },
  { code: "JXST", name: "Jacksonville State Gamecocks", color: "#cc0000", secondary: "#000000" },
  { code: "KENN", name: "Kennesaw State Owls", color: "#fdbb30", secondary: "#0b1315" },
  { code: "KENT", name: "Kent State Golden Flashes", color: "#002664", secondary: "#eaab00" },
  { code: "KSU", name: "Kansas State Wildcats", color: "#330a57", secondary: "#e2e3e4" },
  { code: "KU", name: "Kansas Jayhawks", color: "#0051ba", secondary: "#e8000d" },
  { code: "LIB", name: "Liberty Flames", color: "#0a254e", secondary: "#b72025" },
  { code: "LOU", name: "Louisville Cardinals", color: "#c9001f", secondary: "#ffffff" },
  { code: "LSU", name: "LSU Tigers", color: "#461d76", secondary: "#fdd023" },
  { code: "LT", name: "Louisiana Tech Bulldogs", color: "#003087", secondary: "#cb333b" },
  { code: "M-OH", name: "Miami (OH) RedHawks", color: "#c41230", secondary: "#ffffff" },
  { code: "MASS", name: "Massachusetts Minutemen", color: "#881c1c", secondary: "#ffffff" },
  { code: "MD", name: "Maryland Terrapins", color: "#ce1126", secondary: "#ffffff" },
  { code: "MEM", name: "Memphis Tigers", color: "#004991", secondary: "#8e908f" },
  { code: "MIA", name: "Miami Hurricanes", color: "#f47423", secondary: "#035131" },
  { code: "MICH", name: "Michigan Wolverines", color: "#00274c", secondary: "#ffcb05" },
  { code: "MINN", name: "Minnesota Golden Gophers", color: "#5e0a2f", secondary: "#fab41c" },
  { code: "MISS", name: "Ole Miss Rebels", color: "#13294b", secondary: "#cf142b" },
  { code: "MIZ", name: "Missouri Tigers", color: "#f1b82d", secondary: "#000000" },
  { code: "MOST", name: "Missouri State Bears", color: "#5e0009", secondary: "#ffffff" },
  { code: "MRSH", name: "Marshall Thundering Herd", color: "#00b140", secondary: "#000000" },
  { code: "MSST", name: "Mississippi State Bulldogs", color: "#5d1725", secondary: "#c1c6c8" },
  { code: "MSU", name: "Michigan State Spartans", color: "#173f35", secondary: "#ffffff" },
  { code: "MTSU", name: "Middle Tennessee Blue Raiders", color: "#036eb7", secondary: "#ffffff" },
  { code: "NAVY", name: "Navy Midshipmen", color: "#00225b", secondary: "#b5a67c" },
  { code: "NCSU", name: "NC State Wolfpack", color: "#cc0000", secondary: "#ffffff" },
  { code: "ND", name: "Notre Dame Fighting Irish", color: "#062340", secondary: "#c99700" },
  { code: "NDSU", name: "North Dakota State Bison", color: "#01402A", secondary: "#ffffff" },
  { code: "NEB", name: "Nebraska Cornhuskers", color: "#e31937", secondary: "#ffffff" },
  { code: "NEV", name: "Nevada Wolf Pack", color: "#041e42", secondary: "#8a8d8f" },
  { code: "NIU", name: "Northern Illinois Huskies", color: "#c8102e", secondary: "#000000" },
  { code: "NMSU", name: "New Mexico State Aggies", color: "#7e141b", secondary: "#231f20" },
  { code: "NU", name: "Northwestern Wildcats", color: "#492f92", secondary: "#ffffff" },
  { code: "ODU", name: "Old Dominion Monarchs", color: "#003768", secondary: "#a1d2f1" },
  { code: "OHIO", name: "Ohio Bobcats", color: "#154734", secondary: "#ffffff" },
  { code: "OKST", name: "Oklahoma State Cowboys", color: "#fe5c00", secondary: "#000000" },
  { code: "ORE", name: "Oregon Ducks", color: "#00934b", secondary: "#fff41b" },
  { code: "ORST", name: "Oregon State Beavers", color: "#dc4405", secondary: "#000000" },
  { code: "OSU", name: "Ohio State Buckeyes", color: "#ba0c2f", secondary: "#a8adb4" },
  { code: "OU", name: "Oklahoma Sooners", color: "#990000", secondary: "#ffffff" },
  { code: "PITT", name: "Pittsburgh Panthers", color: "#003594", secondary: "#ffb81c" },
  { code: "PSU", name: "Penn State Nittany Lions", color: "#061440", secondary: "#ffffff" },
  { code: "PUR", name: "Purdue Boilermakers", color: "#ceb888", secondary: "#000000" },
  { code: "RICE", name: "Rice Owls", color: "#00205b", secondary: "#c1c6c8" },
  { code: "RUTG", name: "Rutgers Scarlet Knights", color: "#ce0e2d", secondary: "#ffffff" },
  { code: "SAC", name: "Sacramento State Hornets", color: "#00573C", secondary: "#cdb97d" },
  { code: "SC", name: "South Carolina Gamecocks", color: "#73000a", secondary: "#000000" },
  { code: "SDSU", name: "San Diego State Aztecs", color: "#a6192e", secondary: "#000000" },
  { code: "SHSU", name: "Sam Houston Bearkats", color: "#f56423", secondary: "#ffffff" },
  { code: "SJSU", name: "San José State Spartans", color: "#0038a8", secondary: "#ffb81a" },
  { code: "SMU", name: "SMU Mustangs", color: "#a80000", secondary: "#0033a1" },
  { code: "STAN", name: "Stanford Cardinal", color: "#8c1515", secondary: "#ffffff" },
  { code: "SYR", name: "Syracuse Orange", color: "#000e54", secondary: "#ff431b" },
  { code: "TA&M", name: "Texas A&M Aggies", color: "#500000", secondary: "#ffffff" },
  { code: "TCU", name: "TCU Horned Frogs", color: "#4d1979", secondary: "#ffffff" },
  { code: "TEM", name: "Temple Owls", color: "#a41e35", secondary: "#ffffff" },
  { code: "TENN", name: "Tennessee Volunteers", color: "#ff8200", secondary: "#ffffff" },
  { code: "TEX", name: "Texas Longhorns", color: "#af5c37", secondary: "#ffffff" },
  { code: "TLSA", name: "Tulsa Golden Hurricane", color: "#003595", secondary: "#d0b787" },
  { code: "TOL", name: "Toledo Rockets", color: "#0b2240", secondary: "#ffcd00" },
  { code: "TROY", name: "Troy Trojans", color: "#862633", secondary: "#b1b1b1" },
  { code: "TTU", name: "Texas Tech Red Raiders", color: "#da291c", secondary: "#000000" },
  { code: "TULN", name: "Tulane Green Wave", color: "#006747", secondary: "#418fde" },
  { code: "TXST", name: "Texas State Bobcats", color: "#501214", secondary: "#6a5638" },
  { code: "UAB", name: "UAB Blazers", color: "#1a5632", secondary: "#fdb913" },
  { code: "UCF", name: "UCF Knights", color: "#000000", secondary: "#b4a169" },
  { code: "UCLA", name: "UCLA Bruins", color: "#2774ae", secondary: "#f2a900" },
  { code: "UGA", name: "Georgia Bulldogs", color: "#ba0c2f", secondary: "#2c2a29" },
  { code: "UK", name: "Kentucky Wildcats", color: "#0033a0", secondary: "#ffffff" },
  { code: "UL", name: "Louisiana Ragin\' Cajuns", color: "#ce181e", secondary: "#000000" },
  { code: "ULM", name: "UL Monroe Warhawks", color: "#840029", secondary: "#fdb913" },
  { code: "UNC", name: "North Carolina Tar Heels", color: "#7bafd4", secondary: "#13294b" },
  { code: "UNLV", name: "UNLV Rebels", color: "#cf0a2c", secondary: "#cac8c8" },
  { code: "UNM", name: "New Mexico Lobos", color: "#ba0c2f", secondary: "#a7a8aa" },
  { code: "UNT", name: "North Texas Mean Green", color: "#068f33", secondary: "#ffffff" },
  { code: "USA", name: "South Alabama Jaguars", color: "#00205b", secondary: "#bf0d3e" },
  { code: "USC", name: "USC Trojans", color: "#9d2235", secondary: "#ffc72c" },
  { code: "USF", name: "South Florida Bulls", color: "#006747", secondary: "#cfc493" },
  { code: "USM", name: "Southern Miss Golden Eagles", color: "#ffc72c", secondary: "#231f20" },
  { code: "USU", name: "Utah State Aggies", color: "#0f2439", secondary: "#ffffff" },
  { code: "UTAH", name: "Utah Utes", color: "#be0000", secondary: "#ffffff" },
  { code: "UTEP", name: "UTEP Miners", color: "#ff8200", secondary: "#041e42" },
  { code: "UTSA", name: "UTSA Roadrunners", color: "#0c2340", secondary: "#f15a22" },
  { code: "UVA", name: "Virginia Cavaliers", color: "#232d4b", secondary: "#f84c1e" },
  { code: "VAN", name: "Vanderbilt Commodores", color: "#000000", secondary: "#cfae70" },
  { code: "VT", name: "Virginia Tech Hokies", color: "#6a2c3e", secondary: "#cf4520" },
  { code: "WAKE", name: "Wake Forest Demon Deacons", color: "#ceb888", secondary: "#2c2a29" },
  { code: "WASH", name: "Washington Huskies", color: "#33006f", secondary: "#e8d3a2" },
  { code: "WIS", name: "Wisconsin Badgers", color: "#a00000", secondary: "#ffffff" },
  { code: "WKU", name: "Western Kentucky Hilltoppers", color: "#e13a3e", secondary: "#ffffff" },
  { code: "WMU", name: "Western Michigan Broncos", color: "#532e1f", secondary: "#f1c500" },
  { code: "WSU", name: "Washington State Cougars", color: "#a60f2d", secondary: "#4d4d4d" },
  { code: "WVU", name: "West Virginia Mountaineers", color: "#eaaa00", secondary: "#002855" },
  { code: "WYO", name: "Wyoming Cowboys", color: "#492f24", secondary: "#ffc425" },
];

export type League = "nhl" | "nfl" | "nba" | "soccer" | "ncaaf";
export const LEAGUE_THEMES: Record<League, TeamTheme[]> = { nhl: TEAM_THEMES, nfl: NFL_TEAM_THEMES, nba: NBA_TEAM_THEMES, soccer: SOCCER_TEAM_THEMES, ncaaf: NCAAF_TEAM_THEMES };

export function themeFor(league: League, code: string): TeamTheme | null {
  return LEAGUE_THEMES[league].find((t) => t.code === code) ?? null;
}

// Per-league favorites: one NHL team, one NFL team, one NBA team, one soccer
// club. The color scheme follows whichever league is active. Legacy
// single-favorite values ("league:CODE" or plain "CODE" from the NHL-only
// era) migrate into the matching league slot on first read.
export type LeagueFavorites = { nhl: string | null; nfl: string | null; nba: string | null; soccer: string | null; ncaaf: string | null };
const FAV_NHL_KEY = "dh-favorite-nhl";
const FAV_NFL_KEY = "dh-favorite-nfl";
const FAV_NBA_KEY = "dh-favorite-nba";
const FAV_SOCCER_KEY = "dh-favorite-soccer";
const FAV_NCAAF_KEY = "dh-favorite-ncaaf";

export function loadFavorites(): LeagueFavorites {
  try {
    let nhl = localStorage.getItem(FAV_NHL_KEY);
    let nfl = localStorage.getItem(FAV_NFL_KEY);
    let nba = localStorage.getItem(FAV_NBA_KEY);
    let soccer = localStorage.getItem(FAV_SOCCER_KEY);
    let ncaaf = localStorage.getItem(FAV_NCAAF_KEY);
    const legacy = localStorage.getItem(FAVORITE_TEAM_KEY);
    if (legacy && !nhl && !nfl && !nba && !soccer && !ncaaf) {
      const [league, code] = legacy.includes(":") ? legacy.split(":") : ["nhl", legacy];
      if (league === "nfl" && code && themeFor("nfl", code)) nfl = code;
      else if (league === "nba" && code && themeFor("nba", code)) nba = code;
      else if (league === "soccer" && code && themeFor("soccer", code)) soccer = code;
      else if (code && themeFor("nhl", code)) nhl = code;
      try {
        localStorage.removeItem(FAVORITE_TEAM_KEY);
        if (nhl) localStorage.setItem(FAV_NHL_KEY, nhl);
        if (nfl) localStorage.setItem(FAV_NFL_KEY, nfl);
        if (nba) localStorage.setItem(FAV_NBA_KEY, nba);
        if (soccer) localStorage.setItem(FAV_SOCCER_KEY, soccer);
      } catch { /* migration is best-effort */ }
    }
    return {
      nhl: nhl && themeFor("nhl", nhl) ? nhl : null,
      nfl: nfl && themeFor("nfl", nfl) ? nfl : null,
      nba: nba && themeFor("nba", nba) ? nba : null,
      soccer: soccer && themeFor("soccer", soccer) ? soccer : null,
      ncaaf: ncaaf && themeFor("ncaaf", ncaaf) ? ncaaf : null,
    };
  } catch {
    return { nhl: null, nfl: null, nba: null, soccer: null, ncaaf: null };
  }
}

export function saveFavorite(league: League, code: string | null): void {
  try {
    const key = league === "nhl" ? FAV_NHL_KEY : league === "nfl" ? FAV_NFL_KEY : league === "nba" ? FAV_NBA_KEY : league === "ncaaf" ? FAV_NCAAF_KEY : FAV_SOCCER_KEY;
    if (code) localStorage.setItem(key, code);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable; theme still applies for the session */
  }
  applyLeagueTheme(league, code);
  try {
    window.dispatchEvent(new CustomEvent("dh-team-change", { detail: { league, code } }));
  } catch {
    /* event dispatch is best-effort */
  }
}

export function applyLeagueTheme(league: League, code: string | null): void {
  try {
    const root = document.documentElement;
    const team = code ? themeFor(league, code) : null;
    if (team) {
      root.style.setProperty("--accent", team.color);
      // The pearlescent finish shimmers between the team's two colors.
      root.style.setProperty("--accent2", team.secondary || team.color);
      // Dark team colors need a lightened variant for text sitting on
      // accent-colored buttons/bars; light team colors keep the default
      // dark text via the CSS fallbacks.
      if (luminance(team.color) < 0.18) {
        root.style.setProperty("--accent-ink", lighten(team.color, 0.72));
      } else {
        root.style.removeProperty("--accent-ink");
      }
      root.setAttribute("data-fav-team", `${league}:${team.code}`);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent2");
      root.style.removeProperty("--accent-ink");
      root.removeAttribute("data-fav-team");
    }
  } catch {
    /* theming is decorative; never break the app */
  }
}

// Legacy single-favorite API, kept for any external callers.
export type FavoriteTeam = { league: League; code: string } | null;

export function loadFavoriteTeam(): FavoriteTeam {
  const favs = loadFavorites();
  if (favs.nhl) return { league: "nhl", code: favs.nhl };
  if (favs.nfl) return { league: "nfl", code: favs.nfl };
  if (favs.nba) return { league: "nba", code: favs.nba };
  if (favs.soccer) return { league: "soccer", code: favs.soccer };
  return null;
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function lighten(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const m = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
}
