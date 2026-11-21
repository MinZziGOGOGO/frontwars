// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const {
  UNIT_TYPES, CAMPAIGN, MAPS, MapGrid, GameState, Unit, createMission, createSkirmish,
} = require('../engine.js');

const noLuck = () => 0.5; // removes the ±15% damage roll

function tinyGame(rows = ['A....', '.....', '..c..', '.....', '....B']) {
  return new GameState(MapGrid.fromRows(rows), { names: ['P1', 'P2'] });
}

test('every map row has the same width and only known tiles', () => {
  for (const [name, build] of Object.entries(MAPS)) {
    const map = build();
    assert.ok(map.width > 0 && map.height > 0, name);
  }
});

test('every campaign mission places all of its units', () => {
  CAMPAIGN.forEach((mission, i) => {
    const gs = createMission(i);
    assert.strictEqual(gs.units.length, mission.player.length + mission.enemy.length, mission.name);
  });
});

test('every mission has one HQ per side and the enemy HQ is reachable on foot', () => {
  CAMPAIGN.forEach((mission, i) => {
    const gs = createMission(i);
    const hqs = [];
    gs.map.cells.forEach((row, y) => row.forEach((c, x) => { if (c.terrain === 'hq') hqs.push({ x, y, owner: c.owner }); }));
    assert.deepStrictEqual(hqs.map(h => h.owner).sort(), [0, 1], mission.name);
    const infantry = gs.unitsOf(0).find(u => u.captures);
    const enemyHq = hqs.find(h => h.owner === 1);
    const field = gs._costField(infantry, Infinity, true);
    assert.ok(field.has(`${enemyHq.x},${enemyHq.y}`), `${mission.name}: enemy HQ unreachable`);
  });
});

test('movement respects range and terrain cost', () => {
  const gs = tinyGame(['A.m..', '.....', '.....', '.....', '....B']);
  const tank = gs.spawn(0, 'tank', 0, 1);
  const tiles = gs.getMoveRange(tank);
  assert.ok(!tiles.some(t => t.x === 2 && t.y === 0), 'tanks cannot enter mountains');
  const inf = gs.spawn(0, 'infantry', 1, 0);
  assert.ok(gs.getMoveRange(inf).some(t => t.x === 2 && t.y === 0), 'infantry can climb mountains');
});

test('units can pass through friends but never end on an occupied tile', () => {
  const gs = tinyGame();
  const a = gs.spawn(0, 'infantry', 0, 1);
  gs.spawn(0, 'infantry', 1, 1);
  const tiles = gs.getMoveRange(a);
  assert.ok(!tiles.some(t => t.x === 1 && t.y === 1));
  assert.ok(tiles.some(t => t.x === 2 && t.y === 1));
  assert.strictEqual(gs.moveUnit(a, 1, 1), false);
  assert.strictEqual(gs.units.length, 2);
});

test('enemy units block movement', () => {
  const gs = tinyGame(['A....', 'mmm.m', '.....', '.....', '....B']);
  const inf = gs.spawn(0, 'infantry', 3, 0);
  gs.spawn(1, 'infantry', 3, 1);
  assert.ok(!gs.getMoveRange(inf).some(t => t.y >= 2 && t.x === 3));
});

test('attacking deals damage and the defender counter-attacks', () => {
  const gs = tinyGame();
  const tank = gs.spawn(0, 'tank', 1, 1);
  const enemy = gs.spawn(1, 'tank', 2, 1);
  const res = gs.attack(tank, enemy, noLuck);
  assert.ok(res.damage > 0);
  assert.ok(res.counterDamage > 0);
  assert.strictEqual(enemy.hp, 10 - res.damage);
  assert.strictEqual(tank.hp, 10 - res.counterDamage);
  assert.strictEqual(gs.attack(tank, enemy, noLuck), null, 'only one attack per turn');
});

test('artillery fires at range 2-3, not adjacent, and cannot move and fire', () => {
  const gs = tinyGame();
  const art = gs.spawn(0, 'artillery', 0, 1);
  const near = gs.spawn(1, 'infantry', 1, 1);
  const far = gs.spawn(1, 'infantry', 3, 1);
  const targets = gs.getAttackTargets(art);
  assert.ok(targets.includes(far));
  assert.ok(!targets.includes(near));
  const res = gs.attack(art, far, noLuck);
  assert.strictEqual(res.counterDamage, 0, 'no counter against ranged attacks');

  const art2 = gs.spawn(0, 'artillery', 0, 3);
  gs.moveUnit(art2, 0, 4);
  assert.deepStrictEqual(gs.getAttackTargets(art2), []);
});

test('destroying the last enemy unit wins the game', () => {
  const gs = tinyGame();
  const tank = gs.spawn(0, 'tank', 1, 1);
  const enemy = gs.spawn(1, 'infantry', 2, 1);
  enemy.hp = 1;
  gs.attack(tank, enemy, noLuck);
  assert.strictEqual(gs.gameOver, true);
  assert.strictEqual(gs.winner, 0);
});

test('capturing a city takes two turns at full HP and adds income', () => {
  const gs = tinyGame();
  gs.spawn(1, 'infantry', 4, 3);
  const inf = gs.spawn(0, 'infantry', 2, 1);
  gs.moveUnit(inf, 2, 2);
  gs.endTurn(); // P1 ends: 10/20
  assert.strictEqual(gs.captureStatus(2, 2), 10);
  assert.strictEqual(gs.map.cell(2, 2).owner, null);
  gs.endTurn(); // P2
  gs.wait(inf);
  gs.endTurn(); // P1 ends: 20/20 → captured
  assert.strictEqual(gs.map.cell(2, 2).owner, 0);
  assert.strictEqual(gs.incomeOf(0), 2000 + 1000);
});

test('moving away resets capture progress', () => {
  const gs = tinyGame();
  gs.spawn(1, 'infantry', 4, 3);
  const inf = gs.spawn(0, 'infantry', 2, 1);
  gs.moveUnit(inf, 2, 2);
  gs.endTurn();
  gs.endTurn();
  gs.moveUnit(inf, 1, 2);
  assert.strictEqual(gs.captureStatus(2, 2), 0);
});

test('standing on your own HQ does not win the game', () => {
  const gs = tinyGame();
  gs.spawn(1, 'infantry', 4, 3);
  const inf = gs.spawn(0, 'infantry', 1, 0);
  gs.moveUnit(inf, 0, 0);
  gs.endTurn(); gs.endTurn(); gs.endTurn();
  assert.strictEqual(gs.gameOver, false);
});

test('capturing the enemy HQ wins the game', () => {
  const gs = tinyGame();
  gs.spawn(1, 'tank', 0, 4);
  const inf = gs.spawn(0, 'infantry', 4, 3);
  gs.moveUnit(inf, 4, 4);
  gs.endTurn(); gs.endTurn();
  gs.wait(inf);
  gs.endTurn();
  assert.strictEqual(gs.gameOver, true);
  assert.strictEqual(gs.winner, 0);
});

test('units can only be bought on your own empty properties', () => {
  const gs = tinyGame();
  gs.spawn(1, 'infantry', 4, 3);
  assert.strictEqual(gs.buyUnit('tank', 4, 4), null, 'enemy HQ');
  assert.strictEqual(gs.buyUnit('tank', 2, 2), null, 'neutral city');
  const u = gs.buyUnit('infantry', 0, 0);
  assert.ok(u);
  assert.strictEqual(gs.players[0].funds, 5000 - UNIT_TYPES.infantry.cost);
  assert.strictEqual(u.hasMoved, true, 'bought units wait a turn');
  assert.strictEqual(gs.buyUnit('infantry', 0, 0), null, 'tile is now occupied');
});

test('turns alternate between players and income is paid', () => {
  const gs = tinyGame();
  gs.spawn(0, 'infantry', 1, 1);
  gs.spawn(1, 'infantry', 3, 3);
  gs.endTurn();
  assert.strictEqual(gs.currentPlayer, 1);
  assert.strictEqual(gs.players[1].funds, 5000 + 2000);
  gs.endTurn();
  assert.strictEqual(gs.currentPlayer, 0);
  assert.strictEqual(gs.day, 2);
});

test('fog of war only reveals tiles near your units and properties', () => {
  const gs = new GameState(MAPS.river(), { fog: true });
  gs.spawn(0, 'recon', 2, 0);
  const visible = gs.visibleTiles(0);
  assert.ok(visible.has('2,0'));
  assert.ok(!visible.has('19,19'));
});

test('save and load restore the full game', () => {
  const gs = createMission(2);
  const unit = gs.unitsOf(0)[0];
  gs.moveUnit(unit, ...Object.values(gs.getMoveRange(unit)[0]));
  gs.map.cell(3, 2).owner = 0;
  const copy = GameState.load(gs.save());
  assert.strictEqual(copy.save(), gs.save());
  assert.ok(Unit._idCounter >= Math.max(...copy.units.map(u => u.id)));
});

test('the AI plays full games without errors and someone eventually wins', () => {
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const gs = createMission(i);
    for (let turn = 0; turn < 400 && !gs.gameOver; turn++) gs.runAI();
    for (const u of gs.units) assert.strictEqual(gs.map.cell(u.x, u.y).unit, u, 'map and unit list in sync');
  }
});

test('the AI makes progress against a passive player', () => {
  const gs = createSkirmish();
  for (let turn = 0; turn < 60 && !gs.gameOver; turn++) {
    if (gs.currentPlayer === 1) gs.runAI(); else gs.endTurn();
  }
  assert.strictEqual(gs.gameOver, true);
  assert.strictEqual(gs.winner, 1);
});

test('the AI does not stall against a single unit holding its HQ', () => {
  for (let g = 0; g < 10; g++) {
    const gs = createSkirmish({ fog: false });
    gs.moveUnit(gs.unitAt(1, 0), 1, 3);
    gs.buyUnit('infantry', 0, 0);
    for (let turn = 0; turn < 200 && !gs.gameOver; turn++) {
      if (gs.currentPlayer === 1) gs.runAI(); else gs.endTurn();
    }
    assert.strictEqual(gs.gameOver, true);
  }
});
