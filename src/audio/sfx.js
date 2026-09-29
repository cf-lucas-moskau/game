// Turns sim events into sounds. Events are copied into a preallocated ring while the renderer
// drains the stream (building Web Audio graphs there would bill the renderer's update); update()
// plays them with stereo position and distance from the camera, rate-limited per sound.
import { EV } from '../core/events.js';
import { KIND } from '../sim/constants.js';
import { S } from '../render/palette.js';
import { SOUNDS } from './sounds.js';
import { spatial, Throttle } from './theory.js';

const RING = 64;
const GAPS = { hitDealt: 0.05, hitTaken: 0.09, melee: 0.07, tower: 0.25, gold: 0.08, cast: 0.03, blink: 0.05, heroDeath: 0.2, relic: 0.3 };
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
      case EV.DAMAGE: if (ev.b === me.id && ev.a !== me.id) this.push('hitDealt', ev.x); else if (ev.a === me.id && ev.v >= 4) this.push('hitTaken', ev.x, '', true); break;
      case EV.AUTO_ATTACK: { const a = w.entities[ev.a]; if (a && a.kind === KIND.MELEE) this.push('melee', ev.x); break; }
      case EV.TOWER_SHOT: this.push('tower', ev.x); break;
      case EV.BLINK: this.push('blink', ev.x); break;
      case EV.KILL: if (ev.b === me.id) this.push('kill', ev.x, '', true); else this.push('heroDeath', ev.x); break;
      case EV.LEVEL_UP: if (ev.a === me.id) this.push('levelUp', ev.x, '', true); break;
      case EV.GOLD: if (ev.a === me.id) this.push('gold', ev.x, '', true); break;
      case EV.ITEM_BOUGHT: if (ev.a === me.id) this.push('buy', ev.x, '', true); break;
      case EV.RELIC: if (ev.a > 0) this.push('relic', ev.x); break;
      case EV.STRUCTURE_DOWN: this.push('structure', ev.x); break;
      case EV.WHALE_WARN: this.push('whaleWarn', 0, '', true); break;
      case EV.WHALE_ROLL: this.push('whaleRoll', 0, '', true); break;
      case EV.RESPAWN: if (ev.a === me.id) this.push('respawn', ev.x, '', true); break;
      case EV.FX: if (ev.s === 'sudden-death') this.push('suddenDeath', 0, '', true); break;
    }
  }
  update() {
    if (!this.len) return;
    const e = this.e, t = e.now, camX = this.s.renderer.cam.x / S;
    while (this.len) {
      const r = this.q[this.head]; this.head = (this.head + 1) % RING; this.len--;
      if (!this.throttle.ok(r.name, t)) continue;
      let pan = 0, gain = 1;
      if (!r.local) { const sp = spatial(r.x, camX); if (sp.gain < 0.05) continue; pan = sp.pan; gain = sp.gain; }
      SOUNDS[r.name](e, e.sfx, t, pan, gain, r.hero);
    }
  }
  /** One-shot sounds that are not sim events (UI, match result). */
  play(name) { if (this.e.ready) SOUNDS[name](this.e, this.e.sfx, this.e.now, 0, 1); }
  dispose() { this.untap(); }
}
