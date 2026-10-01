// Turns sim events into sounds. Events are copied into a preallocated ring while the renderer
// drains the stream (building Web Audio graphs there would bill the renderer's update); update()
// plays them with stereo position and distance from the camera, rate-limited per sound.
import { EV } from '../core/events.js';
import { KIND } from '../sim/constants.js';
import { S } from '../render/palette.js';
import { SOUNDS } from './sounds.js';
import { spatial, Throttle } from './theory.js';

const RING = 64;
const PER_FRAME = 3; // graphs built per frame; the rest of a burst is dropped (the ear cannot separate them anyway)
const GAPS = { auto: 0.06, towerLock: 1, towerHit: 0.2, hitDealt: 0.05, hitTaken: 0.09, melee: 0.07, tower: 0.25, gold: 0.08, cast: 0.03, blink: 0.05, heroDeath: 0.2, relic: 0.3, campUp: 1, campSlain: 0.5, buff: 0.5, pearlWarn: 2, pearlUp: 2, pearlOurs: 2, pearlTheirs: 2, loot: 0.1, streak: 1 };
export class SfxDirector {
  constructor(engine, session) {
    this.e = engine; this.s = session;
    this.q = Array.from({ length: RING }, () => ({ name: '', x: 0, hero: '', local: false }));
    this.head = 0; this.len = 0; this.throttle = new Throttle(GAPS);
    this.untap = session.tapEvents((ev) => this.onEvent(ev));
  }
  push(name, x, hero = '', local = false) {
    if (this.len >= RING) return;
    const r = this.q[(this.head + this.len) % RING]; this.len++;
    r.name = name; r.x = x; r.hero = hero; r.local = local;
  }
  onEvent(ev) {
    if (!this.e.ready) return;
    const w = this.s.world, me = this.s.me;
    switch (ev.type) {
      case EV.CAST: this.push('cast', ev.x, ev.s, ev.a === me.id); break;
      case EV.DAMAGE: {
        const src = ev.b >= 0 ? w.entities[ev.b] : null;
        if (ev.b === me.id && ev.a !== me.id) this.push('hitDealt', ev.x);
        else if (ev.a === me.id && src && src.kind === KIND.TOWER) this.push('towerHit', ev.x, '', true);
        else if (ev.a === me.id && ev.v >= 4) this.push('hitTaken', ev.x, '', true);
        break;
      }
      case EV.AUTO_ATTACK: { const a = w.entities[ev.a]; if (!a) break; if (a.kind === KIND.MELEE) this.push('melee', ev.x); else if (a.kind === KIND.HERO) this.push('auto', ev.x, a.heroKey, a === me); break; }
      case EV.TOWER_SHOT: this.push('tower', ev.x); break;
      case EV.BLINK: this.push('blink', ev.x); break;
      case EV.KILL: if (ev.b === me.id) this.push(ev.s === 'shutdown' ? 'shutdown' : 'kill', ev.x, '', true); else this.push('heroDeath', ev.x); break;
      case EV.LEVEL_UP: if (ev.a === me.id) this.push('levelUp', ev.x, '', true); break;
      case EV.GOLD: if (ev.a === me.id) this.push('gold', ev.x, '', true); break;
      case EV.ITEM_BOUGHT: if (ev.a === me.id) this.push('buy', ev.x, '', true); break;
      case EV.RELIC: if (ev.a > 0) this.push('relic', ev.x); break;
      case EV.STRUCTURE_DOWN: this.push('structure', ev.x); break;
      case EV.WHALE_WARN: this.push('whaleWarn', 0, '', true); break;
      case EV.WHALE_ROLL: this.push('whaleRoll', 0, '', true); break;
      case EV.RESPAWN: if (ev.a === me.id) this.push('respawn', ev.x, '', true); break;
      case EV.FX: if (ev.s === 'sudden-death') this.push('suddenDeath', 0, '', true); break;
      case EV.BUFF: if (ev.a === me.id) this.push('buff', ev.x, '', true); break;
      case EV.PICKUP: this.push('loot', ev.x, '', ev.a === me.id); break;
      case EV.OBJECTIVE:
        if (ev.s === 'camp-slain') this.push('campSlain', ev.x);
        else if (ev.s === 'camp-up') this.push('campUp', ev.x);
        else if (ev.s === 'streak') this.push('streak', 0, '', true);
        else if (ev.s === 'pearl-warn') this.push('pearlWarn', 0, '', true);
        else if (ev.s === 'pearl-up') this.push('pearlUp', ev.x);
        else if (ev.s === 'pearl-taken') this.push(ev.b === me.team ? 'pearlOurs' : 'pearlTheirs', 0, '', true);
        break;
    }
  }
  update() {
    // a tower acquiring you gets an alarm (once per lock)
    const me = this.s.me; let locked = false;
    if (!me.dead) for (const st of this.s.world.structures) if (st.alive && st.kind === KIND.TOWER && st.team !== me.team && st.targetId === me.id) { locked = true; break; }
    if (locked && !this.locked && this.e.ready) this.push('towerLock', me.x, '', true);
    this.locked = locked;
    if (!this.len) return;
    const e = this.e, t = e.now, camX = this.s.renderer.cam.x / S;
    let built = 0;
    while (this.len) {
      const r = this.q[this.head]; this.head = (this.head + 1) % RING; this.len--;
      if (!this.throttle.ok(r.name, t)) continue;
      let pan = 0, gain = 1;
      if (!r.local) { const sp = spatial(r.x, camX); if (sp.gain < 0.05) continue; pan = sp.pan; gain = sp.gain; }
      if (built >= PER_FRAME) continue;
      SOUNDS[r.name](e, e.sfx, t, pan, gain, r.hero); built++;
    }
  }
  /** One-shot sounds that are not sim events (UI, match result). */
  play(name) { if (this.e.ready) SOUNDS[name](this.e, this.e.sfx, this.e.now, 0, 1); }
  dispose() { this.untap(); }
}
