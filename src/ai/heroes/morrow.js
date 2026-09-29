// Bot script: one ability cast per think, built around the hero's signature mechanic.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd, predict } from '../perception.js';

export default function morrow(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 760);
  if (ready(world, me, 3) && hpr(me) < 0.3 && me.heroState.histFill > 60) {
    const s = me.heroState, i = ((s.histHead - s.histFill + 120 * 2) % 120) * 3;
    if (s.hist[i + 2] > me.hp + me.maxHp * 0.25) return cast(bot, 3, me);
  }
  if (ready(world, me, 1) && snap.enemies.some((e) => d(e, me) < 500)) return cast(bot, 1, me);
  if (ready(world, me, 2) && me.heroState.echoes.length) {
    const echo = me.heroState.echoes[me.heroState.echoes.length - 1];
    const safer = bot.state === 'retreat' && (echo.x - me.x) * fwd(me.team) < 0;
    const chase = bot.state === 'allin' && t && d(echo, t) < d(me, t) - 150;
    if (safer || chase) return cast(bot, 2, echo);
  }
  if (t && ready(world, me, 0)) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1300)));
  return null;
}
