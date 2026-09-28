import { TICK_HZ } from '../sim/constants.js';

export const clock = (ticks) => { const s = Math.max(0, Math.floor(ticks / TICK_HZ)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const secs = (ticks) => { const s = ticks / TICK_HZ; return s >= 10 ? String(Math.ceil(s)) : s >= 1 ? String(Math.ceil(s)) : s.toFixed(1); };
const STAT = {
  ad: ['Attack damage', (v) => `+${v}`], ap: ['Ability power', (v) => `+${v}`], armor: ['Armor', (v) => `+${v}`],
  mr: ['Magic resist', (v) => `+${v}`], hp: ['Health', (v) => `+${v}`], ms: ['Move speed', (v) => `+${v}`],
  as: ['Attack speed', (v) => `+${Math.round(v * 100)}%`], cdr: ['Cooldown reduction', (v) => `${Math.round(v * 100)}%`],
};
/** ['+35 Attack damage', ...] */
export const statLines = (stats = {}) => Object.keys(stats).map((k) => (STAT[k] ? `${STAT[k][1](stats[k])} ${STAT[k][0]}` : `${k} ${stats[k]}`));
export const heroName = (def) => def.name;
