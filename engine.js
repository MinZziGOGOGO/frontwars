// Front Wars game engine — pure game logic, no rendering.
// Works in the browser (globals) and in Node (module.exports) so it can be unit-tested.

const TERRAIN = {
  plains:   { name: 'Plains',   defense: 1, moves: { F: 1, T: 1, W: 2 } },
  forest:   { name: 'Forest',   defense: 2, moves: { F: 1, T: 2, W: 3 } },
  mountain: { name: 'Mountain', defense: 4, moves: { F: 2 } },
  road:     { name: 'Road',     defense: 0, moves: { F: 1, T: 1, W: 1 } },
  sea:      { name: 'Sea',      defense: 0, moves: {} },
  city:     { name: 'City',     defense: 3, moves: { F: 1, T: 1, W: 1 }, property: true, income: 1000 },
  hq:       { name: 'HQ',       defense: 4, moves: { F: 1, T: 1, W: 1 }, property: true, income: 2000 },
};

// moveType: F = foot, T = tread, W = wheels. minRange > 1 marks indirect (ranged) units.
const UNIT_TYPES = {
  infantry:  { name: 'Infantry',  cost: 1000, move: 3, vision: 2, atk: 3, def: 1, minRange: 1, maxRange: 1, moveType: 'F', captures: true, icon: '▲' },
  mech:      { name: 'Mech',      cost: 3000, move: 2, vision: 2, atk: 5, def: 2, minRange: 1, maxRange: 1, moveType: 'F', captures: true, icon: '◆' },
  recon:     { name: 'Recon',     cost: 4000, move: 8, vision: 5, atk: 4, def: 1, minRange: 1, maxRange: 1, moveType: 'W', icon: '●' },
  tank:      { name: 'Tank',      cost: 7000, move: 6, vision: 3, atk: 6, def: 3, minRange: 1, maxRange: 1, moveType: 'T', icon: '■' },
  artillery: { name: 'Artillery', cost: 6000, move: 5, vision: 1, atk: 6, def: 1, minRange: 2, maxRange: 3, moveType: 'W', icon: '⬟' },
  anti_air:  { name: 'Anti-Air',  cost: 8000, move: 6, vision: 2, atk: 5, def: 3, minRange: 1, maxRange: 1, moveType: 'T', icon: '✖' },
};

const CAPTURE_POINTS = 20;   // a full-HP infantry needs two turns to capture
const STARTING_FUNDS = 5000;
const PROMOTION_KILLS = 3;

const key = (x, y) => `${x},${y}`;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

class Unit {
  static _idCounter = 0;

  constructor(owner, type, x, y) {
    const def = UNIT_TYPES[type];
    if (!def) throw new Error(`Unknown unit type: ${type}`);
    this.id = ++Unit._idCounter;
    this.owner = owner; // 0 = player 1, 1 = player 2 / AI
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = 10;
    this.maxHp = 10;
    this.hasMoved = false;
    this.hasAttacked = false;
    this.kills = 0;
    this.promoted = false;
  }

  get def() { return UNIT_TYPES[this.type]; }
  get name() { return this.def.name; }
  get icon() { return this.def.icon; }
  get atk() { return this.def.atk + (this.promoted ? 1 : 0); }
  get armor() { return this.def.def; }
  get moveRange() { return this.def.move; }
  get visionRange() { return this.def.vision; }
  get indirect() { return this.def.minRange > 1; }
  get captures() { return !!this.def.captures; }
}

class MapGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];
    for (let y = 0; y < height; y++) {
      this.cells.push([]);
      for (let x = 0; x < width; x++) this.cells[y].push({ terrain: 'plains', owner: null, unit: null });
    }
  }

  /** Build a map from ASCII rows. Legend: . plains, f forest, m mountain, r road, s sea,
   *  c neutral city, 1/2 city owned by player 1/2, A/B HQ of player 1/2. */
  static fromRows(rows) {
    const legend = {
      '.': ['plains', null], f: ['forest', null], m: ['mountain', null], r: ['road', null],
      s: ['sea', null], c: ['city', null], 1: ['city', 0], 2: ['city', 1], A: ['hq', 0], B: ['hq', 1],
    };
    const map = new MapGrid(rows[0].length, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const [terrain, owner] = legend[ch];
      map.cells[y][x].terrain = terrain;
      map.cells[y][x].owner = owner;
    }));
    return map;
  }

  inBounds(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
  cell(x, y) { return this.inBounds(x, y) ? this.cells[y][x] : null; }
  terrain(x, y) { return TERRAIN[this.cells[y][x].terrain]; }
  moveCost(x, y, moveType) { return this.terrain(x, y).moves[moveType] ?? Infinity; }
}

const MAPS = {
  skirmish: () => MapGrid.fromRows([
    'A..f......',
    '..c...c...',
    '.ff..r....',
    '.....r..m.',
    '..m..rrrr.',
    '.rrrr..m..',
    '.m..r.....',
    '....r..ff.',
    '...c...c..',
    '......f..B',
  ]),
  mountainPass: () => MapGrid.fromRows([
    '...f...m...f...',
    'A.c....m....c..',
    '.......m.......',
    '..f..c.m.c..f..',
    '.......m.......',
    '.rrrrrrrrrrrrr.',
    '.r..c..m..c..r.',
    '.r.fff.m.fff.r.',
    '.r..c..m..c..r.',
    '.rrrrrrrrrrrrr.',
    '.......m.......',
    '..f..c.m.c..f..',
    '.......m.......',
    '..c....m....c.B',
    '...f...m...f...',
  ]),
  river: () => MapGrid.fromRows([
    '..........f.........',
    '.A..f.........m.....',
    '...c.......c........',
    '...ss...f.......f...',
    '....ss..............',
    '..f..ss....c....m...',
    '......ss............',
    '...c...sr..f....c...',
    '........sr..........',
    '..m......rs....f....',
    '.....f...rs.........',
    '...........ss..c....',
    '..c.....f...ss......',
    '.............ss..f..',
    '....m...c.....ss....',
    '...............ss...',
    '..f.....f.......ss..',
    '...c.........c...s..',
    '.........m........B.',
    '.......f............',
  ]),
};

const CAMPAIGN = [
  {
    name: 'Boot Camp', map: 'skirmish', fog: false,
    intro: 'Welcome, Commander. Two enemy squads hold the eastern plains. Move your infantry onto cities to capture them for income, and take the enemy HQ to win.',
    player: [['infantry', 1, 0], ['infantry', 0, 1]],
    enemy: [['infantry', 8, 9], ['infantry', 9, 8]],
  },
  {
    name: 'Armored Advance', map: 'mountainPass', fog: false,
    intro: 'The enemy is reinforcing with armor. A mountain ridge splits the valley — use the roads to push through and bring your tanks into range.',
    player: [['tank', 1, 0], ['infantry', 0, 2], ['recon', 2, 1]],
    enemy: [['tank', 13, 14], ['infantry', 14, 12], ['mech', 12, 13]],
  },
  {
    name: 'Fog of War', map: 'river', fog: true,
    intro: 'A large force is advancing under cover of darkness. Visibility is limited, so scout ahead with your recon before committing your tanks.',
    player: [['recon', 2, 0], ['tank', 1, 2], ['artillery', 0, 1], ['infantry', 2, 1]],
    enemy: [['tank', 17, 19], ['artillery', 18, 17], ['infantry', 19, 18], ['anti_air', 16, 18]],
  },
  {
    name: 'River Crossing', map: 'river', fog: false,
    intro: 'The enemy has dug in behind the river. Use the bridges, bombard their lines with artillery and send infantry to seize the cities on the far bank.',
    player: [['tank', 3, 1], ['artillery', 1, 3], ['infantry', 2, 0], ['anti_air', 0, 2], ['mech', 3, 2]],
    enemy: [['tank', 17, 18], ['tank', 16, 19], ['artillery', 18, 16], ['infantry', 19, 17], ['mech', 16, 17]],
  },
  {
    name: 'Final Stand', map: 'river', fog: true,
    intro: 'This is it, Commander. The enemy has thrown everything at us. Take their HQ and end this war once and for all.',
    player: [['tank', 1, 1], ['artillery', 0, 3], ['infantry', 2, 0], ['recon', 3, 1], ['anti_air', 1, 2]],
    enemy: [['tank', 18, 17], ['artillery', 19, 16], ['infantry', 17, 19], ['mech', 18, 16], ['anti_air', 16, 19], ['recon', 19, 18]],
  },
];

class GameState {
  constructor(map, { names = ['Player', 'AI'], fog = false } = {}) {
    this.map = map;
    this.units = [];
    this.players = names.map(name => ({ name, funds: STARTING_FUNDS }));
    this.currentPlayer = 0;
    this.day = 1;
    this.fogOfWar = fog;
    this.captureProgress = {}; // tile key → { unitId, points }
    this.gameOver = false;
    this.winner = null;
  }

  // ── Units ──────────────────────────────────────────────────────────────

  addUnit(unit) {
    const cell = this.map.cell(unit.x, unit.y);
    if (!cell || cell.unit || !Number.isFinite(this.map.moveCost(unit.x, unit.y, unit.def.moveType))) return false;
    cell.unit = unit;
    this.units.push(unit);
    return true;
  }

  spawn(owner, type, x, y) {
    const unit = new Unit(owner, type, x, y);
    return this.addUnit(unit) ? unit : null;
  }

  unitsOf(player) { return this.units.filter(u => u.owner === player); }
  unitAt(x, y) { return this.map.cell(x, y)?.unit || null; }

  _removeUnit(unit) {
    this.map.cells[unit.y][unit.x].unit = null;
    this.units = this.units.filter(u => u !== unit);
    this._clearCapture(unit);
  }

  _clearCapture(unit) {
    const k = key(unit.x, unit.y);
    if (this.captureProgress[k]?.unitId === unit.id) delete this.captureProgress[k];
  }

  // ── Movement ───────────────────────────────────────────────────────────

  /** Cheapest movement cost from (x, y) to every reachable tile (Dijkstra). */
  _costField(unit, maxCost, passThroughEnemies = false) {
    const best = new Map([[key(unit.x, unit.y), 0]]);
    const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const { x, y, cost } = queue.shift();
      if (cost > best.get(key(x, y))) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!this.map.inBounds(nx, ny)) continue;
        const other = this.map.cells[ny][nx].unit;
        if (!passThroughEnemies && other && other.owner !== unit.owner) continue;
        const next = cost + this.map.moveCost(nx, ny, unit.def.moveType);
        if (next > maxCost) continue;
        const k = key(nx, ny);
        if (!best.has(k) || next < best.get(k)) {
          best.set(k, next);
          queue.push({ x: nx, y: ny, cost: next });
        }
      }
    }
    return best;
  }

  /** Tiles the unit can end its move on (friendly units can be passed but not stood on). */
  getMoveRange(unit) {
    if (unit.hasMoved || unit.owner !== this.currentPlayer) return [];
    const tiles = [];
    for (const k of this._costField(unit, unit.moveRange).keys()) {
      const [x, y] = k.split(',').map(Number);
      if (!this.map.cells[y][x].unit) tiles.push({ x, y });
    }
    return tiles;
  }

  moveUnit(unit, x, y) {
    if (!this.getMoveRange(unit).some(t => t.x === x && t.y === y)) return false;
    this._clearCapture(unit);
    this.map.cells[unit.y][unit.x].unit = null;
    unit.x = x;
    unit.y = y;
    this.map.cells[y][x].unit = unit;
    unit.hasMoved = true;
    return true;
  }

  /** End a unit's action without moving (e.g. to keep capturing). */
  wait(unit) {
    unit.hasMoved = true;
  }

  // ── Combat ─────────────────────────────────────────────────────────────

  getAttackTargets(unit, from = unit) {
    if (unit.hasAttacked || unit.owner !== this.currentPlayer) return [];
    if (unit.indirect && unit.hasMoved) return []; // ranged units can't move and fire
    return this.units.filter(o => {
      if (o.owner === unit.owner) return false;
      const d = dist(from, o);
      return d >= unit.def.minRange && d <= unit.def.maxRange;
    });
  }

  /** Expected damage in HP points (before the random ±15%). */
  estimateDamage(attacker, defender, attackerHp = attacker.hp) {
    const terrain = this.map.terrain(defender.x, defender.y);
    return attacker.atk * (attackerHp / 10) * (1 - terrain.defense * 0.1) * (1 - defender.armor * 0.1);
  }

  _rollDamage(attacker, defender, attackerHp, rng) {
    const raw = this.estimateDamage(attacker, defender, attackerHp) * (0.85 + rng() * 0.3);
    return Math.max(1, Math.round(raw));
  }

  attack(attacker, defender, rng = Math.random) {
    if (!this.getAttackTargets(attacker).includes(defender)) return null;
    const damage = this._rollDamage(attacker, defender, attacker.hp, rng);
    defender.hp = Math.max(0, defender.hp - damage);

    // Direct-combat units strike back if they survive and the attacker is adjacent
    let counterDamage = 0;
    if (defender.hp > 0 && !defender.indirect && dist(attacker, defender) === 1) {
      counterDamage = this._rollDamage(defender, attacker, defender.hp, rng);
      attacker.hp = Math.max(0, attacker.hp - counterDamage);
    }

    attacker.hasAttacked = true;
    attacker.hasMoved = true;
    const destroyed = defender.hp === 0;
    const attackerDestroyed = attacker.hp === 0;
    if (destroyed) {
      this._removeUnit(defender);
      this._registerKill(attacker);
    }
    if (attackerDestroyed) {
      this._removeUnit(attacker);
      this._registerKill(defender);
    }
    this._checkRout();
    return { damage, counterDamage, destroyed, attackerDestroyed };
  }

  _registerKill(unit) {
    unit.kills++;
    if (unit.kills >= PROMOTION_KILLS) unit.promoted = true;
  }

  // ── Economy ────────────────────────────────────────────────────────────

  incomeOf(player) {
    let total = 0;
    for (const row of this.map.cells) {
      for (const c of row) if (c.owner === player) total += TERRAIN[c.terrain].income || 0;
    }
    return total;
  }

  /** Owned, empty properties where the current player can deploy new units. */
  buildTiles(player = this.currentPlayer) {
    const tiles = [];
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const c = this.map.cells[y][x];
        if (c.owner === player && TERRAIN[c.terrain].property && !c.unit) tiles.push({ x, y });
      }
    }
    return tiles;
  }

  buyUnit(type, x, y) {
    const def = UNIT_TYPES[type];
    const player = this.players[this.currentPlayer];
    if (!def || player.funds < def.cost) return null;
    if (!this.buildTiles().some(t => t.x === x && t.y === y)) return null;
    const unit = this.spawn(this.currentPlayer, type, x, y);
    if (!unit) return null;
    player.funds -= def.cost;
    unit.hasMoved = unit.hasAttacked = true; // new units deploy next turn
    return unit;
  }

  // ── Turns ──────────────────────────────────────────────────────────────

  captureStatus(x, y) {
    const p = this.captureProgress[key(x, y)];
    return p ? p.points : 0;
  }

  _processCaptures() {
    for (const u of this.unitsOf(this.currentPlayer)) {
      const cell = this.map.cells[u.y][u.x];
      if (!u.captures || u.hasAttacked || !TERRAIN[cell.terrain].property || cell.owner === u.owner) continue;
      const k = key(u.x, u.y);
      const progress = this.captureProgress[k]?.unitId === u.id ? this.captureProgress[k].points : 0;
      const points = progress + u.hp;
      if (points >= CAPTURE_POINTS) {
        delete this.captureProgress[k];
        const wasHq = cell.terrain === 'hq';
        cell.owner = u.owner;
        if (wasHq) return this._declareWinner(u.owner);
      } else {
        this.captureProgress[k] = { unitId: u.id, points };
      }
    }
  }

  _checkRout() {
    for (const p of [0, 1]) {
      if (!this.gameOver && this.unitsOf(p).length === 0) this._declareWinner(1 - p);
    }
  }

  _declareWinner(player) {
    this.gameOver = true;
    this.winner = player;
  }

  endTurn() {
    if (this.gameOver) return;
    this._processCaptures();
    if (this.gameOver) return;

    this.currentPlayer = 1 - this.currentPlayer;
    if (this.currentPlayer === 0) this.day++;
    for (const u of this.units) u.hasMoved = u.hasAttacked = false;
    this.players[this.currentPlayer].funds += this.incomeOf(this.currentPlayer);
  }

  // ── Fog of war ─────────────────────────────────────────────────────────

  /** Set of tile keys the given player can see, or null when fog is off. */
  visibleTiles(player) {
    if (!this.fogOfWar) return null;
    const visible = new Set();
    const reveal = (x, y, r) => {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r && this.map.inBounds(x + dx, y + dy)) visible.add(key(x + dx, y + dy));
        }
      }
    };
    for (const u of this.unitsOf(player)) reveal(u.x, u.y, u.visionRange);
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) if (this.map.cells[y][x].owner === player) reveal(x, y, 1);
    }
    return visible;
  }

  // ── AI ─────────────────────────────────────────────────────────────────

  /** Plays the whole turn for the current player and ends it. */
  runAI(rng = Math.random) {
    const me = this.currentPlayer;
    const order = this.unitsOf(me).sort((a, b) => b.indirect - a.indirect);
    for (const unit of order) {
      if (this.gameOver) return;
      if (!this.units.includes(unit)) continue;
      this._aiAct(unit, rng);
    }
    if (this.gameOver) return;
    this._aiBuy(rng);
    this.endTurn();
  }

  _aiScoreAttack(unit, target, from) {
    const dmg = this.estimateDamage(unit, target);
    const kill = dmg >= target.hp ? 10 : 0;
    const counter = target.indirect || dist(from, target) > 1 ? 0 : this.estimateDamage(target, unit, Math.max(0, target.hp - dmg)) * 0.6;
    return dmg * UNIT_TYPES[target.type].cost / 3000 + kill - counter;
  }

  _aiAct(unit, rng) {
    const me = unit.owner;
    const cell = this.map.cells[unit.y][unit.x];

    // Keep capturing if already standing on a property we don't own
    if (unit.captures && TERRAIN[cell.terrain].property && cell.owner !== me) {
      this.wait(unit);
      return;
    }

    // Ranged units: fire if possible, otherwise reposition
    if (unit.indirect) {
      const targets = this.getAttackTargets(unit);
      if (targets.length) {
        const best = targets.reduce((a, b) => (this._aiScoreAttack(unit, a, unit) >= this._aiScoreAttack(unit, b, unit) ? a : b));
        this.attack(unit, best, rng);
        return;
      }
    }

    // Direct units: find the best (tile, target) combination reachable this turn.
    // With a clear numbers advantage the AI also accepts costly trades so it can't stall.
    if (!unit.indirect) {
      const superior = this.unitsOf(me).length >= 2 * this.unitsOf(1 - me).length;
      const minScore = superior ? -3 : 0;
      let bestPlan = null;
      const tiles = [{ x: unit.x, y: unit.y }, ...this.getMoveRange(unit)];
      for (const tile of tiles) {
        for (const target of this.getAttackTargets(unit, tile)) {
          const score = this._aiScoreAttack(unit, target, tile);
          if (score > minScore && (!bestPlan || score > bestPlan.score)) bestPlan = { tile, target, score };
        }
      }
      if (bestPlan) {
        if (bestPlan.tile.x !== unit.x || bestPlan.tile.y !== unit.y) this.moveUnit(unit, bestPlan.tile.x, bestPlan.tile.y);
        this.attack(unit, bestPlan.target, rng);
        return;
      }
    }

    // Otherwise move toward a goal: properties for capturers, enemies for everyone else
    const goals = [];
    if (unit.captures) {
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          const c = this.map.cells[y][x];
          if (TERRAIN[c.terrain].property && c.owner !== me && (!c.unit || c.unit === unit)) goals.push({ x, y, bonus: c.terrain === 'hq' ? 4 : 0 });
        }
      }
    }
    for (const e of this.unitsOf(1 - me)) goals.push({ x: e.x, y: e.y, bonus: 0 });
    if (!goals.length) return this.wait(unit);

    const field = this._costField(unit, Infinity, true);
    const goal = goals.reduce((best, g) => {
      const c = (field.get(key(g.x, g.y)) ?? Infinity) - g.bonus;
      return c < best.c ? { g, c } : best;
    }, { g: null, c: Infinity }).g;
    if (!goal) return this.wait(unit);

    const reverse = this._costField({ x: goal.x, y: goal.y, owner: me, def: unit.def }, Infinity, true);
    const keepAway = unit.indirect ? unit.def.maxRange : 0;
    let best = null;
    for (const t of this.getMoveRange(unit)) {
      const d = reverse.get(key(t.x, t.y)) ?? Infinity;
      const score = keepAway ? Math.abs(dist(t, goal) - keepAway) * 10 + d * 0.1 : d;
      if (!best || score < best.score) best = { t, score };
    }
    const here = reverse.get(key(unit.x, unit.y)) ?? Infinity;
    if (best && (keepAway || best.score < here)) this.moveUnit(unit, best.t.x, best.t.y);
    else this.wait(unit);
  }

  _aiBuy(rng) {
    const me = this.currentPlayer;
    const funds = () => this.players[me].funds;
    const infantry = this.unitsOf(me).filter(u => u.captures).length;
    for (const tile of this.buildTiles(me)) {
      let type;
      if (infantry < 3 && funds() >= 1000) type = 'infantry';
      else {
        const affordable = ['tank', 'artillery', 'anti_air', 'mech', 'recon', 'infantry'].filter(t => UNIT_TYPES[t].cost <= funds());
        if (!affordable.length) break;
        type = affordable[Math.floor(rng() * Math.min(3, affordable.length))];
      }
      if (!this.buyUnit(type, tile.x, tile.y)) break;
    }
  }

  // ── Serialization ──────────────────────────────────────────────────────

  save() {
    return JSON.stringify({
      width: this.map.width,
      height: this.map.height,
      cells: this.map.cells.map(row => row.map(c => [c.terrain, c.owner])),
      units: this.units.map(u => ({
        id: u.id, owner: u.owner, type: u.type, x: u.x, y: u.y, hp: u.hp,
        hasMoved: u.hasMoved, hasAttacked: u.hasAttacked, kills: u.kills, promoted: u.promoted,
      })),
      players: this.players,
      currentPlayer: this.currentPlayer,
      day: this.day,
      fogOfWar: this.fogOfWar,
      captureProgress: this.captureProgress,
    });
  }

  static load(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const map = new MapGrid(data.width, data.height);
    data.cells.forEach((row, y) => row.forEach(([terrain, owner], x) => {
      map.cells[y][x].terrain = terrain;
      map.cells[y][x].owner = owner;
    }));
    const gs = new GameState(map, { names: data.players.map(p => p.name), fog: data.fogOfWar });
    gs.players = data.players;
    gs.currentPlayer = data.currentPlayer;
    gs.day = data.day;
    gs.captureProgress = data.captureProgress || {};
    for (const ud of data.units) {
      const u = new Unit(ud.owner, ud.type, ud.x, ud.y);
      Object.assign(u, ud);
      gs.addUnit(u);
    }
    Unit._idCounter = Math.max(Unit._idCounter, ...data.units.map(u => u.id), 0);
    return gs;
  }
}

/** Create a ready-to-play game for a campaign mission index. */
function createMission(index) {
  const m = CAMPAIGN[index];
  const gs = new GameState(MAPS[m.map](), { names: ['Commander', 'Enemy'], fog: m.fog });
  for (const [type, x, y] of m.player) gs.spawn(0, type, x, y);
  for (const [type, x, y] of m.enemy) gs.spawn(1, type, x, y);
  return gs;
}

/** Create a skirmish game (vs AI or local 2-player). */
function createSkirmish({ twoPlayer = false, fog = !twoPlayer } = {}) {
  const gs = new GameState(MAPS.skirmish(), { names: twoPlayer ? ['Player 1', 'Player 2'] : ['Player', 'AI'], fog });
  gs.spawn(0, 'infantry', 1, 0); gs.spawn(0, 'infantry', 2, 1); gs.spawn(0, 'tank', 0, 1);
  gs.spawn(1, 'infantry', 8, 9); gs.spawn(1, 'infantry', 7, 8); gs.spawn(1, 'tank', 9, 8);
  return gs;
}

if (typeof module !== 'undefined') {
  module.exports = { TERRAIN, UNIT_TYPES, CAPTURE_POINTS, Unit, MapGrid, MAPS, CAMPAIGN, GameState, createMission, createSkirmish };
}
