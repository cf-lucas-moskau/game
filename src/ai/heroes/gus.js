// Bot script: one ability cast per think, built around the hero's signature mechanic.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd, predict } from '../perception.js';

export default function gus(world, me, snap, bot) {
  const s = me.heroState, t = fightTarget(me, snap, bot, 900);
  const peb = s.pebbleId >= 0 ? world.get(s.pebbleId) : null;
  if (!s.mounted && ready(world, me, 1) && (hpr(me) < 0.4 || (peb && hpr(peb) < 0.25)) && peb && d(peb, me) < 220) return cast(bot, 1, me);
  if (!t) { if (!s.mounted && peb && ready(world, me, 1) && d(peb, me) < 220) return cast(bot, 1, me); return null; }
  const clustered = snap.enemies.filter((e) => d(e, t) < 300).length;
  if (ready(world, me, 3) && (bot.state === 'allin' || clustered >= 2) && d(me, t) < 780) return cast(bot, 3, bot.aim(predict(t, 0.8)));
  if (s.mounted) {
    if (ready(world, me, 0) && d(me, t) < 300) return cast(bot, 0, t);
    if (ready(world, me, 2) && d(me, t) < 600 && bot.state !== 'lane') return cast(bot, 2, t);
    if (ready(world, me, 1) && bot.state === 'trade' && hpr(me) > 0.6 && s.rebuildAt <= world.tick) return cast(bot, 1, { x: me.x - fwd(me.team) * 200, y: me.y });
  } else {
    if (ready(world, me, 0) && d(me, t) < 900) return cast(bot, 0, bot.aim(predict(t, 0.6)));
    if (ready(world, me, 2) && peb && d(peb, t) < 600) return cast(bot, 2, t);
  }
  return null;
}
