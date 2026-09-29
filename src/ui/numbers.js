// The numbers players reason with, computed from the same declarations the sim uses
// (ability value specs, item stats, stat growth). Presentation only: never mutates the world.
import { recomputeHero } from '../sim/stats.js';
import { amount } from '../sim/heroes/kit.js';

const KEYS = ['Q', 'W', 'E', 'R'];
const STAT_NAME = { ap: 'AP', ad: 'AD', maxHp: 'max health' };

/** A copy of the hero's derived stats as they would be with `items` (e.g. current + one to buy). */
export function statsWith(world, e, items) {
  const c = Object.assign({}, e, { items, itemState: { ...e.itemState } });
  recomputeHero(world, c);
  return c;
}
/** 'base + 55% AP (+ 20% AD)' for a value spec at a rank. */
export function formula(v, rank) {
  const base = Array.isArray(v.base) ? v.base[Math.max(0, Math.min(v.base.length - 1, rank - 1))] : v.base;
  let s = `${base} + ${Math.round(v.ratio * 100)}% ${STAT_NAME[v.stat] || v.stat}`;
  if (v.bonus) s += ` + ${Math.round(v.bonus.ratio * 100)}% ${STAT_NAME[v.bonus.stat] || v.bonus.stat}`;
  return s;
}
/** [{ key, name, rank, rows: [{ label, type, value, formula }] }] for the hero's four abilities. */
export function abilityNumbers(world, e, stats = e) {
  const def = world.registry.heroes[e.heroKey];
  return KEYS.map((k) => {
    const a = def.abilities[k], rank = Math.max(1, e.ranks[k] || 0);
    return { key: k, name: a.name, rank: e.ranks[k] || 0, rows: (a.values || []).map((v) => ({ label: v.label, type: v.type, value: amount(stats, v, rank), formula: formula(v, rank) })) };
  });
}
/** Auto-attack damage per hit, hits per second, and damage per second. */
export const autoNumbers = (s) => ({ hit: s.ad, rate: s.as, dps: s.ad * s.as });
/** Health it takes to kill you with physical / magic damage (armor and magic resist folded in). */
export const effectiveHp = (s) => ({ phys: s.maxHp * (1 + s.armor / 100), magic: s.maxHp * (1 + s.mr / 100) });

/**
 * What buying `itemKey` changes for this hero, as short lines ordered by size:
 * [{ label, from, to, delta }] for ability values, auto damage/DPS, health and effective health.
 */
export function itemImpact(world, e, itemKey) {
  const after = statsWith(world, e, [...e.items, itemKey]), before = statsWith(world, e, e.items);
  const out = [], add = (label, from, to, unit = '') => { const d = to - from; if (Math.abs(d) >= 0.5) out.push({ label, from, to, delta: d, unit }); };
  const A = abilityNumbers(world, e, before), B = abilityNumbers(world, e, after);
  A.forEach((ab, i) => ab.rows.forEach((row, j) => add(`${ab.key} ${ab.name}${ab.rows.length > 1 ? ` (${row.label.replace(/ damage.*/i, '').toLowerCase()})` : ''}`, row.value, B[i].rows[j].value)));
  const a0 = autoNumbers(before), a1 = autoNumbers(after);
  add('Auto-attack hit', a0.hit, a1.hit); add('Auto-attack DPS', a0.dps, a1.dps);
  add('Health', before.maxHp, after.maxHp);
  const h0 = effectiveHp(before), h1 = effectiveHp(after);
  if (after.armor !== before.armor) add('Effective health vs physical', h0.phys, h1.phys);
  if (after.mr !== before.mr) add('Effective health vs magic', h0.magic, h1.magic);
  add('Move speed', before.speed, after.speed);
  if (after.cdr !== before.cdr) add('Cooldowns', before.cdr * 100, after.cdr * 100, '% shorter');
  return out;
}
