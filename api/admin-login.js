/**
 * Serverless function for Vercel.
 * Verifies the admin passkey and returns the admin panel HTML securely.
 */
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const correctPasskey = process.env.ADMIN_PASSKEY || "footbalism2026";
  const { passkey, token } = req.body || {};

  // Check if either the passkey or token (saved passkey) matches the correct password
  const attempt = passkey || token;

  if (!attempt || attempt.trim() !== correctPasskey) {
    return res.status(401).json({ error: "Unauthorized: Invalid passkey" });
  }

  // The admin panel HTML is served dynamically from the server.
  // It is never exposed in static client-side source code files.
  const adminPanelHtml = `
    <div id="admin-panel" style="display: block;">
      <div class="admin-section">
        <p class="admin-section__title">Current Data Source</p>
        <div id="current-source" class="source-status source-status--inactive">
          Checking...
        </div>
      </div>

      <div class="admin-section">
        <p class="admin-section__title">Upload Data Override</p>
        <p class="admin-section__desc">
          Export your Google Sheet as <code>.json</code> using the format
          in <code>assets/data/fallback.json</code> and upload it here.
          This will override the live Google Sheets data until cleared.
        </p>
        <input type="file" id="data-upload" accept=".json" style="display:none">
        <div class="admin-btns">
          <button class="btn btn--primary" id="upload-btn">Choose File</button>
          <button class="btn btn--ghost" id="clear-btn">Clear Override</button>
        </div>
        <div id="upload-status" class="upload-status"></div>
      </div>

      <div class="admin-section">
        <p class="admin-section__title">JSON Format Reference</p>
        <div class="instructions">
          <p style="font-size: var(--text-sm); color: var(--c-muted); margin-bottom: var(--sp-md);">
            Your uploaded JSON must follow this structure:
          </p>
          <ol>
            <li>Top-level <code>players</code> array (required)</li>
            <li>Each player: <code>{ "no", "name", "scores": [], "total" }</code></li>
            <li><code>scores</code> is an array of numbers, one per matchday column</li>
            <li><code>total</code> is the sum — or set to <code>0</code> to auto-calculate</li>
            <li>See <code>assets/data/fallback.json</code> for a full example</li>
          </ol>
        </div>
      </div>

      <div class="admin-section">
        <div class="admin-btns">
          <a href="index.html" class="btn btn--ghost">← Back to Leaderboard</a>
          <button class="btn btn--ghost" id="admin-logout">Log Out</button>
        </div>
      </div>
    </div>
  `;

  return res.status(200).json({
    success: true,
    html: adminPanelHtml,
    token: correctPasskey // Simple secure token matching the passkey
  });
};
