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

// Parse a flag emoji and return its lowercase ISO 2-letter (or subdivision) code.
// This resolves issues where flag emojis do not render on some browsers (e.g. Windows).
function emojiToCountryCode(emoji) {
  if (!emoji) return null;
  const codePoints = Array.from(emoji).map(char => char.codePointAt(0));
  
  // Handle subdivision flags (e.g., Scotland, England, Wales)
  if (codePoints[0] === 0x1F3F4) {
    let tagString = "";
    for (let i = 1; i < codePoints.length; i++) {
      const cp = codePoints[i];
      if (cp >= 0xE0030 && cp <= 0xE007E) {
        tagString += String.fromCharCode(cp - 0xE0000);
      }
    }
    if (tagString === "gbsct") return "gb-sct";
    if (tagString === "gbeng") return "gb-eng";
    if (tagString === "gbwls") return "gb-wls";
    if (tagString === "gbnir") return "gb-nir";
  }
  
  // Handle standard regional indicators (0x1F1E6 to 0x1F1FF)
  const isRegionalIndicator = cp => cp >= 0x1F1E6 && cp <= 0x1F1FF;
  if (codePoints.length >= 2 && isRegionalIndicator(codePoints[0]) && isRegionalIndicator(codePoints[1])) {
    const char1 = String.fromCharCode(codePoints[0] - 0x1F1E6 + 65);
    const char2 = String.fromCharCode(codePoints[1] - 0x1F1E6 + 65);
    return (char1 + char2).toLowerCase();
  }
  
  return null;
}

// Convert a flag emoji or text into a beautiful flag image using jsDelivr flag-icons CDN.
// We set alt="" (decorative) so that if the image is loading or fails to load,
// browsers on Windows do not render the ugly country-code letters (like CZ, MX) or black flags (🏴).
function getFlagImgHtml(flagEmoji) {
  if (!flagEmoji) return "";
  const code = emojiToCountryCode(flagEmoji);
  if (code) {
    return `<img src="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3/${code}.svg" alt="" class="flag-img" loading="lazy" />`;
  }
  return escapeHtml(flagEmoji);
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
  initLenis();
  initNav();
  ParallaxController.init();
  HeroSlideshow.init();
  Countdown.init();
  initFixtureControls();

  boot();
});

// ── Lenis smooth scrolling ──
// Exposed as window.__lenis so the anchor handler (parallax.js) can
// route in-page jumps through it. Falls back to native scrolling when
// the CDN is blocked or the user prefers reduced motion.
function initLenis() {
  if (typeof Lenis === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.__lenis = new Lenis({
    autoRaf: true,
    lerp: 0.1,          // buttery but never floaty
    smoothWheel: true,
    syncTouch: false    // keep native momentum on touch devices
  });
}

async function boot() {
  await loadFixturesData();
  initDateNavigation();
  renderFixtures();
  loadGroupStandings();
  loadTopScorers();
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
    const clockHtml = m.displayClock ? `<span class="fixture-row__clock">${m.displayClock}</span>` : "";
    centerHtml = `
      <span class="fixture-row__score">${m.score1} - ${m.score2}</span>
      ${clockHtml}
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
        <span class="fixture-row__team-flag">${getFlagImgHtml(m.flag1)}</span>
      </div>
      <div class="fixture-row__center">
        <div class="${timeBoxClass}">
          ${centerHtml}
        </div>
      </div>
      <div class="fixture-row__team fixture-row__team--away">
        <span class="fixture-row__team-flag">${getFlagImgHtml(m.flag2)}</span>
        <span class="fixture-row__team-name">${escapeHtml(m.team2)}</span>
      </div>
    </div>
    <div class="fixture-row__meta">
      <span class="fixture-row__group">${escapeHtml(m.group)}</span>
      <span class="fixture-row__separator">·</span>
      <span class="fixture-row__stadium" title="${escapeHtml(m.stadium)}">${escapeHtml(m.stadium)}</span>
    </div>
    <div class="fixture-row__details" id="details-${m.id}" style="display: none;">
      <div class="spinner"></div>
    </div>
  `;

  // Attach click listener for accordion toggle
  row.addEventListener("click", (e) => toggleMatchDetails(m.id, row, e));

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
  let list = [];
  try {
    if (typeof FixturesAPI === "undefined") return false;
    const apiData = await FixturesAPI.loadMatches(opts);
    Object.values(apiData.byDate).forEach(dayMatches => {
      dayMatches.forEach(m => {
        list.push({
          id: m.id || null,
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
          utcDate: m.utcDate,
          displayClock: m.displayClock || null
        });
      });
    });
  } catch (err) {
    console.warn("[Fixtures] Live fixtures unavailable, using local matches database.", err.message || err);
    if (typeof MATCHES_DATA !== "undefined") {
      list = JSON.parse(JSON.stringify(MATCHES_DATA));
    }
  }

  // Always merge ESPN live scores into the loaded schedule list
  if (list.length > 0) {
    if (typeof FixturesAPI !== "undefined" && typeof FixturesAPI.mergeESPNLiveScores === "function") {
      await FixturesAPI.mergeESPNLiveScores(list);
    }
    const print = JSON.stringify(list);
    if (print === fixturesFingerprint) return false;
    fixturesFingerprint = print;
    CURRENT_MATCHES = list;
    console.log("[Fixtures] Loaded matches (merged with ESPN live scores if active):", list.length);
    return true;
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
      const next = getNextOpponent(row.team.short || row.team.name);
      rowsHtml += `
        <tr class="gt-row">
          <td class="gt-cell--pos">${row.position}</td>
          <td class="gt-cell--team">
            <div class="gt-team-wrapper">
              <span class="gt-team-flag">${getFlagImgHtml(row.team.flag)}</span>
              <span class="gt-team-name" title="${escapeHtml(row.team.name)}">${escapeHtml(row.team.short || row.team.name)}</span>
            </div>
          </td>
          <td class="gt-cell--stat gt-cell--pl">${row.played}</td>
          <td class="gt-cell--stat gt-cell--w">${row.won}</td>
          <td class="gt-cell--stat gt-cell--d">${row.drawn}</td>
          <td class="gt-cell--stat gt-cell--l">${row.lost}</td>
          <td class="gt-cell--stat gt-cell--plusminus">${row.gf}-${row.ga}</td>
          <td class="gt-cell--stat gt-cell--gd">${row.gd > 0 ? "+" + row.gd : row.gd}</td>
          <td class="gt-cell--stat gt-cell--pts">${row.points}</td>
          <td class="gt-cell--next">
            ${next ? `<span class="gt-next-flag" title="${escapeHtml(next.opponent)} · ${escapeHtml(next.date)}">${getFlagImgHtml(next.flag)}</span>` : `<span class="gt-next-flag gt-next-flag--none">–</span>`}
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
            <th class="gt-col--team"></th>
            <th class="gt-col--stat gt-col--pl">PL</th>
            <th class="gt-col--stat gt-col--w">W</th>
            <th class="gt-col--stat gt-col--d">D</th>
            <th class="gt-col--stat gt-col--l">L</th>
            <th class="gt-col--stat gt-col--plusminus">+/-</th>
            <th class="gt-col--stat gt-col--gd">GD</th>
            <th class="gt-col--stat gt-col--pts">PTS</th>
            <th class="gt-col--next">Next</th>
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

// Next fixture for a team (FotMob's "Next" column) — first non-finished
// match in CURRENT_MATCHES featuring the team; returns the opponent's flag.
function getNextOpponent(teamName) {
  for (const m of CURRENT_MATCHES) {
    if (m.status === "FINISHED") continue;
    if (m.team1 === teamName) return { opponent: m.team2, flag: m.flag2, date: m.istDate };
    if (m.team2 === teamName) return { opponent: m.team1, flag: m.flag1, date: m.istDate };
  }
  return null;
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
    await loadTopScorers();
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

// ── Match Details Accordion & ESPN Summary Integration ──

// Toggle Match Details Accordion
async function toggleMatchDetails(eventId, row, event) {
  // Prevent toggle if clicking on tabs or inside details
  if (event && (event.target.closest('.match-tabs') || event.target.closest('.fixture-row__details') || event.target.tagName === 'A' || event.target.tagName === 'BUTTON')) {
    return;
  }
  
  const details = row.querySelector('.fixture-row__details');
  if (!details) return;

  const isExpanded = details.style.display === "block";
  
  // Collapse all other expanded rows first
  document.querySelectorAll('.fixture-row__details').forEach(el => {
    if (el !== details) {
      el.style.display = "none";
      el.closest('.fixture-row').classList.remove('fixture-row--expanded');
    }
  });

  if (isExpanded) {
    details.style.display = "none";
    row.classList.remove('fixture-row--expanded');
  } else {
    details.style.display = "block";
    row.classList.add('fixture-row--expanded');
    
    // Only fetch if we haven't loaded it yet or it's currently live
    const isLive = row.querySelector('.fixture-row__time-box--live') !== null;
    const hasLoaded = details.dataset.loaded === "true";
    
    if (!hasLoaded || isLive) {
      await fetchAndRenderSummary(eventId, details);
    }
  }
}

// Fetch and Render ESPN Match Summary Details
async function fetchAndRenderSummary(eventId, container) {
  container.innerHTML = `<div class="spinner"></div>`;
  
  if (!eventId) {
    container.innerHTML = `<div style="text-align: center; color: var(--c-muted); padding: var(--sp-md);">No live details available for this match.</div>`;
    return;
  }

  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    
    container.dataset.loaded = "true";
    renderSummaryTabs(data, container);
  } catch (err) {
    console.warn(`[Fixtures] Failed to fetch match summary for event ${eventId}:`, err.message || err);
    container.innerHTML = `<div style="text-align: center; color: var(--c-muted); padding: var(--sp-md);">Details temporarily unavailable. Check back later!</div>`;
  }
}

// Render the summary layout inside the details panel
function renderSummaryTabs(data, container) {
  container.innerHTML = `
    <div class="match-tabs">
      <button class="match-tab match-tab--active" data-tab="stats">Stats</button>
      <button class="match-tab" data-tab="timeline">Timeline</button>
      <button class="match-tab" data-tab="lineups">Lineups</button>
    </div>
    <div class="match-tab-content">
      <!-- Active tab content goes here -->
    </div>
  `;

  const contentDiv = container.querySelector('.match-tab-content');
  const tabButtons = container.querySelectorAll('.match-tab');

  // Helper to switch active tab
  function showTab(tabName) {
    tabButtons.forEach(btn => btn.classList.toggle('match-tab--active', btn.dataset.tab === tabName));
    
    if (tabName === 'stats') {
      renderStatsTab(data, contentDiv);
    } else if (tabName === 'timeline') {
      renderTimelineTab(data, contentDiv);
    } else if (tabName === 'lineups') {
      renderLineupsTab(data, contentDiv);
    }
  }

  // Setup click listeners
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTab(btn.dataset.tab);
    });
  });

  // Default to Stats tab
  showTab('stats');
}

// Render Stats tab
function renderStatsTab(data, target) {
  const teams = data.boxscore?.teams || [];
  const homeTeam = teams.find(t => t.homeAway === "home") || teams[0];
  const awayTeam = teams.find(t => t.homeAway === "away") || teams[1];
  
  if (!homeTeam || !awayTeam || !homeTeam.statistics) {
    target.innerHTML = `<div style="text-align: center; color: var(--c-muted); padding: var(--sp-md);">No statistics recorded for this match.</div>`;
    return;
  }

  // Common stats we want to compare
  const statsToCompare = [
    { key: "possession", label: "Possession %", isPercent: true },
    { key: "shots", label: "Total Shots" },
    { key: "shotsOnTarget", label: "Shots on Target" },
    { key: "cornerKicks", label: "Corner Kicks" },
    { key: "foulsCommitted", label: "Fouls" }
  ];

  let html = `<div class="match-stats">`;
  
  statsToCompare.forEach(stat => {
    const homeStatObj = homeTeam.statistics.find(s => s.name === stat.key || s.label?.toLowerCase() === stat.label.toLowerCase());
    const awayStatObj = awayTeam.statistics.find(s => s.name === stat.key || s.label?.toLowerCase() === stat.label.toLowerCase());

    const homeVal = parseFloat(homeStatObj?.displayValue) || 0;
    const awayVal = parseFloat(awayStatObj?.displayValue) || 0;

    let homePercent = 0;
    let awayPercent = 0;
    const total = homeVal + awayVal;

    if (stat.isPercent) {
      homePercent = homeVal;
      awayPercent = awayVal;
    } else if (total > 0) {
      homePercent = (homeVal / total) * 100;
      awayPercent = (awayVal / total) * 100;
    }

    html += `
      <div class="match-stat-row">
        <div class="match-stat-labels">
          <span class="match-stat-value">${homeStatObj?.displayValue || homeVal}</span>
          <span class="match-stat-name">${stat.label}</span>
          <span class="match-stat-value">${awayStatObj?.displayValue || awayVal}</span>
        </div>
        <div class="match-stat-bar-container">
          <div class="match-stat-bar-half match-stat-bar-half--home">
            <div class="match-stat-bar-fill" style="width: ${homePercent}%"></div>
          </div>
          <div class="match-stat-bar-half match-stat-bar-half--away">
            <div class="match-stat-bar-fill" style="width: ${awayPercent}%"></div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  target.innerHTML = html;
}

// Render Timeline tab (Goals, Yellow Cards, Red Cards)
function renderTimelineTab(data, target) {
  const events = data.keyEvents || [];
  
  // Filter for goals, cards
  const filteredEvents = events.filter(e => {
    const text = e.type?.text || "";
    return text.startsWith("Goal") || text.endsWith("Card");
  });

  if (filteredEvents.length === 0) {
    target.innerHTML = `<div style="text-align: center; color: var(--c-muted); padding: var(--sp-md);">No goals or cards recorded.</div>`;
    return;
  }

  // Sort events chronologically (0 -> 90)
  filteredEvents.sort((a, b) => (a.clock?.value || 0) - (b.clock?.value || 0));

  const homeTeamId = data.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === "home")?.id;

  let html = `<div class="match-timeline">`;
  
  filteredEvents.forEach(e => {
    const text = e.type?.text || "";
    const isHome = e.team?.id == homeTeamId;
    const player = e.athletesInvolved?.[0]?.displayName || "Player";
    const time = e.clock?.displayValue || `${Math.floor((e.clock?.value || 0) / 60)}'`;

    let icon = "⚽";
    let detail = "";
    
    if (text === "Yellow Card") {
      icon = "🟨";
    } else if (text === "Red Card") {
      icon = "🟥";
    } else if (text.includes("Penalty")) {
      icon = "⚽";
      detail = "(PEN)";
    } else if (text.includes("Own Goal")) {
      icon = "⚽";
      detail = "(OG)";
    }

    html += `
      <div class="match-event match-event--${isHome ? 'home' : 'away'}">
        <span class="match-event__time">${time}</span>
        <span class="match-event__icon">${icon}</span>
        <span class="match-event__player">${escapeHtml(player)}<span class="match-event__detail">${detail}</span></span>
      </div>
    `;
  });

  html += `</div>`;
  target.innerHTML = html;
}

// Render Lineups tab
function renderLineupsTab(data, target) {
  const rosters = data.rosters;
  
  if (!rosters || (!rosters['0'] && !rosters['1'])) {
    target.innerHTML = `<div style="text-align: center; color: var(--c-muted); padding: var(--sp-md);">Lineups not announced yet.</div>`;
    return;
  }

  const homeRosterObj = rosters['0']?.homeAway === "home" ? rosters['0'] : rosters['1']?.homeAway === "home" ? rosters['1'] : rosters['0'];
  const awayRosterObj = rosters['0']?.homeAway === "away" ? rosters['0'] : rosters['1']?.homeAway === "away" ? rosters['1'] : rosters['1'];

  function buildLineupHtml(rosterObj) {
    if (!rosterObj || !rosterObj.roster) return '<div class="lineup-column">No lineup data.</div>';
    
    const startingXI = rosterObj.roster.filter(p => p.starter);
    const subs = rosterObj.roster.filter(p => !p.starter);

    let html = `
      <div class="lineup-column">
        <div class="lineup-title">${escapeHtml(rosterObj.team?.displayName)} ${rosterObj.formation ? `(${rosterObj.formation})` : ''}</div>
        <div class="lineup-group-title">Starting XI</div>
    `;

    startingXI.forEach(p => {
      html += `
        <div class="player-item">
          <span class="player-item__number">${p.jersey || ''}</span>
          <span class="player-item__name">${escapeHtml(p.athlete?.displayName)}</span>
          <span style="font-size: 10px; color: var(--c-muted); margin-left: auto;">${p.position?.abbreviation || ''}</span>
        </div>
      `;
    });

    if (subs.length > 0) {
      html += `<div class="lineup-group-title" style="margin-top: 12px;">Substitutes</div>`;
      subs.forEach(p => {
        html += `
          <div class="player-item">
            <span class="player-item__number">${p.jersey || ''}</span>
            <span class="player-item__name" style="color: var(--c-muted);">${escapeHtml(p.athlete?.displayName)}</span>
            <span style="font-size: 10px; color: var(--c-muted); margin-left: auto;">${p.position?.abbreviation || ''}</span>
          </div>
        `;
      });
    }

    html += `</div>`;
    return html;
  }

  target.innerHTML = `
    <div class="match-lineups">
      ${buildLineupHtml(homeRosterObj)}
      ${buildLineupHtml(awayRosterObj)}
    </div>
  `;
}

// Load and render top scorers / golden boot table
async function loadTopScorers() {
  const scorersList = document.getElementById("stat-list-scorers");
  const assistsList = document.getElementById("stat-list-assists");
  const goalsAssistsList = document.getElementById("stat-list-goals-assists");
  
  if (!scorersList && !assistsList && !goalsAssistsList) return;

  try {
    const playerMap = {};

    // 1. Fetch scorers baseline from the Vercel proxy (football-data.org)
    try {
      if (typeof FixturesAPI !== "undefined" && typeof FixturesAPI.fetchScorers === "function") {
        const baseline = await FixturesAPI.fetchScorers();
        baseline.forEach(s => {
          const name = s.player?.name;
          if (!name) return;
          const teamName = s.team?.shortName || s.team?.name || "";
          const tla = s.team?.tla || "";
          const flag = typeof FixturesAPI.getFlag === "function" ? FixturesAPI.getFlag(tla) : "🏳️";
          
          playerMap[name] = {
            name: name,
            teamName: teamName,
            flag: flag,
            goals: s.goals || 0,
            assists: s.assists || 0
          };
        });
      }
    } catch (err) {
      console.warn("[Scorers] Failed to load baseline scorers:", err.message || err);
    }

    // 2. Scan all matches in CURRENT_MATCHES (ESPN) to backfill missing assist makers (players with 0 goals)
    // and live goal updates since the proxy caches for 5 minutes.
    if (typeof CURRENT_MATCHES !== "undefined" && Array.isArray(CURRENT_MATCHES)) {
      const activeMatches = CURRENT_MATCHES.filter(m => {
        const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
        const isFinished = m.status === "FINISHED";
        const hasScore = m.score1 !== null && m.score2 !== null && (m.score1 > 0 || m.score2 > 0);
        return (isFinished || isLive) && hasScore;
      });

      const summaryPromises = activeMatches.map(async m => {
        const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
        const cacheKey = `espn_goals_match_${m.id}`;
        
        if (!isLive) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try { return { match: m, goals: JSON.parse(cached) }; } catch (e) {}
          }
        }

        try {
          const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${m.id}`);
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          
          const keyEvents = data.keyEvents || [];
          const goalEvents = keyEvents.filter(e => e.type?.text?.startsWith("Goal") || e.type?.type?.startsWith("goal"));
          
          const parsedGoals = [];
          goalEvents.forEach(e => {
            const text = e.text || "";
            const isOwnGoal = text.includes("Own Goal");
            const scorer = e.participants?.[0]?.athlete?.displayName || null;
            const assister = e.participants?.[1]?.athlete?.displayName || null;
            
            const eventTeamName = e.team?.displayName || "";
            let teamName = eventTeamName;
            let flag = "🏳️";
            
            const mHome = typeof FixturesAPI !== "undefined" ? FixturesAPI.normalizeTeamName(m.team1) : m.team1;
            const mAway = typeof FixturesAPI !== "undefined" ? FixturesAPI.normalizeTeamName(m.team2) : m.team2;
            const eventTeamNorm = typeof FixturesAPI !== "undefined" ? FixturesAPI.normalizeTeamName(eventTeamName) : eventTeamName;
            
            if (eventTeamNorm === mHome) {
              teamName = m.team1;
              flag = m.flag1;
            } else if (eventTeamNorm === mAway) {
              teamName = m.team2;
              flag = m.flag2;
            }

            parsedGoals.push({
              scorer: isOwnGoal ? null : scorer,
              assister: assister || null,
              teamName: teamName,
              flag: flag
            });
          });

          if (!isLive && parsedGoals.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify(parsedGoals));
          }

          return { match: m, goals: parsedGoals };
        } catch (err) {
          console.warn(`[Scorers] Failed to fetch summary for match ${m.team1} vs ${m.team2}:`, err.message);
          return { match: m, goals: [] };
        }
      });

      const results = await Promise.all(summaryPromises);

      // Reset goals and assists that we will recalculate/validate via match details
      // to avoid double counting baseline data and ensure 100% accurate assist counts
      const scannedAssists = {};
      const scannedGoals = {};

      results.forEach(res => {
        res.goals.forEach(g => {
          if (g.scorer) {
            scannedGoals[g.scorer] = (scannedGoals[g.scorer] || 0) + 1;
            // Backfill details
            if (!playerMap[g.scorer]) {
              playerMap[g.scorer] = { name: g.scorer, teamName: g.teamName, flag: g.flag, goals: 0, assists: 0 };
            }
          }
          if (g.assister) {
            scannedAssists[g.assister] = (scannedAssists[g.assister] || 0) + 1;
            // Backfill details
            if (!playerMap[g.assister]) {
              playerMap[g.assister] = { name: g.assister, teamName: g.teamName, flag: g.flag, goals: 0, assists: 0 };
            }
          }
        });
      });

      // Update the player map with the scanned goals and assists
      Object.keys(playerMap).forEach(name => {
        const player = playerMap[name];
        // If we found goals for them in the scan, align their goal count
        if (scannedGoals[name] !== undefined) {
          player.goals = Math.max(player.goals, scannedGoals[name]);
        }
        // Assists: Since football-data.org doesn't return players with 0 goals,
        // we take the maximum of baseline assists and scanned assists to guarantee we get the full assists count!
        player.assists = Math.max(player.assists, scannedAssists[name] || 0);
      });
    }

    const scorers = Object.values(playerMap);
    
    // Sort and slice lists
    const topScorers = [...scorers]
      .filter(s => s.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name))
      .slice(0, 5);

    const topAssists = [...scorers]
      .filter(s => s.assists > 0)
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals || a.name.localeCompare(b.name))
      .slice(0, 5);

    const topGoalsAssists = [...scorers]
      .filter(s => (s.goals + s.assists) > 0)
      .sort((a, b) => {
        const sumA = a.goals + a.assists;
        const sumB = b.goals + b.assists;
        return sumB - sumA || b.goals - a.goals || a.name.localeCompare(b.name);
      })
      .slice(0, 5);

    // Helper to render a single stats card list
    function renderStatList(list, targetEl, type, valueGetter) {
      if (!targetEl) return;
      if (!list || list.length === 0) {
        let msg = "No stats available yet.";
        if (type === "goals") msg = "No goals recorded yet.";
        else if (type === "assists") msg = "No assists recorded yet.";
        targetEl.innerHTML = `<div class="stat-card__empty">${msg}</div>`;
        return;
      }

      let html = "";
      list.forEach(s => {
        const value = valueGetter(s);
        
        // Initials for avatar
        const nameParts = s.name ? s.name.trim().split(/\s+/) : ["P"];
        const initials = nameParts.length > 1 
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0][0].toUpperCase();

        const badgeClass = type === "assists" ? "stat-player-badge--green" : "stat-player-badge--red";

        html += `
          <div class="stat-player-row">
            <div class="stat-player-avatar" data-initials="${initials}">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <div class="stat-player-info">
              <span class="stat-player-name">${escapeHtml(s.name)}</span>
              <span class="stat-player-team">
                <span class="stat-player-flag">${getFlagImgHtml(s.flag)}</span>
                <span class="stat-player-team-name">${escapeHtml(s.teamName)}</span>
              </span>
            </div>
            <div class="stat-player-badge ${badgeClass}">
              ${value}
            </div>
          </div>
        `;
      });

      targetEl.innerHTML = html;
    }

    renderStatList(topScorers, scorersList, "goals", s => s.goals);
    renderStatList(topAssists, assistsList, "assists", s => s.assists);
    renderStatList(topGoalsAssists, goalsAssistsList, "goals-assists", s => s.goals + s.assists);

  } catch (err) {
    console.warn("[Scorers] Failed to load top stats:", err.message || err);
    const msg = `<div class="stat-card__empty">Failed to load stats.</div>`;
    if (scorersList) scorersList.innerHTML = msg;
    if (assistsList) assistsList.innerHTML = msg;
    if (goalsAssistsList) goalsAssistsList.innerHTML = msg;
  }
}
