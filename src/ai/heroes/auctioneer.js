// Bot script: one ability cast per think, built around the hero's signature mechanic.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, predict } from '../perception.js';

export default function auctioneer(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 920);
  if (!t) return null;
  if (ready(world, me, 3) && bot.state === 'allin' && d(me, t) < 700 && t.items.length) {
    const best = Math.max(...t.items.map((k) => world.registry.items[k].cost)); if (best >= 1600) return cast(bot, 3, t, null, t.id);
  }
  if (ready(world, me, 1) && bot.state === 'allin' && t.ampUntil <= world.tick && d(me, t) < 800) return cast(bot, 1, t, null, t.id);
  if (ready(world, me, 2) && hpr(t) < 0.4 && d(me, t) < 700 && d(me, t) > 320 && bot.state === 'allin') return cast(bot, 2, t, null, t.id);
  if (ready(world, me, 0) && d(me, t) < 880) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1650)));
  return null;
}
