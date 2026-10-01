// Map-feature HUD: active buffs (chips with seconds left), the Sky Pearl capture bar, and banners and kill-feed lines
// for camps and objectives. Owned by the HUD; reads the world and the event stream like the rest of the UI.
import { h, setNum, setScaleX, toggle } from './dom.js';
import { EV } from '../core/events.js';
import { TICK_HZ } from '../sim/constants.js';
import { BUFFS } from '../sim/buffs.js';

const TEAM_NAME = ['Blue', 'Red'];
export class ObjectiveHud {
  constructor(hud) {
    this.hud = hud; this.s = hud.s;
    this.buffs = h('div', { class: 'buffs', 'aria-label': 'Active buffs' });
    this.sig = '';
    this.chips = [];
    this.campsAnnounced = false;
  }
  /** Buff chips: rebuilt when the set of buffs changes, seconds updated in place. */
  update() {
    const me = this.s.me, t = this.s.world.tick, list = me.buffs || [];
    let sig = ''; for (let i = 0; i < list.length; i++) sig += list[i].key + ',';
    if (sig !== this.sig) {
      this.sig = sig; this.chips.length = 0; this.buffs.replaceChildren();
      for (const b of list) {
        const spec = BUFFS[b.key], n = h('span', { class: 'n' });
        const chip = h('div', { class: `buff${spec.good ? ' good' : ''}`, title: spec.desc, 'data-buff': b.key }, h('b', {}, spec.name), n);
        this.buffs.append(chip); this.chips.push({ b, n });
      }
      toggle(this.buffs, 'empty', !list.length);
    }
    for (const c of this.chips) setNum(c.n, Math.max(0, Math.ceil((c.b.until - t) / TICK_HZ)));
  }
  onEvent(e) {
    const w = this.s.world, me = this.s.me, hud = this.hud;
    if (e.type === EV.BUFF && e.a === me.id) { const spec = BUFFS[e.s]; if (spec) hud.showBanner(spec.name, spec.desc, 'good', 2400); return; }
    if (e.type !== EV.OBJECTIVE) return;
    switch (e.s) {
      case 'camp-up':
        if (!this.campsAnnounced) { this.campsAnnounced = true; hud.showBanner('Barnacle Crabs surfaced', 'Slay one in the middle for gold and +10% damage', 'warn', 3200); }
        break;
      case 'camp-slain': {
        if (e.b < 0) break;
        const killer = w.entities[e.a], name = killer ? hud.heroName(killer.id) : TEAM_NAME[e.b];
        hud.feedLine([h('span', { class: `t${e.b}` }, name), h('span', { class: 'x' }, 'slew a'), h('span', { class: 'neutral' }, 'Barnacle Crab')], killer === me);
        break;
      }
    }
  }
}
