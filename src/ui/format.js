import { TICK_HZ } from '../sim/constants.js';

export const clock = (ticks) => { const s = Math.max(0, Math.floor(ticks / TICK_HZ)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** Countdown key: whole seconds from 1 s up, tenths below (negative keys), so per-frame callers compare numbers. */
export const cdKey = (ticks) => (ticks >= TICK_HZ ? Math.ceil(ticks / TICK_HZ) : -Math.max(1, Math.ceil(ticks / 3)));
export const cdLabel = (k) => (k === 0 ? '' : k > 0 ? String(k) : (-k / 10).toFixed(1));
const STAT = {
  ad: ['Attack damage', (v) => `+${v}`], ap: ['Ability power', (v) => `+${v}`], armor: ['Armor', (v) => `+${v}`],
  mr: ['Magic resist', (v) => `+${v}`], hp: ['Health', (v) => `+${v}`], ms: ['Move speed', (v) => `+${v}`],
  as: ['Attack speed', (v) => `+${Math.round(v * 100)}%`], cdr: ['Cooldown reduction', (v) => `${Math.round(v * 100)}%`],
};
/** ['+35 Attack damage', ...] */
export const statLines = (stats = {}) => Object.keys(stats).map((k) => (STAT[k] ? `${STAT[k][1](stats[k])} ${STAT[k][0]}` : `${k} ${stats[k]}`));
export const heroName = (def) => def.name;
