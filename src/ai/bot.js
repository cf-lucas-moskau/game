// Bot controller: a small utility-scored behavior tree producing ordinary player commands.
// States: lane, trade, all-in, retreat, siege. Difficulty sets reaction time and aim error.
import { Rng } from '../core/rng.js';
import { CMD, moveCmd, attackCmd, attackMoveCmd, castCmd, spellCmd, buyCmd, stopCmd } from '../sim/commands.js';
import { KIND, LANE, MAP, sideX, sec } from '../sim/constants.js';
import { canShop } from '../sim/match.js';
import { BUILDS } from '../sim/items/index.js';
import { snapshot, alive, d, hpr, fwd, power, underTower, minionsTankingTower, predict } from './perception.js';
import { SCRIPTS } from './heroes.js';

export const DIFFICULTY = {
  easy: { think: 12, aimError: 95, abilityRate: 0.55, dodge: 0.1 },
  medium: { think: 8, aimError: 50, abilityRate: 0.8, dodge: 0.35 },
  hard: { think: 5, aimError: 18, abilityRate: 1, dodge: 0.65 },
};

export class Bot {
  constructor(playerId, difficulty = 'medium', seed = 1) {
    this.p = playerId; this.cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    this.rng = new Rng(seed * 7919 + playerId * 104729);
    this.state = 'lane'; this.phase = playerId % this.cfg.think; this.lastBuyTick = 0; this.strafe = 0;
  }
  aim(pt) { const e = this.cfg.aimError; return { x: pt.x + this.rng.range(-e, e), y: pt.y + this.rng.range(-e, e) }; }
  think(world) {
    if ((world.tick + this.phase) % this.cfg.think) return EMPTY;
    const me = world.get(world.players[this.p]);
    if (!me || world.state.over) return EMPTY;
    const out = [];
    this.shop(world, me, out);
    if (me.dead) return out;
    const snap = snapshot(world, me);
    this.decide(world, snap);
    const script = SCRIPTS[me.heroKey];
    // summoner spells
    const threatened = snap.enemies.some((e) => d(e, me) < 650);
    if (hpr(me) < 0.28 && threatened && me.spellCds[1] === 0) out.push(spellCmd(this.p, 1, me.x, me.y));
    if (hpr(me) < 0.18 && threatened && me.spellCds[0] === 0) { const hx = sideX(me.team, MAP.FOUNTAIN_X); out.push(spellCmd(this.p, 0, me.x + Math.sign(hx - me.x) * 400, me.y)); }
    // abilities
    if (script && this.rng.chance(this.cfg.abilityRate)) { const c = script(world, me, snap, this); if (c) out.push(c); }
    // movement / attacks
    out.push(this.act(world, me, snap));
    return out;
  }
  shop(world, me, out) {
    if (!canShop(me) || world.tick - this.lastBuyTick < 15) return;
    const build = BUILDS[me.heroKey] || [];
    for (const key of build) {
      if (me.items.includes(key)) continue;
      const it = world.registry.items[key];
      if (it && me.gold >= it.cost && me.items.length < 6) { out.push(buyCmd(this.p, key)); this.lastBuyTick = world.tick; }
      return; // buy strictly in order
    }
  }
  decide(world, snap) {
    const { me, enemies, allies } = snap;
    const near = enemies.filter((e) => d(e, me) < 1000);
    const allyNear = allies.filter((a) => d(a, me) < 1000);
    const ourPower = power(me) + allyNear.reduce((s, a) => s + power(a), 0);
    const theirPower = near.reduce((s, e) => s + power(e), 0);
    const weak = near.find((e) => hpr(e) < 0.35 && d(e, me) < me.range + 400);
    const diveRisk = underTower(snap, me, 60) && minionsTankingTower(snap) < 2;
    if (hpr(me) < 0.25 && near.length) this.state = 'retreat';
    else if (diveRisk && !(weak && hpr(weak) < 0.15)) this.state = 'retreat';
    else if (weak && ourPower > theirPower * 0.9 && hpr(me) > 0.35) { this.state = 'allin'; this.focus = weak.id; }
    else if (near.length && ourPower > theirPower * 1.45 && hpr(me) > 0.5) { this.state = 'allin'; this.focus = near.reduce((a, b) => (hpr(a) < hpr(b) ? a : b)).id; }
    else if (near.length && near.some((e) => d(e, me) < me.range + 350)) this.state = 'trade';
    else if (snap.enemyTower && minionsTankingTower(snap) >= 1 && (!near.length || ourPower > theirPower * 1.3)) this.state = 'siege';
    else if (snap.enemyTower && world.heroes.filter((h) => h.team !== me.team && h.dead).length >= 2 && hpr(me) > 0.45) this.state = 'siege';
    else this.state = 'lane';
  }
  act(world, me, snap) {
    const f = fwd(me.team);
    switch (this.state) {
      case 'retreat': {
        const safe = snap.allyTower ? snap.allyTower.x - f * 250 : sideX(me.team, MAP.FOUNTAIN_X);
        this.strafe = (this.strafe + 1) % 6;
        return moveCmd(this.p, safe, 450 + (this.strafe < 3 ? -140 : 140));
      }
      case 'allin': {
        const t = world.get(this.focus);
        if (alive(t)) return attackCmd(this.p, t.id);
        return attackMoveCmd(this.p, me.x + f * 400, 450);
      }
      case 'trade': {
        const t = snap.enemies.filter((e) => d(e, me) < me.range + 500).sort((a, b) => hpr(a) - hpr(b))[0];
        if (!t) break;
        const dist = d(t, me), want = me.range * 0.85;
        if (me.range < 250) return attackCmd(this.p, t.id);
        // kite: attack when ready, step back when the enemy closes in
        if (me.attackCd > 3 && dist < want) { const a = Math.atan2(me.y - t.y, me.x - t.x); return moveCmd(this.p, me.x + Math.cos(a) * 140, me.y + Math.sin(a) * 140 + this.rng.range(-60, 60)); }
        if (underTower(snap, t, 0) && minionsTankingTower(snap) < 2) break;
        return attackCmd(this.p, t.id);
      }
      case 'siege': {
        const t = snap.enemyTower;
        // tank-check: never be the closest unit to the tower unless enemies are mostly dead
        if (minionsTankingTower(snap) < 1 && world.heroes.filter((h) => h.team !== me.team && h.dead).length < 2) return attackMoveCmd(this.p, t.x - f * (t.range + 150), me.y);
        return attackCmd(this.p, t.id);
      }
    }
    // lane: farm behind the front line
    const front = snap.allyFront ? snap.allyFront.x : sideX(me.team, MAP.TOWER_INNER_X);
    const hold = front - f * (me.range < 250 ? 60 : 200);
    let target = null;
    for (const m of snap.enemyMinions) if (d(m, me) < me.range + 200 && (!target || m.hp < target.hp)) target = m;
    if (target && !(underTower(snap, target, 0) && minionsTankingTower(snap) < 1)) return attackCmd(this.p, target.id);
    const x = Math.max(200, Math.min(LANE.W - 200, hold));
    const laneY = 450 + ((this.p % 3) - 1) * 130;
    if (Math.abs(me.x - x) < 60 && Math.abs(me.y - laneY) < 60) return null;
    return moveCmd(this.p, x, laneY);
  }
}
const EMPTY = [];
