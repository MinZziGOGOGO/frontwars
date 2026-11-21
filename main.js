// Front Wars — rendering, input and game flow. Game rules live in engine.js.

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');

const SAVE_KEY = 'frontwars_save';
const CAMPAIGN_KEY = 'frontwars_campaign';
const TERRAIN_COLORS = { plains: '#4a7c3f', forest: '#2d5a1e', mountain: '#6b6b6b', road: '#b39a5a', sea: '#1a4d7e', city: '#8b7355', hq: '#7a3b2e' };
const PLAYER_COLORS = ['#4a90d9', '#d94a4a'];
const NEUTRAL_COLOR = '#bbbbbb';

let T = 56;                        // tile size in pixels
let gs = null;                     // current GameState
let mode = null;                   // 'ai' | 'hotseat' | 'campaign'
let missionIndex = 0;
let sel = null, moves = [], targets = [];
let buildTile = null;
let vx = 0, vy = 0;                // camera offset
let floating = [];                 // damage numbers and labels
let busy = false;                  // true while the AI is playing

// ── Storage helpers (storage can be unavailable, e.g. in private windows) ──
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// The player whose view we render (fog of war, "your turn")
const viewer = () => (mode === 'hotseat' ? gs.currentPlayer : 0);
// A unit is finished once it attacked, or moved and has nothing left to shoot at
const isDone = u => u.hasAttacked || (u.hasMoved && !gs.getAttackTargets(u).length);
const isHumanTurn = () => gs && !gs.gameOver && !busy && (mode === 'hotseat' || gs.currentPlayer === 0);

// ── Game setup ─────────────────────────────────────────────────────────

function startGame(state, newMode) {
  gs = state;
  mode = newMode;
  sel = null; moves = []; targets = []; buildTile = null; floating = [];
  for (const o of ['menu', 'mission', 'game-over', 'handover']) $(o).classList.remove('show');
  resize();
  centerOn(gs.unitsOf(viewer())[0]);
  save();
  render();
  if (mode === 'hotseat') showHandover();
}

function startSkirmish() { startGame(createSkirmish({ fog: $('opt-fog').checked }), 'ai'); }
function startHotseat() { startGame(createSkirmish({ twoPlayer: true }), 'hotseat'); }

function showMission(index) {
  missionIndex = index;
  const m = CAMPAIGN[index];
  $('mission-title').textContent = `Mission ${index + 1}/${CAMPAIGN.length}: ${m.name}`;
  $('mission-text').textContent = m.intro;
  for (const o of ['menu', 'game-over']) $(o).classList.remove('show');
  $('mission').classList.add('show');
}

function startCampaign() {
  const unlocked = Number(store.get(CAMPAIGN_KEY)) || 0;
  showMission(Math.min(unlocked, CAMPAIGN.length - 1));
}

function showMenu() {
  gs = null;
  closeBuyPanel();
  for (const o of ['mission', 'game-over', 'handover']) $(o).classList.remove('show');
  $('btn-continue').style.display = store.get(SAVE_KEY) ? '' : 'none';
  $('menu').classList.add('show');
}

function save() {
  if (!gs || gs.gameOver) return store.del(SAVE_KEY);
  store.set(SAVE_KEY, JSON.stringify({ state: gs.save(), mode, missionIndex }));
}

function loadSaved() {
  try {
    const data = JSON.parse(store.get(SAVE_KEY));
    missionIndex = data.missionIndex || 0;
    startGame(GameState.load(data.state), data.mode);
    if (data.mode === 'ai' && gs.currentPlayer === 1) runAI();
  } catch (e) {
    console.error('Could not load save:', e);
    store.del(SAVE_KEY);
    showMenu();
  }
}

// ── Turn flow ──────────────────────────────────────────────────────────

function endTurn() {
  if (!isHumanTurn()) return;
  deselect();
  gs.endTurn();
  afterTurn();
}

function afterTurn() {
  save();
  render();
  if (gs.gameOver) return showGameOver();
  if (mode === 'hotseat') showHandover();
  else if (gs.currentPlayer === 1) runAI();
  else centerOn(gs.unitsOf(0)[0]);
}

function runAI() {
  busy = true;
  render();
  // Short pause so the "enemy turn" state is visible before the board changes
  setTimeout(() => {
    const before = new Map(gs.units.map(u => [u.id, u.hp]));
    gs.runAI();
    for (const u of gs.units) {
      const old = before.get(u.id);
      if (old !== undefined && u.hp < old) addFloating(u.x, u.y, `-${old - u.hp}`, '#ff6b6b');
    }
    busy = false;
    afterTurn();
  }, 400);
}

function showHandover() {
  $('handover-title').textContent = `${gs.players[gs.currentPlayer].name} — Day ${gs.day}`;
  $('handover-title').style.color = PLAYER_COLORS[gs.currentPlayer];
  $('handover').classList.add('show');
}

function showGameOver() {
  store.del(SAVE_KEY);
  const won = gs.winner === 0;
  const title = $('go-title');
  let next = false;
  if (mode === 'hotseat') {
    title.textContent = `${gs.players[gs.winner].name.toUpperCase()} WINS!`;
  } else {
    title.textContent = won ? 'VICTORY!' : 'DEFEAT';
  }
  title.style.color = PLAYER_COLORS[gs.winner];
  $('go-sub').textContent = `${gs.players[gs.winner].name} conquered the battlefield on day ${gs.day}.`;
  if (mode === 'campaign' && won) {
    const unlocked = Math.max(Number(store.get(CAMPAIGN_KEY)) || 0, missionIndex + 1);
    store.set(CAMPAIGN_KEY, String(Math.min(unlocked, CAMPAIGN.length - 1)));
    next = missionIndex + 1 < CAMPAIGN.length;
    if (!next) $('go-sub').textContent = 'Campaign complete — every mission won!';
  }
  $('btn-next').style.display = next ? '' : 'none';
  $('btn-restart').textContent = mode === 'campaign' ? 'Replay Mission' : 'Play Again';
  $('game-over').classList.add('show');
}

// ── Selection and actions ──────────────────────────────────────────────

function visibleSet() { return gs.visibleTiles(viewer()); }
function isVisible(x, y, vis = visibleSet()) { return !vis || vis.has(`${x},${y}`); }

function select(unit) {
  sel = unit;
  moves = gs.getMoveRange(unit);
  const vis = visibleSet();
  targets = gs.getAttackTargets(unit).filter(t => isVisible(t.x, t.y, vis));
  closeBuyPanel();
}

function deselect() {
  sel = null; moves = []; targets = [];
  closeBuyPanel();
}

function waitSelected() {
  if (!sel) return;
  gs.wait(sel);
  deselect();
  render();
}

function onTileClick(x, y) {
  if (!isHumanTurn() || !gs.map.inBounds(x, y)) return;
  const me = gs.currentPlayer;
  const unit = gs.unitAt(x, y);

  if (sel && targets.some(t => t.x === x && t.y === y)) {
    const target = unit;
    const res = gs.attack(sel, target);
    addFloating(x, y, `-${res.damage}`, '#ff6b6b');
    if (res.counterDamage) addFloating(sel.x, sel.y, `-${res.counterDamage}`, '#ff6b6b');
    deselect();
    save();
    render();
    if (gs.gameOver) showGameOver();
    return;
  }

  if (sel && moves.some(m => m.x === x && m.y === y)) {
    gs.moveUnit(sel, x, y);
    const moved = sel;
    select(moved);
    if (!targets.length) deselect();
    render();
    return;
  }

  if (sel && unit === sel) return waitSelected();

  if (unit && unit.owner === me && !isDone(unit)) {
    select(unit);
    render();
    return;
  }

  const cell = gs.map.cell(x, y);
  if (!unit && cell.owner === me && TERRAIN[cell.terrain].property) {
    deselect();
    openBuyPanel(x, y);
    render();
    return;
  }

  // Clicking anything else shows info about it (enemy units) or clears the selection
  deselect();
  render(unit && isVisible(x, y) ? unit : null);
}

function openBuyPanel(x, y) {
  buildTile = { x, y };
  const funds = gs.players[gs.currentPlayer].funds;
  const panel = $('buy-panel');
  panel.innerHTML = '';
  for (const [type, def] of Object.entries(UNIT_TYPES)) {
    const b = document.createElement('button');
    b.innerHTML = `${def.icon} ${def.name}<br>$${def.cost}`;
    b.disabled = def.cost > funds;
    b.onclick = () => {
      const u = gs.buyUnit(type, x, y);
      if (u) addFloating(x, y, 'DEPLOYED', '#9be38a');
      closeBuyPanel();
      save();
      render();
    };
    panel.appendChild(b);
  }
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.onclick = () => { closeBuyPanel(); render(); };
  panel.appendChild(cancel);
  panel.classList.add('show');
}

function closeBuyPanel() {
  buildTile = null;
  $('buy-panel').classList.remove('show');
}

// ── Floating labels ────────────────────────────────────────────────────

let animating = false;
function addFloating(x, y, text, color) {
  floating.push({ x, y, text, color, life: 45 });
  if (!animating) {
    animating = true;
    requestAnimationFrame(tick);
  }
}
function tick() {
  floating.forEach(f => f.life--);
  floating = floating.filter(f => f.life > 0);
  render();
  if (floating.length) requestAnimationFrame(tick);
  else animating = false;
}

// ── Rendering ──────────────────────────────────────────────────────────

function resize() {
  T = window.innerWidth < 700 ? 44 : 56;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  clampCamera();
}

function clampCamera() {
  if (!gs) return;
  const maxX = gs.map.width * T - canvas.width, maxY = gs.map.height * T - canvas.height;
  vx = maxX > 0 ? Math.max(0, Math.min(vx, maxX)) : maxX / 2;
  vy = maxY > 0 ? Math.max(0, Math.min(vy, maxY)) : maxY / 2;
}

function centerOn(unit) {
  if (!unit) return;
  vx = unit.x * T + T / 2 - canvas.width / 2;
  vy = unit.y * T + T / 2 - canvas.height / 2;
  clampCamera();
}

function drawProperty(cell, sx, sy) {
  const color = cell.owner === null ? NEUTRAL_COLOR : PLAYER_COLORS[cell.owner];
  if (cell.terrain === 'city') {
    ctx.fillStyle = 'rgba(30,25,20,.55)';
    ctx.fillRect(sx + T * .22, sy + T * .42, T * .56, T * .38);
    ctx.fillRect(sx + T * .34, sy + T * .24, T * .32, T * .2);
    ctx.fillStyle = color;
    ctx.fillRect(sx + T * .22, sy + T * .76, T * .56, T * .06);
  } else {
    ctx.fillStyle = 'rgba(30,25,20,.6)';
    ctx.fillRect(sx + T * .2, sy + T * .5, T * .6, T * .32);
    ctx.fillStyle = '#c4a458';
    ctx.fillRect(sx + T * .47, sy + T * .12, 2, T * .4);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  const fx = cell.terrain === 'city' ? sx + T * .5 : sx + T * .49;
  const fy = cell.terrain === 'city' ? sy + T * .08 : sy + T * .12;
  ctx.moveTo(fx, fy); ctx.lineTo(fx + T * .28, fy + T * .09); ctx.lineTo(fx, fy + T * .18);
  ctx.fill();
}

function drawTerrainDetail(type, sx, sy) {
  if (type === 'forest') {
    ctx.fillStyle = '#1f4214';
    for (const [ox, oy] of [[.3, .35], [.62, .3], [.46, .62]]) {
      ctx.beginPath();
      ctx.moveTo(sx + T * ox, sy + T * (oy - .15));
      ctx.lineTo(sx + T * (ox + .13), sy + T * (oy + .1));
      ctx.lineTo(sx + T * (ox - .13), sy + T * (oy + .1));
      ctx.fill();
    }
  } else if (type === 'mountain') {
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.moveTo(sx + T * .5, sy + T * .15); ctx.lineTo(sx + T * .85, sy + T * .8); ctx.lineTo(sx + T * .15, sy + T * .8);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(sx + T * .5, sy + T * .15); ctx.lineTo(sx + T * .6, sy + T * .35); ctx.lineTo(sx + T * .4, sy + T * .35);
    ctx.fill();
  }
}

function render(inspect = null) {
  if (!gs) return;
  const { width, height } = gs.map;
  const vis = visibleSet();
  ctx.fillStyle = '#1a1f1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Terrain
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x * T - vx, sy = y * T - vy;
      if (sx < -T || sx > canvas.width || sy < -T || sy > canvas.height) continue;
      const cell = gs.map.cells[y][x];
      ctx.fillStyle = TERRAIN_COLORS[cell.terrain];
      ctx.fillRect(sx, sy, T, T);
      drawTerrainDetail(cell.terrain, sx, sy);
      if (TERRAIN[cell.terrain].property) drawProperty(cell, sx, sy);
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, T, T);
      const cap = gs.captureStatus(x, y);
      if (cap && isVisible(x, y, vis)) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${T * .2}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`${cap}/${CAPTURE_POINTS}`, sx + T - 3, sy + T * .2);
      }
      if (!isVisible(x, y, vis)) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(sx, sy, T, T);
      }
    }
  }

  // Highlights
  const tile = (list, fill, stroke) => {
    for (const m of list) {
      const sx = m.x * T - vx, sy = m.y * T - vy;
      ctx.fillStyle = fill; ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4);
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(sx + 2, sy + 2, T - 4, T - 4);
    }
  };
  tile(moves, 'rgba(74,144,217,.3)', 'rgba(120,180,255,.7)');
  tile(targets, 'rgba(217,74,74,.35)', 'rgba(255,110,110,.8)');
  if (buildTile) tile([buildTile], 'rgba(196,164,88,.35)', 'rgba(230,200,120,.9)');

  // Units
  for (const u of gs.units) {
    if (!isVisible(u.x, u.y, vis)) continue;
    const cx = u.x * T - vx + T / 2, cy = u.y * T - vy + T / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, T * .34, 0, Math.PI * 2);
    ctx.fillStyle = PLAYER_COLORS[u.owner];
    ctx.fill();
    ctx.strokeStyle = u === sel ? '#ffd966' : '#111';
    ctx.lineWidth = u === sel ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${T * .3}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.icon, cx, cy + 1);
    if (u.owner === gs.currentPlayer && isDone(u) && !busy) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.arc(cx, cy, T * .34, 0, Math.PI * 2); ctx.fill();
    }
    if (u.hp < u.maxHp) {
      ctx.fillStyle = '#111';
      ctx.fillRect(cx + T * .12, cy + T * .14, T * .3, T * .26);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${T * .22}px monospace`;
      ctx.fillText(u.hp, cx + T * .27, cy + T * .28);
    }
    if (u.promoted) {
      ctx.fillStyle = '#ffd966';
      ctx.font = `${T * .22}px monospace`;
      ctx.fillText('★', cx - T * .26, cy - T * .26);
    }
  }
  ctx.textBaseline = 'alphabetic';

  // Floating labels
  for (const f of floating) {
    ctx.globalAlpha = Math.min(1, f.life / 20);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x * T - vx + T / 2, f.y * T - vy + T * .2 - (45 - f.life) * .5);
  }
  ctx.globalAlpha = 1;

  renderMinimap(vis);
  renderSidebar(inspect);
}

function renderMinimap(vis) {
  const { width, height } = gs.map;
  const s = Math.min(mini.width / width, mini.height / height);
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, mini.width, mini.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = gs.map.cells[y][x];
      mctx.fillStyle = c.owner !== null ? PLAYER_COLORS[c.owner] : TERRAIN_COLORS[c.terrain];
      mctx.fillRect(x * s, y * s, s, s);
      if (!isVisible(x, y, vis)) { mctx.fillStyle = 'rgba(0,0,0,.5)'; mctx.fillRect(x * s, y * s, s, s); }
    }
  }
  for (const u of gs.units) {
    if (!isVisible(u.x, u.y, vis)) continue;
    mctx.fillStyle = PLAYER_COLORS[u.owner];
    mctx.beginPath(); mctx.arc(u.x * s + s / 2, u.y * s + s / 2, s * .4, 0, Math.PI * 2); mctx.fill();
  }
  mctx.strokeStyle = '#c4a458';
  mctx.strokeRect(vx / T * s, vy / T * s, canvas.width / T * s, canvas.height / T * s);
}

function renderSidebar(inspect) {
  const p = gs.players[gs.currentPlayer];
  const turnEl = $('turn');
  turnEl.style.color = PLAYER_COLORS[gs.currentPlayer];
  turnEl.textContent = busy ? `Day ${gs.day} · ENEMY TURN…` : `Day ${gs.day} · ${p.name.toUpperCase()}`;
  const shown = gs.players[viewer()];
  $('funds').innerHTML = `$${shown.funds} <small>+${gs.incomeOf(viewer())}/turn</small>`;
  $('btn-end').disabled = !isHumanTurn();
  $('btn-wait').disabled = !sel;

  const u = inspect || sel;
  const info = $('info');
  if (u) {
    const pct = u.hp / u.maxHp;
    const color = pct > .6 ? '#4a7c3f' : pct > .3 ? '#c4a458' : '#d94a4a';
    const terrain = TERRAIN[gs.map.cells[u.y][u.x].terrain];
    const range = u.indirect ? `${u.def.minRange}-${u.def.maxRange}` : '1';
    info.innerHTML = `<b>${u.name}</b> <span style="color:${PLAYER_COLORS[u.owner]}">${gs.players[u.owner].name}</span> ${u.promoted ? '★' : ''}`
      + `<span class="hp"><i style="width:${pct * 100}%;background:${color}"></i></span>`
      + `HP ${u.hp}/${u.maxHp} · ATK ${u.atk} · DEF ${u.armor}<br>`
      + `Move ${u.moveRange} · Range ${range} · Vision ${u.visionRange}<br>`
      + `On ${terrain.name} (+${terrain.defense * 10}% def) · Kills ${u.kills}`;
  } else {
    info.textContent = isHumanTurn() ? 'Select a unit, or click one of your empty cities / your HQ to buy units.' : 'Waiting…';
  }
}

// ── Input ──────────────────────────────────────────────────────────────

let drag = null;
canvas.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, vx, vy, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || !gs) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
  if (drag.moved) {
    vx = drag.vx - dx; vy = drag.vy - dy;
    clampCamera();
    render();
  }
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const wasDrag = drag.moved;
  drag = null;
  if (wasDrag || !gs) return;
  const r = canvas.getBoundingClientRect();
  onTileClick(Math.floor((e.clientX - r.left + vx) / T), Math.floor((e.clientY - r.top + vy) / T));
});
canvas.addEventListener('wheel', e => {
  if (!gs) return;
  e.preventDefault();
  vx += e.deltaX || (e.shiftKey ? e.deltaY : 0);
  vy += e.shiftKey ? 0 : e.deltaY;
  clampCamera();
  render();
}, { passive: false });

document.addEventListener('keydown', e => {
  if (!gs) return;
  if (e.key === 'Escape') { deselect(); render(); }
  if (e.key === 'w' || e.key === 'W') waitSelected();
  if (e.key === 'e' || e.key === 'E') endTurn();
});

$('btn-end').onclick = endTurn;
$('btn-wait').onclick = waitSelected;
$('btn-menu-side').onclick = () => { save(); showMenu(); };
$('btn-skirmish').onclick = startSkirmish;
$('btn-campaign').onclick = startCampaign;
$('btn-hotseat').onclick = startHotseat;
$('btn-continue').onclick = loadSaved;
$('btn-mission-start').onclick = () => startGame(createMission(missionIndex), 'campaign');
$('btn-handover').onclick = () => { $('handover').classList.remove('show'); centerOn(gs.unitsOf(gs.currentPlayer)[0]); render(); };
$('btn-next').onclick = () => showMission(missionIndex + 1);
$('btn-restart').onclick = () => {
  if (mode === 'campaign') showMission(missionIndex);
  else if (mode === 'hotseat') startHotseat();
  else startSkirmish();
};
$('btn-menu').onclick = showMenu;
window.addEventListener('resize', () => { resize(); render(); });

showMenu();
