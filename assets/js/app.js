// ─────────────────────────────────────────────
//  app.js — Footbalism WC 2026 application shell
//  Boot, nav, hero slideshow, countdown, fixtures UI,
//  group standings, and the LiveData refresh engine.
//  Load order: matches.js → fixtures.js → sheets.js →
//              leaderboard.js → parallax.js → app.js
// ─────────────────────────────────────────────

// Read a CONFIG key with a default, so older/CI-injected config.js
// files keep working without every key present.
function cfg(key, dflt) {
  return (typeof CONFIG !== "undefined" && CONFIG[key] !== undefined && CONFIG[key] !== null)
    ? CONFIG[key]
    : dflt;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Shared fixtures state ──
let CURRENT_MATCHES = MATCHES_DATA;
let activeFixtureFilter = "filter-all";
let fixtureSortOrder = "asc"; // "asc" or "desc"
let uniqueMatchDates = [];
let selectedDate = ""; // e.g. "Jun 12"

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_FULL = { "Jun": "June", "Jul": "July" };

// ── Boot ──
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  ParallaxController.init();
  HeroSlideshow.init();
  Countdown.init();
  initFixtureControls();

  boot();
});

async function boot() {
  await loadFixturesData();
  initDateNavigation();
  renderFixtures();
  loadGroupStandings();
  LiveData.start();
}

// ── Navigation ──
function initNav() {
  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("nav-toggle");
  const navLinks = document.getElementById("nav-links");
  if (!nav || !navToggle || !navLinks) return;

  window.addEventListener("scroll", () => {
    nav.classList.toggle("nav--scrolled", window.scrollY > 40);
  }, { passive: true });

  function toggleMenu(forceClose = false) {
    const isOpen = forceClose ? false : nav.classList.toggle("nav--open");
    if (forceClose) nav.classList.remove("nav--open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    if (window.innerWidth <= 768) {
      document.body.style.overflow = isOpen ? "hidden" : "";
    }
  }

  navToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => toggleMenu(true));
  });

  document.addEventListener("click", (e) => {
    if (nav.classList.contains("nav--open") && !nav.contains(e.target)) toggleMenu(true);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("nav--open")) toggleMenu(true);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && nav.classList.contains("nav--open")) toggleMenu(true);
  });
}

// ── Hero slideshow (lazy: only the visible + next slide get an image) ──
const HeroSlideshow = (() => {
  const INTERVAL = 5000;
  let slides = [];
  let current = 0;

  function ensureBg(slide) {
    if (slide && !slide.style.backgroundImage && slide.dataset.bg) {
      slide.style.backgroundImage = `url('${slide.dataset.bg}')`;
    }
  }

  function init() {
    slides = Array.from(document.querySelectorAll(".hero__slide"));
    if (slides.length < 2) return;
    ensureBg(slides[0]);
    ensureBg(slides[1]);
    setInterval(next, INTERVAL);
  }

  function next() {
    if (document.hidden) return; // don't churn images in background tabs
    slides[current].classList.remove("hero__slide--active");
    current = (current + 1) % slides.length;
    ensureBg(slides[current]);
    slides[current].classList.add("hero__slide--active");
    ensureBg(slides[(current + 1) % slides.length]); // pre-decode the upcoming one
  }

  return { init };
})();

// ── Countdown to next matchday (odometer) ──
const Countdown = (() => {
  const MATCH_DATES = [
    "2026-06-12","2026-06-13","2026-06-14","2026-06-15",
    "2026-06-16","2026-06-17","2026-06-18","2026-06-19",
    "2026-06-20","2026-06-21","2026-06-22","2026-06-23",
    "2026-06-24","2026-06-25","2026-06-26","2026-06-27",
    "2026-06-28","2026-06-29","2026-06-30","2026-07-01",
    "2026-07-02","2026-07-03","2026-07-04","2026-07-05",
    "2026-07-06","2026-07-07","2026-07-08","2026-07-10",
    "2026-07-11","2026-07-12","2026-07-15","2026-07-16",
    "2026-07-19","2026-07-20"
  ];
  const DAY_MS = 24 * 60 * 60 * 1000;

  let el = null;
  let odometerHtml = "";
  let mode = "countdown"; // countdown | live | done

  function dates() {
    return MATCH_DATES.map(d => new Date(`${d}T00:00:00`));
  }

  function setOdoDigit(elementId, value) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const strVal = String(value).padStart(2, "0");
    const digits = container.querySelectorAll(".odometer-digit");
    if (digits.length !== 2) return;
    [0, 1].forEach(i => {
      if (digits[i].textContent !== strVal[i]) {
        digits[i].textContent = strVal[i];
        digits[i].classList.remove("odometer-digit--roll");
        void digits[i].offsetWidth; // restart the roll animation
        digits[i].classList.add("odometer-digit--roll");
      }
    });
  }

  function setMode(next, html) {
    if (mode === next) return;
    mode = next;
    el.innerHTML = html;
  }

  function tick() {
    const now = new Date();
    const all = dates();
    const next = all.find(d => d > now);
    const liveDay = all.some(d => now >= d && now - d < DAY_MS);

    if (liveDay) {
      setMode("live", `<div class="odometer-live">Matchday is live!</div>`);
      setTimeout(tick, 60 * 1000); // re-arm for when the matchday ends
      return;
    }
    if (!next) {
      setMode("done", `<div class="odometer-completed">Contest complete</div>`);
      return;
    }

    setMode("countdown", odometerHtml);
    const diff = next - now;
    setOdoDigit("odo-days",    Math.floor(diff / DAY_MS));
    setOdoDigit("odo-hours",   Math.floor((diff % DAY_MS) / 3600000));
    setOdoDigit("odo-minutes", Math.floor((diff % 3600000) / 60000));
    setOdoDigit("odo-seconds", Math.floor((diff % 60000) / 1000));
    setTimeout(tick, 1000);
  }

  function init() {
    el = document.getElementById("countdown");
    if (!el) return;
    odometerHtml = el.innerHTML;
    mode = "countdown";
    tick();
  }

  return { init };
})();

// ── Fixture filter / search / sort controls ──
function initFixtureControls() {
  const searchInput = document.getElementById("fixtures-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => renderFixtures());
  }

  const pills = document.querySelectorAll(".filter-pill");
  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("filter-pill--active"));
      pill.classList.add("filter-pill--active");
      activeFixtureFilter = pill.id;
      renderFixtures();
    });
  });

  const sortBtn = document.getElementById("filter-sort-btn");
  if (sortBtn) {
    sortBtn.addEventListener("click", () => {
      fixtureSortOrder = fixtureSortOrder === "asc" ? "desc" : "asc";
      sortBtn.classList.toggle("icon-circle-btn--active", fixtureSortOrder === "desc");
      renderFixtures();
    });
  }
}

// ── Date helpers ──
function getFullDayHeader(istDateStr) {
  if (!istDateStr) return "";
  const monthMap = { "Jun": 5, "Jul": 6 };
  const parts = istDateStr.split(" ");
  const d = new Date(2026, monthMap[parts[0]], parseInt(parts[1]));
  return `${DAYS_OF_WEEK[d.getDay()]}, ${MONTHS_FULL[parts[0]]} ${parseInt(parts[1])}, 2026`;
}

function getShortDayName(istDateStr) {
  if (!istDateStr) return "";
  const monthMap = { "Jun": 5, "Jul": 6 };
  const parts = istDateStr.split(" ");
  const d = new Date(2026, monthMap[parts[0]], parseInt(parts[1]));
  return DAYS_SHORT[d.getDay()];
}

// ── Date navigation ──
function initDateNavigation() {
  const datesSet = new Set();
  CURRENT_MATCHES.forEach(m => {
    if (m.istDate) datesSet.add(m.istDate);
  });
  uniqueMatchDates = Array.from(datesSet);
  // Keep the user's selection across live refreshes when possible
  if (!selectedDate || !uniqueMatchDates.includes(selectedDate)) {
    selectedDate = uniqueMatchDates[0] || "";
  }
  renderDateNavigation();
}

function renderDateNavigation() {
  const track = document.getElementById("date-nav-track");
  if (!track) return;

  track.innerHTML = "";
  uniqueMatchDates.forEach(dateStr => {
    const btn = document.createElement("button");
    btn.className = "date-nav-item";
    if (dateStr === selectedDate) btn.classList.add("date-nav-item--active");
    btn.innerHTML = `
      <span class="date-nav-item__day">${getShortDayName(dateStr)}</span>
      <span class="date-nav-item__num">${dateStr.split(" ")[1]}</span>
    `;
    btn.addEventListener("click", () => {
      selectedDate = dateStr;
      updateSelectedDateView();
    });
    track.appendChild(btn);
  });

  const prevBtn = document.getElementById("date-nav-prev");
  const nextBtn = document.getElementById("date-nav-next");
  if (prevBtn) {
    prevBtn.onclick = () => {
      const idx = uniqueMatchDates.indexOf(selectedDate);
      if (idx > 0) {
        selectedDate = uniqueMatchDates[idx - 1];
        updateSelectedDateView();
      }
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      const idx = uniqueMatchDates.indexOf(selectedDate);
      if (idx < uniqueMatchDates.length - 1) {
        selectedDate = uniqueMatchDates[idx + 1];
        updateSelectedDateView();
      }
    };
  }

  scrollToActiveDate();
}

function updateSelectedDateView() {
  const items = document.querySelectorAll(".date-nav-item");
  uniqueMatchDates.forEach((dateStr, idx) => {
    if (items[idx]) items[idx].classList.toggle("date-nav-item--active", dateStr === selectedDate);
  });
  scrollToActiveDate();
  renderFixtures();
}

function scrollToActiveDate() {
  const activeEl = document.querySelector(".date-nav-item--active");
  const track = document.getElementById("date-nav-track");
  if (activeEl && track) {
    track.scrollTo({
      left: activeEl.offsetLeft - (track.clientWidth / 2) + (activeEl.clientWidth / 2),
      behavior: "smooth"
    });
  }
}

// ── Fixtures list ──
function renderFixtures() {
  const listEl = document.getElementById("fixtures-list");
  if (!listEl) return;

  if (!selectedDate && uniqueMatchDates.length > 0) {
    selectedDate = uniqueMatchDates[0];
  }

  let matches = CURRENT_MATCHES.filter(m => m.istDate === selectedDate);

  const searchQuery = document.getElementById("fixtures-search")?.value.toLowerCase().trim() || "";
  if (searchQuery) {
    matches = CURRENT_MATCHES.filter(m =>
      m.team1.toLowerCase().includes(searchQuery) ||
      m.team2.toLowerCase().includes(searchQuery) ||
      m.stadium.toLowerCase().includes(searchQuery) ||
      m.group.toLowerCase().includes(searchQuery)
    );
  }

  if (activeFixtureFilter === "filter-ongoing") {
    matches = matches.filter(m => m.status === "IN_PLAY" || m.status === "PAUSED");
  } else if (activeFixtureFilter === "filter-tv") {
    matches = matches.filter(m => m.istTime.includes("06:30 AM") || m.istTime.includes("09:30 PM"));
  }

  matches.sort((a, b) => {
    const indexA = CURRENT_MATCHES.indexOf(a);
    const indexB = CURRENT_MATCHES.indexOf(b);
    return fixtureSortOrder === "asc" ? indexA - indexB : indexB - indexA;
  });

  if (matches.length === 0) {
    let msg = "No matches scheduled.";
    if (activeFixtureFilter === "filter-ongoing") {
      msg = "No matches are currently live. Check back during kickoff!";
    } else if (activeFixtureFilter === "filter-tv") {
      msg = "No matches match this filter.";
    }
    listEl.innerHTML = `<div class="fixtures-empty">${msg}</div>`;
    return;
  }

  // Build into a fragment, swap in one go (no flicker on live refresh)
  const frag = document.createDocumentFragment();

  if (searchQuery) {
    const dates = {};
    matches.forEach(m => {
      (dates[m.istDate] = dates[m.istDate] || []).push(m);
    });
    Object.entries(dates).forEach(([dateName, dateMatches]) => {
      frag.appendChild(buildListHeader("fixtures-date-header", getFullDayHeader(dateName)));
      dateMatches.forEach(m => frag.appendChild(buildMatchRow(m)));
    });
  } else if (activeFixtureFilter === "filter-time") {
    const groups = {};
    matches.forEach(m => {
      (groups[m.group] = groups[m.group] || []).push(m);
    });
    Object.entries(groups).forEach(([groupName, groupMatches]) => {
      frag.appendChild(buildListHeader("fixtures-group-header", groupName));
      groupMatches.forEach(m => frag.appendChild(buildMatchRow(m)));
    });
  } else {
    frag.appendChild(buildListHeader("fixtures-date-header", getFullDayHeader(selectedDate)));
    matches.forEach(m => frag.appendChild(buildMatchRow(m)));
  }

  listEl.replaceChildren(frag);
}

function buildListHeader(className, text) {
  const header = document.createElement("div");
  header.className = className;
  header.textContent = text;
  return header;
}

function buildMatchRow(m) {
  let centerHtml = "";
  let timeBoxClass = "fixture-row__time-box";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const isFinished = m.status === "FINISHED";
  const hasScore = m.score1 !== null && m.score1 !== undefined && m.score1 !== "";

  if (isLive) {
    timeBoxClass += " fixture-row__time-box--live";
    centerHtml = `
      <span class="fixture-row__score">${m.score1} - ${m.score2}</span>
      <span class="live-dot"></span>
    `;
  } else if (isFinished || hasScore) {
    centerHtml = `<span class="fixture-row__score">${m.score1} - ${m.score2}</span>`;
  } else {
    centerHtml = `<span class="fixture-row__time">${m.istTime}</span>`;
  }

  const row = document.createElement("div");
  row.className = "fixture-row";
  row.innerHTML = `
    <div class="fixture-row__main">
      <div class="fixture-row__team fixture-row__team--home">
        <span class="fixture-row__team-name">${escapeHtml(m.team1)}</span>
        <span class="fixture-row__team-flag">${m.flag1}</span>
      </div>
      <div class="fixture-row__center">
        <div class="${timeBoxClass}">
          ${centerHtml}
        </div>
      </div>
      <div class="fixture-row__team fixture-row__team--away">
        <span class="fixture-row__team-flag">${m.flag2}</span>
        <span class="fixture-row__team-name">${escapeHtml(m.team2)}</span>
      </div>
    </div>
    <div class="fixture-row__meta">
      <span class="fixture-row__group">${escapeHtml(m.group)}</span>
      <span class="fixture-row__separator">·</span>
      <span class="fixture-row__stadium" title="${escapeHtml(m.stadium)}">${escapeHtml(m.stadium)}</span>
    </div>
  `;
  return row;
}

// ── Stats bar (mirrors hero stats) ──
function syncStatsBar() {
  const barLeader = document.getElementById("stat-bar-leader");
  const barDay = document.getElementById("stat-bar-day");
  const barPlayers = document.getElementById("stat-bar-players");

  const leaderEl = document.getElementById("stat-leader");
  const dayEl = document.getElementById("stat-day");

  if (barLeader && leaderEl) barLeader.textContent = leaderEl.textContent;
  if (barDay && dayEl) barDay.textContent = dayEl.textContent;
  if (barPlayers) {
    const count = document.getElementById("leaderboard-count")?.textContent || "";
    const match = count.match(/^(\d+)/);
    if (match) barPlayers.textContent = match[1];
  }
}

// ── Fixtures data (football-data.org → local matches DB) ──
// Returns true when the dataset changed.
let fixturesFingerprint = "";

async function loadFixturesData(opts = {}) {
  try {
    if (typeof FixturesAPI === "undefined") return false;
    const apiData = await FixturesAPI.loadMatches(opts);
    const list = [];
    Object.values(apiData.byDate).forEach(dayMatches => {
      dayMatches.forEach(m => {
        list.push({
          group: m.group || m.stageLabel,
          date: m.istDate,
          istDate: m.istDate,
          istTime: m.istTime,
          team1: m.home.short || m.home.name,
          team2: m.away.short || m.away.name,
          flag1: m.home.flag,
          flag2: m.away.flag,
          stadium: m.stadium || "TBD Stadium",
          status: m.status,
          score1: m.home.score,
          score2: m.away.score,
          utcDate: m.utcDate
        });
      });
    });
    if (list.length > 0) {
      const print = JSON.stringify(list);
      if (print === fixturesFingerprint) return false;
      fixturesFingerprint = print;
      CURRENT_MATCHES = list;
      console.log("[Fixtures] Loaded live fixtures from API:", list.length);
      return true;
    }
  } catch (err) {
    console.warn("[Fixtures] Live fixtures unavailable, using local matches database.", err.message || err);
  }
  return false;
}

// ── Group standings (football-data.org → calculated from matches DB) ──
async function loadGroupStandings(opts = {}) {
  const grid = document.getElementById("groups-grid");
  const sourceEl = document.getElementById("standings-source");
  if (!grid) return;

  if (!grid.children.length) grid.innerHTML = `<div class="spinner"></div>`;

  let standings = [];
  let source = "";

  try {
    if (typeof FixturesAPI === "undefined") throw new Error("FixturesAPI missing");
    standings = await FixturesAPI.loadStandings(opts);
    source = "football-data.org";
  } catch (err) {
    console.warn("[Groups] Live standings unavailable, calculating from matches database.", err.message || err);
    standings = getCalculatedStandings();
    source = "Matches Database";
  }

  if (sourceEl) {
    sourceEl.textContent = `Standings: ${source}`;
    sourceEl.className = `data-source data-source--${source === "football-data.org" ? "sheets" : "fallback"}`;
  }

  const frag = document.createDocumentFragment();
  standings.sort((a, b) => a.name.localeCompare(b.name));

  standings.forEach(g => {
    const card = document.createElement("div");
    card.className = "group-card";
    const displayName = g.name.replace("GROUP_", "Group ");

    let rowsHtml = "";
    g.table.forEach(row => {
      rowsHtml += `
        <tr class="gt-row">
          <td class="gt-cell--pos">${row.position}</td>
          <td class="gt-cell--team">
            <div class="gt-team-wrapper">
              <span class="gt-team-flag">${row.team.flag}</span>
              <span class="gt-team-name" title="${escapeHtml(row.team.name)}">${escapeHtml(row.team.short || row.team.name)}</span>
            </div>
          </td>
          <td class="gt-cell--stat gt-cell--pl">${row.played}</td>
          <td class="gt-cell--stat gt-cell--w">${row.won}</td>
          <td class="gt-cell--stat gt-cell--d">${row.drawn}</td>
          <td class="gt-cell--stat gt-cell--l">${row.lost}</td>
          <td class="gt-cell--stat gt-cell--plusminus">${row.gf}:${row.ga}</td>
          <td class="gt-cell--stat gt-cell--gd">${row.gd > 0 ? "+" + row.gd : row.gd}</td>
          <td class="gt-cell--stat gt-cell--pts">${row.points}</td>
          <td class="gt-cell--form">
            ${renderFormBubbles(row.form)}
          </td>
        </tr>
      `;
    });

    card.innerHTML = `
      <div class="group-card__header">
        <h3 class="group-card__title">${escapeHtml(displayName)}</h3>
      </div>
      <table class="group-table">
        <thead>
          <tr>
            <th class="gt-col--pos">#</th>
            <th class="gt-col--team">Team</th>
            <th class="gt-col--stat gt-col--pl">PL</th>
            <th class="gt-col--stat gt-col--w">W</th>
            <th class="gt-col--stat gt-col--d">D</th>
            <th class="gt-col--stat gt-col--l">L</th>
            <th class="gt-col--stat gt-col--plusminus">+/-</th>
            <th class="gt-col--stat gt-col--gd">GD</th>
            <th class="gt-col--stat gt-col--pts">PTS</th>
            <th class="gt-col--form">Form</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
    frag.appendChild(card);
  });

  grid.replaceChildren(frag);
}

function renderFormBubbles(form) {
  if (!form) return `<div class="form-bubbles">–</div>`;
  const items = Array.isArray(form) ? form : form.split(",");
  const cleaned = items.map(x => x.trim()).filter(x => x !== "");
  if (cleaned.length === 0) return `<div class="form-bubbles">–</div>`;

  let html = '<div class="form-bubbles">';
  cleaned.slice(-5).forEach(res => {
    let cls = "form-bubble";
    const label = res.toUpperCase();
    if (label === "W") cls += " form-bubble--win";
    else if (label === "L") cls += " form-bubble--loss";
    else if (label === "D") cls += " form-bubble--draw";
    html += `<span class="${cls}">${label}</span>`;
  });
  html += "</div>";
  return html;
}

function getCalculatedStandings() {
  const groups = {};

  MATCHES_DATA.forEach(m => {
    if (!m.group || !m.group.startsWith("Group")) return;
    if (!groups[m.group]) groups[m.group] = {};
    [["team1", "flag1"], ["team2", "flag2"]].forEach(([t, f]) => {
      if (!groups[m.group][m[t]]) {
        groups[m.group][m[t]] = {
          name: m[t], flag: m[f], played: 0,
          won: 0, drawn: 0, lost: 0,
          gf: 0, ga: 0, gd: 0, points: 0, form: []
        };
      }
    });
  });

  MATCHES_DATA.forEach(m => {
    if (!m.group || !m.group.startsWith("Group")) return;
    const t1 = groups[m.group][m.team1];
    const t2 = groups[m.group][m.team2];

    const hasScore = m.score1 !== null && m.score1 !== undefined && m.score1 !== "" &&
                     m.score2 !== null && m.score2 !== undefined && m.score2 !== "";

    if (hasScore && (m.status === "FINISHED" || m.status === "IN_PLAY")) {
      const s1 = parseInt(m.score1);
      const s2 = parseInt(m.score2);

      t1.played++; t2.played++;
      t1.gf += s1; t1.ga += s2;
      t2.gf += s2; t2.ga += s1;

      if (s1 > s2) {
        t1.won++; t1.points += 3; t1.form.push("W");
        t2.lost++; t2.form.push("L");
      } else if (s2 > s1) {
        t2.won++; t2.points += 3; t2.form.push("W");
        t1.lost++; t1.form.push("L");
      } else {
        t1.drawn++; t1.points += 1; t1.form.push("D");
        t2.drawn++; t2.points += 1; t2.form.push("D");
      }
    }
  });

  return Object.entries(groups).map(([name, teamMap]) => {
    const table = Object.values(teamMap).map(t => {
      t.gd = t.gf - t.ga;
      return {
        position: 1,
        team: { name: t.name, flag: t.flag },
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        gf: t.gf,
        ga: t.ga,
        gd: t.gd,
        points: t.points,
        form: t.form.slice(-5).join(",")
      };
    }).sort((a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name)
    );
    table.forEach((t, i) => { t.position = i + 1; });
    return { name, table };
  });
}

// ── LiveData — keeps everything fresh without reloads ──
//  • Leaderboard: polls Google Sheets (60s default)
//  • Fixtures + group standings: polls football-data.org
//    (2min during live matches, 10min otherwise)
//  • Pauses when the tab is hidden; refreshes instantly on return
const LiveData = (() => {
  const LB_MS      = cfg("LEADERBOARD_REFRESH_MS", 60 * 1000);
  const FX_IDLE_MS = cfg("FIXTURES_REFRESH_MS", 10 * 60 * 1000);
  const FX_LIVE_MS = cfg("FIXTURES_LIVE_REFRESH_MS", 2 * 60 * 1000);

  let lbTimer = null;
  let fxTimer = null;
  let lbFingerprint = "";
  let lastUpdatedAt = null;
  let started = false;

  async function refreshLeaderboard() {
    const data = await SheetsAPI.load();
    const print = JSON.stringify([data.source, data.activeDays, data.players]);
    if (print !== lbFingerprint) {
      lbFingerprint = print;
      Leaderboard.update(data);
      syncStatsBar();
    }
    lastUpdatedAt = Date.now();
    renderUpdatedAgo();
  }

  async function refreshFixtures() {
    const changed = await loadFixturesData({ force: true });
    if (changed) {
      initDateNavigation();
      renderFixtures();
    }
    await loadGroupStandings({ force: true });
  }

  function hasLiveMatch() {
    return CURRENT_MATCHES.some(m => m.status === "IN_PLAY" || m.status === "PAUSED");
  }

  function scheduleLeaderboard() {
    clearTimeout(lbTimer);
    lbTimer = setTimeout(async () => {
      if (document.hidden) return;
      try { await refreshLeaderboard(); }
      catch (err) { console.warn("[Live] Leaderboard refresh failed:", err.message || err); }
      scheduleLeaderboard();
    }, LB_MS);
  }

  function scheduleFixtures() {
    clearTimeout(fxTimer);
    fxTimer = setTimeout(async () => {
      if (document.hidden) return;
      try { await refreshFixtures(); }
      catch (err) { console.warn("[Live] Fixtures refresh failed:", err.message || err); }
      scheduleFixtures();
    }, hasLiveMatch() ? FX_LIVE_MS : FX_IDLE_MS);
  }

  function renderUpdatedAgo() {
    const el = document.getElementById("lb-updated");
    if (!el || !lastUpdatedAt) return;
    const sec = Math.round((Date.now() - lastUpdatedAt) / 1000);
    el.textContent = sec < 20 ? "Updated just now"
      : sec < 90 ? `Updated ${sec}s ago`
      : `Updated ${Math.round(sec / 60)}m ago`;
  }

  async function start() {
    if (started) return;
    started = true;

    try { await refreshLeaderboard(); }
    catch (err) { console.warn("[Live] Initial leaderboard load failed:", err.message || err); }
    scheduleLeaderboard();
    scheduleFixtures();
    setInterval(renderUpdatedAgo, 15 * 1000);

    // Catch up the moment the tab becomes visible / connection returns
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshNow();
    });
    window.addEventListener("online", refreshNow);
  }

  function refreshNow() {
    refreshLeaderboard().catch(() => {});
    refreshFixtures().catch(() => {});
    scheduleLeaderboard();
    scheduleFixtures();
  }

  return { start, refreshNow };
})();
