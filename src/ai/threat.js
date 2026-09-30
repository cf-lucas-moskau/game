// Kill-threat estimates for bots: how much damage a hero can put on a target right now (ready abilities from their
// value specs, plus a few basic attacks, after the target's resistances). Read-only, like perception.js.
import { amount } from '../sim/heroes/kit.js';
import { ready, SL } from './heroes/util.js';

const mitigation = (res) => (res >= 0 ? 100 / (100 + res) : 2 - 100 / (100 - res));

/** Damage `me` can deal to `t` with its ready abilities and `autos` basic attacks. */
export function burst(world, me, t, autos = 3) {
  const def = world.registry.heroes[me.heroKey];
  let dmg = autos * me.ad * mitigation(t.armor);
  for (let s = 0; s < 4; s++) {
    if (!ready(world, me, s)) continue;
    const ab = def.abilities[SL[s]], rank = me.ranks[SL[s]];
    for (const v of ab.values || []) {
      if (v.type === 'phys') dmg += amount(me, v, rank) * mitigation(t.armor);
      else if (v.type === 'magic') dmg += amount(me, v, rank) * mitigation(t.mr);
      else if (v.type === 'true') dmg += amount(me, v, rank);
    }
  }
  return dmg;
}
/** How far `me` can reach a target this moment: attack range, plus a ready gap closer (an ability with range >= 300). */
export function reach(world, me) {
  const def = world.registry.heroes[me.heroKey]; let r = me.range;
  for (let s = 0; s < 4; s++) { const ab = def.abilities[SL[s]]; if (ab.range >= 300 && ready(world, me, s)) r = Math.max(r, me.range + Math.min(ab.range, 600) * 0.8); }
  return r + 60;
}
