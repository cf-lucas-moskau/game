// Bot script: one ability cast per think, built around the hero's signature mechanic.
import { ready, closest, fightTarget, circle, cast } from './util.js';
import { d, fwd, predict } from '../perception.js';

export default function vesper(world, me, snap, bot) {
  const t = fightTarget(me, snap, bot, 800);
  if (bot.state === 'retreat' && ready(world, me, 2)) {
    const c = closest(me, snap.enemies, 600);
    if (c) { const mx = (me.x + c.x) / 2, my = (me.y + c.y) / 2, a = Math.atan2(c.y - me.y, c.x - me.x) + Math.PI / 2; return cast(bot, 2, { x: mx, y: my }, [mx - Math.cos(a) * 220, my - Math.sin(a) * 220, mx + Math.cos(a) * 220, my + Math.sin(a) * 220]); }
  }
  if (!t) return null;
  if (bot.state === 'allin' && ready(world, me, 3) && me.resource < 40) return cast(bot, 3, me);
  const p = bot.aim(predict(t, 0.35));
  if (ready(world, me, 1) && d(me, t) < 640) return cast(bot, 1, p, circle(p.x, p.y, 130, bot));
  if (bot.state === 'allin' && ready(world, me, 2) && d(me, t) < 650) {
    const back = fwd(t.team) * -1, wx = t.x + back * 140; // behind the target, cutting its escape
    return cast(bot, 2, { x: wx, y: t.y }, [wx, t.y - 230, wx, t.y + 230]);
  }
  if (ready(world, me, 0) && d(me, t) < 620 && me.resource > 30) {
    const a = Math.atan2(p.y - me.y, p.x - me.x) + bot.rng.range(-0.6, 0.6), ox = p.x - Math.cos(a) * 180, oy = p.y - Math.sin(a) * 180;
    return cast(bot, 0, p, [ox, oy, p.x, p.y, p.x + Math.cos(a) * 180, p.y + Math.sin(a) * 180]);
  }
  return null;
}
