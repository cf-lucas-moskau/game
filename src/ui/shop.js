// Shop (P or the gold button): browse anywhere, buy and sell at your fountain or while dead.
// Purchases are ordinary commands through the transport; the sim stays the authority on gold.
import { h, clear, setText } from './dom.js';
import { statLines } from './format.js';
import { buyCmd, sellCmd } from '../sim/commands.js';
import { canShop } from '../sim/match.js';
import { BUILDS } from '../sim/items/index.js';
import { RULES } from '../sim/constants.js';
import { itemImpact } from './numbers.js';

const CATS = [['attack', 'Attack'], ['magic', 'Magic'], ['defense', 'Defense'], ['movement', 'Movement']];
export class Shop {
  constructor(root, session, { onClose, tooltip }) {
    this.s = session; this.onClose = onClose; this.tip = tooltip;
    this.body = h('div', { class: 'shop-grid' });
    this.status = h('span', { class: 'sub' });
    this.el = h('div', { class: 'modal screen hidden', role: 'dialog', 'aria-label': 'Shop', onpointerdown: (e) => { if (e.target === this.el) onClose(); } },
      h('div', { class: 'panel' }, h('header', {}, h('div', {}, h('h2', {}, 'Shop'), this.status), h('button', { class: 'x-btn', onclick: onClose, 'aria-label': 'Close shop' }, '✕')), this.body));
    root.append(this.el); this.open = false; this.sig = '';
  }
  show() { this.open = true; this.el.classList.remove('hidden'); this.sig = ''; this.refresh(); }
  hide() { this.open = false; this.el.classList.add('hidden'); if (this.tip) this.tip.hide(); }
  /** Re-render only when something the shop shows has changed (gold, items, shop access). */
  update() {
    if (!this.open) return;
    const me = this.s.me;
    setText(this.status, `${Math.floor(me.gold)} gold`);
    if (this.signature() !== this.sig) this.refresh();
  }
  /** What the cards depend on: shop access, inventory, and which items are affordable. */
  signature() {
    const me = this.s.me, items = this.s.world.registry.items; let afford = '';
    for (const k in items) afford += me.gold >= items[k].cost ? '1' : '0';
    return `${canShop(me)}|${me.items.join(',')}|${afford}|${me.level}`;
  }
  refresh() {
    const me = this.s.me, w = this.s.world, items = w.registry.items, here = canShop(me), full = me.items.length >= RULES.MAX_ITEMS;
    this.sig = this.signature();
    setText(this.status, `${Math.floor(me.gold)} gold`);
    const build = BUILDS[me.heroKey] || [];
    const card = (key) => {
      const it = items[key], owned = me.items.includes(key), rec = build.includes(key);
      const why = !here ? 'Return to your fountain to buy' : full ? 'Inventory full: sell something first' : it.unique && owned ? 'Already owned' : me.gold < it.cost ? `Need ${Math.ceil(it.cost - me.gold)} more gold` : '';
      // what this item does for *your* hero, from the same numbers the sim uses
      const impact = itemImpact(w, me, key), fmt = (d) => `${d.delta > 0 ? '+' : ''}${Math.round(d.delta)}${d.unit}`;
      const short = impact.filter((d) => !d.label.startsWith('Effective')).slice(0, 3).map((d) => `${fmt(d)} ${d.label.replace(/^([QWER]) .*/, '$1').replace('Auto-attack hit', 'auto').replace('Auto-attack DPS', 'DPS').replace('Move speed', 'speed').replace('Cooldowns', 'CD')}`);
      const el = h('button', { class: `card${rec ? ' rec' : ''}${owned ? ' owned' : ''}${me.gold < it.cost ? ' cant' : ''}${why ? ' off' : ''}`, 'aria-disabled': why ? 'true' : 'false', 'data-item': key,
        onclick: () => { if (!why) this.s.send(buyCmd(this.s.player, key)); } },
        h('div', { class: 'top' }, h('span', {}, it.name), h('span', { class: 'cost' }, String(it.cost))),
        h('div', { class: 'st' }, statLines(it.stats).join(' · ')),
        short.length ? h('div', { class: 'impact' }, `For you: ${short.join(' · ')}`) : null,
        it.desc ? h('div', { class: 'ds' }, it.desc) : null);
      const tipRows = impact.map((d) => [d.label, `${Math.round(d.from)} → ${Math.round(d.to)}${d.unit}`, 'up']);
      el.addEventListener('pointerenter', () => this.tip && this.tip.show(el, it.name, why || `Click to buy for ${it.cost} gold`, it.desc || '', tipRows));
      el.addEventListener('pointerleave', () => this.tip && this.tip.hide());
      return el;
    };
    const cats = CATS.map(([tag, label]) => {
      const keys = Object.keys(items).filter((k) => (items[k].tags || [])[0] === tag).sort((a, b) => items[a].cost - items[b].cost);
      return keys.length ? h('div', { class: 'shop-cat' }, h('h4', {}, label), h('div', { class: 'cards' }, keys.map(card))) : null;
    });
    const slots = [];
    for (let i = 0; i < RULES.MAX_ITEMS; i++) {
      const key = me.items[i], it = key && items[key];
      slots.push(it
        ? h('button', { class: 's full', disabled: !here, title: here ? `Sell for ${Math.floor(it.cost * RULES.SELL_RATIO)}` : 'Sell at your fountain', onclick: () => this.s.send(sellCmd(this.s.player, i)) }, it.name, h('small', {}, `sell ${Math.floor(it.cost * RULES.SELL_RATIO)}`))
        : h('div', { class: 's' }, ''));
    }
    clear(this.body).append(
      h('div', {}, cats),
      h('aside', { class: 'inv' },
        h('div', { class: `notice${here ? ' ok' : ''}` }, here ? (me.dead ? 'You can shop while you respawn.' : 'At the fountain: buying is open.') : 'Browse anywhere. Buy at your fountain or while dead.'),
        h('div', { class: 'slots' }, slots),
        h('div', { class: 'build' }, h('b', {}, 'Recommended for this hero'), build.map((k) => h('span', { class: me.items.includes(k) ? 'own' : '' }, `${me.items.includes(k) ? '✓' : '·'} ${items[k].name}`)))));
  }
  dispose() { this.el.remove(); }
}
