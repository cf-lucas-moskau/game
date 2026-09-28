// Per-hero bot scripts: each decides one ability cast per think, using the hero's signature mechanic.
import { castCmd } from '../sim/commands.js';
import { KIND, sideX, MAP } from '../sim/constants.js';
import { byRank } from '../sim/abilities.js';
import { alive, d, hpr, fwd, predict } from './perception.js';

const SL = ['Q', 'W', 'E', 'R'];
function ready(world, me, s) {
  if (me.ranks[SL[s]] <= 0 || me.cds[s] > 0) return false;
  const def = world.registry.heroes[me.heroKey], ab = def.abilities[SL[s]];
  const cost = typeof ab.cost === 'function' ? 0 : byRank(ab.cost || 0, me.ranks[SL[s]]);
  const type = ab.costType || def.resource;
  if (type === 'mana') return me.mana >= cost;
  if (type === 'gold') return me.gold >= cost + 40; // keep a small float
  if (type === 'ink' || type === 'swarm') return me.resource >= cost;
  return true;
}
const closest = (me, list, max = Infinity) => { let b = null, bd = max; for (const e of list) { const dd = d(e, me); if (dd < bd) { bd = dd; b = e; } } return b; };
const lowest = (list) => list.reduce((a, b) => (!a || hpr(b) < hpr(a) ? b : a), null);
const fightTarget = (me, snap, bot, range) => {
  const f = bot.state === 'allin' ? snap.enemies.find((e) => e.id === bot.focus) : null;
  if (f && d(f, me) < range) return f;
  return lowest(snap.enemies.filter((e) => d(e, me) < range));
};
const circle = (x, y, r, bot, n = 12) => { const p = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; p.push(x + Math.cos(a) * r + bot.rng.range(-8, 8), y + Math.sin(a) * r + bot.rng.range(-8, 8)); } p[p.length - 2] = p[0] + 10; p[p.length - 1] = p[1] + 6; return p; };
const cast = (bot, s, pt, pts = null, id = -1) => castCmd(bot.p, s, pt.x, pt.y, pts, id);

export const SCRIPTS = {
  morrow(world, me, snap, bot) {
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
  },
  saffi(world, me, snap, bot) {
    const t = fightTarget(me, snap, bot, 700);
    if (bot.state === 'retreat' && ready(world, me, 0)) { const hx = sideX(me.team, MAP.FOUNTAIN_X); return cast(bot, 0, { x: me.x + Math.sign(hx - me.x) * 350, y: me.y }); }
    if (!t) return null;
    if (bot.state === 'allin' && ready(world, me, 3)) return cast(bot, 3, me);
    if (ready(world, me, 2) && (bot.state === 'allin' || hpr(t) < 0.3) && d(me, t) < 560) return cast(bot, 2, t, null, t.id);
    if (ready(world, me, 1) && d(me, t) < 380) return cast(bot, 1, t);
    if (ready(world, me, 0) && d(me, t) > 250 && d(me, t) < 600 && bot.state !== 'lane') return cast(bot, 0, t);
    return null;
  },
  vesper(world, me, snap, bot) {
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
  },
  gus(world, me, snap, bot) {
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
  },
  brindle(world, me, snap, bot) {
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
  },
  auctioneer(world, me, snap, bot) {
    const t = fightTarget(me, snap, bot, 920);
    if (!t) return null;
    if (ready(world, me, 3) && bot.state === 'allin' && d(me, t) < 700 && t.items.length) {
      const best = Math.max(...t.items.map((k) => world.registry.items[k].cost)); if (best >= 1600) return cast(bot, 3, t, null, t.id);
    }
    if (ready(world, me, 1) && bot.state === 'allin' && t.ampUntil <= world.tick && d(me, t) < 800) return cast(bot, 1, t, null, t.id);
    if (ready(world, me, 2) && hpr(t) < 0.4 && d(me, t) < 700 && d(me, t) > 320 && bot.state === 'allin') return cast(bot, 2, t, null, t.id);
    if (ready(world, me, 0) && d(me, t) < 880) return cast(bot, 0, bot.aim(predict(t, d(me, t) / 1650)));
    return null;
  },
};
