// Bot controller: a small utility-scored behavior tree producing ordinary player commands.
// States: lane, trade, all-in, retreat, siege. Difficulty sets reaction time and aim error.
import { Rng } from '../core/rng.js';
import { CMD, moveCmd, attackCmd, attackMoveCmd, castCmd, spellCmd, buyCmd, stopCmd } from '../sim/commands.js';
import { KIND, LANE, MAP, sideX, sec } from '../sim/constants.js';
import { canShop, purchasePlan } from '../sim/match.js';
import { snapshot, alive, d, hpr, fwd, power, underTower, minionsTankingTower, predict, towerCovers } from './perception.js';
import { SCRIPTS } from './heroes/index.js';
import { burst, reach } from './threat.js';

export const DIFFICULTY = {
  easy: { think: 12, aimError: 95, abilityRate: 0.55, dodge: 0.1 },
  medium: { think: 8, aimError: 50, abilityRate: 0.8, dodge: 0.35 },
  hard: { think: 5, aimError: 18, abilityRate: 1, dodge: 0.65 },
};

export class Bot {
  /**
   * opts.build: item keys to buy in order instead of the hero's recommended build.
   * opts.slot: the hero's seat within its team. Bots think every few ticks; the phase comes from the seat so both
   * teams think on the same ticks (a phase from the player id let one side react first).
   */
  constructor(playerId, difficulty = 'medium', seed = 1, opts = {}) {
    this.p = playerId; this.build = opts.build || null; this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    this.rng = new Rng(seed * 7919 + playerId * 104729);
    this.state = 'lane'; this.phase = ((opts.slot ?? playerId) * 3) % this.cfg.think; this.lastBuyTick = 0; this.strafe = 0;
  }
  aim(pt) { const e = this.cfg.aimError; return { x: pt.x + this.rng.range(-e, e), y: pt.y + this.rng.range(-e, e) }; }
  think(world) {
    if ((world.tick + this.phase) % this.cfg.think) return EMPTY;
    const me = world.get(world.players[this.p]);
    if (!me || world.state.over) return EMPTY;
    const out = this.out || (this.out = []); out.length = 0;
    this.shop(world, me, out);
    if (me.dead) return out;
    const snap = snapshot(world, me, this.snap || (this.snap = { enemies: [], allies: [], enemyMinions: [], allyMinions: [] }));
    this.decide(world, snap);
    const script = SCRIPTS[me.heroKey];
    // summoner spells
    const threatened = anyWithin(snap.enemies, me, 650);
    if (hpr(me) < 0.28 && threatened && me.spellCds[1] === 0) out.push(spellCmd(this.p, 1, me.x, me.y));
    if (hpr(me) < 0.18 && threatened && me.spellCds[0] === 0) { const hx = sideX(me.team, MAP.FOUNTAIN_X); out.push(spellCmd(this.p, 0, me.x + Math.sign(hx - me.x) * 400, me.y)); }
    // abilities
    if (script && this.rng.chance(this.cfg.abilityRate)) { const c = script(world, me, snap, this); if (c) out.push(c); }
    // movement / attacks
    out.push(this.act(world, me, snap));
    return out;
  }
  /**
   * Work through the build in order: buy the next item when its price (after owned components) is affordable,
   * otherwise its most expensive affordable component, as players do.
   */
  shop(world, me, out) {
    if (!canShop(me) || world.tick - this.lastBuyTick < 15) return;
    const build = this.build || world.registry.heroes[me.heroKey].build || [];
    for (const key of build) {
      if (me.items.includes(key)) continue;
      const plan = purchasePlan(world, me, key);
      if (plan.reason === 'owned' || plan.reason === 'group' || plan.reason === 'unknown') continue; // e.g. other boots already
      const pick = plan.ok ? key : plan.reason === 'gold' ? componentToBuy(world, me, key) : null;
      if (pick) { out.push(buyCmd(this.p, pick)); this.lastBuyTick = world.tick; }
      return; // strictly in order
    }
  }
  decide(world, snap) {
    const { me, enemies, allies } = snap;
    const near = this.near || (this.near = []); near.length = 0;
    for (const e of enemies) if (d(e, me) < 1000) near.push(e);
    let ourPower = power(me), theirPower = 0, weak = null;
    for (const a of allies) if (d(a, me) < 1000) ourPower += power(a);
    for (const e of near) { theirPower += power(e); if (!weak && hpr(e) < 0.35 && d(e, me) < me.range + 400) weak = e; }
    const diveRisk = underTower(snap, me, 60) && minionsTankingTower(snap) < 2;
    // recover: low on health (or on mana) and nobody close -> walk back to the fountain until healed, as players do
    // (the fountain heals 12%/s and is the shop). Heroes without regeneration go back earlier.
    const def = world.registry.heroes[me.heroKey], closest = nearestDist(near, me);
    const manaLow = def.resource === 'mana' && me.maxMana > 0 && me.mana < me.maxMana * 0.15;
    if (this.state === 'recover' && (hpr(me) < 0.92 || (def.resource === 'mana' && me.mana < me.maxMana * 0.8)) && closest > 450) return;
    if ((hpr(me) < (def.noRegen ? 0.3 : 0.3) || (manaLow && hpr(me) < 0.7)) && closest > 700 && !(weak && hpr(weak) < 0.15)) { this.state = 'recover'; return; }
    // melee divers commit on a kill they can make, or on a fight an ally has started; otherwise they wait
    const dive = me.range < 250 && hpr(me) > 0.3 && !diveRisk ? meleeCommit(world, snap, me, near) : null;
    if (hpr(me) < 0.25 && near.length) this.state = 'retreat';
    else if (dive) { this.state = 'allin'; this.focus = dive.id; }
    else if (diveRisk && !(weak && hpr(weak) < 0.15)) this.state = 'retreat';
    else if (weak && ourPower > theirPower * 0.9 && hpr(me) > 0.35) { this.state = 'allin'; this.focus = weak.id; }
    else if (near.length && ourPower > theirPower * 1.45 && hpr(me) > 0.5) { let f = near[0]; for (const e of near) if (hpr(e) < hpr(f)) f = e; this.state = 'allin'; this.focus = f.id; }
    else if (near.length && anyWithin(near, me, me.range + 350)) this.state = 'trade';
    else if (snap.enemyTower && minionsTankingTower(snap) >= 1 && (!near.length || ourPower > theirPower * 1.3)) this.state = 'siege';
    else if (snap.enemyTower && deadEnemies(world, me) >= 2 && hpr(me) > 0.45) this.state = 'siege';
    else this.state = 'lane';
  }
  act(world, me, snap) {
    const f = fwd(me.team);
    switch (this.state) {
      case 'recover': return moveCmd(this.p, sideX(me.team, MAP.FOUNTAIN_X), 450);
      case 'retreat': {
        const safe = snap.allyTower ? snap.allyTower.x - f * 250 : sideX(me.team, MAP.FOUNTAIN_X);
        this.strafe = (this.strafe + 1) % 6;
        return moveCmd(this.p, safe, 450 + (this.strafe < 3 ? -140 : 140));
      }
      case 'allin': {
        const t = world.get(this.focus);
        // never chase a healthy target under its tower (the way divers died most)
        if (alive(t) && towerCovers(snap, t) && hpr(t) > 0.15) { this.state = 'lane'; break; }
        if (alive(t)) return attackCmd(this.p, t.id);
        return attackMoveCmd(this.p, me.x + f * 400, 450);
      }
      case 'trade': {
        let t = null; for (const e of snap.enemies) if (d(e, me) < me.range + 500 && (!t || hpr(e) < hpr(t))) t = e;
        if (!t) break;
        const dist = d(t, me), want = me.range * 0.85;
        if (me.range < 250) { if (meleeCanEngage(snap, me, t) && !towerCovers(snap, me)) return attackCmd(this.p, t.id); break; }
        // kite: attack when ready, step back when the enemy closes in
        if (me.attackCd > 3 && dist < want) { const a = Math.atan2(me.y - t.y, me.x - t.x); return moveCmd(this.p, me.x + Math.cos(a) * 140, me.y + Math.sin(a) * 140 + this.rng.range(-60, 60)); }
        if (underTower(snap, t, 0) && minionsTankingTower(snap) < 2) break;
        return attackCmd(this.p, t.id);
      }
      case 'siege': {
        const t = snap.enemyTower;
        // tank-check: never be the closest unit to the tower unless enemies are mostly dead
        if (minionsTankingTower(snap) < 1 && deadEnemies(world, me) < 2) return attackMoveCmd(this.p, t.x - f * (t.range + 150), me.y);
        return attackCmd(this.p, t.id);
      }
    }
    // lane: farm behind the front line. Between waves (no allied minion out), wait on our side of the neutral middle
    // where the next waves meet, not back at the base: that is where trades and pickoffs happen.
    const front = snap.allyFront ? snap.allyFront.x : LANE.W / 2 - f * WAIT_BEFORE_MID;
    let hold = front - f * (me.range < 250 ? 110 : 200);
    // never hold inside the enemy tower's reach while farming (sieging it is the siege state's job)
    const et = snap.enemyTower; if (et) { const edge = et.x - f * (et.range + et.radius + 60); if ((hold - edge) * f > 0) hold = edge; }
    let target = null;
    for (const m of snap.enemyMinions) if (d(m, me) < me.range + 200 && (!target || m.hp < target.hp)) target = m;
    // last-hit under the enemy tower only from range, or while enough minions tank it
    if (target && !(underTower(snap, target, me.range < 250 ? 60 : 0) && minionsTankingTower(snap) < (me.range < 250 ? 3 : 1))) return attackCmd(this.p, target.id);
    const x = Math.max(200, Math.min(LANE.W - 200, hold));
    const laneY = 450 + ((this.p % 3) - 1) * 130;
    // in position: stay, unless an old attack order is dragging the hero into tower shots (a dash sets one)
    if (Math.abs(me.x - x) < 60 && Math.abs(me.y - laneY) < 60 && !towerCovers(snap, me)) return null;
    return moveCmd(this.p, x, laneY);
  }
}
const EMPTY = [];
const WAIT_BEFORE_MID = 250; // between waves: hold this far short of the lane's centre
/** The most expensive component of `key` the bot can buy now and does not already hold (walking down the build tree). */
function componentToBuy(world, me, key) {
  const items = world.registry.items, free = me.items.map(() => true);
  const claim = (k) => { for (let i = 0; i < me.items.length; i++) if (free[i] && me.items[i] === k) { free[i] = false; return true; } return false; };
  let best = null, bestPrice = 0;
  const visit = (k) => {
    if (claim(k)) return;
    const p = purchasePlan(world, me, k);
    if (p.ok && p.price > bestPrice) { best = k; bestPrice = p.price; }
    for (const c of items[k].from) visit(c);
  };
  for (const c of items[key].from) visit(c);
  return best;
}
const anyWithin = (list, me, r) => { for (const e of list) if (d(e, me) < r) return true; return false; };
const nearestDist = (list, me) => { let b = Infinity; for (const e of list) { const v = d(e, me); if (v < b) b = v; } return b; };
/**
 * A melee hero only walks into a trade it can take: the target is close, not under its tower (unless nearly dead), and
 * the enemies around the target do not outnumber the allies around it (a lone melee chasing into three ranged heroes
 * was the main way melee bots died).
 */
function meleeCanEngage(snap, me, t) {
  if (d(t, me) > me.range + 260) return false;
  if (underTower(snap, t, 0) && hpr(t) > 0.2) return false;
  let foes = 0, friends = 1;
  for (const e of snap.enemies) if (d(e, t) < 650) foes++;
  for (const a of snap.allies) if (d(a, t) < 750) friends++;
  return foes <= friends || hpr(t) < 0.3;
}
/** The enemy a melee hero should dive now, or null: killable with its burst, or already in a fight with an ally. */
function meleeCommit(world, snap, me, near) {
  const r = reach(world, me); let best = null;
  for (const e of near) {
    if (d(e, me) > r || !safeToDive(snap, me, e)) continue;
    if (burst(world, me, e) >= (e.hp + e.shield) * 1.05 && (!best || e.hp < best.hp)) best = e;
  }
  if (best) return best;
  for (const a of snap.allies) {
    if (world.tick - a.lastHeroHitTick > 20 || d(a, me) > 900) continue;
    let t = null; for (const e of near) if (d(e, a) < 550 && d(e, me) < r + 150 && (!t || hpr(e) < hpr(t))) t = e;
    if (t && safeToDive(snap, me, t)) return t;
  }
  return null;
}
function safeToDive(snap, me, t) {
  if (towerCovers(snap, t) && hpr(t) > 0.15) return false;
  let foes = 0, friends = 1;
  for (const e of snap.enemies) if (e !== t && d(e, t) < 600) foes++;
  for (const a of snap.allies) if (d(a, t) < 850) friends++;
  return foes < friends + 1;
}
const deadEnemies = (world, me) => { let n = 0; for (const h of world.heroes) if (h.team !== me.team && h.dead) n++; return n; };
