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
    for (let r = 0; r < 8; r++) {
      connect(0, r, 1, Math.floor(r / 2), true);
    }
    // Column 1 (R16 L) -> Column 2 (QF L)
    for (let r = 0; r < 4; r++) {
      connect(1, r, 2, Math.floor(r / 2), true);
    }
    // Column 2 (QF L) -> Column 3 (SF L)
    for (let r = 0; r < 2; r++) {
      connect(2, r, 3, 0, true);
    }
    // Column 3 (SF L) -> Column 4 (Center - Final)
    connect(3, 0, 4, 0, true);

    // ── RIGHT SIDE CONNECTIONS ──
    // Column 8 (R32 R) -> Column 7 (R16 R)
    for (let r = 0; r < 8; r++) {
      connect(8, r, 7, Math.floor(r / 2), false);
    }
    // Column 7 (R16 R) -> Column 6 (QF R)
    for (let r = 0; r < 4; r++) {
      connect(7, r, 6, Math.floor(r / 2), false);
    }
    // Column 6 (QF R) -> Column 5 (SF R)
    for (let r = 0; r < 2; r++) {
      connect(6, r, 5, 0, false);
    }
    // Column 5 (SF R) -> Column 4 (Center - Final)
    connect(5, 0, 4, 0, false);

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

    // Helper to normalize country names for robust matching
    const normalizeName = (name) => {
      if (!name) return "";
      name = name.toLowerCase().trim();
      if (name === "côte d'ivoire" || name === "cote d'ivoire" || name === "ivory coast" || name === "civ") return "ivory coast";
      if (name === "cabo verde" || name === "cape verde" || name === "cpv") return "cape verde";
      if (name === "congo dr" || name === "dr congo" || name === "cod") return "congo dr";
      if (name === "bosnia and herzegovina" || name === "bosnia-herzegovina" || name === "bih") return "bosnia-herzegovina";
      if (name === "usa" || name === "united states" || name === "united states of america") return "united states";
      if (name === "south korea" || name === "korea republic" || name === "kor") return "south korea";
      return name;
    };

    // Helper to find a match in CURRENT_MATCHES by its two team names
    const findMatch = (t1, t2) => {
      const nt1 = normalizeName(t1);
      const nt2 = normalizeName(t2);
      if (!nt1 || !nt2) return null;
      return matches.find(m => {
        const mt1 = normalizeName(m.team1 || m.home?.name || m.home?.short || "");
        const mt2 = normalizeName(m.team2 || m.away?.name || m.away?.short || "");
        return (mt1 === nt1 && mt2 === nt2) || (mt1 === nt2 && mt2 === nt1);
      });
    };

    // Helper to determine the winner of a match
    const getWinnerName = (m) => {
      if (!m) return null;
      if (m.home?.winner === true) return m.team1;
      if (m.away?.winner === true) return m.team2;
      
      if (m.status === "FINISHED" && m.score1 !== null && m.score2 !== null) {
        const s1 = parseInt(m.score1);
        const s2 = parseInt(m.score2);
        if (s1 > s2) return m.team1;
        if (s2 > s1) return m.team2;
        
        if (m.home?.shootoutScore !== null && m.away?.shootoutScore !== null) {
          const ss1 = parseInt(m.home.shootoutScore);
          const ss2 = parseInt(m.away.shootoutScore);
          if (ss1 > ss2) return m.team1;
          if (ss2 > ss1) return m.team2;
        }
      }
      return null;
    };

    // Define the 16 Round of 32 matches in order
    const r32MatchesDef = [
      // Left side (1-8)
      { id: 1, team1: "Brazil", team2: "Japan" },
      { id: 2, team1: "Ivory Coast", team2: "Norway" },
      { id: 3, team1: "Mexico", team2: "Ecuador" },
      { id: 4, team1: "England", team2: "Congo DR" },
      { id: 5, team1: "Germany", team2: "Paraguay" },
      { id: 6, team1: "France", team2: "Sweden" },
      { id: 7, team1: "South Africa", team2: "Canada" },
      { id: 8, team1: "Netherlands", team2: "Morocco" },
      // Right side (9-16)
      { id: 9, team1: "Portugal", team2: "Croatia" },
      { id: 10, team1: "Spain", team2: "Austria" },
      { id: 11, team1: "United States", team2: "Bosnia-Herzegovina" },
      { id: 12, team1: "Belgium", team2: "Senegal" },
      { id: 13, team1: "Switzerland", team2: "Algeria" },
      { id: 14, team1: "Colombia", team2: "Ghana" },
      { id: 15, team1: "Australia", team2: "Egypt" },
      { id: 16, team1: "Argentina", team2: "Cape Verde" }
    ];

    // Build Round of 32 Match Objects
    const r32Matches = r32MatchesDef.map(def => {
      const m = findMatch(def.team1, def.team2);
      const winner = getWinnerName(m);
      return {
        ...def,
        matchObj: m,
        winner: winner,
        flag1: m ? m.flag1 : "🏳️",
        flag2: m ? m.flag2 : "🏳️",
        team1Display: m ? m.team1 : def.team1,
        team2Display: m ? m.team2 : def.team2,
        score1: m ? m.score1 : null,
        score2: m ? m.score2 : null,
        status: m ? m.status : "TIMED",
        istDate: m ? m.istDate : "",
        istTime: m ? m.istTime : ""
      };
    });

    // Build Round of 16 (8 matches)
    const r16Pairings = [
      { key: "A", p1: r32Matches[0], p2: r32Matches[1] },
      { key: "B", p1: r32Matches[2], p2: r32Matches[3] },
      { key: "C", p1: r32Matches[4], p2: r32Matches[5] },
      { key: "D", p1: r32Matches[6], p2: r32Matches[7] },
      { key: "E", p1: r32Matches[8], p2: r32Matches[9] },
      { key: "F", p1: r32Matches[10], p2: r32Matches[11] },
      { key: "G", p1: r32Matches[12], p2: r32Matches[13] },
      { key: "H", p1: r32Matches[14], p2: r32Matches[15] }
    ];

    const r16Matches = r16Pairings.map(pair => {
      const t1 = pair.p1.winner || null;
      const t2 = pair.p2.winner || null;
      const t1Placeholder = `Winner Match ${pair.p1.id}`;
      const t2Placeholder = `Winner Match ${pair.p2.id}`;
      
      let m = null;
      if (t1 && t2) {
        m = findMatch(t1, t2);
      }
      
      const winner = getWinnerName(m);
      return {
        key: pair.key,
        team1: t1,
        team2: t2,
        team1Display: t1 || t1Placeholder,
        team2Display: t2 || t2Placeholder,
        flag1: t1 ? (pair.p1.winner === pair.p1.team1Display ? pair.p1.flag1 : pair.p1.flag2) : "🏳️",
        flag2: t2 ? (pair.p2.winner === pair.p2.team1Display ? pair.p2.flag1 : pair.p2.flag2) : "🏳️",
        score1: m ? m.score1 : null,
        score2: m ? m.score2 : null,
        status: m ? m.status : "TIMED",
        istDate: m ? m.istDate : "",
        istTime: m ? m.istTime : "",
        winner: winner,
        matchObj: m
      };
    });

    // Build Quarterfinals (4 matches)
    const qfPairings = [
      { id: 1, p1: r16Matches[0], p2: r16Matches[1] },
      { id: 2, p1: r16Matches[2], p2: r16Matches[3] },
      { id: 3, p1: r16Matches[4], p2: r16Matches[5] },
      { id: 4, p1: r16Matches[6], p2: r16Matches[7] }
    ];

    const qfMatches = qfPairings.map(pair => {
      const t1 = pair.p1.winner || null;
      const t2 = pair.p2.winner || null;
      const t1Placeholder = `Winner Match ${pair.p1.key}`;
      const t2Placeholder = `Winner Match ${pair.p2.key}`;
      
      let m = null;
      if (t1 && t2) {
        m = findMatch(t1, t2);
      }
      
      const winner = getWinnerName(m);
      return {
        id: pair.id,
        team1: t1,
        team2: t2,
        team1Display: t1 || t1Placeholder,
        team2Display: t2 || t2Placeholder,
        flag1: t1 ? (pair.p1.winner === pair.p1.team1Display ? pair.p1.flag1 : pair.p1.flag2) : "🏳️",
        flag2: t2 ? (pair.p2.winner === pair.p2.team1Display ? pair.p2.flag1 : pair.p2.flag2) : "🏳️",
        score1: m ? m.score1 : null,
        score2: m ? m.score2 : null,
        status: m ? m.status : "TIMED",
        istDate: m ? m.istDate : "",
        istTime: m ? m.istTime : "",
        winner: winner,
        matchObj: m
      };
    });

    // Build Semifinals (2 matches)
    const sfPairings = [
      { id: 1, p1: qfMatches[0], p2: qfMatches[1] },
      { id: 2, p1: qfMatches[2], p2: qfMatches[3] }
    ];

    const sfMatches = sfPairings.map(pair => {
      const t1 = pair.p1.winner || null;
      const t2 = pair.p2.winner || null;
      const t1Placeholder = `Winner QF ${pair.p1.id}`;
      const t2Placeholder = `Winner QF ${pair.p2.id}`;
      
      let m = null;
      if (t1 && t2) {
        m = findMatch(t1, t2);
      }
      
      const winner = getWinnerName(m);
      return {
        id: pair.id,
        team1: t1,
        team2: t2,
        team1Display: t1 || t1Placeholder,
        team2Display: t2 || t2Placeholder,
        flag1: t1 ? (pair.p1.winner === pair.p1.team1Display ? pair.p1.flag1 : pair.p1.flag2) : "🏳️",
        flag2: t2 ? (pair.p2.winner === pair.p2.team1Display ? pair.p2.flag1 : pair.p2.flag2) : "🏳️",
        score1: m ? m.score1 : null,
        score2: m ? m.score2 : null,
        status: m ? m.status : "TIMED",
        istDate: m ? m.istDate : "",
        istTime: m ? m.istTime : "",
        winner: winner,
        matchObj: m
      };
    });

    // Build Finals (Final + Bronze)
    const finalT1 = sfMatches[0].winner || null;
    const finalT2 = sfMatches[1].winner || null;
    let finalMatchObj = null;
    if (finalT1 && finalT2) {
      finalMatchObj = findMatch(finalT1, finalT2);
    }
    const finalMatch = {
      team1: finalT1,
      team2: finalT2,
      team1Display: finalT1 || "Winner SF 1",
      team2Display: finalT2 || "Winner SF 2",
      flag1: finalT1 ? (sfMatches[0].winner === sfMatches[0].team1Display ? sfMatches[0].flag1 : sfMatches[0].flag2) : "🏳️",
      flag2: finalT2 ? (sfMatches[1].winner === sfMatches[1].team1Display ? sfMatches[1].flag1 : sfMatches[1].flag2) : "🏳️",
      score1: finalMatchObj ? finalMatchObj.score1 : null,
      score2: finalMatchObj ? finalMatchObj.score2 : null,
      status: finalMatchObj ? finalMatchObj.status : "TIMED",
      istDate: finalMatchObj ? finalMatchObj.istDate : "",
      istTime: finalMatchObj ? finalMatchObj.istTime : "",
      winner: getWinnerName(finalMatchObj),
      matchObj: finalMatchObj
    };

    const getSFLoser = (sf) => {
      if (!sf.team1 || !sf.team2 || !sf.winner) return null;
      return sf.winner === sf.team1Display ? sf.team2 : sf.team1;
    };
    const bronzeT1 = getSFLoser(sfMatches[0]);
    const bronzeT2 = getSFLoser(sfMatches[1]);
    let bronzeMatchObj = null;
    if (bronzeT1 && bronzeT2) {
      bronzeMatchObj = matches.find(m => {
        const grp = (m.group || "").toLowerCase().trim();
        return grp.includes("third") || grp.includes("3rd");
      });
    }
    const bronzeMatch = {
      team1: bronzeT1,
      team2: bronzeT2,
      team1Display: bronzeT1 || "Loser SF 1",
      team2Display: bronzeT2 || "Loser SF 2",
      flag1: bronzeT1 ? (sfMatches[0].winner === sfMatches[0].team1Display ? sfMatches[0].flag2 : sfMatches[0].flag1) : "🏳️",
      flag2: bronzeT2 ? (sfMatches[1].winner === sfMatches[1].team1Display ? sfMatches[1].flag2 : sfMatches[1].flag1) : "🏳️",
      score1: bronzeMatchObj ? bronzeMatchObj.score1 : null,
      score2: bronzeMatchObj ? bronzeMatchObj.score2 : null,
      status: bronzeMatchObj ? bronzeMatchObj.status : "TIMED",
      istDate: bronzeMatchObj ? bronzeMatchObj.istDate : "",
      istTime: bronzeMatchObj ? bronzeMatchObj.istTime : "",
      winner: getWinnerName(bronzeMatchObj),
      matchObj: bronzeMatchObj
    };

    // Determine Champion
    const isChampTbd = !finalMatch.winner;
    const champName = finalMatch.winner || "TBD";
    const champFlag = finalMatch.winner 
      ? (finalMatch.winner === finalMatch.team1Display ? finalMatch.flag1 : finalMatch.flag2) 
      : null;

    // Slice columns according to Left/Right halves
    const r32_L = r32Matches.slice(0, 8);
    const r16_L = r16Matches.slice(0, 4);
    const qf_L = qfMatches.slice(0, 2);
    const sf_L = sfMatches.slice(0, 1);

    const r32_R = r32Matches.slice(8, 16);
    const r16_R = r16Matches.slice(4, 8);
    const qf_R = qfMatches.slice(2, 4);
    const sf_R = sfMatches.slice(1, 2);

    // Build Column HTML
    const buildColHtml = (arr, colClass, label) => {
      const cardsHtml = arr.map(m => renderMatchCard(m)).join("");
      return `
        <div class="bracket-column ${colClass}">
          <div class="bracket-column-header">${label}</div>
          ${cardsHtml}
        </div>
      `;
    };

    const col1 = buildColHtml(r32_L, "bracket-column--r32", "ROUND OF 32");
    const col2 = buildColHtml(r16_L, "bracket-column--r16", "ROUND OF 16");
    const col3 = buildColHtml(qf_L, "bracket-column--qf", "QUARTERFINALS");
    const col4 = buildColHtml(sf_L, "bracket-column--sf", "SEMIFINALS");

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
        ${renderMatchCard(finalMatch, "FINAL")}
        <span class="bracket-badge bracket-badge--final">FINAL</span>
      </div>
    `;

    const bronzeHtml = `
      <div class="bracket-match bracket-match--bronze">
        ${renderMatchCard(bronzeMatch, "BRONZE FINAL")}
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

    const col6 = buildColHtml(sf_R, "bracket-column--sf", "SEMIFINALS");
    const col7 = buildColHtml(qf_R, "bracket-column--qf", "QUARTERFINALS");
    const col8 = buildColHtml(r16_R, "bracket-column--r16", "ROUND OF 16");
    const col9 = buildColHtml(r32_R, "bracket-column--r32", "ROUND OF 32");

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
