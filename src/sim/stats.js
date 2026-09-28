import { KIND } from './constants.js';

// LoL-style level growth: stat = base + growth * (lvl-1) * (0.7025 + 0.0175 * (lvl-1))
const growthFactor = (lvl) => (lvl - 1) * (0.7025 + 0.0175 * (lvl - 1));

/** Recompute derived stats for a hero from base, level and items. Preserves hp ratio. */
export function recomputeHero(world, e) {
  const def = world.registry.heroes[e.heroKey];
  const b = def.base, g = growthFactor(e.level);
  const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const mpRatio = e.maxMana > 0 ? e.mana / e.maxMana : 1;
  let maxHp = b.hp + b.hpL * g, ad = b.ad + b.adL * g, ap = 0, armor = b.armor + b.armorL * g, mr = b.mr + b.mrL * g;
  let asBonus = (b.asL || 0.02) * g, speed = b.speed, maxMana = (b.mana || 0) + (b.manaL || 0) * g;
  let hpRegen = b.hpRegen || 1.5, manaRegen = b.manaRegen || 2, cdr = 0, lifesteal = 0, dmgAmp = 0;
  for (const key of e.items) {
    const it = world.registry.items[key]; if (!it) continue; const s = it.stats;
    if (s.hp) maxHp += s.hp; if (s.ad) ad += s.ad; if (s.ap) ap += s.ap;
    if (s.armor) armor += s.armor; if (s.mr) mr += s.mr; if (s.as) asBonus += s.as;
    if (s.ms) speed += s.ms; if (s.cdr) cdr += s.cdr; if (s.lifesteal) lifesteal += s.lifesteal;
    if (s.mana) maxMana += s.mana;
  }
  // dynamic item/passive bonuses
  if (e.itemState.barnacle) { armor += e.itemState.barnacle; mr += e.itemState.barnacle; }
  if (def.modifyStats) { const m = def.modifyStats(world, e); if (m) { ad += m.ad || 0; ap += m.ap || 0; armor += m.armor || 0; speed += m.ms || 0; asBonus += m.as || 0; } }
  e.maxHp = Math.round(maxHp); e.ad = ad; e.ap = ap; e.armor = armor; e.mr = mr;
  e.as = Math.min(2.5, b.as * (1 + asBonus)); e.speed = speed; e.range = b.range;
  e.maxMana = Math.round(maxMana); e.hpRegen = hpRegen + e.level * 0.35; e.manaRegen = manaRegen + e.level * 0.25;
  e.cdr = Math.min(0.4, cdr); e.lifesteal = lifesteal; e.dmgAmp = dmgAmp;
  e.hp = Math.max(1, Math.min(e.maxHp, Math.round(hpRatio * e.maxHp)));
  e.mana = Math.min(e.maxMana, mpRatio * e.maxMana);
  e.statsDirty = false;
}

/** Effective move speed after slows/hastes (with a soft floor). */
export function moveSpeed(world, e) {
  let s = e.kind === KIND.HERO || e.kind === KIND.PEBBLE ? e.speed : e.baseSpeed;
  const t = world.tick;
  if (e.hasteUntil > t) s *= 1 + e.hastePct;
  if (e.slowUntil > t) s *= 1 - Math.min(0.9, e.slowPct);
  return Math.max(60, s);
}
export const canAct = (world, e) => e.stunUntil <= world.tick && e.airborneUntil <= world.tick && !e.dead;
export const canMove = (world, e) => canAct(world, e) && e.rootUntil <= world.tick && e.channelUntil <= world.tick;
export const canCast = (world, e) => canAct(world, e) && e.silenceUntil <= world.tick && e.castLockUntil <= world.tick;
