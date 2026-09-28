// In-match HUD: lane strip + score + clock, kill feed, banners, respawn timer, and the dock
// (portrait with level/XP ring, HP and resource bars, abilities with cooldowns, D/F, items, gold).
// Every per-frame write goes through change-detecting setters; nothing allocates while values hold.
import { h, setText, setStyle, toggle } from './dom.js';
import { LaneStrip } from './minimap.js';
import { emblem } from './menu.js';
import { clock, secs } from './format.js';
import { EV } from '../core/events.js';
import { KIND, RULES, xpToNext } from '../sim/constants.js';
import { byRank } from '../sim/abilities.js';
import { canShop } from '../sim/match.js';
import { itemActiveCmd } from '../sim/commands.js';

const KEYS = ['Q', 'W', 'E', 'R'];
const RES_COLOR = { mana: 'linear-gradient(180deg,#7aa2ff,#4a6fe0)', ink: 'linear-gradient(180deg,#a99cff,#7564e8)', flame: 'linear-gradient(180deg,#ffc27a,#f07a3a)', swarm: 'linear-gradient(180deg,#ffe07a,#e0a82e)' };
const RING = 2 * Math.PI * 34;
const cdMask = (f) => (f > 0 ? `conic-gradient(rgba(8,10,28,.74) ${Math.round(f * 360)}deg, transparent 0)` : '');
const short = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 3);

export class Hud {
  constructor(root, session, { touch, onShop, onScoreboard, onMenu, tooltip }) {
    this.s = session; this.tip = tooltip; this.touch = touch;
    const w = session.world, me = session.me, def = w.registry.heroes[me.heroKey];
    this.def = def;
    // ---- top
    this.blue = h('div', { class: 'score blue', title: 'Blue team kills' }, '0');
    this.red = h('div', { class: 'score red', title: 'Red team kills' }, '0');
    const canvas = h('canvas', { class: 'strip', 'aria-label': 'Lane map' });
    this.clock = h('div', { class: 'clock' }, '0:00');
    this.strip = new LaneStrip(canvas);
    this.feed = h('div', { class: 'feed', 'aria-live': 'polite' });
    this.banner = h('div', { class: 'banner hidden' }, h('div', { class: 'b' }), h('div', { class: 's' }));
    this.respawn = h('div', { class: 'respawn hidden' }, h('div', { class: 'n' }), h('div', { class: 's' }, 'Respawning. Open the shop while you wait.'));
    // ---- dock
    this.ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.ring.setAttribute('class', 'ring'); this.ring.setAttribute('viewBox', '0 0 76 76');
    this.ring.innerHTML = `<circle cx="38" cy="38" r="34" stroke="rgba(0,0,0,.45)" stroke-width="5" fill="none"/><circle class="xp" cx="38" cy="38" r="34" stroke="#f2c14e" stroke-width="5" fill="none" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" stroke-linecap="round"/>`;
    this.xpArc = this.ring.querySelector('.xp');
    this.lvl = h('div', { class: 'lvl' }, '3');
    const portrait = h('div', { class: 'portrait' }, emblem(me.heroKey), this.ring, this.lvl);
    this.slots = KEYS.map((k, i) => this.slot(k, def.abilities[k].name, 'ability', i));
    this.spells = ['D', 'F'].map((k, i) => this.slot(k, me.spells[i] === 'dash' ? 'Dash' : 'Heal', 'spell', i, true));
    this.hpFill = h('i', { class: 'hp' }); this.hpLag = h('i', { class: 'lag' }); this.shield = h('i', { class: 'sh' }); this.hpText = h('b');
    this.resFill = h('i', { style: { background: RES_COLOR[def.resource] || RES_COLOR.mana } }); this.resText = h('b');
    this.resBar = h('div', { class: 'bar res' }, this.resFill, this.resText);
    this.items = []; const itemsEl = h('div', { class: 'items' });
    for (let i = 0; i < RULES.MAX_ITEMS; i++) {
      const it = h('div', { class: 'item interactive', role: 'button', tabindex: '-1' }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'lb' }), h('div', { class: 'cd' }));
      it.addEventListener('click', () => this.useItem(i));
      it.addEventListener('pointerenter', () => this.itemTip(i, it)); it.addEventListener('pointerleave', () => this.tip.hide());
      itemsEl.append(it); this.items.push(it);
    }
    this.gold = h('span', {}, '0');
    this.goldBtn = h('button', { class: 'gold-btn interactive', onclick: onShop, 'aria-label': 'Open shop', 'data-act': 'shop' }, h('i', { class: 'coin' }), this.gold);
    this.dock = h('div', { class: 'dock' }, portrait,
      h('div', { class: 'mid' },
        h('div', { class: 'abilities' }, this.slots.map((s) => s.el), h('div', { class: 'gap' }), this.spells.map((s) => s.el)),
        h('div', { class: 'bars' }, h('div', { class: 'bar' }, this.hpLag, this.hpFill, this.shield, this.hpText), this.resBar)),
      h('div', { class: 'side' }, itemsEl, this.goldBtn));
    const quick = h('div', { class: 'quick' },
      h('button', { onclick: onScoreboard, 'aria-label': 'Scoreboard', 'data-act': 'score' }, touch ? 'Score' : 'Tab'),
      h('button', { onclick: onMenu, 'aria-label': 'Menu', 'data-act': 'menu' }, touch ? 'Menu' : 'Esc'));
    this.el = h('div', { class: 'hud' },
      h('div', { class: 'topbar' }, this.blue, h('div', { class: 'strip-wrap' }, canvas, this.clock), this.red),
      this.feed, this.banner, this.respawn, this.dock, quick);
    root.append(this.el);
    this.cdTotal = [1, 1, 1, 1]; this.prevCd = [0, 0, 0, 0]; this.prevRanks = { Q: -1, W: -1, E: -1, R: -1 }; this.prevLevel = me.level;
    this.lag = 1; this.feedItems = []; this.bannerUntil = 0; this.bannerQueue = [];
    this.untap = session.tapEvents((e) => this.onEvent(e));
    this.showBanner('Shatter the enemy Heartstone', 'Push with your minions. Towers fall in order: outer, inner, then the Heartstone.', 'good', 4200);
  }
  slot(key, name, kind, i, small = false) {
    const cd = h('div', { class: 'cd' }), cdn = h('div', { class: 'cdn' }), pips = h('div', { class: 'pips' });
    if (kind === 'ability') for (let r = 0; r < (key === 'R' ? 3 : 5); r++) pips.append(h('i'));
    const el = h('div', { class: `slot interactive${small ? ' sm' : ''}` }, h('span', { class: 'key' }, key), h('span', { class: 'nm' }, name), cd, cdn, pips);
    el.addEventListener('pointerenter', () => this.abilityTip(kind, i, el)); el.addEventListener('pointerleave', () => this.tip.hide());
    return { el, cd, cdn, pips: [...pips.children] };
  }
  abilityTip(kind, i, el) {
    const me = this.s.me;
    if (kind === 'spell') { const n = me.spells[i]; this.tip.show(el, n === 'dash' ? 'Dash' : 'Heal', n === 'dash' ? 'Dash a short distance toward the cursor.' : 'Heal yourself and the nearest ally, and gain a burst of speed.', `${n === 'dash' ? 30 : 60} s cooldown`); return; }
    const k = KEYS[i], a = this.def.abilities[k], rank = me.ranks[k];
    const cost = typeof a.cost === 'function' ? null : byRank(a.cost || 0, Math.max(1, rank));
    const cd = typeof a.cd === 'function' ? null : byRank(a.cd, Math.max(1, rank));
    const meta = [rank > 0 ? `Rank ${rank}` : `Unlocks at level ${k === 'R' ? 6 : 'up'}`, cd != null ? `${cd} s cooldown` : '', cost ? `${cost} ${a.costType || this.def.resource}` : ''].filter(Boolean).join(' · ');
    this.tip.show(el, `${k} · ${a.name}`, a.desc || '', meta);
  }
  itemTip(i, el) {
    const key = this.s.me.items[i]; if (!key) return;
    const it = this.s.world.registry.items[key];
    this.tip.show(el, it.name, it.desc || '', it.active ? `Active: press ${i + 1}` : `Sells for ${Math.floor(it.cost * RULES.SELL_RATIO)} gold`);
  }
  useItem(i) {
    const me = this.s.me, key = me.items[i], it = key && this.s.world.registry.items[key];
    if (it && it.active) this.s.send(itemActiveCmd(this.s.player, i, me.x, me.y));
  }
  heroName(id) { const e = this.s.world.entities[id]; return e && e.kind === KIND.HERO ? this.s.world.registry.heroes[e.heroKey].name.replace(/^The /, '') : null; }
  onEvent(e) {
    const w = this.s.world, me = this.s.me;
    switch (e.type) {
      case EV.KILL: {
        const victim = w.entities[e.a], killer = e.b >= 0 ? w.entities[e.b] : null;
        if (!victim) break;
        const kn = killer && killer.kind === KIND.HERO ? this.heroName(killer.id) : null;
        const row = h('div', { class: `k${victim === me || killer === me ? ' me' : ''}` },
          kn ? h('span', { class: `t${killer.team}` }, kn) : h('span', { class: 'x' }, killer && killer.kind === KIND.TOWER ? 'Tower' : 'Executed'),
          h('span', { class: 'x' }, '⟶'), h('span', { class: `t${victim.team}` }, this.heroName(victim.id)));
        this.feed.prepend(row); this.feedItems.push({ row, until: performance.now() + 7000 });
        while (this.feedItems.length > 5) this.feedItems.shift().row.remove();
        if (killer === me) this.showBanner(`You slew ${this.heroName(victim.id)}`, `+${RULES.KILL_GOLD} gold`, 'good', 1800);
        break;
      }
      case EV.WHALE_WARN: this.showBanner('The whale rolls!', `Get off the ${e.v > 0 ? 'near' : 'far'} edge`, 'warn', 3000); break;
      case EV.STRUCTURE_DOWN: if (e.b === KIND.TOWER) { const mine = e.v === me.team; this.showBanner(mine ? 'Your tower fell' : 'Enemy tower destroyed', mine ? 'Defend the next one' : 'Push on', mine ? 'bad' : 'good', 2600); } break;
      case EV.FX: if (e.s === 'sudden-death') this.showBanner('Sudden death', 'Both Heartstones crumble. Damage +50%.', 'bad', 3800); break;
      case EV.LEVEL_UP: if (e.a === me.id) { this.dock.querySelector('.portrait').animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); } break;
    }
  }
  showBanner(title, sub, kind, ms) {
    const now = performance.now();
    if (now < this.bannerUntil && this.bannerQueue.length < 3) { this.bannerQueue.push([title, sub, kind, ms]); return; }
    const [b, s] = this.banner.children; b.textContent = title; s.textContent = sub;
    this.banner.className = `banner ${kind}`; this.bannerUntil = now + ms;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }
  update(now) {
    const s = this.s, w = s.world, me = s.me, def = this.def, t = w.tick;
    // top bar
    let k0 = 0, k1 = 0; for (const x of w.heroes) { if (x.team === 0) k0 += x.kills; else k1 += x.kills; }
    setText(this.blue, String(k0)); setText(this.red, String(k1));
    setText(this.clock, clock(t)); toggle(this.clock, 'sd', !!w.state.suddenDeath);
    this.strip.update(w, me, s.renderer, now);
    // banners + feed expiry
    if (this.bannerUntil && now > this.bannerUntil) { if (this.bannerQueue.length) { this.bannerUntil = 0; this.showBanner(...this.bannerQueue.shift()); } else { this.bannerUntil = 0; this.banner.classList.add('hidden'); } }
    while (this.feedItems.length && this.feedItems[0].until < now) this.feedItems.shift().row.remove();
    // respawn
    toggle(this.respawn, 'hidden', !me.dead);
    if (me.dead) setText(this.respawn.firstChild, secs(Math.max(0, me.respawnAt - t)));
    // portrait
    setText(this.lvl, String(me.level));
    const xpf = me.level >= RULES.MAX_LEVEL ? 1 : Math.min(1, me.xp / xpToNext(me.level));
    const off = String(Math.round(RING * (1 - xpf))); if (this.xpArc._o !== off) { this.xpArc._o = off; this.xpArc.setAttribute('stroke-dashoffset', off); }
    // bars
    const hp = Math.max(0, me.hp) / me.maxHp; this.lag = this.lag > hp ? Math.max(hp, this.lag - 0.012) : hp;
    setStyle(this.hpFill, 'transform', `scaleX(${hp.toFixed(3)})`); setStyle(this.hpLag, 'transform', `scaleX(${this.lag.toFixed(3)})`);
    const sh = me.shield > 0 && me.shieldUntil > t ? Math.min(1 - hp, me.shield / me.maxHp) : 0;
    setStyle(this.shield, 'transform', sh > 0 ? `translateX(${(hp * 100).toFixed(1)}%) scaleX(${sh.toFixed(3)})` : 'scaleX(0)');
    setText(this.hpText, `${Math.ceil(Math.max(0, me.hp))} / ${Math.round(me.maxHp)}`);
    const usesMana = def.resource === 'mana', rv = usesMana ? me.mana : me.resource, rmax = usesMana ? me.maxMana : me.maxResource;
    toggle(this.resBar, 'hidden', !(rmax > 0));
    if (rmax > 0) { setStyle(this.resFill, 'transform', `scaleX(${Math.max(0, rv / rmax).toFixed(3)})`); setText(this.resText, `${Math.floor(rv)} / ${Math.round(rmax)}`); }
    // abilities
    for (let i = 0; i < 4; i++) {
      const sl = this.slots[i], k = KEYS[i], a = def.abilities[k], rank = me.ranks[k], cd = me.cds[i];
      if (cd > this.prevCd[i]) this.cdTotal[i] = cd;
      if (this.prevCd[i] > 0 && cd === 0) { sl.el.classList.remove('flash'); void sl.el.offsetWidth; sl.el.classList.add('flash'); }
      this.prevCd[i] = cd;
      setStyle(sl.cd, 'background', cdMask(cd > 0 ? cd / this.cdTotal[i] : 0));
      setText(sl.cdn, cd > 0 ? secs(cd) : '');
      const cost = rank > 0 ? (typeof a.cost === 'function' ? 0 : byRank(a.cost || 0, rank)) : 0;
      const pool = { mana: me.mana, ink: me.resource, swarm: me.resource, gold: me.gold }[a.costType || def.resource];
      toggle(sl.el, 'locked', rank <= 0 || me.dead); toggle(sl.el, 'poor', rank > 0 && pool !== undefined && pool < cost);
      toggle(sl.el, 'ready', rank > 0 && cd === 0 && !me.dead);
      if (rank !== this.prevRanks[k]) { const first = this.prevRanks[k] < 0; this.prevRanks[k] = rank; sl.pips.forEach((p, r) => p.classList.toggle('on', r < rank)); if (!first) sl.el.animate([{ transform: 'translateY(-6px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' }); }
    }
    for (let i = 0; i < 2; i++) { const cd = me.spellCds[i], total = i === 0 ? 900 : 1800; setStyle(this.spells[i].cd, 'background', cdMask(cd / total)); setText(this.spells[i].cdn, cd > 0 ? secs(cd) : ''); toggle(this.spells[i].el, 'locked', me.dead); }
    // items + gold
    for (let i = 0; i < this.items.length; i++) {
      const el = this.items[i], key = me.items[i], it = key && w.registry.items[key];
      toggle(el, 'full', !!it); setText(el.children[1], it ? short(it.name) : '');
      const until = it && it.active ? (me.itemState[key + ':cd'] || 0) : 0;
      setStyle(el.children[2], 'background', until > t ? cdMask((until - t) / (it.activeCd * 30)) : '');
    }
    setText(this.gold, String(Math.floor(me.gold)));
    toggle(this.goldBtn, 'shop-here', canShop(me) && me.gold >= 900 && me.items.length < RULES.MAX_ITEMS);
  }
  dispose() { this.untap(); this.el.remove(); this.tip.hide(); }
}
