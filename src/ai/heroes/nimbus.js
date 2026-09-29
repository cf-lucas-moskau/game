// Bot script: builds static with spells, then cashes it in with a chain-lightning attack.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, predict } from '../perception.js';

export default function nimbus(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 880);
  const close = snap.enemies.filter((e) => d(e, me) < 420);
  if (ready(world, me, 3) && (bot.state === 'allin' || close.length >= 2) && close.length) return cast(bot, 3, me);
  if (ready(world, me, 2) && close.length && (bot.state === 'retreat' || hpr(me) < 0.45)) return cast(bot, 2, close[0]);
  if (!t) return null;
  if (ready(world, me, 1) && d(me, t) < 780 && bot.state !== 'lane') return cast(bot, 1, bot.aim(predict(t, 0.6)));
  if (ready(world, me, 0) && d(me, t) < 840) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1800)));
  return null;
}
