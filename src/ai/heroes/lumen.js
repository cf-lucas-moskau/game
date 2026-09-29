// Bot script: charts stars with falling stars and threads, completes constellations, novas in fights.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd, predict } from '../perception.js';
import { starsOf } from '../../sim/heroes/lumen.js';

export default function lumen(world, me, snap, bot) {
  const inRange = snap.enemies.filter((e) => d(e, me) < 1050);
  if (ready(world, me, 3) && inRange.length && (inRange.length >= 2 || inRange.some((e) => starsOf(world, me, e) >= 1) || bot.state === 'allin')) return cast(bot, 3, me);
  if (ready(world, me, 2) && bot.state === 'retreat' && snap.enemies.some((e) => d(e, me) < 400)) return cast(bot, 2, { x: me.x - fwd(me.team) * 380, y: me.y });
  const t = fightTarget(me, snap, bot, 880);
  if (!t) return null;
  if (ready(world, me, 1) && d(me, t) < 680 && (bot.state !== 'lane' || starsOf(world, me, t) === 2)) return cast(bot, 1, t, null, t.id);
  if (ready(world, me, 0) && d(me, t) < 840 && (bot.state !== 'lane' || hpr(t) < 0.6)) return cast(bot, 0, bot.aim(predict(t, 0.5)));
  return null;
}
