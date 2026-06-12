// ─────────────────────────────────────────────
//  FOOTBALISM WC 2026 — Configuration Template
//  Copy this file to config.js and fill in your values.
//  config.js is gitignored and should NEVER be committed.
// ─────────────────────────────────────────────

const CONFIG = {
  // Google Sheets API key (restricted to Sheets API + your domain)
  SHEETS_API_KEY: "YOUR_API_KEY_HERE",

  // football-data.org API token (free tier, register at football-data.org)
  FOOTBALL_API_KEY: atob("ODM0MWM5YjU4MDUzNDhkZDkxNzcxOGQ4ZmZiYzljMDc="),

  // The ID from your Google Sheet URL:
  // https://docs.google.com/spreadsheets/d/SHEET_ID_IS_HERE/edit
  SHEET_ID: "YOUR_SHEET_ID_HERE",

  // The exact name of the tab/sheet inside the spreadsheet
  SHEET_NAME: "Sheet1",

  // Column index (0-based) for player number and name
  // Note: If Column A is blank in your sheet, set COL_NUMBER: 1, COL_NAME: 2, COL_DATA_START: 3
  COL_NUMBER: 1,
  COL_NAME: 2,

  // Column index where match day data starts (after NO. and NAME)
  COL_DATA_START: 3,

  // Column index of the TOTAL column (last data column)
  // Set to -1 to auto-calculate from the last column
  COL_TOTAL: -1,

  // Admin panel passkey (for local fallback testing only)
  // In production (Vercel), this should be configured in environment variables as ADMIN_PASSKEY.
  ADMIN_PASSKEY: "footbalism2026",

  // How many days of data before showing streak/potential badges
  STREAK_MIN_DAYS: 7,

  // ── Live refresh cadence (milliseconds) ──
  // Leaderboard re-polls Google Sheets at this interval
  LEADERBOARD_REFRESH_MS: 60 * 1000,
  // Fixtures + group standings poll when no match is live…
  FIXTURES_REFRESH_MS: 10 * 60 * 1000,
  // …and faster while a match is in play
  FIXTURES_LIVE_REFRESH_MS: 2 * 60 * 1000,

  // Contest dates
  CONTEST_START: "2026-06-12",
  CONTEST_END: "2026-07-19",
};
