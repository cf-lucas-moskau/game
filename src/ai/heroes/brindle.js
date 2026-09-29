// Bot script: one ability cast per think, built around the hero's signature mechanic.
import { ready, fightTarget, cast } from './util.js';
import { d, hpr, predict } from '../perception.js';

export default function brindle(world, me, snap, bot) {
  // shield the ally in trouble
  if (ready(world, me, 1)) {
    const hurt = [me, ...snap.allies].filter((a) => d(a, me) < 700 && world.tick - a.lastHeroDamageTick < 20 && hpr(a) < 0.7).sort((a, b) => hpr(a) - hpr(b))[0];
    if (hurt && !(me.ranks.R > 0 && me.cds[3] === 0 && me.resource < 20 && hpr(hurt) > 0.35)) return cast(bot, 1, hurt);
  }
  const t = fightTarget(me, snap, bot, 760);
  const fight = snap.enemies.filter((e) => d(e, me) < 650).length + snap.allies.filter((a) => d(a, me) < 650).length;
  const domeUp = me.ranks.R > 0 && me.cds[3] === 0;
  if (domeUp && me.resource >= 15 && fight >= 2) return cast(bot, 3, me);
  if (!t) return null;
  const saving = domeUp && me.resource < 19; // bank bees for the Hive Dome
  if (ready(world, me, 2) && (bot.state === 'allin' || bot.state === 'retreat') && d(me, t) < 700) return cast(bot, 2, bot.aim(predict(t, 0.4)));
  if (!saving && ready(world, me, 0) && d(me, t) < 680) return cast(bot, 0, t, null, t.id);
  return null;
}
