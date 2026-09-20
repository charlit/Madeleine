(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const hudEl = document.getElementById('hud');
  const bestEl = document.getElementById('best');
  const overlayEl = document.getElementById('overlay');
  const btnStart = document.getElementById('btnStart');

  const BEST_KEY = 'madeleine_race_best';
  const GROUND_Y = 500;
  const GRAVITY = 1700;
  const JUMP_VELOCITY = -600;
  const CAT_X = 78;
  const CAT_W = 40;
  const CAT_H = 44;
  const BASE_SPEED = 230;
  const MAX_SPEED = 430;

  let state = 'menu'; // 'menu' | 'running' | 'over'
  let score = 0;
  let best = 0;
  let dist = 0;
  let speed = BASE_SPEED;
  let lastTime = 0;

  let catY = 0;       // 0 = grounded, negative = height above ground
  let catVY = 0;
  let jumping = false;
  let runDist = 0;    // used to drive the leg animation cycle

  let obstacles = [];
  let collectibles = [];
  let nextObstacleAt = 0;
  let nextCollectibleAt = 0;

  let farBuildings = [];
  let midBuildings = [];
  let stars = [];

  function readBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10); } catch (e) { return 0; }
  }
  function writeBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------
  // World generation (parallax city layers)
  // ---------------------------------------------------------------------

  function seedSkyline() {
    farBuildings = [];
    let x = 0;
    while (x < W + 400) {
      const w = 60 + Math.random() * 70;
      const h = 120 + Math.random() * 180;
      farBuildings.push({ x, w, h });
      x += w + 10 + Math.random() * 20;
    }
    midBuildings = [];
    x = 0;
    let sinceSign = 0;
    while (x < W + 500) {
      const w = 70 + Math.random() * 60;
      const h = 90 + Math.random() * 130;
      sinceSign++;
      const showSign = sinceSign >= 3 && Math.random() < 0.5;
      if (showSign) sinceSign = 0;
      const windows = [];
      const cols = Math.max(2, Math.floor(w / 18));
      const rows = Math.max(2, Math.floor(h / 22));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.35) windows.push({ c, r });
        }
      }
      midBuildings.push({ x, w, h, windows, cols, rows, sign: showSign });
      x += w + 14 + Math.random() * 24;
    }
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * (H * 0.4), r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2 });
    }
  }

  function wrapLayer(layer, spanPadding) {
    // recycle buildings that have scrolled fully off-screen to the left
    while (layer.length && layer[0].x + layer[0].w < -spanPadding) {
      const b = layer.shift();
      const last = layer[layer.length - 1];
      b.x = last.x + last.w + 12 + Math.random() * 24;
      if (b.windows) {
        b.w = 70 + Math.random() * 60;
        b.h = 90 + Math.random() * 130;
        b.cols = Math.max(2, Math.floor(b.w / 18));
        b.rows = Math.max(2, Math.floor(b.h / 22));
        b.windows = [];
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            if (Math.random() < 0.35) b.windows.push({ c, r });
          }
        }
        b.sign = Math.random() < 0.16;
      } else {
        b.w = 60 + Math.random() * 70;
        b.h = 120 + Math.random() * 180;
      }
      layer.push(b);
    }
  }

  // ---------------------------------------------------------------------
  // Obstacles & collectibles
  // ---------------------------------------------------------------------

  const OBSTACLE_TYPES = ['bollard', 'barrier', 'manhole'];

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    let w, h;
    if (type === 'bollard') { w = 16; h = 44; }
    else if (type === 'barrier') { w = 58; h = 38; }
    else { w = 40; h = 14; }
    obstacles.push({ worldX: nextObstacleAt, type, w, h });
    const gapBase = Math.max(300, 480 - speed * 0.5);
    nextObstacleAt += gapBase + Math.random() * 160;
  }

  function spawnCollectible() {
    const high = Math.random() < 0.4;
    collectibles.push({
      worldX: nextCollectibleAt,
      h: high ? 96 : 34,
      collected: false,
      bob: Math.random() * Math.PI * 2,
    });
    nextCollectibleAt += 220 + Math.random() * 240;
  }

  // ---------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d0a22');
    g.addColorStop(0.55, '#1a1030');
    g.addColorStop(1, '#241531');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // moon
    ctx.save();
    ctx.fillStyle = '#f5e8c8';
    ctx.shadowColor = 'rgba(245,232,200,0.55)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(W - 70, 80, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const s of stars) {
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.tw));
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFarBuildings(scrollX) {
    ctx.fillStyle = '#241a3d';
    for (const b of farBuildings) {
      const sx = b.x - scrollX;
      ctx.fillRect(sx, GROUND_Y - b.h, b.w, b.h);
    }
  }

  function drawSignText(sx, topY, w) {
    const t = 'RIOMS';
    ctx.save();
    ctx.font = '700 15px "Baloo 2", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = sx + w / 2;
    const cy = topY + 12;
    ctx.shadowColor = '#ff5fa2';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd6ea';
    ctx.fillText(t, cx, cy);
    ctx.restore();
  }

  function drawMidBuildings(scrollX) {
    for (const b of midBuildings) {
      const sx = b.x - scrollX;
      if (sx + b.w < -20 || sx > W + 20) continue;
      const topY = GROUND_Y - b.h;
      ctx.fillStyle = '#2f2147';
      ctx.fillRect(sx, topY, b.w, b.h);

      const winW = 8, winH = 10;
      for (const win of b.windows) {
        const wx = sx + 6 + win.c * (winW + 5);
        const wy = topY + 8 + win.r * (winH + 6);
        if (wx > sx + b.w - winW) continue;
        ctx.fillStyle = '#ffdd88';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(wx, wy, winW, winH);
        ctx.globalAlpha = 1;
      }

      if (b.sign) {
        ctx.fillStyle = '#1a1330';
        ctx.fillRect(sx + b.w * 0.12, topY - 22, b.w * 0.76, 22);
        drawSignText(sx + b.w * 0.12, topY - 22, b.w * 0.76);
      }
    }
  }

  function drawGround(scrollX) {
    ctx.fillStyle = '#211a33';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#160f24';
    ctx.fillRect(0, GROUND_Y, W, 6);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    const dashLen = 26, gapLen = 22, period = dashLen + gapLen;
    let off = (-scrollX) % period;
    if (off > 0) off -= period;
    for (let x = off; x < W; x += period) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 24);
      ctx.lineTo(x + dashLen, GROUND_Y + 24);
      ctx.stroke();
    }
  }

  function drawBollard(sx, w, h) {
    const x = sx, y = GROUND_Y;
    ctx.fillStyle = '#e9e6f2';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h + 8);
    ctx.quadraticCurveTo(x, y - h, x + w / 2, y - h);
    ctx.quadraticCurveTo(x + w, y - h, x + w, y - h + 8);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5f5f';
    ctx.fillRect(x, y - h * 0.55, w, h * 0.16);
  }

  function drawBarrier(sx, w, h) {
    const x = sx, y = GROUND_Y;
    ctx.fillStyle = '#4a4358';
    ctx.fillRect(x + 4, y - 10, 4, 10);
    ctx.fillRect(x + w - 8, y - 10, 4, 10);
    const beamY = y - h;
    const beamH = 14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, beamY, w, beamH);
    ctx.clip();
    const stripeW = 12;
    for (let i = -1; i * stripeW < w + beamH; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ff5f5f' : '#f4f1fb';
      ctx.beginPath();
      ctx.moveTo(x + i * stripeW, beamY + beamH);
      ctx.lineTo(x + i * stripeW + beamH, beamY);
      ctx.lineTo(x + i * stripeW + beamH + stripeW, beamY);
      ctx.lineTo(x + i * stripeW + stripeW, beamY + beamH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawManhole(sx, w, h) {
    const x = sx + w / 2, y = GROUND_Y - h / 2;
    ctx.fillStyle = '#0e0a1a';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y - 2, w / 2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a324f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y - 2, w / 2 - 3, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // steam wisps
    const t = performance.now() / 500;
    ctx.strokeStyle = 'rgba(220,220,235,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      const phase = t + i * 1.7;
      const wx = x - 6 + i * 12;
      ctx.beginPath();
      ctx.moveTo(wx, GROUND_Y - 4);
      ctx.quadraticCurveTo(wx + Math.sin(phase) * 6, GROUND_Y - 20, wx + Math.sin(phase * 1.3) * 8, GROUND_Y - 34);
      ctx.stroke();
    }
  }

  function drawObstacle(o, scrollX) {
    const sx = o.worldX - scrollX;
    if (sx < -80 || sx > W + 20) return;
    if (o.type === 'bollard') drawBollard(sx, o.w, o.h);
    else if (o.type === 'barrier') drawBarrier(sx, o.w, o.h);
    else drawManhole(sx, o.w, o.h);
  }

  function drawMadeleineIcon(cx, cy, bob) {
    const y = cy + Math.sin(bob) * 4;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(0.42, 0.42);
    const grad = ctx.createLinearGradient(0, -30, 0, 30);
    grad.addColorStop(0, '#ffd27a');
    grad.addColorStop(1, '#df8f28');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.bezierCurveTo(-36, 30, -48, 2, -43, -23);
    ctx.bezierCurveTo(-38, -43, -18, -48, 0, -48);
    ctx.bezierCurveTo(18, -48, 38, -43, 43, -23);
    ctx.bezierCurveTo(48, 2, 36, 30, 0, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (const dx of [-30, -15, 0, 15, 30]) {
      ctx.beginPath();
      ctx.moveTo(0, 26);
      ctx.quadraticCurveTo(dx / 2, -10, dx, -40);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCollectible(c, scrollX) {
    if (c.collected) return;
    const sx = c.worldX - scrollX;
    if (sx < -30 || sx > W + 30) return;
    drawMadeleineIcon(sx, GROUND_Y - c.h, c.bob);
  }

  function drawTabbyCat(x, footY, runDistance, isJumping) {
    ctx.save();
    ctx.translate(x, footY);

    const bodyLen = 40, bodyH = 20;
    const bodyCX = -4, bodyCY = -CAT_H + 18;
    const strideLen = 34;
    const phase = (runDistance / strideLen) * Math.PI * 2;

    // legs (drawn first, behind body)
    ctx.strokeStyle = '#3f3e46';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const hipY = bodyCY + bodyH / 2 - 2;
    const legPairs = isJumping
      ? [{ hipX: bodyCX - 10, angle: -0.9 }, { hipX: bodyCX + 12, angle: -0.5 }]
      : [
          { hipX: bodyCX - 10, angle: Math.sin(phase) * 0.9 },
          { hipX: bodyCX + 12, angle: Math.sin(phase + Math.PI) * 0.9 },
        ];
    for (const leg of legPairs) {
      const kneeX = leg.hipX + Math.sin(leg.angle) * 14;
      const kneeY = hipY + Math.cos(leg.angle) * 14;
      const footX = leg.hipX + Math.sin(leg.angle) * 22;
      const footY2 = Math.min(0, hipY + Math.cos(leg.angle) * 22);
      ctx.beginPath();
      ctx.moveTo(leg.hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY2);
      ctx.stroke();
    }

    // tail
    const tailSway = Math.sin(performance.now() / 260) * 0.4;
    ctx.strokeStyle = '#9b9aa8';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(bodyCX - bodyLen / 2 + 4, bodyCY);
    ctx.quadraticCurveTo(
      bodyCX - bodyLen / 2 - 16, bodyCY - 6 + tailSway * 10,
      bodyCX - bodyLen / 2 - 10, bodyCY - 26 + tailSway * 14
    );
    ctx.stroke();

    // body
    ctx.fillStyle = '#9b9aa8';
    ctx.beginPath();
    ctx.ellipse(bodyCX, bodyCY, bodyLen / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // tabby stripes
    ctx.strokeStyle = '#3f3e46';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const dx of [-10, 0, 10]) {
      ctx.beginPath();
      ctx.moveTo(bodyCX + dx, bodyCY - bodyH / 2 + 2);
      ctx.quadraticCurveTo(bodyCX + dx + 4, bodyCY, bodyCX + dx, bodyCY + bodyH / 2 - 2);
      ctx.stroke();
    }

    // head
    const headCX = bodyCX + bodyLen / 2 - 2;
    const headCY = bodyCY - bodyH / 2 - 8;
    const headR = 13;
    ctx.fillStyle = '#9b9aa8';
    ctx.beginPath();
    ctx.moveTo(headCX - headR * 0.6, headCY - headR * 0.9);
    ctx.lineTo(headCX - headR * 1.1, headCY - headR * 1.9);
    ctx.lineTo(headCX - headR * 0.1, headCY - headR * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headCX + headR * 0.5, headCY - headR * 0.9);
    ctx.lineTo(headCX + headR * 1.0, headCY - headR * 1.9);
    ctx.lineTo(headCX + headR * 0.05, headCY - headR * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // face
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath();
    ctx.arc(headCX + 5, headCY - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a5962';
    ctx.beginPath();
    ctx.moveTo(headCX + headR - 2, headCY + 3);
    ctx.lineTo(headCX + headR + 3, headCY + 5);
    ctx.lineTo(headCX + headR - 2, headCY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (const dy of [-2, 1, 4]) {
      ctx.beginPath();
      ctx.moveTo(headCX + headR + 2, headCY + dy);
      ctx.lineTo(headCX + headR + 12, headCY + dy - 1);
      ctx.stroke();
    }

    ctx.restore();
  }

  function catFootY() {
    return GROUND_Y + catY;
  }

  // ---------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------

  function resetGame() {
    score = 0;
    dist = 0;
    speed = BASE_SPEED;
    catY = 0;
    catVY = 0;
    jumping = false;
    runDist = 0;
    obstacles = [];
    collectibles = [];
    nextObstacleAt = 520;
    nextCollectibleAt = 260;
    seedSkyline();
  }

  function doJump() {
    if (state !== 'running' || jumping) return;
    jumping = true;
    catVY = JUMP_VELOCITY;
  }

  function checkCollision(box) {
    const catLeft = CAT_X - CAT_W / 2;
    const catRight = CAT_X + CAT_W / 2;
    const catTop = catFootY() - CAT_H;
    const catBottom = catFootY();
    return catRight > box.left && catLeft < box.right && catBottom > box.top && catTop < box.bottom;
  }

  function endGame() {
    state = 'over';
    best = Math.max(best, Math.floor(score));
    writeBest(best);
    bestEl.textContent = 'MEILLEUR ' + best;

    overlayEl.innerHTML =
      '<h1>Aïe ! 🙀</h1>' +
      '<p class="final-label">Score</p>' +
      '<div class="final-score">' + Math.floor(score) + '</div>' +
      '<p style="margin-bottom:18px;">Meilleur score : ' + best + '</p>' +
      '<button id="btnStart" type="button">REJOUER</button>' +
      '<p class="credit"><a href="index.html">← Retour à Madeleine</a></p>';
    overlayEl.classList.remove('hidden');
    document.getElementById('btnStart').addEventListener('click', startGame);
  }

  function startGame() {
    resetGame();
    state = 'running';
    overlayEl.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    speed = Math.min(MAX_SPEED, BASE_SPEED + score * 0.12);
    dist += speed * dt;
    runDist += speed * dt;

    if (jumping) {
      catVY += GRAVITY * dt;
      catY += catVY * dt;
      if (catY >= 0) {
        catY = 0;
        catVY = 0;
        jumping = false;
      }
    }

    while (nextObstacleAt < dist + 700) spawnObstacle();
    while (nextCollectibleAt < dist + 700) spawnCollectible();

    score += dt * 12;

    for (const o of obstacles) {
      const left = o.worldX - dist;
      const right = left + o.w;
      const box = { left, right, top: GROUND_Y - o.h, bottom: GROUND_Y };
      if (checkCollision(box)) {
        endGame();
        return;
      }
    }
    obstacles = obstacles.filter((o) => o.worldX - dist > -100);

    for (const c of collectibles) {
      if (c.collected) continue;
      const left = c.worldX - dist - 14;
      const right = c.worldX - dist + 14;
      const box = { left, right, top: GROUND_Y - c.h - 14, bottom: GROUND_Y - c.h + 14 };
      if (checkCollision(box)) {
        c.collected = true;
        score += 25;
      }
    }
    collectibles = collectibles.filter((c) => c.worldX - dist > -60);

    wrapLayer(farBuildings, 200);
    wrapLayer(midBuildings, 200);

    hudEl.textContent = 'SCORE ' + Math.floor(score);
  }

  function render() {
    drawSky();
    drawFarBuildings(dist * 0.25);
    drawMidBuildings(dist * 0.55);
    drawGround(dist);

    for (const c of collectibles) drawCollectible(c, dist);
    for (const o of obstacles) drawObstacle(o, dist);

    drawTabbyCat(CAT_X, catFootY(), runDist, jumping);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    if (state === 'running') {
      update(dt);
      render();
      requestAnimationFrame(loop);
    } else if (state === 'over') {
      render();
    }
  }

  // input
  function onTap(e) {
    if (state === 'menu') return;
    if (e) e.preventDefault();
    doJump();
  }
  canvas.addEventListener('pointerdown', onTap);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') onTap(e);
  });

  btnStart.addEventListener('click', startGame);

  best = readBest();
  bestEl.textContent = 'MEILLEUR ' + best;
  hudEl.textContent = 'SCORE 0';
  seedSkyline();
  render();
})();
