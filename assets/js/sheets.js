// ─────────────────────────────────────────────
//  sheets.js — Data layer for Footbalism WC 2026
//  Fetches from Google Sheets, falls back to local JSON
// ─────────────────────────────────────────────

const SheetsAPI = (() => {
  const MATCHDAY_LABELS = [
    "Jun 12","Jun 13","Jun 14","Jun 15","Jun 16","Jun 17",
    "Jun 18","Jun 19","Jun 20","Jun 21","Jun 22","Jun 23",
    "Jun 24","Jun 25","Jun 26","Jun 27","Jun 28","Jun 29",
    "Jun 30","Jul 1","Jul 2","Jul 3","Jul 4","Jul 4b",
    "Jul 5","Jul 6","Jul 7","Jul 8","Jul 10","Jul 11",
    "Jul 12","Jul 15","Jul 16","Jul 19","Jul 20"
  ];

  const STAGES = {
    "Group MD1": [0, 7],
    "Group MD2": [8, 15],
    "Group MD3": [16, 18],
    "Round of 32": [19, 24],
    "Round of 16": [25, 27],
    "Quarter-Finals": [28, 29],
    "Semi-Finals": [30, 30],
    "Third Place": [31, 31],
    "Final": [32, 33]
  };

  // Determine how many matchdays have real data (non-zero columns seen)
  function getActiveDayCount(players) {
    if (!players.length) return 0;
    let lastActive = 0;
    for (let d = 0; d < MATCHDAY_LABELS.length; d++) {
      const hasData = players.some(p => p.scores[d] && p.scores[d] > 0);
      if (hasData) lastActive = d + 1;
    }
    return lastActive;
  }

  // Parse a raw Sheets API row into a player object
  function parseRow(row, rowIndex) {
    const no = parseInt(row[CONFIG.COL_NUMBER]) || rowIndex + 1;
    const name = (row[CONFIG.COL_NAME] || "").trim();
    if (!name) return null;

    const scores = [];
    const dataStart = CONFIG.COL_DATA_START;

    // Collect all score columns up to (but not including) the TOTAL column
    // We detect TOTAL as the last column if COL_TOTAL is -1
    const totalColIndex = CONFIG.COL_TOTAL === -1
      ? row.length - 1
      : CONFIG.COL_TOTAL;

    for (let i = dataStart; i < totalColIndex; i++) {
      scores.push(parseFloat(row[i]) || 0);
    }

    const total = parseFloat(row[totalColIndex]) || scores.reduce((a, b) => a + b, 0);

    return { no, name, scores, total };
  }

  // Fetch from Google Sheets API
  async function fetchFromSheets() {
    let sheetId = CONFIG.SHEET_ID;
    let colNumber = CONFIG.COL_NUMBER;
    let colName = CONFIG.COL_NAME;
    let colDataStart = CONFIG.COL_DATA_START;

    // Hardcoded default fallback to user's active WC 2026 sheet if not configured
    if (!sheetId || sheetId === "YOUR_SHEET_ID_HERE" || sheetId.trim() === "") {
      sheetId = "1EJ8MDwJg49Nuve1g-wAmp60C2rz7bLBWWBP20mXs9Mc";
      // The default sheet has a blank Column A, so we must map B, C, D
      colNumber = 1;
      colName = 2;
      colDataStart = 3;
    }

    // Try Google Sheets API v4 if key is configured
    if (CONFIG.SHEETS_API_KEY && CONFIG.SHEETS_API_KEY !== "YOUR_API_KEY_HERE" && CONFIG.SHEETS_API_KEY.trim() !== "") {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(CONFIG.SHEET_NAME)}?key=${CONFIG.SHEETS_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          return parseRowsData(json.values || [], "sheets_api", colNumber, colName, colDataStart);
        }
        console.warn(`Sheets API v4 returned status ${res.status}. Falling back to public CSV export...`);
      } catch (err) {
        console.warn("Sheets API v4 failed. Falling back to public CSV export...", err.message);
      }
    }

    // Fallback: Fetch public CSV export (CORS-friendly, no API key required)
    console.log("[Footbalism] Fetching leaderboard from public CSV export...");
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`Google Sheets CSV export failed: ${res.status}`);
    }

    const text = await res.text();
    // Parse CSV rows line-by-line
    const rows = text.split('\n').map(line => {
      // Split by comma, trimming quotes
      return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    });

    return parseRowsData(rows, "sheets_csv", colNumber, colName, colDataStart);
  }

  // Helper to process rows and return standardized structure
  function parseRowsData(rows, sourceName, colNo, colNm, colStart) {
    // Skip header rows — find first row where column colNo is a number
    const dataRows = rows.filter(row => {
      const first = (row[colNo] || "").toString().trim();
      return /^\d+$/.test(first);
    });

    // Parse a raw row into a player object, overriding COL_NUMBER/COL_NAME/COL_DATA_START
    function parseLocalRow(row, rowIndex) {
      const no = parseInt(row[colNo]) || rowIndex + 1;
      const name = (row[colNm] || "").trim();
      if (!name) return null;

      const scores = [];
      const totalColIndex = CONFIG.COL_TOTAL === -1
        ? row.length - 1
        : CONFIG.COL_TOTAL;

      for (let i = colStart; i < totalColIndex; i++) {
        scores.push(parseFloat(row[i]) || 0);
      }

      const total = parseFloat(row[totalColIndex]) || scores.reduce((a, b) => a + b, 0);

      return { no, name, scores, total };
    }

    const players = dataRows
      .map((row, i) => parseLocalRow(row, i))
      .filter(Boolean);

    return {
      source: sourceName,
      matchdays: MATCHDAY_LABELS,
      stages: STAGES,
      activeDays: getActiveDayCount(players),
      players,
      fetchedAt: new Date().toISOString()
    };
  }

  // Fetch from local fallback JSON
  async function fetchFallback() {
    const res = await fetch("assets/data/fallback.json");
    if (!res.ok) throw new Error("Fallback data not available");
    const json = await res.json();
    return {
      source: "fallback",
      matchdays: json.matchdays || MATCHDAY_LABELS,
      stages: json.stages || STAGES,
      activeDays: getActiveDayCount(json.players || []),
      players: json.players || [],
      fetchedAt: json._meta?.uploaded_at || "unknown"
    };
  }

  // Check localStorage for admin-uploaded override
  async function fetchLocalOverride() {
    const raw = localStorage.getItem("footbalism_override");
    if (!raw) return null;
    try {
      const json = JSON.parse(raw);
      return {
        source: "local_override",
        matchdays: json.matchdays || MATCHDAY_LABELS,
        stages: json.stages || STAGES,
        activeDays: getActiveDayCount(json.players || []),
        players: json.players || [],
        fetchedAt: json._meta?.uploaded_at || "unknown"
      };
    } catch {
      return null;
    }
  }

  // Main entry point — tries sources in priority order
  async function load() {
    // 1. Check for local admin override first
    const override = await fetchLocalOverride();
    if (override && override.players.length > 0) {
      console.log("[Footbalism] Using local admin override");
      return override;
    }

    // 2. Try Google Sheets
    try {
      const data = await fetchFromSheets();
      console.log("[Footbalism] Loaded from Google Sheets");
      return data;
    } catch (err) {
      console.warn("[Footbalism] Sheets API failed:", err.message);
    }

    // 3. Fall back to static JSON
    try {
      const data = await fetchFallback();
      console.log("[Footbalism] Using fallback JSON");
      return data;
    } catch (err) {
      console.error("[Footbalism] All data sources failed:", err.message);
      return {
        source: "empty",
        matchdays: MATCHDAY_LABELS,
        stages: STAGES,
        activeDays: 0,
        players: [],
        fetchedAt: null
      };
    }
  }

  return { load };
})();
