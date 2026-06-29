// ─────────────────────────────────────────────
//  bracket.js — Tournament Bracket Controller
// ─────────────────────────────────────────────

const BracketAPI = (() => {
  const SHORT_NAMES = {
    "South Africa": "RSA",
    "Czech Republic": "CZE",
    "Bosnia & Herzegovina": "BIH",
    "Bosnia-Herzegovina": "BIH",
    "Switzerland": "SUI",
    "Saudi Arabia": "KSA",
    "United States": "USA",
    "Congo DR": "COD",
    "New Zealand": "NZL",
    "Ivory Coast": "CIV",
    "Netherlands": "NED",
    "Germany": "GER",
    "Paraguay": "PAR",
    "Morocco": "MAR",
    "Argentina": "ARG",
    "Portugal": "POR",
    "Croatia": "CRO",
    "Colombia": "COL",
    "Australia": "AUS",
    "Cape Verde": "CPV",
    "Algeria": "ALG",
    "Senegal": "SEN",
    "Belgium": "BEL",
    "England": "ENG",
    "Mexico": "MEX",
    "Ecuador": "ECU",
    "France": "FRA",
    "Sweden": "SWE",
    "Brazil": "BRA",
    "Japan": "JPN",
    "Spain": "ESP",
    "Austria": "AUT",
    "Uruguay": "URU",
    "Italy": "ITA",
    "Canada": "CAN",
    "Korea Republic": "KOR",
    "South Korea": "KOR"
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderFlag(flag, name) {
    if (!name || name === "TBD" || flag === "🏳️" || !flag || name.startsWith("Round of 32") || name.startsWith("Round of 16") || name.startsWith("Quarter") || name.startsWith("Semi")) {
      return `<div class="bracket-team-flag--tbd"></div>`;
    }
    if (typeof getFlagImgHtml === "function") {
      return getFlagImgHtml(flag);
    }
    return flag;
  }

  function renderName(name) {
    if (!name || name === "TBD" || name.startsWith("Round of 32") || name.startsWith("Round of 16") || name.startsWith("Quarter") || name.startsWith("Semi")) {
      return `<span class="bracket-team-name bracket-team-name--tbd">TBD</span>`;
    }
    const short = SHORT_NAMES[name] || name.substring(0, 3).toUpperCase();
    return `<span class="bracket-team-name" title="${escapeHtml(name)}">${escapeHtml(short)}</span>`;
  }

  function renderMatchCard(m, placeholderText = "TBD") {
    if (!m) {
      return `
        <div class="bracket-match">
          <div class="bracket-match__teams">
            <div class="bracket-match__team">
              <div class="bracket-team-flag--tbd"></div>
              <span class="bracket-team-name bracket-team-name--tbd">TBD</span>
            </div>
            <span class="bracket-match__vs">vs</span>
            <div class="bracket-match__team">
              <div class="bracket-team-flag--tbd"></div>
              <span class="bracket-team-name bracket-team-name--tbd">TBD</span>
            </div>
          </div>
          <div class="bracket-match__info">${placeholderText}</div>
        </div>
      `;
    }

    const t1 = m.team1 || m.home?.name || "TBD";
    const t2 = m.team2 || m.away?.name || "TBD";
    const f1 = m.flag1 || m.home?.flag || "🏳️";
    const f2 = m.flag2 || m.away?.flag || "🏳️";
    const s1 = m.score1 !== undefined && m.score1 !== null ? m.score1 : m.home?.score;
    const s2 = m.score2 !== undefined && m.score2 !== null ? m.score2 : m.away?.score;

    let infoHtml = "";
    if (m.status === "FINISHED") {
      infoHtml = `<span class="bracket-match__info--score">${s1} - ${s2}</span>`;
    } else if (m.status === "IN_PLAY") {
      const clock = m.displayClock ? ` (${m.displayClock})` : "";
      infoHtml = `<span class="bracket-match__info--score bracket-match__info--live">LIVE ${s1}-${s2}${clock}</span>`;
    } else {
      infoHtml = `<span class="bracket-match__date">${m.istDate || m.date || placeholderText}</span>`;
    }

    return `
      <div class="bracket-match" data-match-id="${m.id || ''}">
        <div class="bracket-match__teams">
          <div class="bracket-match__team">
            ${renderFlag(f1, t1)}
            ${renderName(t1)}
          </div>
          <span class="bracket-match__vs">vs</span>
          <div class="bracket-match__team">
            ${renderFlag(f2, t2)}
            ${renderName(t2)}
          </div>
        </div>
        <div class="bracket-match__info">${infoHtml}</div>
      </div>
    `;
  }

  function drawLines() {
    const container = document.getElementById("bracket-container");
    const wrapper = document.querySelector(".bracket-wrapper");
    if (!container || !wrapper) return;

    // Remove existing SVG
    const oldSvg = wrapper.querySelector(".bracket-lines-overlay");
    if (oldSvg) oldSvg.remove();

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "bracket-lines-overlay");
    wrapper.appendChild(svg);

    const cols = Array.from(wrapper.querySelectorAll(".bracket-column"));
    if (cols.length < 9) return;

    const colPositions = cols.map(col => ({
      left: col.offsetLeft,
      width: col.offsetWidth,
      top: col.offsetTop,
      height: col.offsetHeight
    }));

    const paths = [];

    // Helper to add path
    function connect(colStart, rowStart, colEnd, rowEnd, isLeft) {
      const parentCol = cols[colStart];
      const childCol = cols[colEnd];
      if (!parentCol || !childCol) return;

      const parents = parentCol.querySelectorAll(".bracket-match");
      const children = childCol.querySelectorAll(".bracket-match");

      const parentCard = parents[rowStart];
      const childCard = children[rowEnd];
      if (!parentCard || !childCard) return;

      const pRect = {
        x: colPositions[colStart].left,
        y: colPositions[colStart].top + parentCard.offsetTop,
        w: parentCard.offsetWidth,
        h: parentCard.offsetHeight
      };

      const cRect = {
        x: colPositions[colEnd].left,
        y: colPositions[colEnd].top + childCard.offsetTop,
        w: childCard.offsetWidth,
        h: childCard.offsetHeight
      };

      const y1 = pRect.y + pRect.h / 2;
      const y2 = cRect.y + cRect.h / 2;

      let x1, x2;
      if (isLeft) {
        x1 = pRect.x + pRect.w;
        x2 = cRect.x;
      } else {
        x1 = pRect.x;
        x2 = cRect.x + cRect.w;
      }

      const x_mid = x1 + (x2 - x1) / 2;

      const pathString = `M ${x1} ${y1} L ${x_mid} ${y1} L ${x_mid} ${y2} L ${x2} ${y2}`;
      
      // Determine if active line (if parent has a winner and goes to the child)
      let activeClass = "";
      const pName1 = parentCard.querySelector(".bracket-team-name:not(.bracket-team-name--tbd)")?.textContent;
      const pName2 = parentCard.querySelectorAll(".bracket-team-name:not(.bracket-team-name--tbd)")[1]?.textContent;
      const cName1 = childCard.querySelector(".bracket-team-name:not(.bracket-team-name--tbd)")?.textContent;
      const cName2 = childCard.querySelectorAll(".bracket-team-name:not(.bracket-team-name--tbd)")[1]?.textContent;

      if (pName1 && cName1 && (pName1 === cName1 || pName1 === cName2)) activeClass = " bracket-line-path--active";
      if (pName2 && cName2 && (pName2 === cName1 || pName2 === cName2)) activeClass = " bracket-line-path--active";

      paths.push(`<path class="bracket-line-path${activeClass}" d="${pathString}" />`);
    }

    // ── LEFT SIDE CONNECTIONS ──
    // Column 0 (R32 L) -> Column 1 (R16 L)
    connect(0, 0, 1, 0, true); // FRA/SWE -> R16-3
    connect(0, 1, 1, 0, true); // NED/MAR -> R16-3
    connect(0, 2, 1, 1, true); // RSA/CAN -> R16-1
    connect(0, 3, 1, 1, true); // GER/PAR -> R16-1
    
    connect(0, 4, 1, 2, true); // POR/CRO -> R16-5
    connect(0, 5, 1, 2, true); // ESP/AUT -> R16-5
    connect(0, 6, 1, 3, true); // USA/BIH -> R16-6
    connect(0, 7, 1, 3, true); // BEL/SEN -> R16-6

    // Column 1 (R16 L) -> QF
    connect(1, 1, 2, 0, true);  // Left R16 Row 1 (R16-1) -> Left QF Row 0 (QF-1)
    connect(1, 2, 2, 1, true);  // Left R16 Row 2 (R16-5) -> Left QF Row 1 (QF-2)
    connect(1, 3, 2, 1, true);  // Left R16 Row 3 (R16-6) -> Left QF Row 1 (QF-2)
    
    // QF Left -> SF Left
    connect(2, 0, 3, 0, true);  // Left QF Row 0 (QF-1) -> Left SF (SF-1)
    connect(2, 1, 3, 0, true);  // Left QF Row 1 (QF-2) -> Left SF (SF-1)

    // SF Left -> Center (Final)
    connect(3, 0, 4, 0, true);

    // ── RIGHT SIDE CONNECTIONS ──
    // Column 8 (R32 R) -> Column 7 (R16 R)
    connect(8, 0, 7, 0, false); // BRA/JPN -> R16-2
    connect(8, 1, 7, 0, false); // CIV/NOR -> R16-2
    connect(8, 2, 7, 1, false); // MEX/ECU -> R16-4
    connect(8, 3, 7, 1, false); // ENG/COD -> R16-4
    
    connect(8, 4, 7, 2, false); // ARG/CPV -> R16-8
    connect(8, 5, 7, 2, false); // SUI/ALG -> R16-8
    connect(8, 6, 7, 3, false); // COL/GHA -> R16-7
    connect(8, 7, 7, 3, false); // AUS/EGY -> R16-7

    // Column 7 (R16 R) -> QF
    connect(7, 1, 6, 0, false); // Right R16 Row 1 (R16-4) -> Right QF Row 0 (QF-3)
    connect(7, 2, 6, 1, false); // Right R16 Row 2 (R16-8) -> Right QF Row 1 (QF-4)
    connect(7, 3, 6, 1, false); // Right R16 Row 3 (R16-7) -> Right QF Row 1 (QF-4)

    // QF Right -> SF Right
    connect(6, 0, 5, 0, false); // Right QF Row 0 (QF-3) -> Right SF (SF-2)
    connect(6, 1, 5, 0, false); // Right QF Row 1 (QF-4) -> Right SF (SF-2)

    // SF Right -> Center (Final)
    connect(5, 0, 4, 0, false);

    // ── CROSSING CONNECTIONS ──
    // Right R16 Row 0 (R16-2) -> Left QF Row 0 (QF-1)
    connect(7, 0, 2, 0, false); // From Right R16-2 to Left QF-1
    // Left R16 Row 0 (R16-3) -> Right QF Row 0 (QF-3)
    connect(1, 0, 6, 0, true);  // From Left R16-3 to Right QF-3

    svg.innerHTML = paths.join("");
  }

  function scaleBracket() {
    const container = document.getElementById("bracket-container");
    const wrapper = document.querySelector(".bracket-wrapper");
    if (!container || !wrapper) return;

    // Break container out of standard constrained width
    container.style.width = "100vw";
    container.style.position = "relative";
    container.style.left = "50%";
    container.style.right = "50%";
    container.style.marginLeft = "-50vw";
    container.style.marginRight = "-50vw";

    const viewportWidth = window.innerWidth;
    const targetWidth = 1620; // 1580px wrapper width + some padding margin
    
    const minScale = viewportWidth < 768 ? 0.6 : 0.45;
    
    let scale = viewportWidth / targetWidth;
    if (scale > 1.0) scale = 1.0;
    
    const finalScale = Math.max(scale, minScale);
    
    wrapper.style.transform = `scale(${finalScale})`;
    wrapper.style.transformOrigin = `center top`;
    
    // Adjust height of container to fit the scaled bracket height (680px * scale)
    container.style.height = `${700 * finalScale}px`;
    container.style.overflowY = "hidden";
    
    if (scale < minScale) {
      container.style.overflowX = "auto";
      container.style.justifyContent = "flex-start";
    } else {
      container.style.overflowX = "hidden";
      container.style.justifyContent = "center";
    }
  }

  function render() {
    const container = document.getElementById("bracket-container");
    if (!container) return;

    const matches = (typeof CURRENT_MATCHES !== "undefined") ? CURRENT_MATCHES : [];

    // Filter by stage
    const filterRound = (names) => {
      return matches.filter(m => {
        const grp = (m.group || "").toLowerCase().trim();
        return names.some(n => grp === n.toLowerCase());
      });
    };

    const r32 = filterRound(["round of 32"]);
    const r16 = filterRound(["round of 16"]);
    const qf = filterRound(["quarter-finals", "quarterfinals"]);
    const sf = filterRound(["semi-finals", "semifinals"]);
    const finalMatches = filterRound(["final"]);
    const thirdPlaceMatches = filterRound(["third place", "3rd-place-match", "third place playoff"]);

    // Sort chronologically using a robust date parser that works for both live and static fallback data
    const getComparableDate = (m) => {
      if (m.utcDate && !m.utcDate.endsWith("T00:00:00Z")) {
        return new Date(m.utcDate).getTime();
      }
      if (m.istDate) {
        const parts = m.istDate.split(" ");
        const month = parts[0] === "Jun" ? 5 : 6;
        const day = parseInt(parts[1]) || 1;
        
        let hours = 0;
        let minutes = 0;
        if (m.istTime) {
          const timeParts = m.istTime.split(" ");
          const hm = timeParts[0].split(":");
          hours = parseInt(hm[0]) || 0;
          minutes = parseInt(hm[1]) || 0;
          if (timeParts[1] === "PM" && hours < 12) hours += 12;
          if (timeParts[1] === "AM" && hours === 12) hours = 0;
        }
        
        return new Date(2026, month, day, hours, minutes).getTime();
      }
      return 0;
    };

    const sortByDate = (arr) => {
      return arr.sort((a, b) => getComparableDate(a) - getComparableDate(b));
    };

    sortByDate(r32);
    sortByDate(r16);
    sortByDate(qf);
    sortByDate(sf);
    sortByDate(finalMatches);
    sortByDate(thirdPlaceMatches);

    // ── MAPPING MATCHES TO SLOTS ──
    // Left Columns
    const r32_L = [r32[5], r32[3], r32[0], r32[2], r32[11], r32[10], r32[9], r32[8]];
    const r16_L = [r16[2], r16[0], r16[4], r16[5]];
    const qf_L = [qf[0], qf[1]];
    const sf_L = [sf[0]];

    // Right Columns
    const r32_R = [r32[1], r32[4], r32[6], r32[7], r32[14], r32[12], r32[15], r32[13]];
    const r16_R = [r16[1], r16[3], r16[7], r16[6]];
    const qf_R = [qf[2], qf[3]];
    const sf_R = [sf[1]];

    // Center Column
    const finalMatch = finalMatches[0];
    const bronzeMatch = thirdPlaceMatches[0];

    // Determine Champion if final is finished
    let champName = "TBD";
    let champFlag = null;
    let isChampTbd = true;

    if (finalMatch && finalMatch.status === "FINISHED") {
      const s1 = parseInt(finalMatch.score1);
      const s2 = parseInt(finalMatch.score2);
      if (!isNaN(s1) && !isNaN(s2)) {
        isChampTbd = false;
        if (s1 > s2) {
          champName = finalMatch.team1;
          champFlag = finalMatch.flag1;
        } else {
          champName = finalMatch.team2;
          champFlag = finalMatch.flag2;
        }
      }
    }

    // Build Column HTML
    const buildColHtml = (arr, colClass, placeholderPrefix) => {
      let cardsHtml = "";
      arr.forEach((m, idx) => {
        cardsHtml += renderMatchCard(m, `${placeholderPrefix} ${idx + 1}`);
      });
      return `<div class="bracket-column ${colClass}">${cardsHtml}</div>`;
    };

    const col1 = buildColHtml(r32_L, "bracket-column--r32", "R32 L");
    const col2 = buildColHtml(r16_L, "bracket-column--r16", "R16 L");
    const col3 = buildColHtml(qf_L, "bracket-column--qf", "QF L");
    const col4 = buildColHtml(sf_L, "bracket-column--sf", "SF L");

    // Center Column (Trophy + Final + Bronze)
    const trophySvg = isChampTbd 
      ? `<svg class="bracket-trophy-svg bracket-trophy-svg--tbd" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25M4 4.5h16M9 4.5v10.5M15 4.5v10.5"/></svg>`
      : `<svg class="bracket-trophy-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6a2 2 0 00-2 2v3c0 2.2 1.4 4.1 3.4 4.7C8.1 13.5 10 15 12 15s3.9-1.5 4.6-3.3c2-.6 3.4-2.5 3.4-4.7V4a2 2 0 00-2-2zm-12 5V4h2v5.1C6.8 8.7 6 7.9 6 7zm12 0c0 .9-.8 1.7-2 2.1V4h2v3zM12 17a3 3 0 00-3 3v2h6v-2a3 3 0 00-3-3z"/></svg>`;

    const champHtml = `
      <div class="bracket-champion-trophy">
        ${trophySvg}
        <div class="bracket-champion-title">CHAMPION</div>
        <div class="bracket-champion-name">${champFlag ? renderFlag(champFlag, champName) + " " : ""}${escapeHtml(champName)}</div>
      </div>
    `;

    const finalHtml = `
      <div class="bracket-match bracket-match--final">
        ${finalMatch ? renderMatchCard(finalMatch, "FINAL") : `
          <div class="bracket-match__teams">
            <div class="bracket-match__team">
              <div class="bracket-team-flag--tbd"></div>
              <span class="bracket-team-name bracket-team-name--tbd">WS1</span>
            </div>
            <span class="bracket-match__vs">vs</span>
            <div class="bracket-match__team">
              <div class="bracket-team-flag--tbd"></div>
              <span class="bracket-team-name bracket-team-name--tbd">WS2</span>
            </div>
          </div>
          <div class="bracket-match__info">FINAL</div>
        `}
        <span class="bracket-badge bracket-badge--final">FINAL</span>
      </div>
    `;

    const bronzeHtml = `
      <div class="bracket-match bracket-match--bronze">
        ${bronzeMatch ? renderMatchCard(bronzeMatch, "BRONZE FINAL") : `
          <div class="bracket-match__teams">
            <div class="bracket-match__team">
              <div class="bracket-team-flag--tbd"></div>
              <span class="bracket-team-name bracket-team-name--tbd">LS1</span>
            </div>
            <span class="bracket-match__vs">vs</span>
            <div class="bracket-match__team">
              <div class="bracket-team-flag--tbd"></div>
              <span class="bracket-team-name bracket-team-name--tbd">LS2</span>
            </div>
          </div>
          <div class="bracket-match__info">BRONZE FINAL</div>
        `}
        <span class="bracket-badge bracket-badge--bronze">BRONZE FINAL</span>
      </div>
    `;

    const col5 = `
      <div class="bracket-column bracket-column--center">
        ${champHtml}
        ${finalHtml}
        ${bronzeHtml}
      </div>
    `;

    const col6 = buildColHtml(sf_R, "bracket-column--sf", "SF R");
    const col7 = buildColHtml(qf_R, "bracket-column--qf", "QF R");
    const col8 = buildColHtml(r16_R, "bracket-column--r16", "R16 R");
    const col9 = buildColHtml(r32_R, "bracket-column--r32", "R32 R");

    container.innerHTML = `
      <div class="bracket-wrapper">
        ${col1}
        ${col2}
        ${col3}
        ${col4}
        ${col5}
        ${col6}
        ${col7}
        ${col8}
        ${col9}
      </div>
    `;

    scaleBracket();

    // Render connection lines
    // Wait a brief timeout for elements to paint and offsetLeft to be populated accurately
    setTimeout(() => {
      scaleBracket();
      drawLines();
    }, 50);
  }

  // Handle redraw on window resize
  window.addEventListener("resize", () => {
    // Only redraw lines if the bracket is active and visible
    const container = document.getElementById("bracket-container");
    if (container && container.style.display !== "none") {
      scaleBracket();
      drawLines();
    }
  });

  return { render, scale: scaleBracket };
})();
