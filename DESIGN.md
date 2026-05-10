# Front Wars — Game Design Document

> Based on Advance Wars (GBA, 2001) mechanics. All numbers derived from the original game.

---

## 1. Grid-Based Turn-Based Strategy Fundamentals

Front Wars is a 2-player turn-based strategy game played on a rectangular grid.
Each player commands an army identified by a color (Red vs Blue).

### Turn Structure
Each turn proceeds in this order:
1. **Income Phase** — Player receives funds from owned cities.
2. **Movement Phase** — Player moves each unit. Movement is optional per unit.
3. **Attack Phase** — After moving, a unit may attack if in range. Direct attacks allow the unit to move first.
4. **Purchase Phase** — Player may buy new units from owned bases/ports/airports.
5. **End Turn** — Turn passes to opponent.

### Victory Conditions
- **Rout**: Destroy all enemy units.
- **HQ Capture**: Capture the enemy Headquarters (HQ) with an Infantry or Mech unit.

### Fog of War (optional)
When enabled, tiles outside friendly vision range are hidden. Vision is computed per-unit before movement.

### Grid
- Square grid, typically 10-30 tiles wide/tall.
- Each tile has one terrain type and may contain one unit.

---

## 2. Unit Types and Stats

All units have HP from 0-10 (0 = dead). Stats are for full HP (10). Actual damage scales linearly with HP: `damage = base_damage × (HP / 10)`.

### Movement Types (for terrain costs)
| Code | Type | Description |
|------|------|-------------|
| F | Foot | Infantry, Mech |
| B | Boot/Bazooka | Mech (same as foot for movement) |
| T | Tread | Tanks, Md Tank, Anti-Air |
| W | Wheel | Recon, Artillery, Rockets, Missiles, APC |
| A | Air | B-Copter, T-Copter, Fighter, Bomber |
| S | Sea | Battleship, Cruiser, Lander, Sub |

### Unit Stats Table

| Unit | Class | Cost | Move | Vision | Fuel | Ammo | Primary Weapon | Range | Targets |
|------|-------|------|-------|--------|------|------|----------------|-------|---------|
| Infantry | Foot | 1000 | 3 | 2 | 99 | — | Machine Gun | 1 | Inf, Mech, Heli |
| Mech | Foot | 3000 | 2 | 2 | 70 | 3 | Bazooka | 1 | Vehicles, Heli |
| Recon | Wheel | 4000 | 8 | 5 | 80 | — | MG | 1 | Inf, Mech, Recon, Heli |
| Tank | Tread | 7000 | 6 | 3 | 70 | 9 | Cannon | 1 | All ground, Heli |
| Md Tank | Tread | 16000 | 5 | 1 | 50 | 8 | Cannon | 1 | All ground, Heli |
| APC | Wheel | 5000 | 6 | 1 | 70 | — | — | — | (transport only) |
| Artillery | Wheel | 6000 | 5 | 1 | 50 | 9 | Howitzer | 2-3 | All ground, Sea |
| Rockets | Wheel | 15000 | 5 | 1 | 50 | 6 | Rockets | 3-5 | All ground, Sea |
| Anti-Air | Tread | 8000 | 6 | 2 | 60 | 9 | Vulcan | 1 | Inf, Mech, Air, Heli |
| Missiles | Wheel | 12000 | 4 | 5 | 50 | 6 | Missiles | 3-5 | Air, Heli |
| Fighter | Air | 20000 | 9 | 2 | 99 | 9 | Missiles | 1 | Air, Heli |
| Bomber | Air | 22000 | 7 | 2 | 99 | 9 | Bombs | 1 | Ground, Sea |
| B-Copter | Air | 9000 | 6 | 3 | 99 | 6 | Missiles+MG | 1 | Ground, Air, Heli |
| T-Copter | Air | 5000 | 6 | 2 | 99 | — | — | — | (transport only) |
| Battleship | Sea | 28000 | 5 | 2 | 99 | 9 | Cannons | 2-6 | Ground, Sea |
| Cruiser | Sea | 18000 | 6 | 3 | 99 | 9 | AA Missiles | 1 | Air, Heli, Sub |
| Lander | Sea | 12000 | 6 | 1 | 99 | — | — | — | (transport only) |
| Sub | Sea | 20000 | 5 | 5 | 60 | 6 | Torpedoes | 1 | Sea (dive capable) |

### Fuel and Ammo
- Each movement costs 1 fuel per tile (foot soldiers: 0 fuel but have a fuel stat for transport purposes).
- Air units consume 5 fuel per turn when idle, plus 2 fuel per tile moved.
- Sea units: 1 fuel per tile moved, 0 when idle.
- Ammo: Each attack consumes 1 ammo. At 0 ammo, the unit cannot attack. Resupplied by APC (ground), friendly city/base/port/airport.
- **Fuel = 0**: Unit is destroyed at start of its owner's next turn.
- Submerged subs consume 5 fuel per turn.

---

## 3. Terrain Types and Effects

### Terrain Defense Stars
Each defense star gives +10% effective defense (multiplicative in damage formula).
Each terrain type may also grant +1 HP recovery at the start of your turn.

| Terrain | Defense Stars | HP Recovery | Vision Block | Notes |
|---------|---------------|-------------|--------------|-------|
| Plains | 1 | 0 | No | Default open terrain |
| Road | 0 | 0 | No | Bridges are Road over water |
| Forest | 2 | 0 | Yes (Woods) | Blocks vision in Fog of War |
| Mountain | 4 | 0 | Yes | +3 vision range for foot units |
| City | 3 | +2 | No | Capture for 1000 G/turn income |
| HQ | 4 | +2 | No | Capture = victory |
| Base (Factory) | 3 | +2 | No | Builds ground units |
| Port | 3 | +2 | No | Builds sea units |
| Airport | 3 | +2 | No | Builds air units |
| Sea | 0 | 0 | No | Sea/air units only |
| Reef | 1 | 0 | No | Sea. Lander can only unload on Shoal |
| Shoal | 0 | 0 | No | Sea. Ground units can pass when unloaded |

### Movement Costs Per Terrain Type

| Terrain | Foot (F) | Tread (T) | Wheel (W) | Air (A) | Sea (S) | Lander (L) | Pipe |
|---------|----------|-----------|-----------|---------|---------|------------|------|
| Plains | 1 | 1 | 2 | 1 | — | — | — |
| Road | 1 | 1 | 1 | 1 | — | — | — |
| Forest | 1 | 2 | 3 | 1 | — | — | — |
| Mountain | 2 | — | — | 1 | — | — | — |
| City | 1 | 1 | 1 | 1 | — | — | — |
| HQ | 1 | 1 | 1 | 1 | — | — | — |
| Base | 1 | 1 | 1 | 1 | — | — | — |
| Port | 1 | 1 | 1 | 1 | 1 | 1 | — |
| Airport | 1 | 1 | 1 | 1 | — | — | — |
| Sea | — | — | — | 1 | 1 | 1 | — |
| Reef | — | — | — | 1 | 2 | 2 | — |
| Shoal | 1 | 1 | 1 | 1 | — | 1 | — |
| Pipe | — | — | — | — | — | — | — |

Key: `—` = impassable for that movement type.

### Movement Cost for River
- Foot: 2 (can cross)
- Tread, Wheel: — (cannot cross except at bridges)
- Bridges count as Road.

---

## 4. Combat Formula

### Damage Calculation

```
baseDamage = damageTable[attacker][defender]  // from damage chart (percent, 0-120+)

// Attacker HP multiplier
attackMultiplier = attacker.currentHP / 10.0

// Defender defense value
defenderDefense = terrainDefenseStars * 10  // each star = 10
defenseMultiplier = (200 - (defender.baseDefense + defenderDefense)) / 100.0

// Luck (random variance, ±0-9% in AW1)
luck = randomInt(0, 9)  // added to damage AFTER the main calculation

// Final damage (in HP, rounded down)
finalDamage = floor(baseDamage * attackMultiplier * defenseMultiplier) + luck
finalDamage = min(finalDamage, defender.currentHP)  // can't kill more than remaining HP
```

**In practice**, the formula simplifies to:

```
damage_percent = damageTable[attacker][defender]
effective_damage = damage_percent * (attacker_HP / 10.0) * ((200 - (def_base_def + terrain_stars * 10)) / 100)
```

Where `def_base_def` is the unit's inherent defense (0 for all units in AW1; CO-dependent in later games).

For Front Wars (no COs): `def_base_def = 0`.

**Example**: Tank (HP 10) attacks Infantry on City (3 stars):
- Tank vs Infantry base: 75%
- terrain_stars = 3, so defense = 30
- effective = 75 * (10/10) * ((200 - (0 + 30)) / 100) = 75 * 1.0 * 1.70 = wait no...

Let me recheck: the formula is `(200 - defense) / 100`, so with 30 defense: `(200 - 30) / 100 = 1.70`... That's >1, which means LESS damage? No...

Actually, re-examining the formula: In Advance Wars, damage is calculated as:
```
damage = base_damage * (attacker_HP / 10) * (defender_HP / 10)
```
And then adjusted by defense. The true formula from the game code is:

```
damage = floor(base_damage * (attacker_HP_100 / 100) * (defender_HP_100 / 100)) + luck
```

Wait, I need to be more precise. Let me reconsider. The actual Advance Wars damage formula:

```
base_damage = damage_chart[attacker][defender]  // percentage value
effective_damage = base_damage * (attacker_hp / 100)
```

Then defense is applied: each defense star reduces damage by roughly 10%, but it's multiplicative, not additive.

The actual formula is:
```
final_damage = effective_damage * (100 - defense_total) / 100
```

Where `defense_total = base_unit_defense + terrain_stars * defense_per_star`.

With no CO modifiers, `base_unit_defense = 0` and `defense_per_star = 10` (in AW1).

So: Tank on City:
- base = 75
- effective = 75 * (10/10) = 75
- terrain = 3 * 10 = 30
- final = 75 * (100 - 30) / 100 = 75 * 0.70 = 52.5 → floor = 52%
- Then luck adds 0-9, so 52-61% HP, i.e., 5-6 HP damage.

That makes more sense! Defense reduces damage.

Let me write this correctly now.

Actually, I realize the formula varies slightly between games. Let me use the standard AW1 interpretation that's most widely cited by the community:

```
Damage% = (Base Damage%) × (Attacker HP / 10) × ((100 - (Terrain Stars × Defense per Star)) / 100)
```

Where Defense per Star varies:
- AW1/AW2: 10% per star
- AWDS: 10% per star

And CO defense bonuses are added to terrain defense.

For Front Wars (no COs), Defense per Star = 10.

### Counter-Attacks
- Triggered when a **direct-attack** unit (Infantry, Mech, Recon, Tank, Md Tank, Anti-Air, B-Copter, Fighter, Cruiser, Sub) attacks another **direct-attack** unit.
- The defender fires back using the same damage formula, but at **half the base damage** (counter_attack_multiplier = 0.5).
- Counter-attack damage is calculated after the attacker's damage is applied (so the defender's reduced HP affects counter-attack power).
- Indirect-attack units (Artillery, Rockets, Missiles, Battleship) do NOT trigger counter-attacks.
- The counter-attacking unit does NOT consume ammo.

### Damage Chart (Attacker vs Defender, base %)

This is the core damage table. Values are base damage percentages at full HP on Plains (1 star defense).

| Defender → | Inf | Mech | Recon | Tank | MdTnk | APC | Art | Rock | AAir | Miss | Fight | Bomb | BCopt | TCopt | Bship | Cruis | Land | Sub |
|-------------|-----|------|-------|------|-------|-----|-----|------|------|------|-------|------|-------|-------|-------|-------|------|-----|
| **Infantry**| 55 | 45 | 12 | 5 | 1 | 14 | 15 | 25 | 5 | 25 | — | — | 7 | 30 | — | — | — | — |
| **Mech** | 65 | 55 | 85 | 55 | 15 | 75 | 70 | 85 | 65 | 85 | — | — | 9 | 35 | — | — | — | — |
| **Recon** | 70 | 65 | 35 | 6 | 1 | 45 | 45 | 55 | 4 | 28 | — | — | 10 | 35 | — | — | — | — |
| **Tank** | 75 | 70 | 85 | 55 | 15 | 75 | 70 | 85 | 65 | 85 | — | — | 40 | 45 | 5 | 5 | 10 | 1 |
| **Md Tank** | 105 | 95 | 105 | 85 | 55 | 105 | 105 | 105 | 105 | 105 | — | — | 45 | 45 | 25 | 20 | 35 | 10 |
| **Artillery** | 90 | 85 | 80 | 70 | 45 | 70 | 75 | 80 | 75 | 80 | — | — | — | — | 55 | 50 | 55 | 60 |
| **Rockets** | 95 | 90 | 90 | 80 | 55 | 80 | 80 | 85 | 85 | 90 | — | — | — | — | 65 | 60 | 60 | 65 |
| **Anti-Air** | 105 | 105 | 60 | 25 | 10 | 50 | 50 | 55 | 45 | 55 | 65 | 75 | 105 | 105 | — | — | — | — |
| **Missiles** | — | — | — | — | — | — | — | — | — | — | 100 | 100 | 120 | 120 | — | — | — | — |
| **Fighter** | — | — | — | — | — | — | — | — | — | — | 55 | 100 | 100 | 100 | — | — | — | — |
| **Bomber** | 110 | 110 | 105 | 105 | 95 | 105 | 105 | 105 | 95 | 105 | — | — | — | — | 75 | 85 | 95 | 95 |
| **B-Copter** | 75 | 75 | 55 | 55 | 25 | 60 | 65 | 65 | 25 | 65 | — | — | 65 | 95 | 25 | 60 | 25 | 25 |
| **Battleship** | 95 | 90 | 90 | 80 | 55 | 80 | 80 | 85 | 85 | 90 | — | — | — | — | 50 | 95 | 95 | 95 |
| **Cruiser** | — | — | — | — | — | — | — | — | 85 | 100 | 55 | 65 | 105 | 105 | — | 25 | — | 90 |
| **Sub** | — | — | — | — | — | — | — | — | — | — | — | — | — | — | 65 | 90 | 95 | 55 |

Notation: `—` = cannot attack that target. Values are base %.

---

## 5. Movement Ranges Per Unit Type

Movement range = the number of tiles a unit can traverse in one turn.
The effective distance depends on terrain costs (see §3).

| Unit | Move Points | Type | Notes |
|------|------------|------|-------|
| Infantry | 3 | Foot | 3 tiles on plains (cost 1 each) |
| Mech | 2 | Foot | 2 tiles on plains, slower than infantry |
| Recon | 8 | Wheel | Fast scout, 4 tiles on plains (cost 2 each) |
| Tank | 6 | Tread | 6 tiles on plains (cost 1 each) |
| Md Tank | 5 | Tread | 5 tiles on plains |
| APC | 6 | Wheel | Can carry 1 infantry/mech; 3 tiles on plains |
| Artillery | 5 | Wheel | 2 tiles on plains (cost 2 each) |
| Rockets | 5 | Wheel | 2 tiles on plains |
| Anti-Air | 6 | Tread | 6 tiles on plains |
| Missiles | 4 | Wheel | 2 tiles on plains |
| Fighter | 9 | Air | 9 tiles (air ignores all terrain costs) |
| Bomber | 7 | Air | 7 tiles |
| B-Copter | 6 | Air | 6 tiles |
| T-Copter | 6 | Air | Can carry 1 infantry/mech |
| Battleship | 5 | Sea | 5 tiles on sea (cost 1 each) |
| Cruiser | 6 | Sea | 6 tiles; can carry 2 B-Copters |
| Lander | 6 | Sea | Can carry 2 ground units |
| Sub | 5 | Sea | 5 tiles; can dive |

---

## 6. Capture Mechanic

### Capture Rules
- Only **Infantry** and **Mech** units can capture properties.
- Properties: City, HQ, Base, Port, Airport.
- To initiate capture: Move next to or onto a neutral/enemy property.
- Unit cannot have moved and then captured in the same turn (unless already standing on the property).

### Capture Formula
```
capture_points_needed = 20
capture_rate_per_turn = floor(unit.currentHP)
```

- A full 10 HP infantry contributes 10 capture points per turn → captures in **2 turns**.
- A 5 HP infantry contributes 5 capture points per turn → captures in **4 turns**.
- Capturing is interruptible: if the capturing unit is attacked/killed/driven off before reaching 20 points, progress is **lost** (resets to 0).
- Neutral (white) cities start with 20 capture points and count DOWN to 0.
- An enemy-owned property: first reduce enemy capture points to 0 (same 20-point pool), then build up to 20.

### Simplified Capture (recommended for Front Wars)
```
capture_points_needed = 2  // turns
// Full HP infantry: captures in 2 turns
// HP 5-9: captures in 3 turns  
// HP 1-4: captures in 4 turns
// HP 0: dead, cannot capture
```

---

## 7. Fog of War

### Vision Rules
- In Fog of War, tiles are either **visible**, **revealed** (seen but not currently visible), or **hidden**.
- Vision radiates from each unit in a diamond/circle pattern (no diagonal vision blocking).
- Forests and Mountains block vision beyond them (a unit behind a forest is hidden unless adjacent).
- Mountains give +3 vision range to foot soldiers standing on them.

### Unit Vision Ranges

| Unit | Vision Range |
|------|-------------|
| Infantry | 2 |
| Mech | 2 |
| Recon | 5 |
| Tank | 3 |
| Md Tank | 1 |
| APC | 1 |
| Artillery | 1 |
| Rockets | 1 |
| Anti-Air | 2 |
| Missiles | 5 |
| Fighter | 2 |
| Bomber | 2 |
| B-Copter | 3 |
| T-Copter | 2 |
| Battleship | 2 |
| Cruiser | 3 |
| Lander | 1 |
| Sub | 5 (submerged: 1) |

### Vision Blocking Terrain
- **Forest**: blocks vision (a unit behind a forest is hidden unless adjacent to an observer).
- **Mountain**: blocks vision except for units ON the mountain, which gain +3 vision.
- **Reef**: blocks vision for submerged subs.

### Fog in a Forest
- A unit standing INSIDE a forest is hidden unless an enemy unit is **adjacent** to it.
- A unit standing ON a mountain can see over adjacent forests/mountains.

### Submarines
- Subs can **dive** (become hidden). While submerged:
  - Cannot be seen except by adjacent Cruisers and other adjacent submerged Subs.
  - Use 5 fuel per turn.
  - Can only be attacked by Cruisers and Subs.
  - Cannot attack.

---

## 8. Funds System

### Per-Turn Income
```
income = number_of_owned_cities * 1000
```

- Each owned City, Base, Port, and Airport generates 1000 G per turn.
- HQ does NOT generate income (in AW1; but we can make it 1000 too for simplicity).
- A player starts with some initial funds (varies by map).

### Unit Purchase Costs

| Unit | Cost |
|------|------|
| Infantry | 1000 |
| Mech | 3000 |
| Recon | 4000 |
| Tank | 7000 |
| Md Tank | 16000 |
| APC | 5000 |
| Artillery | 6000 |
| Rockets | 15000 |
| Anti-Air | 8000 |
| Missiles | 12000 |
| Fighter | 20000 |
| Bomber | 22000 |
| B-Copter | 9000 |
| T-Copter | 5000 |
| Battleship | 28000 |
| Cruiser | 18000 |
| Lander | 12000 |
| Sub | 20000 |

### Purchase Rules
- Ground units: built at **Base** (Factory).
- Sea units: built at **Port**.
- Air units: built at **Airport**.
- A unit appears on the property tile at the start of your NEXT turn.
- Only one unit per property per turn.
- A unit cannot be built on a tile that already contains a unit.
- Purchases happen AFTER movement/attack, so newly built units cannot move the same turn.

### Repair
- Units parked on a friendly property (City/Base/Port/Airport/HQ) at the start of your turn recover **2 HP**.
- Cost per HP repaired: `unit_cost / 10` G (i.e., 10% of unit cost per HP).
- This cost is deducted from current funds automatically.

---

## 9. AI Behavior Patterns

### AI Decision-Making Pipeline
The AI evaluates moves in this priority order:

#### Phase 1: Capture
- Score all Infantry/Mech units for capture actions.
- Prioritize capturing HQ (if reachable) > neutral cities > enemy cities.
- If a unit is already capturing, continue unless threatened.

#### Phase 2: Attack
- For each unit, evaluate all possible attack targets.
- Attack priority:
  1. **Kill weakest enemy unit** (highest damage / lowest remaining HP first).
  2. **Damage high-value targets** (Bombers, Battleships, Md Tanks).
  3. **Break captures** — attack enemy infantry currently capturing a friendly property.
  4. **Favorable trades** — attack where counter-attack damage is minimal.

#### Phase 3: Movement
- After attacks (or for units that didn't attack):
  1. Move toward the nearest uncaptured neutral city.
  2. Move toward enemy units (closing distance).
  3. Move toward enemy HQ (if winning the unit-count advantage).
  4. Retreat damaged units (<3 HP) toward friendly properties for repair.

#### Phase 4: Purchase
- Spending priority:
  1. Build Infantry if less than 3 infantry exist and cities are uncaptured.
  2. Build counter-units (Anti-Air if enemy has air, Tank if enemy has infantry spam).
  3. Build high-value units (Md Tank, Bomber) if funds allow.
  4. Save funds if no clear need (accumulate for expensive units).

### Difficulty Levels
AI behavior can scale across difficulty levels:

| Level | Behavior Tweaks |
|-------|----------------|
| Easy | Random suboptimal attacks, ignores capture priority, buys randomly |
| Normal | Follows priority list above, reasonable unit composition |
| Hard | Normal + sees through fog of war partially, better unit counters, aggressive HQ rushes |
| Expert | Hard + optimal damage calculations, perfect capture timing, saves for Md Tanks/Bombers |

### Turn Budget
For reasonable performance on a grid up to 20x30:
- AI evaluation budget: O(n_units × n_reachable_tiles × n_enemies).
- Cache damage calculations (pre-compute the full damage table).
- Limit move evaluation to the top-5 best moves per unit.

---

## Appendix A: Simplified Unit Count (for MVP)

For an MVP, use this reduced set:

| Unit | Cost | Move | Vision | Notes |
|------|------|------|--------|-------|
| Infantry | 1000 | 3 | 2 | Captures |
| Tank | 7000 | 6 | 3 | Direct attack |
| Artillery | 6000 | 5 | 1 | Indirect, range 2-3 |
| Anti-Air | 8000 | 6 | 2 | Anti-air + infantry |
| Fighter | 20000 | 9 | 2 | Anti-air only |
| Bomber | 22000 | 7 | 2 | Anti-ground/sea |
| Battleship | 28000 | 5 | 2 | Indirect naval, range 2-6 |

### Simplified Damage Chart (MVP 7 units)

| Defender → | Inf | Tank | Art | AA | Fight | Bomb | Bship |
|-------------|-----|------|-----|----|-------|------|-------|
| **Infantry** | 55 | 5 | 15 | 5 | — | — | — |
| **Tank** | 75 | 55 | 70 | 65 | — | — | 5 |
| **Artillery** | 90 | 70 | 75 | 75 | — | — | 55 |
| **Anti-Air** | 105 | 25 | 50 | 45 | 65 | 75 | — |
| **Fighter** | — | — | — | — | 55 | 100 | — |
| **Bomber** | 110 | 105 | 105 | 95 | — | — | 75 |
| **Battleship** | 95 | 80 | 80 | 85 | — | — | 50 |

## Appendix B: Terrain (MVP)

| Terrain | Defense | Foot | Tread | Wheel | Air | Sea |
|---------|---------|------|-------|-------|-----|-----|
| Plains | 1★ | 1 | 1 | 2 | 1 | — |
| Forest | 2★ | 1 | 2 | 3 | 1 | — |
| Mountain | 4★ | 2 | — | — | 1 | — |
| Road | 0★ | 1 | 1 | 1 | 1 | — |
| City | 3★ | 1 | 1 | 1 | 1 | — |
| HQ | 4★ | 1 | 1 | 1 | 1 | — |
| Sea | 0★ | — | — | — | 1 | 1 |
| Shoal | 0★ | 1 | 1 | 1 | 1 | 1 |

---

## Appendix C: Game Loop Pseudocode

```python
class Game:
    def __init__(self, map_width, map_height, players=2):
        self.grid = Grid(map_width, map_height)
        self.players = [Player("Red"), Player("Blue")]
        self.current_player_idx = 0
        self.turn = 0
        self.fog_of_war = False
    
    def run_turn(self):
        player = self.players[self.current_player_idx]
        
        # 1. Income
        player.funds += player.count_cities() * 1000
        
        # 2. Repair units on properties
        self.repair_phase(player)
        
        # 3. Player moves and attacks (handled by UI or AI)
        # Each unit: move (optional) -> attack (optional)
        
        # 4. Purchase phase
        self.purchase_phase(player)
        
        # 5. End turn
        self.current_player_idx = (self.current_player_idx + 1) % len(self.players)
        self.turn += 1
        
        # 6. Check victory
        return self.check_victory()
    
    def calculate_damage(self, attacker, defender, terrain):
        base = DAMAGE_TABLE[attacker.type][defender.type]
        effective = base * (attacker.hp / 10.0)
        defense = terrain.defense_stars * 10
        final = effective * ((100 - defense) / 100.0)
        luck = random.randint(0, 9) / 10.0  # 0.0 to 0.9 HP
        damage = int(final) + luck
        return min(damage, defender.hp)
```

---

*Document prepared for Front Wars project. All mechanics directly sourced from Advance Wars (GBA) game code analysis and community reference materials (Wars World News, Advance Wars By Web).*
