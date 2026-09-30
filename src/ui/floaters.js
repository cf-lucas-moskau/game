// Floating combat numbers from the sim event stream: damage you deal and take, heals on you, gold
// you earn. A fixed pool of DOM nodes; positions are re-projected every frame so numbers stay
// pinned to the battlefield while the camera moves. Events only fill a pool record (they arrive
// while the renderer drains the stream); DOM work happens in update(), with no forced layout.
import { h } from './dom.js';
import { EV } from '../core/events.js';

const POOL = 36, LIFE = 900;
const RISE = [
  { transform: 'translate(-50%, 0) scale(1.25)', opacity: 1 },
  { transform: 'translate(-50%, -32px) scale(1)', opacity: 1, offset: 0.7 },
  { transform: 'translate(-50%, -46px) scale(1)', opacity: 0 },
];
const FADE = [{ transform: 'translate(-50%, 0)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%, 0)', opacity: 0 }];
const RISE_OPTS = { duration: LIFE, easing: 'ease-out', fill: 'forwards' };
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export class Floaters {
  constructor(root, session, settings) {
    this.s = session; this.settings = settings;
    this.el = h('div', { class: 'floaters', 'aria-hidden': 'true' }); root.append(this.el);
    this.pool = []; this.next = 0; this.p = { x: 0, y: 0, visible: false };
    for (let i = 0; i < POOL; i++) {
      const n = h('div', { class: 'fl hidden' }, h('span'));
      this.el.append(n); this.pool.push({ n, x: 0, y: 0, hgt: 0, born: -1e9, dx: 0, text: '', cls: '', pending: false, shown: false });
    }
    this.untap = session.tapEvents((e) => this.onEvent(e));
    this.frames = reducedMotion() ? FADE : RISE;
  }
  spawn(x, y, text, cls, hgt = 1.9) {
    const f = this.pool[this.next]; this.next = (this.next + 1) % POOL;
    f.x = x; f.y = y; f.hgt = hgt; f.text = text; f.cls = cls; f.pending = true;
  }
  onEvent(e) {
    if (!this.settings.get('damageNumbers')) return;
    const me = this.s.me;
    if (e.type === EV.DAMAGE) {
      const amt = Math.round(e.v); if (amt < 1) return;
      if (e.b === me.id && e.a !== me.id) this.spawn(e.x, e.y, String(amt), `${e.s === 'm' ? 'magic' : e.s === 't' ? 'true' : 'dealt'}${amt >= 200 ? ' big' : ''}`);
      else if (e.a === me.id && amt >= 4) this.spawn(e.x, e.y, `-${amt}`, 'taken', 2.3);
    } else if (e.type === EV.HEAL && e.c !== 1 && e.a === me.id && e.v >= 25) this.spawn(e.x, e.y, `+${Math.round(e.v)}`, 'heal', 2.4);
    else if (e.type === EV.GOLD && e.a === me.id && e.v >= 1) this.spawn(e.x, e.y, `+${Math.round(e.v)}g`, 'gold', 2.8);
  }
  update(now) {
    for (const f of this.pool) {
      if (f.pending) {
        f.pending = false; f.born = now; f.dx = (Math.random() - 0.5) * 36;
        f.n.className = `fl ${f.cls}`; f.shown = true;
        const sp = f.n.firstChild; sp.textContent = f.text; sp.animate(this.frames, RISE_OPTS);
      } else if (!f.shown) continue;
      if (now - f.born >= LIFE) { f.shown = false; f.n.classList.add('hidden'); continue; }
      const p = this.s.renderer.project(f.x, f.y, f.hgt, this.p);
      f.n.style.transform = `translate3d(${(p.x + f.dx).toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
    }
  }
  dispose() { this.untap(); this.el.remove(); }
}
