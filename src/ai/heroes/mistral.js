// Bot script: shields the ally under fire, gusts through fights, calls the jetstream to engage or escape.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd, predict } from '../perception.js';

export default function mistral(world, me, snap, bot) {
  if (ready(world, me, 2)) {
    const hurt = [me, ...snap.allies].filter((a) => d(a, me) < 700 && world.tick - a.lastHeroDamageTick < 20 && hpr(a) < 0.75).sort((a, b) => hpr(a) - hpr(b))[0];
    if (hurt) return cast(bot, 2, hurt, null, hurt.id);
  }
  const t = fightTarget(me, snap, bot, 880);
  const fight = snap.enemies.filter((e) => d(e, me) < 800).length;
  if (ready(world, me, 3) && fight && (bot.state === 'allin' || bot.state === 'retreat')) {
    const dir = bot.state === 'retreat' ? -fwd(me.team) : fwd(me.team);
    return cast(bot, 3, { x: me.x + dir * 1200, y: me.y });
  }
  if (!t) return null;
  if (ready(world, me, 1) && d(me, t) < 700 && bot.state !== 'lane') return cast(bot, 1, bot.aim(predict(t, 0.5)));
  if (ready(world, me, 0) && d(me, t) < 820) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1500)));
  return null;
}
