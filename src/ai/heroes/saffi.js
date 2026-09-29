// Bot script: one ability cast per think, built around the hero's signature mechanic.
import { ready, fightTarget, cast } from './util.js';
import { sideX, MAP } from '../../sim/constants.js';
import { d, hpr } from '../perception.js';

export default function saffi(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 700);
  if (bot.state === 'retreat' && ready(world, me, 0)) { const hx = sideX(me.team, MAP.FOUNTAIN_X); return cast(bot, 0, { x: me.x + Math.sign(hx - me.x) * 350, y: me.y }); }
  if (!t) return null;
  if (bot.state === 'allin' && ready(world, me, 3)) return cast(bot, 3, me);
  if (ready(world, me, 2) && (bot.state === 'allin' || hpr(t) < 0.3) && d(me, t) < 560) return cast(bot, 2, t, null, t.id);
  if (ready(world, me, 1) && d(me, t) < 380) return cast(bot, 1, t);
  if (ready(world, me, 0) && d(me, t) > 250 && d(me, t) < 600 && bot.state !== 'lane') return cast(bot, 0, t);
  return null;
}
