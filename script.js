(() => {
  const COLS = 6;
  const ROWS = 8;
  const CAT_TYPES = [
    { face: '🐱', hue: 28 },   // orange tabby
    { face: '😻', hue: 330 },  // pink heart-eyes
    { face: '😸', hue: 200 },  // sky blue
    { face: '🙀', hue: 265 },  // violet
    { face: '🐈‍⬛', hue: 0, sat: 0, light: 22 }, // black cat, neutral tile
    { face: '🐈', hue: 140 },  // green
  ];
  const GAME_DURATION = 45;
  const BEST_SCORE_KEY = 'madeleine_best_score';

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const timerBarEl = document.getElementById('timerBar');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const overlaySubtitleEl = document.getElementById('overlaySubtitle');
  const badgeWrapEl = document.getElementById('badgeWrap');
  const badgeVisualEl = document.getElementById('badgeVisual');
  const badgeLabelEl = document.getElementById('badgeLabel');
  const badgeSubEl = document.getElementById('badgeSub');
  const finalScoreWrapEl = document.getElementById('finalScoreWrap');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreLineEl = document.getElementById('bestScoreLine');
  const startBtn = document.getElementById('startBtn');
  const topScoresBtn = document.getElementById('topScoresBtn');
  const saveAreaEl = document.getElementById('saveArea');
  const pseudoFieldEl = document.getElementById('pseudoField');
  const saveScoreBtn = document.getElementById('saveScoreBtn');
  const saveStatusEl = document.getElementById('saveStatus');
  const leaderboardModalEl = document.getElementById('leaderboardModal');
  const lbContentEl = document.getElementById('lbContent');
  const closeLbBtn = document.getElementById('closeLbBtn');

  let grid = [];
  let tileEls = [];
  let score = 0;
  let timeLeft = GAME_DURATION;
  let timerId = null;
  let selected = null;
  let busy = false;
  let running = false;

  // ---- Classement en ligne (TOP 10 partagé entre tous les joueurs) ----
  // Backend : Netlify Function + Netlify Blobs (voir netlify/functions/scores.js)
  const SCORES_API = '/api/scores';

  async function fetchLeaderboard() {
    try {
      const res = await fetch(SCORES_API, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function submitScore(name, scoreValue) {
    try {
      const res = await fetch(SCORES_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, score: scoreValue }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderLeaderboardList(list) {
    if (!list) {
      lbContentEl.innerHTML = '<p class="lb-msg">Classement indisponible pour le moment.</p>';
      return;
    }
    if (list.length === 0) {
      lbContentEl.innerHTML = '<p class="lb-msg">Aucun score enregistré pour l\'instant.<br>Sois le premier !</p>';
      return;
    }
    const items = list.slice(0, 10).map((entry, i) => {
      const safeName = escapeHtml(String(entry.name || 'Anonyme').slice(0, 14));
      return '<li><span class="lb-rank">#' + (i + 1) + '</span>' +
        '<span class="lb-name">' + safeName + '</span>' +
        '<span class="lb-score">' + Math.floor(entry.score) + '</span></li>';
    }).join('');
    lbContentEl.innerHTML = '<ul class="lb-list">' + items + '</ul>';
  }

  async function openLeaderboard() {
    leaderboardModalEl.classList.remove('hidden');
    lbContentEl.innerHTML = '<p class="lb-msg">Chargement…</p>';
    const list = await fetchLeaderboard();
    renderLeaderboardList(list);
  }

  topScoresBtn.addEventListener('click', openLeaderboard);
  closeLbBtn.addEventListener('click', () => {
    leaderboardModalEl.classList.add('hidden');
  });

  saveScoreBtn.addEventListener('click', async () => {
    let name = (pseudoFieldEl.value || '').trim().slice(0, 14);
    if (!name) name = 'Anonyme';
    saveScoreBtn.disabled = true;
    saveStatusEl.textContent = 'Enregistrement…';
    const result = await submitScore(name, score);
    if (result) {
      saveStatusEl.textContent = 'Score enregistré !';
    } else {
      saveStatusEl.textContent = "Échec de l'enregistrement, réessaie.";
      saveScoreBtn.disabled = false;
    }
  });

  function randomType(excludeChecks) {
    let type;
    do {
      type = Math.floor(Math.random() * CAT_TYPES.length);
    } while (excludeChecks && excludeChecks(type));
    return type;
  }

  function idx(r, c) { return r * COLS + c; }

  function buildInitialGrid() {
    grid = new Array(ROWS * COLS).fill(null);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[idx(r, c)] = randomType((type) => {
          const left1 = c >= 1 ? grid[idx(r, c - 1)] : null;
          const left2 = c >= 2 ? grid[idx(r, c - 2)] : null;
          const up1 = r >= 1 ? grid[idx(r - 1, c)] : null;
          const up2 = r >= 2 ? grid[idx(r - 2, c)] : null;
          return (type === left1 && type === left2) || (type === up1 && type === up2);
        });
      }
    }
  }

  function paintTile(tile, typeId) {
    const type = CAT_TYPES[typeId];
    tile.textContent = type.face;
    tile.style.setProperty('--hue', type.hue);
    if (type.sat !== undefined) tile.style.setProperty('--tile-sat', type.sat + '%');
    else tile.style.removeProperty('--tile-sat');
    if (type.light !== undefined) tile.style.setProperty('--tile-light', type.light + '%');
    else tile.style.removeProperty('--tile-light');
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--cols', COLS);
    boardEl.style.setProperty('--rows', ROWS);
    tileEls = new Array(ROWS * COLS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.r = r;
        tile.dataset.c = c;
        paintTile(tile, grid[idx(r, c)]);
        tile.addEventListener('click', onTileClick);
        boardEl.appendChild(tile);
        tileEls[idx(r, c)] = tile;
      }
    }
  }

  function syncTileFace(r, c) {
    const tile = tileEls[idx(r, c)];
    paintTile(tile, grid[idx(r, c)]);
    tile.classList.remove('matched');
  }

  function clearSelection() {
    if (selected) {
      tileEls[idx(selected.r, selected.c)].classList.remove('selected');
      selected = null;
    }
  }

  function onTileClick(e) {
    if (!running || busy) return;
    const r = parseInt(e.currentTarget.dataset.r, 10);
    const c = parseInt(e.currentTarget.dataset.c, 10);

    if (!selected) {
      selected = { r, c };
      e.currentTarget.classList.add('selected');
      return;
    }

    if (selected.r === r && selected.c === c) {
      clearSelection();
      return;
    }

    const isAdjacent = Math.abs(selected.r - r) + Math.abs(selected.c - c) === 1;
    if (!isAdjacent) {
      tileEls[idx(selected.r, selected.c)].classList.remove('selected');
      selected = { r, c };
      e.currentTarget.classList.add('selected');
      return;
    }

    const from = selected;
    const to = { r, c };
    clearSelection();
    attemptSwap(from, to);
  }

  function attemptSwap(from, to) {
    swapCells(from, to);
    const matches = findMatches();
    if (matches.size === 0) {
      swapCells(from, to);
      const t1 = tileEls[idx(from.r, from.c)];
      const t2 = tileEls[idx(to.r, to.c)];
      t1.classList.add('swap-invalid');
      t2.classList.add('swap-invalid');
      setTimeout(() => {
        t1.classList.remove('swap-invalid');
        t2.classList.remove('swap-invalid');
      }, 280);
      return;
    }
    busy = true;
    syncTileFace(from.r, from.c);
    syncTileFace(to.r, to.c);
    resolveMatches(matches, to);
  }

  function swapCells(a, b) {
    const tmp = grid[idx(a.r, a.c)];
    grid[idx(a.r, a.c)] = grid[idx(b.r, b.c)];
    grid[idx(b.r, b.c)] = tmp;
  }

  function findMatches() {
    const matched = new Set();
    for (let r = 0; r < ROWS; r++) {
      let runStart = 0;
      for (let c = 1; c <= COLS; c++) {
        const same = c < COLS && grid[idx(r, c)] === grid[idx(r, runStart)];
        if (!same) {
          if (c - runStart >= 3) {
            for (let k = runStart; k < c; k++) matched.add(idx(r, k));
          }
          runStart = c;
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      let runStart = 0;
      for (let r = 1; r <= ROWS; r++) {
        const same = r < ROWS && grid[idx(r, c)] === grid[idx(runStart, c)];
        if (!same) {
          if (r - runStart >= 3) {
            for (let k = runStart; k < r; k++) matched.add(idx(k, c));
          }
          runStart = r;
        }
      }
    }
    return matched;
  }

  function resolveMatches(matches, originCell) {
    const points = matches.size * 10 + Math.max(0, matches.size - 3) * 5;
    score += points;
    scoreEl.textContent = score;
    showScoreFloat(points, originCell);

    matches.forEach((i) => {
      tileEls[i].classList.add('matched');
    });

    setTimeout(() => {
      matches.forEach((i) => { grid[i] = null; });
      collapseAndRefill();
      renderGridFaces();

      const nextMatches = findMatches();
      if (nextMatches.size > 0) {
        resolveMatches(nextMatches, null);
      } else {
        busy = false;
      }
    }, 260);
  }

  function collapseAndRefill() {
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[idx(r, c)] !== null) {
          grid[idx(writeRow, c)] = grid[idx(r, c)];
          if (writeRow !== r) grid[idx(r, c)] = null;
          writeRow--;
        }
      }
      for (let r = writeRow; r >= 0; r--) {
        grid[idx(r, c)] = randomType();
      }
    }
  }

  function renderGridFaces() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = tileEls[idx(r, c)];
        paintTile(tile, grid[idx(r, c)]);
        tile.classList.remove('matched');
        tile.classList.add('falling');
      }
    }
    setTimeout(() => {
      tileEls.forEach((t) => t.classList.remove('falling'));
    }, 230);
  }

  function showScoreFloat(points, cell) {
    if (!cell) return;
    const tile = tileEls[idx(cell.r, cell.c)];
    const float = document.createElement('div');
    float.className = 'score-float';
    float.textContent = '+' + points;
    float.style.left = tile.offsetLeft + tile.offsetWidth / 2 + 'px';
    float.style.top = tile.offsetTop + 'px';
    boardEl.appendChild(float);
    setTimeout(() => float.remove(), 700);
  }

  const TIER_INFO = {
    choco: { label: 'Madeleine au chocolat', sub: 'Score > 600 — un délicieux glaçage bien mérité.' },
    golden: { label: 'Madeleine dorée au four', sub: 'Score > 800 — cuite à la perfection.' },
    queen: { label: 'Reine des Madeleines', sub: 'Score > 1000 — la couronne te revient !' },
  };

  function tierForScore(s) {
    if (s > 1000) return 'queen';
    if (s > 800) return 'golden';
    if (s > 600) return 'choco';
    return null;
  }

  function star(cx, cy, r) {
    return `<path class="sparkle" d="M${cx},${cy - r} L${cx + r * 0.3},${cy - r * 0.3} L${cx + r},${cy} L${cx + r * 0.3},${cy + r * 0.3} L${cx},${cy + r} L${cx - r * 0.3},${cy + r * 0.3} L${cx - r},${cy} L${cx - r * 0.3},${cy - r * 0.3} Z" fill="#fff3b0"/>`;
  }

  function madeleineSVG(tier) {
    const shell = 'M60 82 C24 82 12 54 17 29 C22 9 42 4 60 4 C78 4 98 9 103 29 C108 54 96 82 60 82 Z';
    const ridges = [-30, -15, 0, 15, 30].map((dx) =>
      `<path d="M60,78 Q${60 + dx / 2},40 ${60 + dx},10" stroke="rgba(0,0,0,0.18)" stroke-width="2" fill="none" stroke-linecap="round"/>`
    ).join('');

    const gradients = {
      choco: '<linearGradient id="mgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5636"/><stop offset="1" stop-color="#3c2314"/></linearGradient>',
      golden: '<linearGradient id="mgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#df8f28"/></linearGradient>',
      queen: '<linearGradient id="mgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f0b429"/></linearGradient>',
    };

    let extras = '';
    if (tier === 'choco') {
      extras = `<path d="M22,20 Q35,10 48,22 Q61,34 74,20 Q87,8 100,22" stroke="#f6e6d8" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85"/>`;
    } else if (tier === 'golden') {
      extras = star(14, 16, 5) + star(104, 24, 4) + star(96, 70, 3.5);
    } else if (tier === 'queen') {
      extras = star(18, 14, 4) + star(102, 18, 4) +
        `<path d="M38,4 L44,-16 L60,-2 L76,-16 L82,4 Z" fill="url(#mgrad)" stroke="#b9791a" stroke-width="1.5"/>
         <circle cx="44" cy="-11" r="3" fill="#ff5f6d"/>
         <circle cx="60" cy="-4" r="3.2" fill="#5fb4ff"/>
         <circle cx="76" cy="-11" r="3" fill="#5fe08a"/>`;
    }

    return `<svg viewBox="0 -20 120 106" xmlns="http://www.w3.org/2000/svg">
      <defs>${gradients[tier]}</defs>
      <path d="${shell}" fill="url(#mgrad)" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>
      ${ridges}
      ${extras}
    </svg>`;
  }

  function tick() {
    timeLeft -= 1;
    if (timeLeft < 0) timeLeft = 0;
    timeEl.textContent = timeLeft;
    const pct = (timeLeft / GAME_DURATION) * 100;
    timerBarEl.style.width = pct + '%';
    timerBarEl.classList.toggle('low', timeLeft <= 10);
    if (timeLeft <= 0) {
      endGame();
    }
  }

  function startGame() {
    score = 0;
    timeLeft = GAME_DURATION;
    scoreEl.textContent = '0';
    timeEl.textContent = GAME_DURATION;
    timerBarEl.style.width = '100%';
    timerBarEl.classList.remove('low');
    badgeWrapEl.classList.add('hidden');
    saveAreaEl.classList.add('hidden');
    selected = null;
    busy = false;
    running = true;
    buildInitialGrid();
    renderBoard();
    overlayEl.classList.add('hidden');
    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  function endGame() {
    running = false;
    clearInterval(timerId);
    clearSelection();

    const best = Math.max(score, parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10));
    localStorage.setItem(BEST_SCORE_KEY, String(best));

    overlayTitleEl.textContent = 'Temps écoulé !';
    overlaySubtitleEl.textContent = 'Bien joué, Madeleine ronronne de fierté.';

    const tier = tierForScore(score);
    if (tier) {
      badgeVisualEl.innerHTML = madeleineSVG(tier);
      badgeLabelEl.textContent = TIER_INFO[tier].label;
      badgeSubEl.textContent = TIER_INFO[tier].sub;
      badgeWrapEl.classList.remove('hidden');
    } else {
      badgeWrapEl.classList.add('hidden');
    }

    finalScoreWrapEl.classList.remove('hidden');
    finalScoreEl.textContent = score;
    bestScoreLineEl.textContent = 'Meilleur score : ' + best;
    startBtn.textContent = 'Rejouer';

    pseudoFieldEl.value = '';
    saveStatusEl.textContent = '';
    saveScoreBtn.disabled = false;
    saveAreaEl.classList.remove('hidden');

    overlayEl.classList.remove('hidden');
  }

  startBtn.addEventListener('click', startGame);

  const best = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
  if (best > 0) {
    bestScoreLineEl.textContent = 'Meilleur score : ' + best;
    bestScoreLineEl.classList.remove('hidden');
  }
})();
