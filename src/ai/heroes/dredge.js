// Bot script: hooks, breaches, sweeps; drops the anchor on clumps or a fleeing target.
import { ready, fightTarget, cast } from './util.js';
import { d, predict } from '../perception.js';

export default function dredge(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 820);
  if (!t) return null;
  const around = snap.enemies.filter((e) => d(e, me) < 280).length;
  if (ready(world, me, 1) && around) return cast(bot, 1, me);
  if (ready(world, me, 2) && d(me, t) < 260) return cast(bot, 2, me);
  const clump = snap.enemies.filter((e) => d(e, t) < 280).length;
  if (ready(world, me, 3) && bot.state === 'allin' && d(me, t) < 640 && (clump >= 2 || d(me, t) > 300)) return cast(bot, 3, bot.aim(predict(t, 0.4)));
  if (ready(world, me, 0) && d(me, t) < 780 && d(me, t) > 250 && bot.state !== 'lane') return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1500)));
  return null;
}
