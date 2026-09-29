// Bot script: plays on the beat. Spells wait for the beat unless things are urgent.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd } from '../perception.js';
import { onBeat } from '../../sim/heroes/cantor.js';

export default function cantor(world, me, snap, bot) {
  const beat = onBeat(world, me);
  const hurt = [me, ...snap.allies].filter((a) => d(a, me) < 450 && hpr(a) < 0.55).length;
  if (ready(world, me, 1) && hurt && (beat || hpr(me) < 0.3)) return cast(bot, 1, me);
  const around = snap.enemies.filter((e) => d(e, me) < 400).length;
  if (ready(world, me, 3) && (around >= 2 || (bot.state === 'allin' && around))) return cast(bot, 3, me);
  if (bot.state === 'retreat' && ready(world, me, 2)) return cast(bot, 2, { x: me.x - fwd(me.team) * 380, y: me.y });
  const t = fightTarget(me, snap, bot, 600);
  if (!t) return null;
  if (!beat && !(bot.state === 'allin' && hpr(t) < 0.3)) return null; // wait for the beat unless finishing
  if (ready(world, me, 2) && bot.state === 'allin' && d(me, t) < 480 && d(me, t) > 150) return cast(bot, 2, t);
  if (ready(world, me, 0) && d(me, t) < 440) return cast(bot, 0, t);
  return null;
}
