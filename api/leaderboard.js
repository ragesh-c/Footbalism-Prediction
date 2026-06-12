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

function getActiveDayCount(players) {
  if (!players.length) return 0;
  let lastActive = 0;
  for (let d = 0; d < MATCHDAY_LABELS.length; d++) {
    const hasData = players.some(p => p.scores[d] && p.scores[d] > 0);
    if (hasData) lastActive = d + 1;
  }
  return lastActive;
}

module.exports = async (req, res) => {
  const sheetId = process.env.SHEET_ID;
  const apiKey = process.env.SHEETS_API_KEY || "";
  const sheetName = process.env.SHEET_NAME || "Sheet1";
  
  const colNumber = parseInt(process.env.COL_NUMBER) || 1;
  const colName = parseInt(process.env.COL_NAME) || 2;
  const colDataStart = parseInt(process.env.COL_DATA_START) || 3;
  const colTotal = parseInt(process.env.COL_TOTAL) || -1;

  if (!sheetId || sheetId === "YOUR_SHEET_ID_HERE" || sheetId.trim() === "") {
    return res.status(400).json({ error: "Google Sheet ID is not configured on the server" });
  }

  try {
    let rows = [];
    let source = "sheets_api";

    // 1. Try Google Sheets API v4 if API key is present
    if (apiKey && apiKey.trim() !== "") {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
        const apiRes = await fetch(url);
        if (apiRes.ok) {
          const json = await apiRes.json();
          rows = json.values || [];
        } else {
          console.warn(`Sheets API v4 returned status ${apiRes.status}, trying CSV export...`);
          source = "sheets_csv";
        }
      } catch (err) {
        console.warn("Sheets API v4 failed, trying CSV export...", err.message);
        source = "sheets_csv";
      }
    } else {
      source = "sheets_csv";
    }

    // 2. Fallback to CSV export if API key is not present or API call failed
    if (rows.length === 0) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) {
        return res.status(csvRes.status).json({ 
          error: `Failed to fetch sheet CSV: ${csvRes.statusText}` 
        });
      }
      const text = await csvRes.text();
      rows = text.split('\n').map(line => {
        return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      });
    }

    // Skip header rows — find first row where column colNumber is a number
    const dataRows = rows.filter(row => {
      const first = (row[colNumber] || "").toString().trim();
      return /^\d+$/.test(first);
    });

    const players = dataRows.map((row, rowIndex) => {
      const no = parseInt(row[colNumber]) || rowIndex + 1;
      const name = (row[colName] || "").trim();
      if (!name) return null;

      const scores = [];
      const totalColIndex = colTotal === -1 ? row.length - 1 : colTotal;

      for (let i = colDataStart; i < totalColIndex; i++) {
        scores.push(parseFloat(row[i]) || 0);
      }

      const total = parseFloat(row[totalColIndex]) || scores.reduce((a, b) => a + b, 0);
      return { no, name, scores, total };
    }).filter(Boolean);

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
      source: source,
      matchdays: MATCHDAY_LABELS,
      stages: STAGES,
      activeDays: getActiveDayCount(players),
      players,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
