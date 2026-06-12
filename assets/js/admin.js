// ─────────────────────────────────────────────
//  admin.js — Manual data upload panel
// ─────────────────────────────────────────────

const Admin = (() => {
  let sessionToken = null;

  async function init() {
    const token = sessionStorage.getItem("footbalism_admin_token");
    if (token) {
      const success = await attemptLogin({ token });
      if (success) return;
    }
    showLoginForm();
  }

  function showLoginForm() {
    const container = document.getElementById("admin-container");
    if (!container) return;

    container.innerHTML = `
      <div id="admin-auth">
        <div class="auth-form">
          <div>
            <label class="input-label" for="admin-pass">Passkey</label>
            <input
              class="input-field"
              type="password"
              id="admin-pass"
              placeholder="Enter admin passkey"
              autocomplete="current-password"
            >
          </div>
          <button class="btn btn--primary" id="admin-login">Unlock Panel</button>
          <div id="login-error" class="upload-status upload-status--error" style="display:none; margin-top: var(--sp-sm);"></div>
        </div>
      </div>
    `;

    const loginBtn = document.getElementById("admin-login");
    const passInput = document.getElementById("admin-pass");

    loginBtn?.addEventListener("click", async () => {
      const pass = passInput?.value?.trim();
      if (!pass) return;

      loginBtn.disabled = true;
      loginBtn.textContent = "Unlocking...";

      const success = await attemptLogin({ passkey: pass });

      if (!success) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Unlock Panel";
        passInput.classList.add("input--error");
        setTimeout(() => passInput.classList.remove("input--error"), 1000);
        
        const errEl = document.getElementById("login-error");
        if (errEl) {
          errEl.textContent = "Incorrect passkey.";
          errEl.style.display = "block";
        }
      }
    });

    passInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") loginBtn?.click();
    });
  }

  async function attemptLogin(body) {
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        sessionToken = data.token;
        sessionStorage.setItem("footbalism_admin_token", sessionToken);
        renderAdminPanel(data.html);
        return true;
      }
    } catch (err) {
      console.warn("API login failed, checking local config fallback...", err);
    }

    // Fallback for local testing (only if CONFIG.ADMIN_PASSKEY is set)
    const correctKey = typeof CONFIG !== "undefined" ? CONFIG.ADMIN_PASSKEY : null;
    const attempt = body.passkey || body.token;
    if (correctKey && attempt === correctKey) {
      sessionToken = correctKey;
      sessionStorage.setItem("footbalism_admin_token", sessionToken);
      
      // Render local fallback template since we can't fetch it from serverless api
      const fallbackHtml = `
        <div id="admin-panel" style="display: block;">
          <div class="admin-section">
            <p class="admin-section__title">Current Data Source</p>
            <div id="current-source" class="source-status source-status--inactive">
              Checking...
            </div>
          </div>

          <div class="admin-section">
            <p class="admin-section__title">Upload Data Override (Local Fallback)</p>
            <p class="admin-section__desc">
              Export your Google Sheet as <code>.json</code> using the format
              in <code>assets/data/fallback.json</code> and upload it here.
            </p>
            <input type="file" id="data-upload" accept=".json" style="display:none">
            <div class="admin-btns">
              <button class="btn btn--primary" id="upload-btn">Choose File</button>
              <button class="btn btn--ghost" id="clear-btn">Clear Override</button>
            </div>
            <div id="upload-status" class="upload-status"></div>
          </div>

          <div class="admin-section">
            <div class="admin-btns">
              <a href="index.html" class="btn btn--ghost">← Back to Leaderboard</a>
              <button class="btn btn--ghost" id="admin-logout">Log Out</button>
            </div>
          </div>
        </div>
      `;
      renderAdminPanel(fallbackHtml);
      return true;
    }

    sessionStorage.removeItem("footbalism_admin_token");
    return false;
  }

  function renderAdminPanel(html) {
    const container = document.getElementById("admin-container");
    if (!container) return;

    container.innerHTML = html;
    initPanelListeners();
  }

  function initPanelListeners() {
    const logoutBtn = document.getElementById("admin-logout");
    const uploadInput = document.getElementById("data-upload");
    const uploadBtn = document.getElementById("upload-btn");
    const clearBtn = document.getElementById("clear-btn");
    const statusEl = document.getElementById("upload-status");
    const currentSourceEl = document.getElementById("current-source");

    updateSourceStatus(currentSourceEl);

    logoutBtn?.addEventListener("click", () => {
      sessionStorage.removeItem("footbalism_admin_token");
      location.reload();
    });

    uploadBtn?.addEventListener("click", () => uploadInput?.click());

    uploadInput?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".json")) {
        setStatus(statusEl, "Please upload a .json file.", "error");
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed.players || !Array.isArray(parsed.players)) {
          throw new Error("Invalid format: missing 'players' array.");
        }

        parsed._meta = {
          ...parsed._meta,
          uploaded_at: new Date().toISOString(),
          source: "manual_upload",
          filename: file.name
        };

        localStorage.setItem("footbalism_override", JSON.stringify(parsed));
        updateSourceStatus(currentSourceEl);
        setStatus(statusEl, `✓ Loaded ${parsed.players.length} players from ${file.name}`, "success");

        setTimeout(() => {
          if (confirm("Data uploaded. Reload the leaderboard now?")) {
            window.location.href = "index.html";
          }
        }, 800);

      } catch (err) {
        setStatus(statusEl, `Error: ${err.message}`, "error");
      }

      uploadInput.value = "";
    });

    clearBtn?.addEventListener("click", () => {
      if (confirm("Clear the local override? The site will use Google Sheets or fallback.json instead.")) {
        localStorage.removeItem("footbalism_override");
        updateSourceStatus(currentSourceEl);
        setStatus(statusEl, "Override cleared. Live data will be used.", "success");
      }
    });
  }

  function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = `upload-status upload-status--${type}`;
    el.style.display = "block";
  }

  function updateSourceStatus(el) {
    if (!el) return;
    const override = localStorage.getItem("footbalism_override");
    if (override) {
      try {
        const parsed = JSON.parse(override);
        const uploadedAt = parsed._meta?.uploaded_at
          ? new Date(parsed._meta.uploaded_at).toLocaleString()
          : "unknown time";
        el.textContent = `Active override: ${parsed.players?.length || 0} players, uploaded ${uploadedAt}`;
        el.className = "source-status source-status--active";
      } catch {
        el.textContent = "Override data (corrupt — clear and re-upload)";
        el.className = "source-status source-status--error";
      }
    } else {
      el.textContent = "No override active. Using Google Sheets or fallback.json.";
      el.className = "source-status source-status--inactive";
    }
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Admin.init);
