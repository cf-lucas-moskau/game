// Lumen Vey, the Starcartographer: charts stars on her enemies; three stars complete a constellation.
import { KIND, LANE } from '../constants.js';
import { spawnZone } from '../zones.js';
import { aoe, dealDamage, DMG, sec, fx, amount, pickTarget, clampY, byRank } from './kit.js';
import { slow, root } from '../damage.js';
import { EV } from '../../core/events.js';
import { sin, cos, atan2, hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const P_VAL = { label: 'Constellation burst (+4% of the target\'s max health)', type: 'magic', base: 70, ratio: 0.45, stat: 'ap' };
const Q_VAL = { label: 'Magic damage', type: 'magic', base: [43, 68, 93, 118, 143], ratio: 0.6, stat: 'ap' };
const W_VAL = { label: 'Magic damage per second', type: 'magic', base: [26, 38, 51, 64, 77], ratio: 0.2, stat: 'ap' };
const R_VAL = { label: 'Magic damage', type: 'magic', base: [120, 190, 260], ratio: 0.5, stat: 'ap' };

const MAX_STARS = 3, STAR_SEC = 6;
/** Chart n stars on an enemy hero; the third completes the constellation (burst + 40% slow). */
function star(world, e, u, n = 1) {
  if (u.kind !== KIND.HERO || u.dead) return;
  const s = e.heroState, t = world.tick; let c = s.stars.get(u.id);
  if (!c) { c = { n: 0, until: 0 }; s.stars.set(u.id, c); }
  if (c.until <= t) c.n = 0;
  c.n += n; c.until = t + sec(STAR_SEC);
  if (c.n >= MAX_STARS) {
    c.n = 0; c.until = 0;
    const burst = amount(e, P_VAL, 1) + 0.04 * u.maxHp;
    dealDamage(world, e, u, burst, DMG.MAGIC, { ability: true }); slow(world, u, 0.4, 1.5, e);
    fx(world, e, 'lumen-constellation', u.x, u.y, 0, u.id);
  } else fx(world, e, 'lumen-star', u.x, u.y, c.n, u.id);
}
export const starsOf = (world, e, u) => { const c = e.heroState.stars.get(u.id); return c && c.until > world.tick ? c.n : 0; };
/** Wayfinder makes her next spell free. */
const costOf = (base) => (world, e, rank) => (e.heroState.freeUntil > world.tick ? 0 : byRank(base, rank));

export default {
  key: 'lumen', name: 'Lumen Vey', title: 'the Starcartographer', role: 'Burst mage', resource: 'mana', difficulty: 'Hard',
  rankOrder: ['Q', 'W', 'E'],
  build: ['lanternfish-lens', 'stormstep-sandals', 'deepwater-codex', 'kelp-crown', 'tidewatch-hourglass', 'borrowed-seconds'], // recommended items: shop highlights and bot purchase order
  base: { hp: 545, hpL: 88, ad: 48, adL: 3, armor: 22, armorL: 4, mr: 30, mrL: 1.3, as: 0.64, asL: 0.018, range: 530, speed: 330, mana: 420, manaL: 50, manaRegen: 3.2, projectile: 1600, radius: 31 },
  passive: { name: 'Constellation', desc: 'Her spells chart stars on enemy heroes (6 s). The third star completes a constellation: a burst of magic damage (plus 4% of their max health) and a 40% slow.', values: [P_VAL] },
  init(world, e) { e.heroState = { stars: new Map(), freeUntil: 0 }; },
  onCast(world, e, slot) { if (slot !== 2) e.heroState.freeUntil = 0; },
  onTick(world, e) { if (world.tick % sec(3) === 0) { const t = world.tick; e.heroState.stars.forEach((c, id, m) => { if (c.until <= t) m.delete(id); }); } },
  abilities: {
    Q: { values: [Q_VAL], name: 'Falling Star', cd: [6, 5.5, 5, 4.5, 4], cost: costOf([55, 60, 65, 70, 75]), range: 850,
      desc: 'A star falls where she points after 0.5 s: damage in a small area and a star on each hero hit.',
      cast(world, e, c) {
        const rank = c.rank, x = c.x, y = c.y;
        spawnZone(world, { kind: 'lumen-fall', team: e.team, owner: e.id, x, y, r: 150, duration: 0.5 });
        world.schedule(sec(0.5), (w) => { aoe(w, e.team, x, y, 150, (u) => { dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.MAGIC, { ability: true }); star(w, e, u); }); fx(w, e, 'lumen-impact', x, y); });
      } },
    W: { values: [W_VAL], name: 'Starlight Thread', cd: [13, 12, 11, 10, 9], cost: costOf(70), range: 700,
      desc: 'Threads starlight to an enemy hero for 2 s: damage every half second. If it holds (within 900), a star and a 0.75 s root.',
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 720, true, c.targetId); if (!t) return false;
        const rank = c.rank;
        spawnZone(world, { kind: 'lumen-thread', team: e.team, owner: e.id, x: e.x, y: e.y, r: 20, duration: 2, every: 0.5, data: { target: t.id },
          onTick: (w, z) => {
            const u = w.get(z.data.target);
            if (!u || u.dead || e.dead || hypot(u.x - e.x, u.y - e.y) > 900) { z.until = w.tick; z.onEnd = null; return; }
            if (w.tick === z.born) return;
            dealDamage(w, e, u, amount(e, W_VAL, rank) / 2, DMG.MAGIC, { ability: true, dot: true });
          },
          onEnd: (w, z) => { const u = w.get(z.data.target); if (u && !u.dead && !e.dead && hypot(u.x - e.x, u.y - e.y) <= 900) { star(w, e, u); root(w, u, 0.75, e); } } });
      } },
    E: { name: 'Wayfinder', cd: [16, 15, 14, 13, 12], cost: 50, range: 380,
      desc: 'Blinks 380 along her chart; her next spell within 4 s costs no mana.',
      cast(world, e, c) {
        const x0 = e.x, y0 = e.y, a = atan2(c.y - e.y, c.x - e.x), d = Math.min(380, hypot(c.x - e.x, c.y - e.y));
        e.x = e.px = Math.max(0, Math.min(LANE.W, e.x + cos(a) * d)); e.y = e.py = clampY(e.y + sin(a) * d); e.windup = 0;
        world.events.push(EV.BLINK, world.tick, e.id, 0, x0, y0, 0, 'lumen-wayfinder');
        e.heroState.freeUntil = world.tick + sec(4);
      } },
    R: { values: [R_VAL], name: 'Nova Chart', cd: [100, 85, 70], cost: costOf(100),
      desc: 'Charts the whole sky: every enemy hero within 1100 takes damage and gains two stars.',
      cast(world, e, c) {
        const hit = []; world.forEachInRadius(e.x, e.y, 1100, e.team, 'enemy', (u) => { if (u.kind === KIND.HERO) hit.push(u); });
        if (!hit.length) return false;
        for (const u of hit) { dealDamage(world, e, u, amount(e, R_VAL, c.rank), DMG.MAGIC, { ability: true }); star(world, e, u, 2); }
        fx(world, e, 'lumen-nova', e.x, e.y);
      } },
  },
};
