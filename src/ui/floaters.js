// Floating combat numbers from the sim event stream: damage you deal and take, heals on you, gold
// you earn. A fixed pool of DOM nodes; positions are re-projected every frame so numbers stay
// pinned to the battlefield while the camera moves.
import { h } from './dom.js';
import { EV } from '../core/events.js';

const POOL = 36, LIFE = 900;
export class Floaters {
  constructor(root, session, settings) {
    this.s = session; this.settings = settings;
    this.el = h('div', { class: 'floaters', 'aria-hidden': 'true' }); root.append(this.el);
    this.pool = []; this.next = 0; this.p = { x: 0, y: 0, visible: false };
    for (let i = 0; i < POOL; i++) { const n = h('div', { class: 'fl hidden' }, h('span')); this.el.append(n); this.pool.push({ n, x: 0, y: 0, hgt: 0, born: -1e9, dx: 0 }); }
    this.untap = session.tapEvents((e) => this.onEvent(e));
    this.acc = new Map(); // merge rapid ticks of damage-over-time on the same target
  }
  spawn(x, y, text, cls, hgt = 1.9) {
    const f = this.pool[this.next]; this.next = (this.next + 1) % POOL;
    f.x = x; f.y = y; f.hgt = hgt; f.born = performance.now(); f.dx = (Math.random() - 0.5) * 36;
    f.n.className = `fl ${cls}`; const sp = f.n.firstChild; sp.textContent = text;
    sp.style.animation = 'none'; void sp.offsetWidth; sp.style.animation = '';
    this.place(f); // events arrive while the renderer drains them, after this frame's update()
  }
  place(f) {
    const p = this.s.renderer.project(f.x, f.y, f.hgt, this.p);
    f.n.style.transform = `translate3d(${(p.x + f.dx).toFixed(1)}px,${p.y.toFixed(1)}px,0)`;
  }
  onEvent(e) {
    if (!this.settings.get('damageNumbers')) return;
    const me = this.s.me;
    if (e.type === EV.DAMAGE) {
      const amt = Math.round(e.v); if (amt < 1) return;
      if (e.b === me.id && e.a !== me.id) this.spawn(e.x, e.y, String(amt), `${e.s === 'm' ? 'magic' : e.s === 't' ? 'true' : 'dealt'}${amt >= 200 ? ' big' : ''}`);
      else if (e.a === me.id && amt >= 4) this.spawn(e.x, e.y, `-${amt}`, 'taken', 2.3);
    } else if (e.type === EV.HEAL && e.a === me.id && e.v >= 25) this.spawn(e.x, e.y, `+${Math.round(e.v)}`, 'heal', 2.4);
    else if (e.type === EV.GOLD && e.a === me.id && e.v >= 1) this.spawn(e.x, e.y, `+${Math.round(e.v)}g`, 'gold', 2.8);
  }
  update(now) {
    for (const f of this.pool) {
      const alive = now - f.born < LIFE;
      if (!alive) { if (!f.n._h) { f.n._h = true; f.n.classList.add('hidden'); } continue; }
      if (f.n._h) { f.n._h = false; f.n.classList.remove('hidden'); }
      this.place(f);
    }
  }
  dispose() { this.untap(); this.el.remove(); }
}
