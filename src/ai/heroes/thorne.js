// Bot script: gardens the lane with thornbushes, snares near them, and pulses the garden in fights.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, fwd, predict } from '../perception.js';

export default function thorne(world, me, snap, bot) {
  const mine = world.zones.filter((z) => z.alive && z.kind === 'thorne-bush' && z.owner === me.id && world.tick - z.born >= 30);
  const t = fightTarget(me, snap, bot, 820);
  if (ready(world, me, 2) && mine.some((z) => snap.enemies.some((e) => Math.hypot(e.x - z.x, e.y - z.y) < 260) || (hpr(me) < 0.6 && Math.hypot(me.x - z.x, me.y - z.y) < 260))) return cast(bot, 2, me);
  if (!t) {
    // no heroes around: keep a bush growing at the minion front
    const f = snap.enemyFront; if (ready(world, me, 0) && f && d(me, f) < 750 && mine.length < 2 && me.mana > me.maxMana * 0.5) return cast(bot, 0, { x: f.x - fwd(me.team) * 60, y: f.y });
    return null;
  }
  if (ready(world, me, 3) && (bot.state === 'allin' || snap.enemies.filter((e) => d(e, t) < 300).length >= 2) && d(me, t) < 780) return cast(bot, 3, bot.aim(predict(t, 0.3)));
  if (ready(world, me, 1) && d(me, t) < 760 && bot.state !== 'lane') return cast(bot, 1, bot.aim(predict(t, d(me, t) / 1200)));
  if (ready(world, me, 0) && d(me, t) < 900) return cast(bot, 0, { x: t.x - fwd(me.team) * 150, y: t.y });
  return null;
}
