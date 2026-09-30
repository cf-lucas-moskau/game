// Match statistics from the sim's event stream: one collector per match, fed every event, sampled once a
// second, finished into a plain JSON record. It reads the world and events only (like render and audio), so
// it works headless (tools/simlab.mjs) and in the browser alike.
//
//   const stats = new MatchStats(world);
//   each tick: world.step(cmds); world.events.drain(stats.onEvent); stats.sample(world);
//   const record = stats.finish(world);
import { EV } from '../core/events.js';
import { KIND, TICK_HZ, RULES, isMinion, isStructure } from '../sim/constants.js';
import { CAUSE, CC } from '../sim/damage.js';

const TYPE_KEY = { p: 'dmgHeroesPhys', m: 'dmgHeroesMagic', t: 'dmgHeroesTrue' };

/** Every per-hero counter, declared once so records have one shape. */
function heroRecord(h) {
  return {
    player: h.playerId, hero: h.heroKey, team: h.team, win: false,
    kills: 0, deaths: 0, assists: 0, level: 1, cs: 0,
    goldEarned: 0, goldSpent: 0, items: [], // net gold earned (gold now + spent - starting gold); items: [{ key, min, price }]
    // damage dealt, in final amounts after resistances (shield absorption included)
    dmgHeroes: 0, dmgHeroesPhys: 0, dmgHeroesMagic: 0, dmgHeroesTrue: 0,
    dmgHeroesBasic: 0, dmgHeroesAbility: 0, dmgHeroesOther: 0,
    dmgMinions: 0, dmgStructures: 0,
    // damage taken, by who dealt it
    taken: 0, takenHeroes: 0, takenMinions: 0, takenStructures: 0, takenOther: 0,
    healSelf: 0, healAllies: 0, shieldSelf: 0, shieldAllies: 0, healed: 0,
    // crowd control applied to enemy heroes (seconds) and received from them
    ccStun: 0, ccRoot: 0, ccAirborne: 0, displaces: 0, slowSec: 0, slowWeighted: 0,
    ccTaken: 0, slowTaken: 0,
    casts: [0, 0, 0, 0], secondsDead: 0, firstItemMin: null,
    goldAt: [], // gold earned at the end of each minute
  };
}

export class MatchStats {
  constructor(world) {
    this.byId = new Map();
    this.heroes = world.heroes.map((h) => { const r = heroRecord(h); this.byId.set(h.id, r); return r; });
    this.deadSince = new Map();
    this.match = { firstBloodMin: null, firstBloodTeam: null, firstTowerMin: null, firstTowerTeam: null,
      towers: [0, 0], kills: [0, 0], whaleRolls: 0, suddenDeathMin: null };
    this.world = world;
    this.onEvent = (e) => this.event(e); // stored callback: draining allocates nothing per event
  }
  kindOf(id) { const u = this.world.entities[id]; return u ? u.kind : 0; }
  teamOf(id) { const u = this.world.entities[id]; return u ? u.team : -1; }
  event(e) {
    const min = e.tick / TICK_HZ / 60;
    switch (e.type) {
      case EV.DAMAGE: {
        const src = this.byId.get(e.b), dst = this.byId.get(e.a), tk = this.kindOf(e.a), v = e.v;
        if (src) {
          if (tk === KIND.HERO) {
            if (this.teamOf(e.a) !== src.team) {
              src.dmgHeroes += v; src[TYPE_KEY[e.s] || 'dmgHeroesTrue'] += v;
              if (e.c === CAUSE.BASIC) src.dmgHeroesBasic += v; else if (e.c === CAUSE.ABILITY) src.dmgHeroesAbility += v; else src.dmgHeroesOther += v;
            }
          } else if (isMinion(tk)) src.dmgMinions += v;
          else if (isStructure(tk)) src.dmgStructures += v;
        }
        if (dst) {
          dst.taken += v; const sk = this.kindOf(e.b);
          if (src) dst.takenHeroes += v; else if (isMinion(sk)) dst.takenMinions += v; else if (isStructure(sk)) dst.takenStructures += v; else dst.takenOther += v;
        }
        break;
      }
      case EV.HEAL: {
        const src = this.byId.get(e.b), dst = this.byId.get(e.a);
        if (dst) dst.healed += e.v;
        if (src) { if (e.a === e.b) src.healSelf += e.v; else if (dst && dst.team === src.team) src.healAllies += e.v; }
        break;
      }
      case EV.SHIELD: {
        const src = this.byId.get(e.b); if (!src) break;
        if (e.a === e.b) src.shieldSelf += e.v; else src.shieldAllies += e.v;
        break;
      }
      case EV.STUN: {
        const src = this.byId.get(e.c), dst = this.byId.get(e.a);
        if (!dst || (src && src.team === dst.team)) break;
        if (e.b === CC.DISPLACE) { if (src) src.displaces++; break; }
        dst.ccTaken += e.v;
        if (src) { if (e.b === CC.STUN) src.ccStun += e.v; else if (e.b === CC.ROOT) src.ccRoot += e.v; else src.ccAirborne += e.v; }
        break;
      }
      case EV.SLOW: {
        const src = this.byId.get(e.b), dst = this.byId.get(e.a);
        if (!dst || (src && src.team === dst.team)) break;
        dst.slowTaken += e.v;
        if (src) { src.slowSec += e.v; src.slowWeighted += e.v * e.c; }
        break;
      }
      case EV.CAST: { const r = this.byId.get(e.a); if (r && e.b >= 0 && e.b < 4) r.casts[e.b]++; break; }
      case EV.ITEM_BOUGHT: {
        const r = this.byId.get(e.a); if (!r) break;
        r.items.push({ key: e.s, min: +min.toFixed(2), price: e.v }); r.goldSpent += e.v; // price paid (components owned are used up)
        if (r.firstItemMin === null) r.firstItemMin = +min.toFixed(2);
        break;
      }
      case EV.DEATH: {
        const r = this.byId.get(e.a); if (!r || e.v !== 1) break;
        this.deadSince.set(e.a, e.tick);
        break;
      }
      case EV.RESPAWN: { const t0 = this.deadSince.get(e.a); if (t0 !== undefined) { const r = this.byId.get(e.a); if (r) r.secondsDead += (e.tick - t0) / TICK_HZ; this.deadSince.delete(e.a); } break; }
      case EV.KILL: {
        const victim = this.byId.get(e.a); if (!victim) break;
        const team = 1 - victim.team; this.match.kills[team]++;
        if (this.match.firstBloodMin === null) { this.match.firstBloodMin = +min.toFixed(2); this.match.firstBloodTeam = team; }
        break;
      }
      case EV.STRUCTURE_DOWN: {
        if (e.b !== KIND.TOWER) break;
        const team = 1 - e.v; this.match.towers[team]++;
        if (this.match.firstTowerMin === null) { this.match.firstTowerMin = +min.toFixed(2); this.match.firstTowerTeam = team; }
        break;
      }
      case EV.WHALE_ROLL: this.match.whaleRolls++; break;
      default: break;
    }
  }
  /** Call once per tick after draining: per-minute gold marks and the sudden-death moment. */
  sample(world) {
    if (world.state.suddenDeath && this.match.suddenDeathMin === null) this.match.suddenDeathMin = +(world.tick / TICK_HZ / 60).toFixed(2);
    if (world.tick % (TICK_HZ * 60) === 0 && world.tick > 0) for (const h of world.heroes) { const r = this.byId.get(h.id); r.goldAt.push(Math.round(h.gold + r.goldSpent - RULES.START_GOLD)); }
  }
  finish(world) {
    const winner = world.state.over ? world.state.winner : null;
    for (const h of world.heroes) {
      const r = this.byId.get(h.id);
      r.goldEarned = Math.round(h.gold + r.goldSpent - RULES.START_GOLD);
      r.kills = h.kills; r.deaths = h.deaths; r.assists = h.assists; r.level = h.level; r.cs = h.cs; r.win = winner === r.team;
      const t0 = this.deadSince.get(h.id); if (t0 !== undefined) r.secondsDead += (world.tick - t0) / TICK_HZ;
      for (const k of Object.keys(r)) if (typeof r[k] === 'number' && !Number.isInteger(r[k])) r[k] = Math.round(r[k] * 100) / 100;
    }
    return { seed: world.seed, minutes: +(world.tick / TICK_HZ / 60).toFixed(2), winner, timedOut: winner === null, ...this.match, heroes: this.heroes };
  }
}
