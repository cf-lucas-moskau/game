// Bot script: keeps range, harpoons to finish, snipes low heroes from afar with the Skyline Shot.
import { ready, fightTarget, cast, closest } from './util.js';
import { d, hpr, fwd, predict } from '../perception.js';

export default function kestrel(world, me, snap, bot) {
  const low = snap.enemies.find((e) => hpr(e) < 0.35 && d(e, me) < 2200 && d(e, me) > 700);
  if (ready(world, me, 3) && low) return cast(bot, 3, bot.aim(predict(low, 0.6 + d(me, low) / 4200)));
  const near = closest(me, snap.enemies, 320);
  if (ready(world, me, 2) && near && (bot.state === 'retreat' || hpr(me) < 0.5)) return cast(bot, 2, { x: me.x - fwd(me.team) * 320, y: me.y });
  const t = fightTarget(me, snap, bot, 900);
  if (!t) return null;
  if (ready(world, me, 1) && d(me, t) < 720 && bot.state === 'allin') return cast(bot, 1, bot.aim(predict(t, 0.5)));
  if (ready(world, me, 0) && d(me, t) < 880 && (bot.state === 'allin' || hpr(t) < 0.4)) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 2000)));
  return null;
}
