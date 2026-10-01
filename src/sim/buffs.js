// Timed buffs on heroes, granted by map features (camps, the Sky Pearl, shrines). Data only: each buff lists its
// duration and stat changes; recomputeHero folds active buffs into the hero's stats, heroSystem expires them.
// Adding a buff = one entry here (presentation: ui/format.js names, render reads the key).
import { EV } from '../core/events.js';
import { sec } from './constants.js';

/**
 * stats: flat ad / armor / mr, msPct and asPct (fractions), dmgAmp (damage dealt +x), dmgTaken (damage taken +x).
 * Durations in seconds.
 */
export const BUFFS = {
  'barnacle-fury': { name: 'Barnacle Fury', desc: 'Slew a Barnacle Crab: deal 10% more damage.', duration: 60, stats: { dmgAmp: 0.1 }, good: true },
  'pearl-blessing': { name: "Pearl's Blessing", desc: 'Your team holds the Sky Pearl: +12% attack speed and +15 armor and magic resist.', duration: 75, stats: { asPct: 0.12, armor: 15, mr: 15 }, good: true },
  tailwind: { name: 'Tailwind', desc: 'Gale Shrine: +30% move speed and +20% attack speed, but you take 12% more damage.', duration: 10, stats: { msPct: 0.3, asPct: 0.2, dmgTaken: 0.12 }, good: true },
};

/** Grant (or refresh) a buff; returns the buff record. */
export function addBuff(world, e, key) {
  const spec = BUFFS[key]; if (!spec || !e.buffs) return null;
  const until = world.tick + sec(spec.duration);
  let b = e.buffs.find((x) => x.key === key);
  if (b) b.until = Math.max(b.until, until); else { b = { key, until }; e.buffs.push(b); }
  e.statsDirty = true;
  world.events.push(EV.BUFF, world.tick, e.id, 0, e.x, e.y, spec.duration, key);
  return b;
}
export const hasBuff = (e, key) => !!(e.buffs && e.buffs.some((b) => b.key === key));
/** Remove expired buffs (heroSystem, every tick). Death clears all buffs. */
export function expireBuffs(world, e) {
  const list = e.buffs; if (!list || !list.length) return;
  let w = 0;
  for (let i = 0; i < list.length; i++) { if (list[i].until > world.tick && !e.dead) list[w++] = list[i]; else e.statsDirty = true; }
  list.length = w;
}
/** Sum of one stat over active buffs. */
export function buffStat(e, stat) {
  const list = e.buffs; if (!list) return 0;
  let v = 0; for (let i = 0; i < list.length; i++) { const s = BUFFS[list[i].key].stats; if (s[stat]) v += s[stat]; }
  return v;
}
