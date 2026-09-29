// Bot script: the front line. Spikes and surges into fights, blooms in the middle of them.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, predict } from '../perception.js';

export default function coralie(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 700);
  const around = snap.enemies.filter((e) => d(e, me) < 400).length;
  if (ready(world, me, 1) && world.tick - me.lastHeroDamageTick < 20 && hpr(me) < 0.85) return cast(bot, 1, me);
  if (ready(world, me, 3) && (around >= 2 || (bot.state === 'allin' && around >= 1))) return cast(bot, 3, me);
  if (!t) return null;
  if (ready(world, me, 2) && bot.state === 'allin' && d(me, t) < 450 && d(me, t) > 200) return cast(bot, 2, { x: t.x + (t.x - me.x) * 0.25, y: t.y });
  if (ready(world, me, 0) && d(me, t) < 620 && bot.state !== 'lane') return cast(bot, 0, bot.aim(predict(t, 0.4)));
  return null;
}
