// ─────────────────────────────────────────────
//  leaderboard.js — Ranking, streaks, potentials
//  Renders the standings table and animates live
//  updates in place (FLIP for rank moves, bump for
//  point changes) instead of repainting from scratch.
// ─────────────────────────────────────────────

const Leaderboard = (() => {

  const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Rank players by total, assign rank numbers (handle ties) ──
  function rankPlayers(players) {
    const sorted = [...players].sort((a, b) => b.total - a.total);
    let rank = 1;
    return sorted.map((player, i) => {
      if (i > 0 && sorted[i - 1].total !== player.total) rank = i + 1;
      return { ...player, rank };
    });
  }

  // ── Calculate daily rank history for each player ──
  function buildDailyRankHistory(players, activeDays) {
    const history = {};
    players.forEach(p => { history[p.name] = []; });

    for (let day = 0; day < activeDays; day++) {
      const dayTotals = players.map(p => ({
        name: p.name,
        running: p.scores.slice(0, day + 1).reduce((a, b) => a + b, 0)
      }));
      dayTotals.sort((a, b) => b.running - a.running);

      let r = 1;
      dayTotals.forEach((p, i) => {
        if (i > 0 && dayTotals[i - 1].running !== p.running) r = i + 1;
        history[p.name].push(r);
      });
    }

    return history;
  }

  // ── Determine badge for a player ──
  function getBadge(player, rankHistory, activeDays, totalPlayers) {
    if (activeDays < cfgStreakMinDays()) return null;

    const history = rankHistory[player.name] || [];
    if (history.length < 3) return null;

    const last3 = history.slice(-3);
    const median = Math.ceil(totalPlayers / 2);

    if (last3.every(r => r <= median)) {
      return { emoji: "🔥", label: "On Fire", cls: "badge--fire" };
    }
    if (last3[0] > last3[1] && last3[1] > last3[2]) {
      return { emoji: "📈", label: "Rising", cls: "badge--rising" };
    }
    if (player.rank <= 3) {
      const recentScores = player.scores.slice(-5);
      const mean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const variance = recentScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentScores.length;
      if (variance < 15) {
        return { emoji: "👑", label: "Contender", cls: "badge--contender" };
      }
    }
    if (last3[0] < last3[1] && last3[1] < last3[2]) {
      return { emoji: "📉", label: "Slipping", cls: "badge--slipping" };
    }

    return null;
  }

  function cfgStreakMinDays() {
    return (typeof CONFIG !== "undefined" && CONFIG.STREAK_MIN_DAYS != null) ? CONFIG.STREAK_MIN_DAYS : 7;
  }

  // ── Compute rank change vs yesterday ──
  function getRankChange(player, rankHistory) {
    const history = rankHistory[player.name] || [];
    if (history.length < 2) return 0;
    return history[history.length - 2] - history[history.length - 1];
  }

  // ── Build the table body ──
  function render(data, { animate } = { animate: true }) {
    const { players, activeDays } = data;
    const tbody = document.getElementById("leaderboard-body");

    if (!players || players.length === 0) {
      tbody.innerHTML =
        `<tr><td colspan="5" class="lb-empty">No data available yet. Check back soon.</td></tr>`;
      document.getElementById("leaderboard-count").textContent = "0 players";
      return;
    }

    const ranked = rankPlayers(players);
    const rankHistory = buildDailyRankHistory(players, activeDays);
    const totalPlayers = players.length;
    const showBadges = activeDays >= cfgStreakMinDays();

    document.getElementById("leaderboard-count").textContent =
      `${totalPlayers} players · Day ${activeDays} of 35`;

    const frag = document.createDocumentFragment();

    ranked.forEach((player, index) => {
      const badge = showBadges ? getBadge(player, rankHistory, activeDays, totalPlayers) : null;
      const change = getRankChange(player, rankHistory);
      const changeHtml = change > 0
        ? `<span class="rank-change rank-change--up">▲${change}</span>`
        : change < 0
        ? `<span class="rank-change rank-change--down">▼${Math.abs(change)}</span>`
        : `<span class="rank-change rank-change--same">–</span>`;

      const rankDisplay = player.rank <= 3
        ? `<span class="rank-medal rank-medal--${player.rank}">${["🥇","🥈","🥉"][player.rank - 1]}</span>`
        : `<span class="rank-number">${player.rank}</span>`;

      const tr = document.createElement("tr");
      tr.className = `lb-row ${player.rank <= 3 ? "lb-row--top3" : ""} ${index === 0 ? "lb-row--leader" : ""}`;
      tr.dataset.player = player.name;
      tr.dataset.total = String(player.total);
      if (animate && !reducedMotion()) {
        tr.style.animationDelay = `${index * 30}ms`;
      } else {
        tr.style.animation = "none";
      }
      tr.innerHTML = `
        <td class="lb-cell lb-cell--rank">${rankDisplay}</td>
        <td class="lb-cell lb-cell--name">
          <span class="player-name">${escapeName(player.name)}</span>
          ${badge ? `<span class="badge ${badge.cls}" title="${badge.label}">${badge.emoji} ${badge.label}</span>` : ""}
        </td>
        <td class="lb-cell lb-cell--points">
          <span class="points-value">${player.total}</span>
          <span class="points-label">pts</span>
        </td>
        <td class="lb-cell lb-cell--change">${changeHtml}</td>
        <td class="lb-cell lb-cell--bar">
          <div class="score-bar">
            <div class="score-bar__fill" style="width: ${getBarWidth(player.total, ranked)}%"></div>
          </div>
        </td>
      `;
      frag.appendChild(tr);
    });

    tbody.replaceChildren(frag);
    updateHeroStats(ranked, activeDays);
  }

  // ── Live update: FLIP rows to their new positions ──
  function update(data) {
    const tbody = document.getElementById("leaderboard-body");
    if (!tbody) return;

    const prev = new Map();
    tbody.querySelectorAll("tr[data-player]").forEach(tr => {
      prev.set(tr.dataset.player, {
        top: tr.getBoundingClientRect().top,
        total: tr.dataset.total
      });
    });
    const firstRender = prev.size === 0;

    render(data, { animate: firstRender });
    showTable();
    showSource(data.source);

    if (firstRender || reducedMotion()) return;

    tbody.querySelectorAll("tr[data-player]").forEach(tr => {
      const old = prev.get(tr.dataset.player);
      if (!old) {
        tr.classList.add("lb-row--flash"); // brand-new entrant
        return;
      }
      const delta = old.top - tr.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) flipRow(tr, delta);
      if (old.total !== tr.dataset.total) bumpPoints(tr);
    });
  }

  function flipRow(tr, delta) {
    tr.style.transition = "none";
    tr.style.transform = `translateY(${delta}px)`;
    requestAnimationFrame(() => {
      tr.style.transition = `transform 0.6s ${EASE_OUT}`;
      tr.style.transform = "";
      tr.addEventListener("transitionend", () => { tr.style.transition = ""; }, { once: true });
    });
    tr.classList.remove("lb-row--flash");
    void tr.offsetWidth;
    tr.classList.add("lb-row--flash");
  }

  function bumpPoints(tr) {
    const el = tr.querySelector(".points-value");
    if (!el) return;
    el.classList.remove("is-bumped");
    void el.offsetWidth;
    el.classList.add("is-bumped");
  }

  function getBarWidth(total, ranked) {
    const max = ranked[0]?.total || 1;
    return Math.max(4, Math.round((total / max) * 100));
  }

  function updateHeroStats(ranked, activeDays) {
    const leaderEl = document.getElementById("stat-leader");
    const scoreEl = document.getElementById("stat-score");
    const dayEl = document.getElementById("stat-day");

    if (leaderEl && ranked[0]) leaderEl.textContent = ranked[0].name;
    if (scoreEl && ranked[0]) scoreEl.textContent = `${ranked[0].total} pts`;
    if (dayEl) dayEl.textContent = `Day ${activeDays}`;
  }

  function showTable() {
    const loadingEl = document.getElementById("leaderboard-loading");
    const tableEl = document.getElementById("leaderboard-table");
    if (loadingEl) loadingEl.style.display = "none";
    if (tableEl && tableEl.style.opacity !== "1") {
      tableEl.style.transition = "opacity 0.4s ease";
      tableEl.style.opacity = "1";
    }
  }

  function showSource(source) {
    const sourceEl = document.getElementById("data-source");
    if (!sourceEl) return;
    const labels = {
      sheets: "Live · Google Sheets",
      fallback: "Using cached data",
      local_override: "Admin override active",
      empty: "No data"
    };
    sourceEl.textContent = labels[source] || source;
    sourceEl.className = `data-source data-source--${source}`;
  }

  function escapeName(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return { update };
})();
