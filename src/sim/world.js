import { Rng } from '../core/rng.js';
import { SpatialHash } from '../core/spatial-hash.js';
import { EventStream } from '../core/events.js';
import { createEntity, resetEntity, isTargetable } from './entity.js';
import { LANE, KIND } from './constants.js';

// World = all simulation state. No DOM, no wall clock, no Math.random.
export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.tick = 0;
    this.entities = [];         // index == id
    this.freeIds = [];
    this.heroes = [];           // hero entities in spawn order
    this.structures = [];
    this.projectiles = [];
    this.zones = [];
    this.walls = [];
    this.pickups = [];
    this.timers = [];           // [{at, fn}], kept sorted by at then insertion
    this.timerSeq = 0;
    this.events = new EventStream(4096);
    this.hash = new SpatialHash(LANE.W, LANE.H, 200, 4096);
    this.scratch = new Int32Array(1024);
    this.scratch2 = new Int32Array(1024);
    this.nextFxId = 1;
    this.state = { whale: { phase: 'idle', dir: 0, until: 0, next: 0 }, suddenDeath: false, winner: -1, over: false, waveCount: 0 };
    this.systems = [];
    this.registry = { heroes: {}, items: {} };
    this.stats = { tickMs: 0 };
  }

  // ---- entities -------------------------------------------------------------
  spawn(kind, team, x, y) {
    let e;
    if (this.freeIds.length) { e = resetEntity(this.entities[this.freeIds.pop()]); }
    else { e = createEntity(); e.id = this.entities.length; this.entities.push(e); }
    const id = e.id; resetEntity(e); e.id = id;
    e.alive = true; e.kind = kind; e.team = team; e.x = e.px = x; e.y = e.py = y;
    e.facing = team === 0 ? 0 : Math.PI;
    return e;
  }
  despawn(e) {
    if (!e.alive) return;
    e.alive = false;
    if (e.kind !== KIND.HERO) this.freeIds.push(e.id); // heroes keep ids for the whole match
  }
  get(id) { const e = id >= 0 ? this.entities[id] : undefined; return e && e.alive ? e : null; }

  /** Rebuild spatial index of targetable units. */
  reindex() {
    this.hash.clear();
    const es = this.entities;
    for (let i = 0; i < es.length; i++) { const e = es[i]; if (e.alive && !e.dead) this.hash.insert(i, e.x, e.y); }
  }
  /**
   * Visit living units within r of (x,y) (edge-inclusive by their radius).
   * filter: 'enemy'|'ally'|'any' relative to team. Returns count visited.
   */
  forEachInRadius(x, y, r, team, filter, fn, includeUntargetable = false) {
    const out = this.scratch; const n = this.hash.query(x, y, r + 130, out);
    let c = 0;
    for (let i = 0; i < n; i++) {
      const e = this.entities[out[i]];
      if (!e.alive || e.dead) continue;
      if (!includeUntargetable && !isTargetable(e, this.tick)) continue;
      if (filter === 'enemy' && e.team === team) continue;
      if (filter === 'ally' && e.team !== team) continue;
      const rr = r + e.radius, dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr) { c++; if (fn(e) === false) break; }
    }
    return c;
  }
  nearestEnemy(x, y, r, team, pred) {
    let best = null, bd = Infinity;
    this.forEachInRadius(x, y, r, team, 'enemy', (e) => {
      if (pred && !pred(e)) return;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd || (d === bd && e.id < best.id)) { bd = d; best = e; }
    });
    return best;
  }

  // ---- timers ---------------------------------------------------------------
  schedule(ticksFromNow, fn) {
    const t = { at: this.tick + Math.max(1, ticksFromNow | 0), seq: this.timerSeq++, fn };
    let i = this.timers.length;
    while (i > 0 && (this.timers[i - 1].at > t.at)) i--;
    this.timers.splice(i, 0, t);
    return t;
  }
  runTimers() {
    while (this.timers.length && this.timers[0].at <= this.tick) this.timers.shift().fn(this);
  }

  // ---- step -----------------------------------------------------------------
  /** Advance one fixed tick. commands: array of command objects for this tick. */
  step(commands) {
    this.tick++;
    const es = this.entities;
    for (let i = 0; i < es.length; i++) { const e = es[i]; e.px = e.x; e.py = e.y; }
    for (const p of this.projectiles) { p.px = p.x; p.py = p.y; }
    this.reindex();
    this.runTimers();
    for (let s = 0; s < this.systems.length; s++) this.systems[s](this, commands);
  }
}
