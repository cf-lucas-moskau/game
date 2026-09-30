// Bot script: marks with moths, drops a shade behind as an escape, dives marked or low heroes.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd, predict, towerCovers } from '../perception.js';

export default function wisp(world, me, snap, bot) {
  const s = me.heroState, t = world.tick, shade = s.shadeUntil > t;
  if (shade && ready(world, me, 1) && (bot.state === 'retreat' || hpr(me) < 0.3)) return cast(bot, 1, { x: s.shadeX, y: s.shadeY });
  if (ready(world, me, 2) && world.tick - me.lastHeroDamageTick < 10 && (hpr(me) < 0.55 || bot.state === 'allin')) return cast(bot, 2, me);
  const tg = fightTarget(me, snap, bot, 780);
  if (!tg) return null;
  const marked = (s.marks.get(tg.id) || 0) > t;
  if (ready(world, me, 3) && bot.state === 'allin' && d(me, tg) < 740 && (marked || hpr(tg) < 0.55) && !(towerCovers(snap, tg) && hpr(tg) > 0.15)) return cast(bot, 3, tg, null, tg.id);
  if (!shade && ready(world, me, 1) && bot.state === 'allin' && me.resource >= 100) return cast(bot, 1, { x: me.x - fwd(me.team) * 300, y: me.y });
  if (ready(world, me, 0) && d(me, tg) < 620 && (bot.state !== 'lane' || me.resource > 150)) return cast(bot, 0, bot.aim(predict(tg, d(me, tg) / 1400)));
  return null;
}
