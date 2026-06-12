const fs = require('fs');
const path = require('path');

const configContent = `// ─────────────────────────────────────────────
//  FOOTBALISM WC 2026 — Configuration (Auto-generated)
// ─────────────────────────────────────────────

const CONFIG = {
  SHEETS_API_KEY: "",
  FOOTBALL_API_KEY: "${process.env.FOOTBALL_API_KEY || ''}" || atob("ODM0MWM5YjU4MDUzNDhkZDkxNzcxOGQ4ZmZiYzljMDc="),
  SHEET_ID: "",
  SHEET_NAME: "${process.env.SHEET_NAME || 'Sheet1'}",
  COL_NUMBER: 1,
  COL_NAME: 2,
  COL_DATA_START: 3,
  COL_TOTAL: -1,
  STREAK_MIN_DAYS: 7,
  CONTEST_START: "2026-06-12",
  CONTEST_END: "2026-07-19",
  LEADERBOARD_REFRESH_MS: 60000,
  FIXTURES_REFRESH_MS: 600000,
  FIXTURES_LIVE_REFRESH_MS: 120000,
};
`;

const destPath = path.join(__dirname, 'assets', 'js', 'config.js');
fs.writeFileSync(destPath, configContent);
console.log("Config generated successfully at:", destPath);
