// Shop (P or the gold button): browse anywhere, buy and sell at your fountain or while dead.
// Items form a build tree: components build into upgrades and finished items; what you own is used up and knocks its
// cost off the price (the sim's purchasePlan decides, so the shop shows exactly what a purchase will do).
// Purchases are ordinary commands through the transport; the sim stays the authority on gold.
import { h, clear, setText } from './dom.js';
import { statLines } from './format.js';
import { buyCmd, sellCmd } from '../sim/commands.js';
import { canShop, purchasePlan } from '../sim/match.js';
import { RULES } from '../sim/constants.js';
import { itemImpact } from './numbers.js';
import { itemIcon } from './identity.js';

const CATS = [['all', 'All'], ['attack', 'Attack'], ['magic', 'Magic'], ['defense', 'Defense'], ['movement', 'Movement'], ['support', 'Support']];
const TIERS = [[1, 'Components', 'Cheap parts: buy them early, they build into bigger items'], [2, 'Upgrades', 'Built from components'], [3, 'Finished items', 'The strongest items, each with a unique effect']];
const WHY = { owned: 'Already owned', group: 'You already have boots', full: 'Inventory full: sell something first', unknown: 'Unknown item' };

export class Shop {
  constructor(root, session, { onClose, tooltip }) {
    this.s = session; this.onClose = onClose; this.tip = tooltip; this.cat = 'all';
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
    setText(this.status, `${Math.floor(this.s.me.gold)} gold`);
    if (this.signature() !== this.sig) this.refresh();
  }
  /** What the cards depend on: shop access, inventory, level, and which purchases are possible. */
  signature() {
    const me = this.s.me, w = this.s.world; let afford = '';
    for (const k in w.registry.items) afford += purchasePlan(w, me, k).ok ? '1' : '0';
    return `${canShop(me)}|${me.items.join(',')}|${afford}|${me.level}|${this.cat}`;
  }
  refresh() {
    const me = this.s.me, w = this.s.world, items = w.registry.items, here = canShop(me);
    this.sig = this.signature();
    setText(this.status, `${Math.floor(me.gold)} gold`);
    const build = w.registry.heroes[me.heroKey].build || [];
    const card = (key) => {
      const it = items[key], plan = purchasePlan(w, me, key), owned = me.items.includes(key), rec = build.includes(key);
      const why = !here ? 'Return to your fountain to buy' : plan.reason === 'gold' ? `Need ${Math.ceil(plan.price - me.gold)} more gold` : WHY[plan.reason] || '';
      // what this item does for *your* hero, from the same numbers the sim uses
      const impact = itemImpact(w, me, key), fmt = (d) => `${d.delta > 0 ? '+' : ''}${Math.round(d.delta)}${d.unit}`;
      const short = impact.filter((d) => !d.label.startsWith('Effective')).slice(0, 3).map((d) => `${fmt(d)} ${d.label.replace(/^([QWER]) .*/, '$1').replace('Auto-attack hit', 'auto').replace('Auto-attack DPS', 'DPS').replace('Move speed', 'speed').replace('Cooldowns', 'CD')}`);
      // recipe: the components, lit when you hold them (the ones this purchase would use up)
      const usedKeys = plan.consume.map((i) => me.items[i]);
      const recipe = it.from.length ? h('div', { class: 'recipe' }, h('span', { class: 'lbl' }, 'from'), it.from.map((c) => {
        const i = usedKeys.indexOf(c), have = i >= 0; if (have) usedKeys.splice(i, 1);
        return h('span', { class: `part${have ? ' have' : ''}`, title: `${items[c].name}${have ? ' (owned)' : ''}` }, itemIcon(c, items[c]));
      }), h('span', { class: 'lbl' }, `+ ${it.cost - it.from.reduce((a, c) => a + items[c].cost, 0)}`)) : null;
      const discounted = plan.price < it.cost;
      const el = h('button', { class: `card t${it.tier}${rec ? ' rec' : ''}${owned ? ' owned' : ''}${me.gold < plan.price ? ' cant' : ''}${why ? ' off' : ''}`, 'aria-disabled': why ? 'true' : 'false', 'data-item': key,
        onclick: () => { if (!why) this.s.send(buyCmd(this.s.player, key)); } },
        h('div', { class: 'top' }, h('span', { class: 'nm' }, itemIcon(key, it), it.name),
          h('span', { class: 'cost' }, discounted ? h('s', {}, String(it.cost)) : null, String(plan.price))),
        h('div', { class: 'st' }, statLines(it.stats).join(' · ')),
        recipe,
        short.length ? h('div', { class: 'impact' }, `For you: ${short.join(' · ')}`) : null,
        it.desc ? h('div', { class: 'ds' }, it.desc) : null);
      const tipRows = impact.map((d) => [d.label, `${Math.round(d.from)} → ${Math.round(d.to)}${d.unit}`, 'up']);
      const into = it.into.length ? `Builds into ${it.into.map((k) => items[k].name).join(', ')}.` : '';
      const buyText = why || (discounted ? `Click to buy for ${plan.price} gold (your components cover ${it.cost - plan.price})` : `Click to buy for ${plan.price} gold`);
      el.addEventListener('pointerenter', () => this.tip && this.tip.show(el, it.name, buyText, [it.desc, into].filter(Boolean).join(' '), tipRows));
      el.addEventListener('pointerleave', () => this.tip && this.tip.hide());
      return el;
    };
    const inCat = (k) => this.cat === 'all' || (items[k].tags || [])[0] === this.cat;
    const sections = TIERS.map(([tier, label, sub]) => {
      const keys = Object.keys(items).filter((k) => items[k].tier === tier && inCat(k)).sort((a, b) => items[a].cost - items[b].cost);
      return keys.length ? h('div', { class: 'shop-cat' }, h('h4', {}, label, h('small', {}, sub)), h('div', { class: 'cards' }, keys.map(card))) : null;
    });
    const filters = h('div', { class: 'seg shop-filter', role: 'group', 'aria-label': 'Item category' }, CATS.map(([k, label]) =>
      h('button', { class: k === this.cat ? 'on' : '', 'aria-pressed': k === this.cat ? 'true' : 'false', 'data-cat': k, onclick: () => { this.cat = k; this.refresh(); } }, label)));
    const slots = [];
    for (let i = 0; i < RULES.MAX_ITEMS; i++) {
      const key = me.items[i], it = key && items[key];
      slots.push(it
        ? h('button', { class: 's full', disabled: !here, title: here ? `Sell for ${Math.floor(it.cost * RULES.SELL_RATIO)}` : 'Sell at your fountain', onclick: () => this.s.send(sellCmd(this.s.player, i)) }, itemIcon(key, it), it.name, h('small', {}, `sell ${Math.floor(it.cost * RULES.SELL_RATIO)}`))
        : h('div', { class: 's' }, ''));
    }
    clear(this.body).append(
      h('div', {}, filters, sections),
      h('aside', { class: 'inv' },
        h('div', { class: `notice${here ? ' ok' : ''}` }, here ? (me.dead ? 'You can shop while you respawn.' : 'At the fountain: buying is open.') : 'Browse anywhere. Buy at your fountain or while dead.'),
        h('div', { class: 'slots' }, slots),
        h('div', { class: 'build' }, h('b', {}, 'Recommended for this hero'), build.map((k) => h('span', { class: me.items.includes(k) ? 'own' : '' }, itemIcon(k, items[k]), `${items[k].name}${me.items.includes(k) ? ' ✓' : ''}`)))));
  }
  dispose() { this.el.remove(); }
}
