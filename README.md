# Footbalism · WC 2026 Prediction Contest

Live leaderboard for the Footbalism World Cup 2026 prediction contest.
Built with vanilla JS, hosted on GitHub Pages, data from Google Sheets.

---

## Quick Setup (first time)

### 1. Clone and prepare the repo

```bash
git clone https://github.com/YOUR_USERNAME/footbalism-wc26.git
cd footbalism-wc26
cp config.example.js assets/js/config.js
```

### 2. Set up Google Sheets API (free)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. `footbalism-wc26`)
3. Enable the **Google Sheets API** (APIs & Services → Library)
4. Create an **API Key** (APIs & Services → Credentials)
5. Restrict the key: Application restrictions → HTTP referrers → add your GitHub Pages URL
6. Restrict to API: Google Sheets API only
7. Copy the key

### 3. Make your Google Sheet public

1. Open your Google Sheet
2. Share → Anyone with the link → **Viewer**
3. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_IS_YOUR_SHEET_ID`**`/edit`

### 4. Add credentials to config.js (local)

Open `assets/js/config.js` and fill in:

```js
SHEETS_API_KEY: "your_api_key_here",
SHEET_ID: "your_sheet_id_here",
SHEET_NAME: "Sheet1",          // exact tab name
ADMIN_PASSKEY: "your_passkey", // change this
```

> **Never commit config.js** — it's in `.gitignore`

### 5. Add GitHub Secrets (for auto-deploy)

In your GitHub repo: Settings → Secrets and Variables → Actions → New repository secret

Add these four secrets:

| Secret Name      | Value                    |
|------------------|--------------------------|
| `SHEETS_API_KEY` | Your Google API key      |
| `SHEET_ID`       | Your Google Sheet ID     |
| `SHEET_NAME`     | Tab name (e.g. `Sheet1`) |
| `ADMIN_PASSKEY`  | Your chosen passkey      |

### 6. Enable GitHub Pages

Settings → Pages → Source: **GitHub Actions**

### 7. Deploy

```bash
git add .
git commit -m "initial deploy"
git push origin main
```

GitHub Actions will build and deploy automatically to:
`https://YOUR_USERNAME.github.io/footbalism-wc26/`

---

## Data Structure

Your Google Sheet must have:
- **Column A**: Player number (1, 2, 3...)
- **Column B**: Player name
- **Columns C onwards**: One column per matchday date (Jun 12, Jun 13, etc.)
- **Last column**: Total points

The parser skips header rows automatically (any row where column A isn't a number).

---

## Admin Panel

Visit `/admin.html` to manually upload data when needed.

**When to use the admin panel:**
- Google Sheets API quota is hit (free tier: 100 requests/100 seconds)
- You want to freeze the leaderboard at a specific snapshot
- You're testing with sample data

**How to export from Google Sheets to JSON:**
Use the format in `assets/data/fallback.json` — one entry per player with a `scores` array matching the matchday columns.

---

## Updating Data (routine)

The site auto-fetches from Google Sheets on every page load. No action needed — just update the sheet and the site reflects it within seconds.

---

## Streak / Potential Badges

Badges appear after **Day 7** (configurable via `STREAK_MIN_DAYS` in config):

| Badge | Trigger |
|---|---|
| 📈 Rising | Rank improved each of last 3 days |
| 👑 Contender | Top 3 with low score variance |
| 📉 Slipping | Rank dropped each of last 3 days |

---

## Tech Stack

- Vanilla HTML / CSS / JS — no build step, no framework
- Google Sheets API v4 (read-only)
- GitHub Actions for config injection + deployment
- GitHub Pages for hosting

---

## Adding a Hero Background Image

Drop your WC 2026 image into `assets/img/wc-hero-bg.jpg`.
Recommended: 1920×1080px minimum, landscape orientation.
