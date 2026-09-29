// Inspect any unit: click it (desktop) or tap it (touch), or click a scoreboard row. Heroes show
// level, K/D/A, health, items (with tooltips) and combat stats; minions and towers show what they hit
// for. Refreshed 4 times a second while open; it follows the unit until closed or it disappears.
import { h, clear } from './dom.js';
import { emblem } from './menu.js';
import { itemIcon } from './identity.js';
import { statLines } from './format.js';
import { KIND, STRUCT, TICK_HZ, RULES } from '../sim/constants.js';
import { autoNumbers } from './numbers.js';

const KIND_NAME = { [KIND.MELEE]: 'Melee minion', [KIND.RANGED]: 'Caster minion', [KIND.SIEGE]: 'Siege ram', [KIND.TOWER]: 'Tower', [KIND.HEART]: 'Heartstone', [KIND.PEBBLE]: 'Pebble' };
export class InspectPanel {
  constructor(root, session, { tooltip }) {
    this.s = session; this.tip = tooltip; this.id = -1; this.next = 0;
    this.body = h('div', { class: 'ins-body' });
    this.el = h('aside', { class: 'inspect interactive hidden', 'aria-label': 'Unit details' },
      h('button', { class: 'x-btn small', onclick: () => this.hide(), 'aria-label': 'Close details' }, '✕'), this.body);
    root.append(this.el);
  }
  get open() { return this.id >= 0; }
  show(id) { this.id = id; this.next = 0; this.el.classList.remove('hidden'); this.update(performance.now()); }
  hide() { this.id = -1; this.el.classList.add('hidden'); this.tip.hide(); }
  update(now) {
    if (this.id < 0 || now < this.next) return; this.next = now + 250;
    const w = this.s.world, e = w.entities[this.id], me = this.s.me;
    if (!e || !e.alive) { this.hide(); return; }
    const mine = e.team === me.team, tcls = `t${e.team}`;
    const hp = h('div', { class: 'ins-hp' }, h('i', { style: { transform: `scaleX(${Math.max(0, e.hp / e.maxHp).toFixed(3)})` } }), h('b', {}, e.dead ? 'Respawning' : `${Math.ceil(e.hp)} / ${Math.round(e.maxHp)}`));
    if (e.kind === KIND.HERO) {
      const def = w.registry.heroes[e.heroKey], a = autoNumbers(e);
      const slots = [];
      for (let i = 0; i < RULES.MAX_ITEMS; i++) {
        const key = e.items[i], it = key && w.registry.items[key];
        const el = h('div', { class: `ins-item${it ? ' full' : ''}`, title: it ? it.name : '' }, it ? itemIcon(key, it) : null, it ? h('small', {}, it.name) : null);
        if (it) { el.addEventListener('pointerenter', () => this.tip.show(el, it.name, statLines(it.stats).join(' · '), it.desc || '')); el.addEventListener('pointerleave', () => this.tip.hide()); }
        slots.push(el);
      }
      const stats = [['Attack damage', Math.round(e.ad)], ['Ability power', Math.round(e.ap)], ['Armor', Math.round(e.armor)], ['Magic resist', Math.round(e.mr)],
        ['Attack speed', e.as.toFixed(2)], ['Auto DPS', Math.round(a.dps)], ['Move speed', Math.round(e.speed)], ['Range', Math.round(e.range)]];
      clear(this.body).append(
        h('div', { class: 'ins-head' }, emblem(e.heroKey, '', this.s.skinOf ? this.s.skinOf(e) : 'classic'), h('div', {}, h('div', { class: `ins-name ${tcls}` }, def.name), h('div', { class: 'ins-sub' }, `${e === me ? 'You' : mine ? 'Ally' : 'Enemy'} · Level ${e.level} `, h('span', { class: 'kda' }, `· ${e.kills} / ${e.deaths} / ${e.assists}`)))),
        hp, h('div', { class: 'ins-label' }, 'Items'), h('div', { class: 'ins-items' }, slots),
        h('div', { class: 'ins-stats' }, stats.map(([k, v]) => [h('span', {}, k), h('b', {}, String(v))])));
    } else {
      const minutes = w.tick / TICK_HZ / 60;
      const dmg = e.kind === KIND.TOWER ? e.baseAd + STRUCT.TOWER.adPerMin * minutes : e.baseAd;
      const rows = [];
      if (dmg) rows.push(['Damage per hit', Math.round(dmg)]);
      if (e.kind === KIND.TOWER) rows.push(['Vs. minions', 'most of their health']);
      if (e.range) rows.push(['Range', Math.round(e.range)]);
      rows.push(['Armor', Math.round(e.armor)], ['Magic resist', Math.round(e.mr)]);
      const note = (e.kind === KIND.TOWER || e.kind === KIND.HEART) && !e.vulnerable ? 'Protected: destroy the tower in front of it first.' : e.kind === KIND.TOWER ? 'Shoots enemy heroes that attack its allies, otherwise the nearest minion.' : '';
      clear(this.body).append(
        h('div', { class: 'ins-head' }, h('div', {}, h('div', { class: `ins-name ${tcls}` }, KIND_NAME[e.kind] || 'Unit'), h('div', { class: 'ins-sub' }, mine ? 'Allied' : 'Enemy'))),
        hp, h('div', { class: 'ins-stats' }, rows.map(([k, v]) => [h('span', {}, k), h('b', {}, String(v))])), note ? h('div', { class: 'ins-note' }, note) : null);
    }
  }
  dispose() { this.el.remove(); }
}
