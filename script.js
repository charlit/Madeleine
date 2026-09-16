(() => {
  const COLS = 6;
  const ROWS = 8;
  const CAT_FACES = ['🐱', '😺', '😸', '😻', '🐈', '🙀'];
  const GAME_DURATION = 45;
  const BEST_SCORE_KEY = 'madeleine_best_score';

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const timerBarEl = document.getElementById('timerBar');
  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const overlaySubtitleEl = document.getElementById('overlaySubtitle');
  const finalScoreWrapEl = document.getElementById('finalScoreWrap');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreLineEl = document.getElementById('bestScoreLine');
  const startBtn = document.getElementById('startBtn');

  let grid = [];
  let tileEls = [];
  let score = 0;
  let timeLeft = GAME_DURATION;
  let timerId = null;
  let selected = null;
  let busy = false;
  let running = false;

  function randomFace(excludeChecks) {
    let face;
    do {
      face = CAT_FACES[Math.floor(Math.random() * CAT_FACES.length)];
    } while (excludeChecks && excludeChecks(face));
    return face;
  }

  function idx(r, c) { return r * COLS + c; }

  function buildInitialGrid() {
    grid = new Array(ROWS * COLS).fill(null);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[idx(r, c)] = randomFace((face) => {
          const left1 = c >= 1 ? grid[idx(r, c - 1)] : null;
          const left2 = c >= 2 ? grid[idx(r, c - 2)] : null;
          const up1 = r >= 1 ? grid[idx(r - 1, c)] : null;
          const up2 = r >= 2 ? grid[idx(r - 2, c)] : null;
          return (face === left1 && face === left2) || (face === up1 && face === up2);
        });
      }
    }
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
        tile.textContent = grid[idx(r, c)];
        tile.addEventListener('click', onTileClick);
        boardEl.appendChild(tile);
        tileEls[idx(r, c)] = tile;
      }
    }
  }

  function syncTileFace(r, c) {
    const tile = tileEls[idx(r, c)];
    tile.textContent = grid[idx(r, c)] || '';
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
        grid[idx(r, c)] = randomFace();
      }
    }
  }

  function renderGridFaces() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = tileEls[idx(r, c)];
        tile.textContent = grid[idx(r, c)];
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
    finalScoreWrapEl.classList.remove('hidden');
    finalScoreEl.textContent = score;
    bestScoreLineEl.textContent = 'Meilleur score : ' + best;
    startBtn.textContent = 'Rejouer';
    overlayEl.classList.remove('hidden');
  }

  startBtn.addEventListener('click', startGame);

  const best = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
  if (best > 0) {
    bestScoreLineEl.textContent = 'Meilleur score : ' + best;
    bestScoreLineEl.classList.remove('hidden');
  }
})();
