// Item registry. Stats are summed by stats.js; unique effects are hook functions called by
// the damage pipeline and hero system. Each item is data + optional hooks, nothing else.
import { EV } from '../../core/events.js';
import { KIND, sec, TICK_HZ } from '../constants.js';
import { dealDamage, DMG, addShield, slow, haste, kill } from '../damage.js';
import { hypot } from '../../core/dmath.js';

const cdReady = (w, e, key) => (e.itemState[key] || 0) <= w.tick;
const fx = (w, e, name, v = 0) => w.events.push(EV.FX, w.tick, e.id, 0, e.x, e.y, v, name);

export const ITEMS = {
  // ---- stat items ------------------------------------------------------------
  'iron-fin':          { name: 'Iron Fin', cost: 1100, stats: { ad: 35 }, tags: ['attack'] },
  'stormglass-orb':    { name: 'Stormglass Orb', cost: 1100, stats: { ap: 50 }, tags: ['magic'] },
  'whalehide-vest':    { name: 'Whalehide Vest', cost: 1000, stats: { armor: 45 }, tags: ['defense'] },
  'cloudwool-cloak':   { name: 'Cloudwool Cloak', cost: 1000, stats: { mr: 45 }, tags: ['defense'] },
  'tidal-heart':       { name: 'Tidal Heart', cost: 1200, stats: { hp: 400 }, tags: ['defense'] },
  'quickcurrent-boots':{ name: 'Quickcurrent Boots', cost: 900, stats: { ms: 45 }, unique: true, tags: ['movement'] },

  // ---- unique items -----------------------------------------------------------
  'borrowed-seconds': { name: 'Borrowed Seconds', cost: 2800, stats: { armor: 40, hp: 250 }, unique: true, tags: ['defense'],
    desc: 'The first lethal hit each 60 s is delayed by 2 s instead of killing you.',
    onLethal(w, e, saved, dmg, attacker) {
      if (saved || !cdReady(w, e, 'bs:cd')) return saved;
      e.itemState['bs:cd'] = w.tick + sec(60); e.itemState['bs:pending'] = dmg; e.itemState['bs:until'] = w.tick + sec(2);
      e.hp = 1; fx(w, e, 'borrowed-seconds', 2);
      const src = attacker ? attacker.id : -1;
      w.schedule(sec(2), (w2) => {
        const pend = e.itemState['bs:pending'] || 0; e.itemState['bs:pending'] = 0; e.itemState['bs:until'] = 0;
        if (e.dead || !pend) return;
        if (e.hp - pend <= 0) kill(w2, e, w2.get(src)); else { e.hp -= pend; w2.events.push(EV.DAMAGE, w2.tick, e.id, src, e.x, e.y, pend, 't'); }
      });
      return true;
    },
    modifyDamageIn(w, e, amt) { if ((e.itemState['bs:until'] || 0) > w.tick) { e.itemState['bs:pending'] += amt; return 0; } return amt; } },

  'magnet-boots': { name: 'Magnet Boots', cost: 1600, stats: { ms: 40 }, unique: true, tags: ['movement'],
    desc: 'Immune to whale roll. Nearby enemies are pulled 20% along with you.',
    onBuy(w, e) { e.itemState.magnet = true; e.itemState.mx = e.x; e.itemState.my = e.y; },
    onSell(w, e) { e.itemState.magnet = false; },
    onTick(w, e) {
      const s = e.itemState, dx = e.x - s.mx, dy = e.y - s.my; s.mx = e.x; s.my = e.y;
      if (dx * dx + dy * dy < 1 || dx * dx + dy * dy > 400 * 400) return;
      w.forEachInRadius(e.x, e.y, 260, e.team, 'enemy', (u) => { if (u.kind === KIND.HERO || u.kind >= 2 && u.kind <= 4) { u.x += dx * 0.2; u.y += dy * 0.2; } });
    } },

  'cursed-coin': { name: 'Cursed Coin', cost: 2400, stats: { ad: 70 }, unique: true, tags: ['attack'],
    desc: '+20% damage dealt, but you drop 15 gold to the attacker when hit by a hero.',
    modifyDamageOut: (w, e, amt) => amt * 1.2,
    onTookDamage(w, e, dmg, attacker) {
      if (!attacker || attacker.kind !== KIND.HERO || (e.itemState['coin:cd'] || 0) > w.tick) return;
      const g = Math.min(15, Math.floor(e.gold)); if (g <= 0) return;
      e.gold -= g; attacker.gold += g; e.itemState['coin:cd'] = w.tick + 5;
      w.events.push(EV.GOLD, w.tick, attacker.id, e.id, e.x, e.y, g, 'coin');
    } },

  'barnacle-plate': { name: 'Barnacle Plate', cost: 2600, stats: { armor: 30, mr: 30 }, unique: true, tags: ['defense'],
    desc: 'Gains 5 armor and magic resist per second standing still, up to 50 each.',
    onBuy(w, e) { e.itemState.barnacle = 0; e.itemState.bx = e.x; e.itemState.by = e.y; },
    onSell(w, e) { e.itemState.barnacle = 0; },
    onTick(w, e) {
      const s = e.itemState, moved = hypot(e.x - s.bx, e.y - s.by) > 2; s.bx = e.x; s.by = e.y;
      const before = s.barnacle;
      s.barnacle = moved ? Math.max(0, s.barnacle - 25 / TICK_HZ) : Math.min(50, s.barnacle + 5 / TICK_HZ);
      if (Math.floor(before) !== Math.floor(s.barnacle)) e.statsDirty = true;
    } },

  'lanternfish-lens': { name: 'Lanternfish Lens', cost: 2500, stats: { ap: 80 }, unique: true, tags: ['magic'],
    desc: 'Abilities mark enemies; your next hit on a marked enemy deals 10% more.',
    onDealtDamage(w, e, t, dmg, type, opts) { if (opts.ability && !opts.lens) { t.lensUntil = w.tick + sec(4); t.lensBy = e.id; } },
    modifyDamageOut(w, e, amt, t, type, opts) {
      if (t.lensUntil > w.tick && t.lensBy === e.id && !opts.ability) { t.lensUntil = 0; w.events.push(EV.FX, w.tick, t.id, 0, t.x, t.y, 0, 'lens-pop'); return amt * 1.1; }
      return amt;
    } },

  'harpoon-chain': { name: 'Harpoon Chain', cost: 2700, stats: { ad: 55, as: 0.15 }, unique: true, tags: ['attack'],
    desc: 'Every 4th attack tethers the target, slowing 25% for 1.5 s.',
    onBasicHit(w, e, t) {
      e.itemState.harpoon = ((e.itemState.harpoon || 0) + 1) % 4;
      if (e.itemState.harpoon === 0) { slow(w, t, 0.25, 1.5, e); w.events.push(EV.FX, w.tick, e.id, t.id, t.x, t.y, 0, 'harpoon'); }
    } },

  'kelp-crown': { name: 'Kelp Crown', cost: 2300, stats: { ap: 60, cdr: 0.2 }, unique: true, tags: ['magic'],
    desc: 'Killing a minion refunds 1 s on all cooldowns.',
    onMinionKill(w, e) { for (let i = 0; i < 4; i++) e.cds[i] = Math.max(0, e.cds[i] - TICK_HZ); } },

  'stormcallers-horn': { name: "Stormcaller's Horn", cost: 2600, stats: { hp: 300, cdr: 0.1 }, unique: true, tags: ['support'], activeCd: 60,
    desc: 'Active: nearby allies gain 30% move speed for 3 s (60 s cooldown).',
    active(w, e) {
      for (const h of w.heroes) if (h.team === e.team && !h.dead && hypot(h.x - e.x, h.y - e.y) < 700) haste(w, h, 0.3, 3);
      fx(w, e, 'horn');
    } },

  'molted-shell': { name: 'Molted Shell', cost: 2900, stats: { hp: 500 }, unique: true, tags: ['defense'],
    desc: 'Taking hero damage above 40% of max health within 2 s grants a 300 shield (45 s cooldown).',
    onTookDamage(w, e, dmg, attacker) {
      if (!attacker || attacker.kind !== KIND.HERO) return;
      const s = e.itemState, t = w.tick;
      if (!s.shellLog) s.shellLog = [];
      s.shellLog.push(t, dmg);
      while (s.shellLog.length && s.shellLog[0] < t - sec(2)) s.shellLog.splice(0, 2);
      let sum = 0; for (let i = 1; i < s.shellLog.length; i += 2) sum += s.shellLog[i];
      if (sum > e.maxHp * 0.4 && cdReady(w, e, 'shell:cd')) { addShield(w, e, 300, 3, e); s['shell:cd'] = t + sec(45); s.shellLog.length = 0; fx(w, e, 'molted-shell'); }
    } },
};
for (const [k, v] of Object.entries(ITEMS)) v.key = k;
export const ITEM_KEYS = Object.keys(ITEMS);

