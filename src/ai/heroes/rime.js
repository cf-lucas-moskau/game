// Bot script: stacks chill with lance and field, shatters when chills pile up, whiteouts a clump.
import { ready, fightTarget, cast } from './util.js';
import { d, predict } from '../perception.js';
import { chillOf } from '../../sim/heroes/rime.js';

export default function rime(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 900);
  const chilled = snap.enemies.reduce((n, e) => n + (d(e, me) < 780 ? chillOf(world, me, e) : 0), 0);
  if (ready(world, me, 2) && chilled >= 2) return cast(bot, 2, me);
  if (!t) return null;
  const clump = snap.enemies.filter((e) => d(e, t) < 320).length;
  if (ready(world, me, 3) && (clump >= 2 || bot.state === 'allin') && d(me, t) < 780) return cast(bot, 3, bot.aim(predict(t, 1)));
  if (ready(world, me, 1) && d(me, t) < 740 && bot.state !== 'lane') return cast(bot, 1, bot.aim(predict(t, 0.4)));
  if (ready(world, me, 0) && d(me, t) < 880) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1600)));
  return null;
}
