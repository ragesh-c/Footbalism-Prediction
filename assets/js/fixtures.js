// ─────────────────────────────────────────────
//  fixtures.js — Fixtures + Group Tables
//  Source: football-data.org v4 API
//  Endpoints: /competitions/WC/matches + /competitions/WC/standings
// ─────────────────────────────────────────────

const FixturesAPI = (() => {

  const BASE = "https://api.football-data.org/v4";
  const COMP = "WC";
  const IST_OFFSET = 5.5 * 60 * 60 * 1000; // UTC+5:30

  // Cache keys
  const CACHE_MATCHES   = "footbalism_matches";
  const CACHE_STANDINGS = "footbalism_standings";
  const CACHE_TTL       = 5 * 60 * 1000; // 5 minutes

  const STAGE_LABELS = {
    GROUP_STAGE:  "Group Stage",
    LAST_32:      "Round of 32",
    LAST_16:      "Round of 16",
    QUARTER_FINALS: "Quarter-Finals",
    SEMI_FINALS:  "Semi-Finals",
    THIRD_PLACE:  "Third Place",
    FINAL:        "Final"
  };

  // Country code → flag emoji
  const FLAG_MAP = {
    "MEX":"🇲🇽","RSA":"🇿🇦","KOR":"🇰🇷","CZE":"🇨🇿","CAN":"🇨🇦","BIH":"🇧🇦",
    "QAT":"🇶🇦","SUI":"🇨🇭","USA":"🇺🇸","PRY":"🇵🇾","PAN":"🇵🇦","ARG":"🇦🇷",
    "BRA":"🇧🇷","COL":"🇨🇴","ECU":"🇪🇨","URU":"🇺🇾","PER":"🇵🇪","CHI":"🇨🇱",
    "ESP":"🇪🇸","POR":"🇵🇹","FRA":"🇫🇷","GER":"🇩🇪","ENG":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","NED":"🇳🇱",
    "BEL":"🇧🇪","ITA":"🇮🇹","CRO":"🇭🇷","DEN":"🇩🇰","AUT":"🇦🇹","SRB":"🇷🇸",
    "POL":"🇵🇱","SCO":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","WAL":"🏴󠁧󠁢󠁷󠁬󠁳󠁿","TUR":"🇹🇷","GRE":"🇬🇷","UKR":"🇺🇦",
    "MAR":"🇲🇦","SEN":"🇸🇳","NGA":"🇳🇬","CMR":"🇨🇲","CIV":"🇨🇮","GHA":"🇬🇭",
    "EGY":"🇪🇬","ALG":"🇩🇿","TUN":"🇹🇳","MLI":"🇲🇱","AUS":"🇦🇺","JPN":"🇯🇵",
    "IRN":"🇮🇷","KSA":"🇸🇦","IRQ":"🇮🇶","UZB":"🇺🇿","THA":"🇹🇭","VNM":"🇻🇳",
    "NZL":"🇳🇿","JAM":"🇯🇲","TRI":"🇹🇹","SLV":"🇸🇻","HND":"🇭🇳","CRC":"🇨🇷",
    "BOL":"🇧🇴","VEN":"🇻🇪","ALB":"🇦🇱","HUN":"🇭🇺","ROU":"🇷🇴","SVK":"🇸🇰",
    "SVN":"🇸🇮","NOR":"🇳🇴","SWE":"🇸🇪","FIN":"🇫🇮","ISL":"🇮🇸","IRL":"🇮🇪",
    "PAR":"🇵🇾","URY":"🇺🇾","CUW":"🇨🇼","JOR":"🇯🇴","HAI":"🇭🇹","CPV":"🇨🇻",
    "COD":"🇨🇩"
  };

  function getFlag(tla) {
    return FLAG_MAP[tla] || "🏳️";
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatISTDate(utcStr) {
    const ist = new Date(new Date(utcStr).getTime() + IST_OFFSET);
    const day = ist.getUTCDate();
    const month = MONTHS[ist.getUTCMonth()];
    return `${month} ${day}`;
  }

  function formatISTTime(utcStr) {
    const ist = new Date(new Date(utcStr).getTime() + IST_OFFSET);
    let hours = ist.getUTCHours();
    const minutes = ist.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    const strMinutes = String(minutes).padStart(2, '0');
    return `${strHours}:${strMinutes} ${ampm}`;
  }

  function getLocalDate(utcStr) {
    // Returns YYYY-MM-DD in IST
    const ist = new Date(new Date(utcStr).getTime() + IST_OFFSET);
    return ist.toISOString().slice(0, 10);
  }

  // Cache helpers
  function cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }

  // Cache helpers
  function cacheSet(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  }

  // Fetch with auth header
  async function apiFetch(path) {
    const key = typeof CONFIG !== "undefined"
      ? CONFIG.FOOTBALL_API_KEY
      : atob("ODM0MWM5YjU4MDUzNDhkZDkxNzcxOGQ4ZmZiYzljMDc=");
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Auth-Token": key }
    });
    if (!res.ok) throw new Error(`football-data API ${res.status}: ${path}`);
    return res.json();
  }

  // Same-origin JSON published by .github/workflows/live-data.yml.
  // football-data.org blocks browser CORS, so this is the primary live
  // source; the direct API call below stays as a long-shot fallback.
  async function liveFileFetch(name) {
    const bust = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-min CDN bucket
    const res = await fetch(`assets/data/live/${name}?v=${bust}`);
    if (!res.ok) throw new Error(`live data ${name}: ${res.status}`);
    return res.json();
  }

  // Fetch from the Vercel API proxy, falling back to static JSON, and finally the direct API
  async function sourceFetch(file, apiPath, validate) {
    const apiEndpoint = `/api/${file.replace(".json", "")}`;
    
    // 1. Try Vercel Serverless Function Proxy first
    try {
      console.log(`[Fixtures] Attempting real-time fetch from: ${apiEndpoint}`);
      const res = await fetch(apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        if (validate(data)) {
          console.log(`[Fixtures] Successfully loaded real-time data from: ${apiEndpoint}`);
          return data;
        }
      }
      console.warn(`[Fixtures] Real-time endpoint ${apiEndpoint} returned unexpected status or shape`);
    } catch (err) {
      console.warn(`[Fixtures] Real-time endpoint ${apiEndpoint} unavailable:`, err.message || err);
    }

    // 2. Fall back to static JSON committed to the repo
    try {
      const data = await liveFileFetch(file);
      if (validate(data)) {
        console.log(`[Fixtures] Using fallback static JSON: ${file}`);
        return data;
      }
      throw new Error(`static JSON data ${file} has unexpected shape`);
    } catch (err) {
      console.warn(`[Fixtures] Static JSON fallback failed for ${file}:`, err.message || err);
      // 3. Last-resort fallback: direct API call
      return apiFetch(apiPath);
    }
  }

  const TEAM_NAME_MAP = {
    "Korea Republic": "South Korea",
    "Czechia": "Czech Republic",
    "Bosnia-H.": "Bosnia & Herzegovina",
    "Cabo Verde": "Cape Verde",
    "Congo DR": "DR Congo",
    "Côte d'Ivoire": "Ivory Coast",
    "United States": "USA",
    "Türkiye": "Turkey"
  };

  const STADIUM_MAP = {
    // Group A
    "Mexico|South Africa": "Estadio Azteca, Mexico City",
    "South Korea|Czech Republic": "SoFi Stadium, Los Angeles",
    "Mexico|Czech Republic": "AT&T Stadium, Dallas",
    "South Korea|South Africa": "Mercedes-Benz Stadium, Atlanta",
    "South Africa|Czech Republic": "Gillette Stadium, Boston",
    "Mexico|South Korea": "Levi's Stadium, San Francisco",
    // Group B
    "Canada|Qatar": "BMO Field, Toronto",
    "Switzerland|Bosnia & Herzegovina": "BC Place, Vancouver",
    "Canada|Bosnia & Herzegovina": "NRG Stadium, Houston",
    "Qatar|Switzerland": "Lumen Field, Seattle",
    "Qatar|Bosnia & Herzegovina": "Lincoln Financial Field, Philadelphia",
    "Canada|Switzerland": "Arrowhead Stadium, Kansas City",
    // Group C
    "Brazil|Haiti": "Hard Rock Stadium, Miami",
    "Morocco|Scotland": "MetLife Stadium, New York/New Jersey",
    "Brazil|Morocco": "AT&T Stadium, Dallas",
    "Scotland|Haiti": "NRG Stadium, Houston",
    "Haiti|Morocco": "Mercedes-Benz Stadium, Atlanta",
    "Brazil|Scotland": "Gillette Stadium, Boston",
    // Group D
    "USA|Paraguay": "SoFi Stadium, Los Angeles",
    "Australia|Türkiye": "AT&T Stadium, Dallas",
    "USA|Türkiye": "Lumen Field, Seattle",
    "Australia|Paraguay": "NRG Stadium, Houston",
    "Paraguay|Türkiye": "GEODIS Park, Nashville",
    "USA|Australia": "Arrowhead Stadium, Kansas City",
    // Group E
    "Germany|Curaçao": "Mercedes-Benz Stadium, Atlanta",
    "Ecuador|Ivory Coast": "Levi's Stadium, San Francisco",
    "Germany|Ecuador": "MetLife Stadium, New York/New Jersey",
    "Ivory Coast|Curaçao": "NRG Stadium, Houston",
    "Ivory Coast|Germany": "Lincoln Financial Field, Philadelphia",
    "Curaçao|Ecuador": "Q2 Stadium, Austin",
    // Group F
    "Netherlands|Japan": "Hard Rock Stadium, Miami",
    "Tunisia|Sweden": "BC Place, Vancouver",
    "Netherlands|Tunisia": "Mercedes-Benz Stadium, Atlanta",
    "Japan|Sweden": "Lumen Field, Seattle",
    "Japan|Tunisia": "GEODIS Park, Nashville",
    "Netherlands|Sweden": "Levi's Stadium, San Francisco",
    // Group G
    "Belgium|Egypt": "SoFi Stadium, Los Angeles",
    "Iran|New Zealand": "BC Place, Vancouver",
    "Belgium|Iran": "Lumen Field, Seattle",
    "Egypt|New Zealand": "NRG Stadium, Houston",
    "New Zealand|Belgium": "GEODIS Park, Nashville",
    "Egypt|Iran": "Levi's Stadium, San Francisco",
    // Group H
    "Spain|Cape Verde": "AT&T Stadium, Dallas",
    "Uruguay|Saudi Arabia": "MetLife Stadium, New York/New Jersey",
    "Spain|Uruguay": "Mercedes-Benz Stadium, Atlanta",
    "Saudi Arabia|Cape Verde": "O2 Stadium, London",
    "Cape Verde|Uruguay": "GEODIS Park, Nashville",
    "Spain|Saudi Arabia": "Hard Rock Stadium, Miami",
    // Group I
    "France|Iraq": "SoFi Stadium, Los Angeles",
    "Senegal|Norway": "Levi's Stadium, San Francisco",
    "France|Senegal": "MetLife Stadium, New York/New Jersey",
    "Norway|Iraq": "NRG Stadium, Houston",
    "Iraq|Senegal": "Q2 Stadium, Austin",
    "France|Norway": "Arrowhead Stadium, Kansas City",
    // Group J
    "Argentina|Algeria": "Hard Rock Stadium, Miami",
    "Austria|Jordan": "BC Place, Vancouver",
    "Argentina|Austria": "NRG Stadium, Houston",
    "Algeria|Jordan": "Lumen Field, Seattle",
    "Jordan|Algeria": "Q2 Stadium, Austin",
    "Argentina|Jordan": "MetLife Stadium, New York/New Jersey",
    // Group K
    "Portugal|DR Congo": "Mercedes-Benz Stadium, Atlanta",
    "Colombia|Uzbekistan": "Levi's Stadium, San Francisco",
    "Portugal|Colombia": "MetLife Stadium, New York/New Jersey",
    "Uzbekistan|DR Congo": "GEODIS Park, Nashville",
    "DR Congo|Colombia": "NRG Stadium, Houston",
    "Portugal|Uzbekistan": "Lumen Field, Seattle",
    // Group L
    "England|Panama": "AT&T Stadium, Dallas",
    "Croatia|Ghana": "Hard Rock Stadium, Miami",
    "England|Ghana": "NRG Stadium, Houston",
    "Croatia|Panama": "GEODIS Park, Nashville",
    "Panama|Ghana": "Q2 Stadium, Austin",
    "England|Croatia": "MetLife Stadium, New York/New Jersey"
  };

  function normalizeTeamName(name) {
    return TEAM_NAME_MAP[name] || name;
  }

  async function mergeESPNLiveScores(matches) {
    try {
      console.log("[Fixtures] Fetching live scores from ESPN...");
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard");
      if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
      const espnData = await res.json();
      
      if (!espnData.events || !Array.isArray(espnData.events)) {
        return;
      }

      espnData.events.forEach(event => {
        const comp = event.competitions?.[0];
        if (!comp || !comp.competitors) return;

        const homeCompetitor = comp.competitors.find(c => c.homeAway === "home");
        const awayCompetitor = comp.competitors.find(c => c.homeAway === "away");
        if (!homeCompetitor || !awayCompetitor) return;

        const homeName = normalizeTeamName(homeCompetitor.team?.displayName);
        const awayName = normalizeTeamName(awayCompetitor.team?.displayName);

        // Find matching match in our schedule
        const match = matches.find(m => {
          const mHome = normalizeTeamName(m.team1);
          const mAway = normalizeTeamName(m.team2);
          return (mHome === homeName && mAway === awayName) || (mHome === awayName && mAway === homeName);
        });

        if (match) {
          const state = comp.status?.type?.state;
          let newStatus = "TIMED";
          
          if (comp.status?.type?.completed || state === "post") {
            newStatus = "FINISHED";
          } else if (state === "in") {
            newStatus = "IN_PLAY";
          }

          const scoreHome = parseInt(homeCompetitor.score);
          const scoreAway = parseInt(awayCompetitor.score);

          // Update match status and scores based on home/away assignment
          const isHomeT1 = normalizeTeamName(match.team1) === homeName;
          if (isHomeT1) {
            match.score1 = isNaN(scoreHome) ? null : scoreHome;
            match.score2 = isNaN(scoreAway) ? null : scoreAway;
          } else {
            match.score1 = isNaN(scoreAway) ? null : scoreAway;
            match.score2 = isNaN(scoreHome) ? null : scoreHome;
          }
          match.status = newStatus;
          
          console.log(`[Fixtures] ESPN Update: ${match.team1} ${match.score1} - ${match.score2} ${match.team2} (${newStatus})`);
        }
      });
    } catch (err) {
      console.warn("[Fixtures] Failed to merge ESPN live scores:", err.message || err);
    }
  }

  function getStadium(t1, t2) {
    const team1 = normalizeTeamName(t1);
    const team2 = normalizeTeamName(t2);
    return STADIUM_MAP[`${team1}|${team2}`] || STADIUM_MAP[`${team2}|${team1}`] || null;
  }

  // Load all matches, grouped by IST date
  // Pass { force: true } to bypass the session cache (live refresh)
  async function loadMatches({ force = false } = {}) {
    if (!force) {
      const cached = cacheGet(CACHE_MATCHES);
      if (cached) return cached;
    }

    const data = await sourceFetch(
      "matches.json",
      `/competitions/${COMP}/matches`,
      d => Array.isArray(d.matches)
    );

    // Group by IST date
    const byDate = {};
    const allDates = [];

    data.matches.forEach(m => {
      const dateKey = getLocalDate(m.utcDate);
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
        allDates.push(dateKey);
      }
      byDate[dateKey].push({
        id: m.id,
        utcDate: m.utcDate,
        istDate: formatISTDate(m.utcDate),
        istTime: formatISTTime(m.utcDate),
        stadium: getStadium(m.homeTeam.shortName || m.homeTeam.name, m.awayTeam.shortName || m.awayTeam.name) || "TBD Stadium",
        status: m.status,           // TIMED, SCHEDULED, IN_PLAY, PAUSED, FINISHED
        stage: m.stage,
        stageLabel: STAGE_LABELS[m.stage] || m.stage,
        group: m.group ? m.group.replace("GROUP_", "Group ") : null,
        matchday: m.matchday,
        home: {
          name: m.homeTeam.name,
          short: m.homeTeam.shortName || m.homeTeam.name,
          tla: m.homeTeam.tla,
          crest: m.homeTeam.crest,
          flag: getFlag(m.homeTeam.tla),
          score: m.score.fullTime.home
        },
        away: {
          name: m.awayTeam.name,
          short: m.awayTeam.shortName || m.awayTeam.name,
          tla: m.awayTeam.tla,
          crest: m.awayTeam.crest,
          flag: getFlag(m.awayTeam.tla),
          score: m.score.fullTime.away
        },
        winner: m.score.winner
      });
    });

    allDates.sort();
    const result = { byDate, dates: allDates };
    cacheSet(CACHE_MATCHES, result);
    return result;
  }

  // Load group standings
  // Pass { force: true } to bypass the session cache (live refresh)
  async function loadStandings({ force = false } = {}) {
    if (!force) {
      const cached = cacheGet(CACHE_STANDINGS);
      if (cached) return cached;
    }

    const data = await sourceFetch(
      "standings.json",
      `/competitions/${COMP}/standings`,
      d => Array.isArray(d.standings)
    );

    const groups = data.standings.map(g => ({
      name: g.group,
      table: g.table.map(row => ({
        position: row.position,
        team: {
          name: row.team.name,
          short: row.team.shortName || row.team.name,
          tla: row.team.tla,
          crest: row.team.crest,
          flag: getFlag(row.team.tla)
        },
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        gf: row.goalsFor,
        ga: row.goalsAgainst,
        gd: row.goalDifference,
        points: row.points,
        form: row.form
      }))
    }));

    cacheSet(CACHE_STANDINGS, groups);
    return groups;
  }

  return { loadMatches, loadStandings, getFlag, formatISTDate, formatISTTime, mergeESPNLiveScores, normalizeTeamName };
})();
