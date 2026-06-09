// ─────────────────────────────────────────────
//  leaderboard.js — Ranking, streaks, potentials
// ─────────────────────────────────────────────

const Leaderboard = (() => {

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
  // Returns array of ranks per day (length = activeDays)
  function buildDailyRankHistory(players, activeDays) {
    const history = {};
    players.forEach(p => { history[p.name] = []; });

    for (let day = 0; day < activeDays; day++) {
      // Running total up to this day
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
    if (activeDays < CONFIG.STREAK_MIN_DAYS) return null;

    const history = rankHistory[player.name] || [];
    if (history.length < 3) return null;

    const last3 = history.slice(-3);
    const median = Math.ceil(totalPlayers / 2);

    // 🔥 On Fire: last 3 days all in top half
    if (last3.every(r => r <= median)) {
      return { emoji: "🔥", label: "On Fire", cls: "badge--fire" };
    }

    // 📈 Rising: rank improved each of last 3 days (lower number = better)
    if (last3[0] > last3[1] && last3[1] > last3[2]) {
      return { emoji: "📈", label: "Rising", cls: "badge--rising" };
    }

    // 👑 Contender: top 3 and consistent (low variance)
    if (player.rank <= 3) {
      const recentScores = player.scores.slice(-5);
      const mean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const variance = recentScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentScores.length;
      if (variance < 15) {
        return { emoji: "👑", label: "Contender", cls: "badge--contender" };
      }
    }

    // 📉 Slipping: rank dropped each of last 3 days
    if (last3[0] < last3[1] && last3[1] < last3[2]) {
      return { emoji: "📉", label: "Slipping", cls: "badge--slipping" };
    }

    return null;
  }

  // ── Compute rank change vs yesterday ──
  function getRankChange(player, rankHistory) {
    const history = rankHistory[player.name] || [];
    if (history.length < 2) return 0;
    const yesterday = history[history.length - 2];
    const today = history[history.length - 1];
    return yesterday - today; // positive = climbed, negative = dropped
  }

  // ── Render the full leaderboard table ──
  function render(data) {
    const { players, activeDays } = data;

    if (!players || players.length === 0) {
      document.getElementById("leaderboard-body").innerHTML =
        `<tr><td colspan="5" class="lb-empty">No data available yet. Check back soon.</td></tr>`;
      document.getElementById("leaderboard-count").textContent = "0 players";
      return;
    }

    const ranked = rankPlayers(players);
    const rankHistory = buildDailyRankHistory(players, activeDays);
    const totalPlayers = players.length;
    const showBadges = activeDays >= CONFIG.STREAK_MIN_DAYS;

    document.getElementById("leaderboard-count").textContent =
      `${totalPlayers} players · Day ${activeDays} of 35`;

    const tbody = document.getElementById("leaderboard-body");
    tbody.innerHTML = "";

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
      tr.style.animationDelay = `${index * 30}ms`;
      tr.innerHTML = `
        <td class="lb-cell lb-cell--rank">${rankDisplay}</td>
        <td class="lb-cell lb-cell--name">
          <span class="player-name">${escapeHtml(player.name)}</span>
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
      tbody.appendChild(tr);
    });

    // Update hero stats
    updateHeroStats(ranked, activeDays);
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

  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // ── Public init ──
  async function init() {
    const loadingEl = document.getElementById("leaderboard-loading");
    const tableEl = document.getElementById("leaderboard-table");

    if (loadingEl) loadingEl.style.display = "flex";
    if (tableEl) tableEl.style.opacity = "0";

    try {
      const data = await SheetsAPI.load();
      render(data);

      // Show data source indicator
      const sourceEl = document.getElementById("data-source");
      if (sourceEl) {
        const labels = {
          sheets: "Live from Google Sheets",
          fallback: "Using cached data",
          local_override: "Admin override active",
          empty: "No data"
        };
        sourceEl.textContent = labels[data.source] || data.source;
        sourceEl.className = `data-source data-source--${data.source}`;
      }
    } catch (err) {
      console.error("[Leaderboard] Init failed:", err);
    } finally {
      if (loadingEl) loadingEl.style.display = "none";
      if (tableEl) {
        tableEl.style.opacity = "1";
        tableEl.style.transition = "opacity 0.4s ease";
      }
    }
  }

  return { init };
})();
