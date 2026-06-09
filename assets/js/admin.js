// ─────────────────────────────────────────────
//  admin.js — Manual data upload panel
// ─────────────────────────────────────────────

const Admin = (() => {

  function init() {
    const form = document.getElementById("admin-auth");
    const panel = document.getElementById("admin-panel");
    const passInput = document.getElementById("admin-pass");
    const loginBtn = document.getElementById("admin-login");
    const logoutBtn = document.getElementById("admin-logout");
    const uploadInput = document.getElementById("data-upload");
    const uploadBtn = document.getElementById("upload-btn");
    const clearBtn = document.getElementById("clear-btn");
    const statusEl = document.getElementById("upload-status");
    const currentSourceEl = document.getElementById("current-source");

    // Check if already authenticated this session
    if (sessionStorage.getItem("footbalism_admin") === "true") {
      showPanel(form, panel);
    }

    // Check current override status
    updateSourceStatus(currentSourceEl);

    loginBtn?.addEventListener("click", () => {
      const pass = passInput?.value?.trim();
      if (!pass) return;

      // CONFIG.ADMIN_PASSKEY is set via the deploy workflow / config.js
      const correctKey = typeof CONFIG !== "undefined" ? CONFIG.ADMIN_PASSKEY : "footbalism2026";

      if (pass === correctKey) {
        sessionStorage.setItem("footbalism_admin", "true");
        showPanel(form, panel);
        passInput.value = "";
      } else {
        passInput.classList.add("input--error");
        setTimeout(() => passInput.classList.remove("input--error"), 1000);
        setStatus(statusEl, "Incorrect passkey.", "error");
      }
    });

    passInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") loginBtn?.click();
    });

    logoutBtn?.addEventListener("click", () => {
      sessionStorage.removeItem("footbalism_admin");
      hidePanel(form, panel);
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

        // Basic validation
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

        // Offer to reload leaderboard
        setTimeout(() => {
          if (confirm("Data uploaded. Reload the leaderboard now?")) {
            window.location.href = "index.html";
          }
        }, 800);

      } catch (err) {
        setStatus(statusEl, `Error: ${err.message}`, "error");
      }

      // Reset input so same file can be re-uploaded
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

  function showPanel(form, panel) {
    if (form) form.style.display = "none";
    if (panel) panel.style.display = "block";
  }

  function hidePanel(form, panel) {
    if (form) form.style.display = "block";
    if (panel) panel.style.display = "none";
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
