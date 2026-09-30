// Item registry. Stats are summed by stats.js; unique effects are hook functions called by
// the damage pipeline and hero system. Each item is data + optional hooks, nothing else.
import { EV } from '../../core/events.js';
import { KIND, sec, TICK_HZ } from '../constants.js';
import { dealDamage, DMG, addShield, slow, haste, kill, heal } from '../damage.js';
import { hypot } from '../../core/dmath.js';

const cdReady = (w, e, key) => (e.itemState[key] || 0) <= w.tick;
const fx = (w, e, name, v = 0) => w.events.push(EV.FX, w.tick, e.id, 0, e.x, e.y, v, name);

// Build tree: `from` lists the components an item is built from. Its `cost` is the total; buying it with the
// components in your inventory costs only the difference (they are used up, see match.js purchasePlan).
// Tiers follow from the tree: 1 = component (built from nothing), 2 = upgrade, 3 = finished item.
// `group` items exclude each other (one pair of boots); `unique` items cannot be doubled.
export const ITEMS = {
  // ---- components (tier 1) ------------------------------------------------------------------------------------
  'shark-tooth':     { name: 'Shark Tooth', cost: 350, stats: { ad: 15 }, tags: ['attack'] },
  'gull-feather':    { name: 'Gull Feather', cost: 350, stats: { as: 0.12 }, tags: ['attack'] },
  'leech-fang':      { name: 'Leech Fang', cost: 400, stats: { lifesteal: 0.08 }, tags: ['attack'] },
  'pearl-shard':     { name: 'Pearl Shard', cost: 400, stats: { ap: 25 }, tags: ['magic'] },
  'moon-pearl':      { name: 'Moon Pearl', cost: 350, stats: { mana: 200, manaRegen: 1 }, tags: ['magic'] },
  'tide-charm':      { name: 'Tide Charm', cost: 450, stats: { cdr: 0.1 }, tags: ['magic'] },
  'kelp-wrap':       { name: 'Kelp Wrap', cost: 400, stats: { hp: 150 }, tags: ['defense'] },
  'barnacle-scale':  { name: 'Barnacle Scale', cost: 300, stats: { armor: 15 }, tags: ['defense'] },
  'sea-glass':       { name: 'Sea Glass', cost: 300, stats: { mr: 15 }, tags: ['defense'] },
  'driftwood-boots': { name: 'Driftwood Boots', cost: 300, stats: { ms: 25 }, group: 'boots', tags: ['movement'] },

  // ---- upgrades (tier 2) ---------------------------------------------------------------------------------------
  'iron-fin':          { name: 'Iron Fin', cost: 1100, from: ['shark-tooth', 'shark-tooth'], stats: { ad: 35 }, tags: ['attack'] },
  'riptide-bow':       { name: 'Riptide Bow', cost: 1000, from: ['gull-feather', 'shark-tooth'], stats: { as: 0.2, ad: 10 }, tags: ['attack'] },
  'anglerfin-blade':   { name: 'Anglerfin Blade', cost: 1200, from: ['shark-tooth', 'leech-fang'], stats: { ad: 20, lifesteal: 0.1 }, tags: ['attack'] },
  'stormglass-orb':    { name: 'Stormglass Orb', cost: 1100, from: ['pearl-shard', 'pearl-shard'], stats: { ap: 50 }, tags: ['magic'] },
  'brinecaller-sash':  { name: "Brinecaller's Sash", cost: 1250, from: ['pearl-shard', 'moon-pearl'], stats: { ap: 30, mana: 250, manaRegen: 1.5, cdr: 0.05 }, tags: ['magic'] },
  'whalehide-vest':    { name: 'Whalehide Vest', cost: 1000, from: ['barnacle-scale', 'barnacle-scale'], stats: { armor: 45 }, tags: ['defense'] },
  'cloudwool-cloak':   { name: 'Cloudwool Cloak', cost: 1000, from: ['sea-glass', 'sea-glass'], stats: { mr: 45 }, tags: ['defense'] },
  'tidal-heart':       { name: 'Tidal Heart', cost: 1200, from: ['kelp-wrap', 'kelp-wrap'], stats: { hp: 400 }, tags: ['defense'] },
  'wardens-bark':      { name: "Warden's Bark", cost: 1300, from: ['barnacle-scale', 'sea-glass', 'kelp-wrap'], stats: { armor: 20, mr: 20, hp: 150, hpRegen: 1 }, tags: ['defense'] },
  // boots: one pair per hero
  'quickcurrent-boots':{ name: 'Quickcurrent Boots', cost: 900, from: ['driftwood-boots'], stats: { ms: 45 }, group: 'boots', tags: ['movement'] },
  'swiftfin-treads':   { name: 'Swiftfin Treads', cost: 1000, from: ['driftwood-boots', 'gull-feather'], stats: { ms: 40, as: 0.15 }, group: 'boots', tags: ['movement'] },
  'stormstep-sandals': { name: 'Stormstep Sandals', cost: 1000, from: ['driftwood-boots', 'tide-charm'], stats: { ms: 40, cdr: 0.12 }, group: 'boots', tags: ['movement'] },
  'anchor-boots':      { name: 'Anchor Boots', cost: 1000, from: ['driftwood-boots', 'barnacle-scale'], stats: { ms: 40, armor: 15, tenacity: 0.25 }, group: 'boots', tags: ['movement'] },

  // ---- finished items (tier 3) ---------------------------------------------------------------------------------
  'borrowed-seconds': { name: 'Borrowed Seconds', cost: 2800, from: ['whalehide-vest', 'kelp-wrap'], stats: { armor: 40, hp: 250 }, unique: true, tags: ['defense'],
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

  'magnet-boots': { name: 'Magnet Boots', cost: 1600, from: ['driftwood-boots'], stats: { ms: 40 }, group: 'boots', tags: ['movement'],
    desc: 'Immune to whale roll. Nearby enemies are pulled 20% along with you.',
    onBuy(w, e) { e.itemState.magnet = true; e.itemState.mx = e.x; e.itemState.my = e.y; },
    onSell(w, e) { e.itemState.magnet = false; },
    onTick(w, e) {
      const s = e.itemState, dx = e.x - s.mx, dy = e.y - s.my; s.mx = e.x; s.my = e.y;
      if (dx * dx + dy * dy < 1 || dx * dx + dy * dy > 400 * 400) return;
      w.forEachInRadius(e.x, e.y, 260, e.team, 'enemy', (u) => { if (u.kind === KIND.HERO || u.kind >= 2 && u.kind <= 4) { u.x += dx * 0.2; u.y += dy * 0.2; } });
    } },

  'cursed-coin': { name: 'Cursed Coin', cost: 2400, from: ['iron-fin', 'shark-tooth'], stats: { ad: 70 }, unique: true, tags: ['attack'],
    desc: '+20% damage dealt, but you drop 15 gold to the attacker when hit by a hero.',
    modifyDamageOut: (w, e, amt) => amt * 1.2,
    onTookDamage(w, e, dmg, attacker) {
      if (!attacker || attacker.kind !== KIND.HERO || (e.itemState['coin:cd'] || 0) > w.tick) return;
      const g = Math.min(15, Math.floor(e.gold)); if (g <= 0) return;
      e.gold -= g; attacker.gold += g; e.itemState['coin:cd'] = w.tick + 5;
      w.events.push(EV.GOLD, w.tick, attacker.id, e.id, e.x, e.y, g, 'coin');
    } },

  'barnacle-plate': { name: 'Barnacle Plate', cost: 2600, from: ['wardens-bark', 'barnacle-scale'], stats: { armor: 30, mr: 30 }, unique: true, tags: ['defense'],
    desc: 'Gains 5 armor and magic resist per second standing still, up to 50 each.',
    onBuy(w, e) { e.itemState.barnacle = 0; e.itemState.bx = e.x; e.itemState.by = e.y; },
    onSell(w, e) { e.itemState.barnacle = 0; },
    onTick(w, e) {
      const s = e.itemState, moved = hypot(e.x - s.bx, e.y - s.by) > 2; s.bx = e.x; s.by = e.y;
      const before = s.barnacle;
      s.barnacle = moved ? Math.max(0, s.barnacle - 25 / TICK_HZ) : Math.min(50, s.barnacle + 5 / TICK_HZ);
      if (Math.floor(before) !== Math.floor(s.barnacle)) e.statsDirty = true;
    } },

  'lanternfish-lens': { name: 'Lanternfish Lens', cost: 2500, from: ['stormglass-orb', 'pearl-shard'], stats: { ap: 80 }, unique: true, tags: ['magic'],
    desc: 'Abilities mark enemies; your next hit on a marked enemy deals 10% more.',
    onDealtDamage(w, e, t, dmg, type, opts) { if (opts.ability && !opts.lens) { t.lensUntil = w.tick + sec(4); t.lensBy = e.id; } },
    modifyDamageOut(w, e, amt, t, type, opts) {
      if (t.lensUntil > w.tick && t.lensBy === e.id && !opts.ability) { t.lensUntil = 0; w.events.push(EV.FX, w.tick, t.id, 0, t.x, t.y, 0, 'lens-pop'); return amt * 1.1; }
      return amt;
    } },

  'harpoon-chain': { name: 'Harpoon Chain', cost: 2700, from: ['iron-fin', 'riptide-bow'], stats: { ad: 55, as: 0.15 }, unique: true, tags: ['attack'],
    desc: 'Every 4th attack tethers the target, slowing 25% for 1.5 s.',
    onBasicHit(w, e, t) {
      e.itemState.harpoon = ((e.itemState.harpoon || 0) + 1) % 4;
      if (e.itemState.harpoon === 0) { slow(w, t, 0.25, 1.5, e); w.events.push(EV.FX, w.tick, e.id, t.id, t.x, t.y, 0, 'harpoon'); }
    } },

  'kelp-crown': { name: 'Kelp Crown', cost: 2300, from: ['stormglass-orb', 'tide-charm'], stats: { ap: 60, cdr: 0.2 }, unique: true, tags: ['magic'],
    desc: 'Killing a minion refunds 1 s on all cooldowns.',
    onMinionKill(w, e) { for (let i = 0; i < 4; i++) e.cds[i] = Math.max(0, e.cds[i] - TICK_HZ); } },

  'stormcallers-horn': { name: "Stormcaller's Horn", cost: 2600, from: ['tidal-heart', 'tide-charm'], stats: { hp: 300, cdr: 0.1 }, unique: true, tags: ['support'], activeCd: 60,
    desc: 'Active: nearby allies gain 30% move speed for 3 s (60 s cooldown).',
    active(w, e) {
      for (const h of w.heroes) if (h.team === e.team && !h.dead && hypot(h.x - e.x, h.y - e.y) < 700) haste(w, h, 0.3, 3);
      fx(w, e, 'horn');
    } },

  'molted-shell': { name: 'Molted Shell', cost: 2900, from: ['tidal-heart', 'kelp-wrap'], stats: { hp: 500 }, unique: true, tags: ['defense'],
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
  'leviathans-maw': { name: "Leviathan's Maw", cost: 2900, from: ['anglerfin-blade', 'iron-fin'], stats: { ad: 55, lifesteal: 0.12 }, unique: true, tags: ['attack'],
    desc: 'Basic attacks on heroes heal you for 4% of your missing health.',
    onBasicHit(w, e, t) { if (t.kind === KIND.HERO && e.hp < e.maxHp) heal(w, e, e, (e.maxHp - e.hp) * 0.04, true); } },

  'reefbreaker': { name: 'Reefbreaker', cost: 2700, from: ['iron-fin', 'shark-tooth'], stats: { ad: 45, pen: 0.3 }, unique: true, tags: ['attack'],
    desc: 'Your physical damage ignores 30% of the target\'s armor.' },

  'squall-bell': { name: 'Squall Bell', cost: 2600, from: ['riptide-bow', 'pearl-shard'], stats: { as: 0.35, ap: 20 }, unique: true, tags: ['attack'],
    desc: 'Basic attacks deal 25 (+15% ability power) bonus magic damage.',
    onBasicHit(w, e, t) { dealDamage(w, e, t, 25 + e.ap * 0.15, DMG.MAGIC, ITEM_HIT); } },

  'storm-cutlass': { name: 'Storm Cutlass', cost: 2600, from: ['iron-fin', 'tide-charm'], stats: { ad: 40, cdr: 0.1 }, unique: true, tags: ['attack'],
    bladeRatio: 0.5, bladeCd: 2, // bonus damage as a share of base attack damage, and its cooldown (s): data, so the lab can patch them
    get desc() { return `After you cast an ability, your next basic attack within 4 s deals ${Math.round(this.bladeRatio * 100)}% of your base attack damage as bonus damage (${this.bladeCd} s cooldown).`; },
    onAbilityCast(w, e) { if (cdReady(w, e, 'cutlass:cd')) e.itemState['cutlass:until'] = w.tick + sec(4); },
    onBasicHit(w, e, t) {
      if ((e.itemState['cutlass:until'] || 0) <= w.tick) return;
      const it = ITEMS['storm-cutlass'];
      e.itemState['cutlass:until'] = 0; e.itemState['cutlass:cd'] = w.tick + sec(it.bladeCd);
      const base = w.registry.heroes[e.heroKey].base; dealDamage(w, e, t, (base.ad + base.adL * (e.level - 1)) * it.bladeRatio, DMG.PHYS, ITEM_HIT);
      fx(w, e, 'storm-cutlass');
    } },

  'deepwater-codex': { name: 'Deepwater Codex', cost: 2700, from: ['stormglass-orb', 'pearl-shard'], stats: { ap: 65, mpen: 0.3 }, unique: true, tags: ['magic'],
    desc: 'Your magic damage ignores 30% of the target\'s magic resist.' },

  'tidewatch-hourglass': { name: 'Tidewatch Hourglass', cost: 2600, from: ['brinecaller-sash', 'tide-charm'], stats: { ap: 50, cdr: 0.2, mana: 250 }, unique: true, tags: ['magic'],
    desc: 'Casting an ability grants 15% move speed for 1.5 s.',
    onAbilityCast(w, e) { haste(w, e, 0.15, 1.5); } },

  'coral-aegis': { name: 'Coral Aegis', cost: 2400, from: ['wardens-bark', 'kelp-wrap'], stats: { hp: 300, mr: 25, armor: 15 }, unique: true, tags: ['support'], activeCd: 60,
    desc: 'Active: you and nearby allies gain a shield of 120 (+8% of your max health) for 3 s (60 s cooldown).',
    active(w, e) {
      const amount = 120 + e.maxHp * 0.08;
      for (const h of w.heroes) if (h.team === e.team && !h.dead && hypot(h.x - e.x, h.y - e.y) < 650) addShield(w, h, amount, 3, e);
      fx(w, e, 'coral-aegis');
    } },

  'stillwater-pendant': { name: 'Stillwater Pendant', cost: 2400, from: ['cloudwool-cloak', 'kelp-wrap'], stats: { mr: 40, hp: 250, tenacity: 0.3 }, unique: true, tags: ['defense'],
    desc: 'Crowd control on you (stuns, roots, slows, knock-ups) lasts 30% shorter.' },
};
const ITEM_HIT = Object.freeze({ item: true }); // item on-hit damage: neither a basic attack nor an ability

/** Tier from the build tree: 1 = component, 2 = upgrade (built from components), 3 = finished item. */
function tierOf(key) { const it = ITEMS[key]; if (!it.from || !it.from.length) return 1; return 1 + Math.max(...it.from.map(tierOf)); }
for (const [k, v] of Object.entries(ITEMS)) { v.key = k; v.from = v.from || []; v.tier = Math.min(3, tierOf(k)); }
/** What each item builds into (the reverse of `from`), for the shop. */
for (const v of Object.values(ITEMS)) v.into = Object.keys(ITEMS).filter((k) => ITEMS[k].from.includes(v.key));
export const ITEM_KEYS = Object.keys(ITEMS);

