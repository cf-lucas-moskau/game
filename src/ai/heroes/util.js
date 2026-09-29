// Shared helpers for per-hero bot scripts (src/ai/heroes/<hero>.js).
import { castCmd } from '../../sim/commands.js';
import { abilityCost } from '../../sim/abilities.js';
import { canPay } from '../../sim/resources.js';
import { d, hpr } from '../perception.js';
export const SL = ['Q', 'W', 'E', 'R'];
export function ready(world, me, s) {
  if (me.ranks[SL[s]] <= 0 || me.cds[s] > 0) return false;
  const def = world.registry.heroes[me.heroKey], ab = def.abilities[SL[s]];
  const cost = abilityCost(world, me, ab, me.ranks[SL[s]]);
  const type = ab.costType || def.resource;
  if (type === 'gold') return me.gold >= cost + 40; // keep a small float
  return canPay(me, type, cost);
}
export const closest = (me, list, max = Infinity) => { let b = null, bd = max; for (const e of list) { const dd = d(e, me); if (dd < bd) { bd = dd; b = e; } } return b; };
export const lowest = (list) => list.reduce((a, b) => (!a || hpr(b) < hpr(a) ? b : a), null);
export const fightTarget = (me, snap, bot, range) => {
  const f = bot.state === 'allin' ? snap.enemies.find((e) => e.id === bot.focus) : null;
  if (f && d(f, me) < range) return f;
  return lowest(snap.enemies.filter((e) => d(e, me) < range));
};
export const circle = (x, y, r, bot, n = 12) => { const p = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; p.push(x + Math.cos(a) * r + bot.rng.range(-8, 8), y + Math.sin(a) * r + bot.rng.range(-8, 8)); } p[p.length - 2] = p[0] + 10; p[p.length - 1] = p[1] + 6; return p; };
export const cast = (bot, s, pt, pts = null, id = -1) => castCmd(bot.p, s, pt.x, pt.y, pts, id);
