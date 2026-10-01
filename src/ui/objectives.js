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
    this.campsAnnounced = false; this.lootAnnounced = false;
    // Sky Pearl bar (a row of the top bar): countdown while announced, capture progress in the holder's colour
    this.pFill = h('i'); this.pText = h('span', { class: 'st' });
    this.bar = h('div', { class: 'objective hidden', 'aria-label': 'Sky Pearl' }, h('span', { class: 'lbl' }, 'Sky Pearl'), h('div', { class: 'track' }, this.pFill), this.pText);
    this.pSig = -1;
  }
  updatePearl() {
    const p = this.s.world.state.pearl, me = this.s.me;
    const show = !!p && p.phase !== 'idle'; toggle(this.bar, 'hidden', !show); if (!show) return;
    // the label is rebuilt only when what it says changes (a numeric key per state), never per frame
    let key, cls;
    const contested = p.phase === 'up' && p.inside[0] > 0 && p.inside[1] > 0, pct = Math.round(p.prog * 100);
    if (p.phase === 'warn') { key = 1000 + Math.max(0, Math.ceil((p.until - this.s.world.tick) / TICK_HZ)); cls = 'warn'; setScaleX(this.pFill, 0); }
    else { cls = p.holder < 0 ? 'free' : p.holder === me.team ? 'ours' : 'theirs'; key = contested ? 1 : p.holder < 0 ? 2 : (p.holder === me.team ? 10000 : 20000) + pct; setScaleX(this.pFill, p.prog); }
    if (key !== this.pSig) {
      this.pSig = key;
      this.pText.textContent = p.phase === 'warn' ? `surfaces in ${key - 1000} s` : contested ? 'contested' : p.holder < 0 ? 'hold the circle' : `${p.holder === me.team ? 'yours' : 'enemy'} ${pct}%`;
    }
    if (this.bar._cls !== cls) { this.bar._cls = cls; this.bar.className = `objective ${cls}`; }
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
    this.updatePearl();
  }
  onEvent(e) {
    const w = this.s.world, me = this.s.me, hud = this.hud;
    if (e.type === EV.BUFF && e.a === me.id) { const spec = BUFFS[e.s]; if (spec) hud.showBanner(spec.name, spec.desc, 'good', 2400); return; }
    if (e.type !== EV.OBJECTIVE) return;
    switch (e.s) {
      case 'camp-up':
        if (!this.campsAnnounced) { this.campsAnnounced = true; hud.showBanner('Barnacle Crabs surfaced', 'Slay one in the middle for gold and +10% damage', 'warn', 3200); }
        break;
      case 'pearl-warn': hud.showBanner('The Sky Pearl stirs', `It surfaces at the centre in ${e.v} s. Hold its circle to claim it.`, 'warn', 3200); break;
      case 'pearl-up': hud.showBanner('The Sky Pearl has surfaced', 'Hold the circle with no enemy inside', 'warn', 2600); break;
      case 'pearl-taken': {
        const ours = e.b === me.team;
        hud.showBanner(ours ? 'Your team claimed the Sky Pearl' : 'The enemy claimed the Sky Pearl',
          ours ? `Pearl's Blessing for everyone, and a Pearl Golem joins your next ${e.v} waves` : `A Pearl Golem leads their next ${e.v} waves`, ours ? 'good' : 'bad', 3000);
        hud.feedLine([h('span', { class: `t${e.b}` }, TEAM_NAME[e.b]), h('span', { class: 'x' }, 'claimed the'), h('span', { class: 'neutral' }, 'Sky Pearl')], ours);
        break;
      }
      case 'loot-up': if (!this.lootAnnounced) { this.lootAnnounced = true; hud.showBanner('Treasure washed up', 'Grab it from the edge while the whale rolls, if you dare', 'warn', 2600); } break;
      case 'pearl-sank': hud.feedLine([h('span', { class: 'neutral' }, 'Sky Pearl'), h('span', { class: 'x' }, 'sank unclaimed')]); break;
      case 'camp-slain': {
        if (e.b < 0) break;
        const killer = w.entities[e.a], name = killer ? hud.heroName(killer.id) : TEAM_NAME[e.b];
        hud.feedLine([h('span', { class: `t${e.b}` }, name), h('span', { class: 'x' }, 'slew a'), h('span', { class: 'neutral' }, 'Barnacle Crab')], killer === me);
        break;
      }
    }
  }
}
