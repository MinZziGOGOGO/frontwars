// Front Wars Game Engine — Pure game logic, no rendering
// Based on DESIGN.md research document

class Terrain {
  static TYPES = {
    plains:   { defense: 0, moves: { F: 1, T: 1, W: 2 }, color: '#4a7c3f', name: 'Plains' },
    forest:   { defense: 3, moves: { F: 1, T: 2, W: 3 }, color: '#2d5a1e', name: 'Forest' },
    mountain: { defense: 4, moves: { F: 2, T: 99, W: 99 }, color: '#6b6b6b', name: 'Mountain' },
    road:     { defense: 0, moves: { F: 1, T: 1, W: 1 }, color: '#c4a458', name: 'Road' },
    sea:      { defense: 0, moves: { F: 99, T: 99, W: 99 }, color: '#1a4d7e', name: 'Sea' },
    city:     { defense: 3, moves: { F: 1, T: 1, W: 1 }, color: '#8b7355', name: 'City', income: 1000, canBuild: true },
    hq:       { defense: 4, moves: { F: 1, T: 1, W: 1 }, color: '#8b0000', name: 'HQ', income: 2000, canBuild: true },
  };

  constructor(type) {
    this.type = type;
    const def = Terrain.TYPES[type];
    this.defense = def.defense;
    this.moves = def.moves;
    this.color = def.color;
    this.name = def.name;
    this.income = def.income || 0;
    this.canBuild = def.canBuild || false;
  }

  moveCost(moveType) {
    return this.moves[moveType] ?? 99;
  }
}

class UnitTypes {
  static ALL = {
    infantry:  { cost: 1000, move: 3, vision: 2, atk: 1, def: 1, range: 1, moveType: 'F', name: 'Infantry', captures: true, icon: '▲' },
    mech:      { cost: 3000, move: 2, vision: 2, atk: 5, def: 2, range: 1, moveType: 'F', name: 'Mech', captures: true, icon: '◆' },
    recon:     { cost: 4000, move: 8, vision: 5, atk: 3, def: 1, range: 1, moveType: 'W', name: 'Recon', icon: '●' },
    tank:      { cost: 7000, move: 6, vision: 3, atk: 6, def: 3, range: 1, moveType: 'T', name: 'Tank', icon: '■' },
    artillery: { cost: 6000, move: 5, vision: 1, atk: 6, def: 2, range: 3, moveType: 'W', name: 'Artillery', indirect: true, icon: '⬟' },
    anti_air:  { cost: 8000, move: 6, vision: 2, atk: 5, def: 3, range: 1, moveType: 'T', name: 'Anti-Air', icon: '✖' },
    apc:       { cost: 5000, move: 6, vision: 1, atk: 0, def: 1, range: 0, moveType: 'W', name: 'APC', icon: '◇' },
  };

  static get(typeName) { return this.ALL[typeName]; }
}

class Unit {
  static _idCounter = 0;
  constructor(owner, type, x, y) {
    this.id = ++Unit._idCounter;
    this.owner = owner; // 0 = Player 1, 1 = Player 2 / AI
    this.type = type;
    const def = UnitTypes.get(type);
    this.maxHp = 10;
    this.hp = 10;
    this.atk = def.atk;
    this.def = def.def;
    this.moveRange = def.move;
    this.visionRange = def.vision;
    this.atkRange = def.range;
    this.cost = def.cost;
    this.moveType = def.moveType;
    this.name = def.name;
    this.icon = def.icon;
    this.captures = def.captures || false;
    this.indirect = def.indirect || false;
    this.x = x;
    this.y = y;
    this.hasMoved = false;
    this.hasAttacked = false;
    this.kills = 0;
    this.promoted = false;
    if (def.canTransport) this.canTransport = true;
  }
}

class MapGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];
    for (let y = 0; y < height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < width; x++) {
        this.cells[y][x] = { terrain: new Terrain('plains'), unit: null };
      }
    }
  }

  setTerrain(x, y, type) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.cells[y][x].terrain = new Terrain(type);
    }
  }

  placeUnit(unit) {
    const cell = this.cells[unit.y]?.[unit.x];
    if (cell && !cell.unit) {
      cell.unit = unit;
      return true;
    }
    return false;
  }

  removeUnit(x, y) {
    const cell = this.cells[y]?.[x];
    if (cell) {
      cell.unit = null;
    }
  }

  getCell(x, y) {
    return this.cells[y]?.[x] || null;
  }

  isInBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}

// Pre-built maps
MapGrid.map1 = function() {
  const m = new MapGrid(10, 10);
  const setup = [
    'pppppppppp',
    'ppccppccpp',
    'pppppppppp',
    'pppppppppp',
    'pppppppppp',
    'pppppppppp',
    'pppppppppp',
    'ppccppccpp',
    'pppppppppp',
    'pppppppppp',
  ];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const ch = setup[y][x];
      if (ch === 'c') m.setTerrain(x, y, 'city');
    }
  }
  m.setTerrain(0, 0, 'hq');
  m.setTerrain(9, 9, 'hq');
  return m;
};

MapGrid.map2 = function() {
  const m = new MapGrid(15, 15);
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if ((x + y) % 5 === 0 && x > 0 && x < 14 && y > 0 && y < 14) m.setTerrain(x, y, 'city');
      if (x === 7 && y >= 2 && y <= 12) m.setTerrain(x, y, 'mountain');
      if (y === 7 && x >= 2 && x <= 12 && x !== 7) m.setTerrain(x, y, 'forest');
    }
  }
  m.setTerrain(0, 1, 'hq');
  m.setTerrain(14, 13, 'hq');
  return m;
};

MapGrid.map3 = function() {
  const m = new MapGrid(20, 20);
  // Rivers, forests, and scattered cities
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      if ((x + y) % 7 === 0) m.setTerrain(x, y, 'forest');
      if (Math.abs(x - y) < 2 && x > 3 && x < 16) m.setTerrain(x, y, 'sea');
    }
  }
  // Cities in clusters
  const cities = [[3,3],[3,16],[7,8],[7,10],[12,8],[12,12],[16,3],[16,16]];
  cities.forEach(([cx, cy]) => m.setTerrain(cx, cy, 'city'));
  m.setTerrain(1, 1, 'hq');
  m.setTerrain(18, 18, 'hq');
  return m;
};

class GameState {
  constructor(map, playerNames = ['Player', 'AI']) {
    this.map = map;
    this.units = [];
    this.players = [{
      name: playerNames[0], funds: 5000, color: '#4a90d9', alive: true,
    }, {
      name: playerNames[1], funds: 5000, color: '#d94a4a', alive: true,
    }];
    this.currentPlayer = 0;
    this.turn = 0;
    this.phase = 'idle'; // idle, move, attack
    this.selectedUnit = null;
    this.fogOfWar = false;
    this.revealedTiles = {}; // `${x},${y}` → true (persistent)
    this.captureProgress = {}; // `${x},${y}` → { owner, progress }
    this.gameOver = false;
    this.winner = null;
    this.campaignMode = null; // { mission: N, playerKills: Map<unitId, count> }
  }

  addUnit(unit) {
    if (this.map.placeUnit(unit)) {
      this.units.push(unit);
      return true;
    }
    return false;
  }

  getPlayerUnits(playerIndex) {
    return this.units.filter(u => u.owner === playerIndex && u.hp > 0);
  }

  removeDestroyed() {
    this.units = this.units.filter(u => {
      if (u.hp <= 0) {
        this.map.removeUnit(u.x, u.y);
        return false;
      }
      return true;
    });
  }

  getMoveRange(unit) {
    if (!unit || unit.hasMoved) return [];
    const visited = new Map();
    const queue = [{ x: unit.x, y: unit.y, mp: unit.moveRange }];
    const key = (x, y) => `${x},${y}`;
    visited.set(key(unit.x, unit.y), true);

    const valid = [];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    while (queue.length > 0) {
      const { x, y, mp } = queue.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        const nk = key(nx, ny);
        if (!this.map.isInBounds(nx, ny) || visited.has(nk)) continue;
        const cell = this.map.getCell(nx, ny);
        if (!cell) continue;
        const cost = cell.terrain.moveCost(unit.moveType);
        if (cost >= 99) continue;
        const newMp = mp - cost;
        if (newMp < 0) continue;
        if (cell.unit && cell.unit.owner !== unit.owner) continue; // blocked by enemy
        visited.set(nk, true);
        if (newMp >= 0) {
          valid.push({ x: nx, y: ny });
          if (newMp > 0) queue.push({ x: nx, y: ny, mp: newMp });
        }
      }
    }
    return valid.filter(m => !(m.x === unit.x && m.y === unit.y));
  }

  getAttackTargets(unit) {
    if (!unit || unit.hasAttacked || unit.atkRange === 0) return [];
    const targets = [];
    for (const other of this.units) {
      if (other.owner === unit.owner || other.hp <= 0) continue;
      const dist = Math.abs(unit.x - other.x) + Math.abs(unit.y - other.y);
      if (dist > unit.atkRange) continue;
      if (dist === 1) { targets.push(other); continue; }
      // Indirect: line of sight not required for artillery type
      if (unit.indirect) { targets.push(other); continue; }
      // Direct ranged: simple line-of-sight check (no mountains blocking)
      if (this._hasLineOfSight(unit.x, unit.y, other.x, other.y)) {
        targets.push(other);
      }
    }
    return targets;
  }

  _hasLineOfSight(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx - dy, x = x1, y = y1;
    while (x !== x2 || y !== y2) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === x2 && y === y2) break;
      const cell = this.map.getCell(x, y);
      if (cell && cell.terrain.type === 'mountain') return false;
    }
    return true;
  }

  resolveCombat(attacker, defender) {
    const baseDamage = Math.floor(attacker.atk * 0.5 + Math.random() * attacker.atk * 0.5);
    const hpRatio = attacker.hp / attacker.maxHp;
    const defHpMod = defender.hp / defender.maxHp;
    const terrainMod = 1 - (this.map.getCell(defender.x, defender.y)?.terrain.defense * 0.1);
    let damage = Math.max(1, Math.floor(baseDamage * hpRatio * defHpMod * terrainMod));
    defender.hp = Math.max(0, defender.hp - damage);

    let counterDamage = 0;
    if (defender.hp > 0 && defender.atkRange > 0) {
      const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
      if (dist <= defender.atkRange && !(dist > 1 && !defender.indirect)) {
        const counterHp = defender.hp / defender.maxHp;
        counterDamage = Math.max(1, Math.floor(defender.atk * 0.3 * counterHp));
        attacker.hp = Math.max(0, attacker.hp - counterDamage);
      }
    }

    if (defender.hp <= 0) {
      this.map.removeUnit(defender.x, defender.y);
      attacker.kills++;
      if (attacker.kills >= 3 && !attacker.promoted) {
        attacker.promoted = true;
        attacker.atk += 1;
      }
    }

    attacker.hasAttacked = true;
    return { damage, counterDamage, destroyed: defender.hp <= 0 };
  }

  moveUnit(unit, x, y) {
    this.map.removeUnit(unit.x, unit.y);
    unit.x = x;
    unit.y = y;
    unit.hasMoved = true;
    const cell = this.map.getCell(x, y);
    if (cell) cell.unit = unit;

    // Check capture
    if (unit.captures) {
      const t = cell?.terrain;
      if ((t.type === 'city' || t.type === 'hq') && cell.unit === unit) {
        const capKey = `${x},${y}`;
        if (!this.captureProgress[capKey]) this.captureProgress[capKey] = 0;
        this.captureProgress[capKey] += unit.hp;
        if (this.captureProgress[capKey] >= 10) {
          delete this.captureProgress[capKey];
          if (t.type === 'hq') {
            this._declareVictor(unit.owner);
          }
          return { captured: true };
        }
      }
    }
    return { captured: false };
  }

  _declareVictor(playerIndex) {
    this.gameOver = true;
    this.winner = playerIndex;
    this.players[playerIndex ^ 1].alive = false;
  }

  endTurn() {
    // Check for destruction victory
    const p1Units = this.getPlayerUnits(this.currentPlayer ^ 1);
    if (p1Units.length === 0) {
      this._declareVictor(this.currentPlayer);
      return;
    }
    if (this.currentPlayer === 0 && this.getPlayerUnits(1).length === 0) {
      this._declareVictor(0);
      return;
    }

    this.currentPlayer = 1;
    this.turn++;
    this.resetAllUnits();

    if (this.currentPlayer === 1 && !this.gameOver) {
      this.aiTurn();
    }
  }

  resetAllUnits() {
    for (const u of this.units) {
      u.hasMoved = false;
      u.hasAttacked = false;
    }
    this.calculateFunds();
  }

  calculateFunds() {
    const income = this.getPlayerUnits(this.currentPlayer).reduce((sum) => sum, 0);
    // Count owned cities
    let totalIncome = 0;
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        const cell = this.map.getCell(x, y);
        if (!cell) continue;
        const t = cell.terrain;
        let owned = false;
        if (t.type === 'hq') {
          const u = cell.unit;
          owned = u ? (u.owner === this.currentPlayer) : (this.turn < 2);
        }
        if (t.type === 'city') {
          if (cell.unit && cell.unit.captures) {
            owned = cell.unit.owner === this.currentPlayer;
          } else {
            owned = false;
          }
        }
        if (owned && t.income) totalIncome += t.income;
      }
    }
    // Simplification: give base income per turn
    totalIncome += 1000 * (this.currentPlayer === 0 ? 1 : 1);
    this.players[this.currentPlayer].funds += totalIncome;
  }

  buyUnit(typeName, spawnX, spawnY) {
    const p = this.players[this.currentPlayer];
    const def = UnitTypes.get(typeName);
    if (!def || p.funds < def.cost) return null;
    const cell = this.map.getCell(spawnX, spawnY);
    if (!cell || cell.unit) return null;
    if (!cell.terrain.canBuild) return null;
    p.funds -= def.cost;
    const unit = new Unit(this.currentPlayer, typeName, spawnX, spawnY);
    this.addUnit(unit);
    return unit;
  }

  setFogOfWar(enabled) {
    this.fogOfWar = enabled;
  }

  calculateFog() {
    if (!this.fogOfWar) return { visible: null, revealed: null };
    const visible = new Set();
    for (const u of this.getPlayerUnits(this.currentPlayer)) {
      for (let dy = -u.visionRange; dy <= u.visionRange; dy++) {
        for (let dx = -u.visionRange; dx <= u.visionRange; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > u.visionRange) continue;
          const nx = u.x + dx, ny = u.y + dy;
          if (this.map.isInBounds(nx, ny)) {
            const k = `${nx},${ny}`;
            visible.add(k);
            this.revealedTiles[k] = true;
          }
        }
      }
    }
    return { visible, revealed: this.revealedTiles };
  }

  // === AI ===
  aiTurn() {
    const aiUnits = this.getPlayerUnits(1);
    const playerUnits = this.getPlayerUnits(0);

    for (const unit of aiUnits) {
      if (unit.hp <= 0 || unit.hasMoved) continue;

      // Find nearest player unit
      let nearest = null, nearestDist = Infinity;
      for (const pu of playerUnits) {
        const d = Math.abs(unit.x - pu.x) + Math.abs(unit.y - pu.y);
        if (d < nearestDist) { nearestDist = d; nearest = pu; }
      }

      const targets = this.getAttackTargets(unit);
      if (targets.length > 0) {
        if (!unit.hasMoved) {
          // Move toward nearest target if not in range
          if (!targets.includes(nearest) && nearest) {
            const moves = this.getMoveRange(unit);
            if (moves.length > 0) {
              moves.sort((a, b) => {
                const da = Math.abs(a.x - nearest.x) + Math.abs(a.y - nearest.y);
                const db = Math.abs(b.x - nearest.x) + Math.abs(b.y - nearest.y);
                return da - db;
              });
              const best = moves[0];
              this.moveUnit(unit, best.x, best.y);
            }
          }
          // Recheck targets after move
          const newTargets = this.getAttackTargets(unit);
          if (newTargets.length > 0) {
            const t = newTargets.reduce((best, t) =>
              (t.hp < best.hp || (!best) ? t : best), null);
            this.resolveCombat(unit, t);
            this.removeDestroyed();
          }
        } else {
          const t = targets.reduce((best, t) =>
            (t.hp < best.hp || (!best) ? t : best), null);
          this.resolveCombat(unit, t);
          this.removeDestroyed();
        }
      } else {
        // Move toward nearest enemy
        if (nearest) {
          const moves = this.getMoveRange(unit);
          if (moves.length > 0) {
            moves.sort((a, b) => {
              const da = Math.abs(a.x - nearest.x) + Math.abs(a.y - nearest.y);
              const db = Math.abs(b.x - nearest.x) + Math.abs(b.y - nearest.y);
              return da - db;
            });
            this.moveUnit(unit, moves[0].x, moves[0].y);
          }
        }
      }
    }

    // AI buys units if it has funds
    if (this.players[1].funds >= 7000 && this.turn % 2 === 0) {
      // Find a buildable cell
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          const cell = this.map.getCell(x, y);
          if (cell?.terrain.canBuild && !cell.unit) {
            const type = Math.random() > 0.5 ? 'tank' : 'infantry';
            if (this.players[1].funds >= UnitTypes.get(type).cost) {
              this.buyUnit(type, x, y);
            }
            break;
          }
        }
      }
    }

    this.currentPlayer = 0;
    this.turn++;
    this.resetAllUnits();
    this.removeDestroyed();

    // Check victory
    if (this.getPlayerUnits(0).length === 0) {
      this._declareVictor(1);
    }
  }

  // === Serialization ===
  save() {
    return JSON.stringify({
      mapW: this.map.width, mapH: this.map.height,
      cells: this.map.cells.map(row => row.map(c => ({
        terrain: c.terrain.type,
        unit: c.unit ? { id: c.unit.id } : null,
      }))),
      units: this.units.map(u => ({
        id: u.id, owner: u.owner, type: u.type, hp: u.hp,
        x: u.x, y: u.y, hasMoved: u.hasMoved, hasAttacked: u.hasAttacked,
        kills: u.kills, promoted: u.promoted,
      })),
      players: this.players,
      turn: this.turn, currentPlayer: this.currentPlayer,
      fogOfWar: this.fogOfWar, revealedTiles: this.revealedTiles,
      captureProgress: this.captureProgress,
      campaignMode: this.campaignMode,
    });
  }

  static load(json) {
    const data = JSON.parse(json);
    const map = new MapGrid(data.mapW, data.mapH);
    for (let y = 0; y < data.mapH; y++) {
      for (let x = 0; x < data.mapW; x++) {
        if (data.cells[y][x]?.terrain) {
          map.setTerrain(x, y, data.cells[y][x].terrain);
        }
      }
    }
    const state = new GameState(map);
    state.players = data.players;
    state.turn = data.turn;
    state.currentPlayer = data.currentPlayer;
    state.fogOfWar = data.fogOfWar;
    state.revealedTiles = data.revealedTiles || {};
    state.captureProgress = data.captureProgress || {};
    state.campaignMode = data.campaignMode || null;
    state.units = [];
    for (const ud of data.units) {
      const u = new Unit(ud.owner, ud.type, ud.x, ud.y);
      u.id = ud.id;
      u.hp = ud.hp;
      u.hasMoved = ud.hasMoved;
      u.hasAttacked = ud.hasAttacked;
      u.kills = ud.kills;
      u.promoted = ud.promoted;
      state.addUnit(u);
    }
    return state;
  }
}

// === Campaign ===
const Campaign = {
  missions: [
    {
      id: 1, name: 'Boot Camp', map: MapGrid.map1,
      intro: 'Welcome to Front Wars, Commander. The enemy has occupied the western territories. Lead your infantry into your first engagement. Capture the enemy HQ to secure victory.',
      playerUnits: [{ type: 'infantry', x: 1, y: 0 }, { type: 'infantry', x: 1, y: 1 }],
      enemyUnits: [{ type: 'infantry', x: 8, y: 9 }, { type: 'infantry', x: 7, y: 9 }],
      fog: false,
    },
    {
      id: 2, name: 'Armored Advance', map: MapGrid.map2,
      intro: 'Your success has caught the enemy off guard. They\'re reinforcing their position with armor. Deploy your tanks and push through the mountain pass.',
      playerUnits: [{ type: 'tank', x: 1, y: 0 }, { type: 'infantry', x: 0, y: 2 }, { type: 'recon', x: 2, y: 1 }],
      enemyUnits: [{ type: 'tank', x: 13, y: 14 }, { type: 'infantry', x: 14, y: 12 }, { type: 'mech', x: 12, y: 13 }],
      fog: false,
    },
    {
      id: 3, name: 'Fog of War', map: MapGrid.map3,
      intro: 'Intel reports show a large enemy force advancing under cover of darkness. Visibility is limited — watch your flanks. Deploy recon units to scout ahead.',
      playerUnits: [{ type: 'recon', x: 2, y: 0 }, { type: 'tank', x: 1, y: 2 }, { type: 'artillery', x: 0, y: 1 }, { type: 'infantry', x: 2, y: 1 }],
      enemyUnits: [{ type: 'tank', x: 17, y: 19 }, { type: 'artillery', x: 18, y: 17 }, { type: 'infantry', x: 19, y: 18 }, { type: 'anti_air', x: 16, y: 18 }],
      fog: true,
    },
    {
      id: 4, name: 'Naval Blockade', map: MapGrid.map3,
      intro: 'The enemy has fortified their island stronghold. Combined arms are essential — infantry to capture, artillery to bombard, and tanks to break through.',
      playerUnits: [{ type: 'tank', x: 3, y: 1 }, { type: 'artillery', x: 1, y: 3 }, { type: 'infantry', x: 2, y: 0 }, { type: 'anti_air', x: 0, y: 2 }, { type: 'mech', x: 3, y: 2 }],
      enemyUnits: [{ type: 'tank', x: 17, y: 18 }, { type: 'tank', x: 16, y: 19 }, { type: 'artillery', x: 18, y: 16 }, { type: 'infantry', x: 19, y: 17 }, { type: 'mech', x: 17, y: 17 }],
      fog: false,
    },
    {
      id: 5, name: 'Final Stand', map: MapGrid.map3,
      intro: 'This is it, Commander. The enemy has thrown everything at us. All unit types are in play. Destroy their HQ and end this war once and for all.',
      playerUnits: [{ type: 'tank', x: 1, y: 1 }, { type: 'artillery', x: 0, y: 3 }, { type: 'infantry', x: 2, y: 0 }, { type: 'recon', x: 3, y: 1 }, { type: 'anti_air', x: 1, y: 2 }],
      enemyUnits: [{ type: 'tank', x: 18, y: 18 }, { type: 'artillery', x: 19, y: 16 }, { type: 'infantry', x: 17, y: 19 }, { type: 'mech', x: 18, y: 17 }, { type: 'anti_air', x: 16, y: 19 }, { type: 'recon', x: 19, y: 18 }],
      fog: true,
    },
  ],
};
