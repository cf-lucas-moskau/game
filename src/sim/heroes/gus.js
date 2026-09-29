// Gus & Pebble: a gnome riding a rock golem. Dismounted, Pebble fights on its own while Gus snipes.
import { EV } from '../../core/events.js';
import { KIND } from '../constants.js';
import { ORDER } from '../entity.js';
import { spawnZone } from '../zones.js';
import { aoe, dash, dealDamage, DMG, scale, sec, fx, clampY, amount } from './kit.js';
import { knockUp, knock, stun, giveGold } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL1 = { label: 'Slam damage (mounted)', type: 'phys', base: [70, 110, 150, 190, 230], ratio: 0.5, stat: 'ad', bonus: { ratio: 0.04, stat: 'maxHp' } };
const Q_VAL2 = { label: 'Rock damage (on foot)', type: 'phys', base: [80, 125, 170, 215, 260], ratio: 0.7, stat: 'ad' };
const E_VAL1 = { label: 'Magic damage', type: 'magic', base: [60, 95, 130, 165, 200], ratio: 0.4, stat: 'ad', bonus: { ratio: 0.03, stat: 'maxHp' } };
const R_VAL1 = { label: 'Magic damage', type: 'magic', base: [150, 250, 350], ratio: 0.8, stat: 'ad', bonus: { ratio: 0.06, stat: 'maxHp' } };

const pebbleOf = (world, e) => (e.heroState.pebbleId >= 0 ? world.get(e.heroState.pebbleId) : null);
function spawnPebble(world, e) {
  const s = e.heroState;
  const p = world.spawn(KIND.PEBBLE, e.team, e.x, e.y);
  p.ownerId = e.id; p.aiControlled = true; p.heroKey = 'pebble';
  p.maxHp = Math.round(e.maxHp * 0.75); p.hp = Math.max(1, Math.round(p.maxHp * s.pebbleHp));
  p.armor = e.armor + 25; p.mr = e.mr + 15; p.ad = e.ad * 0.9; p.as = 0.75; p.baseAs = 0.75; p.range = 150;
  p.speed = 305; p.baseSpeed = 305; p.radius = 52; p.projectileSpeed = 0; p.facing = e.facing;
  s.pebbleId = p.id; s.mounted = false;
  return p;
}
function mount(world, e) {
  const s = e.heroState, p = pebbleOf(world, e);
  if (p) { s.pebbleHp = p.hp / p.maxHp; world.despawn(p); }
  s.pebbleId = -1; s.mounted = true; e.statsDirty = true;
}
export default {
  key: 'gus', name: 'Gus & Pebble', title: 'the Odd Couple', role: 'Tank / Artillery', resource: 'mana', difficulty: 'Medium',
  rankOrder: ['Q', 'E', 'W'],
  build: ['tidal-heart', 'barnacle-plate', 'magnet-boots', 'molted-shell', 'iron-fin', 'whalehide-vest'], // recommended items: shop highlights and bot purchase order
  base: { hp: 690, hpL: 108, ad: 62, adL: 3.6, armor: 38, armorL: 4.8, mr: 32, mrL: 2, as: 0.62, asL: 0.02, range: 170, speed: 330, mana: 360, manaL: 40, radius: 46, projectile: 0 },
  init(world, e) { e.heroState = { mounted: true, pebbleId: -1, pebbleHp: 1, rebuildAt: 0 }; },
  modifyStats(world, e) {
    if (!e.heroState || e.heroState.mounted) return { range: 170, projectile: 0, radius: 46 };
    return { armor: -30, ms: 45, range: 525, projectile: 1400, hpMult: 0.6, radius: 28 };
  },
  onTick(world, e) {
    const s = e.heroState;
    if (s.mounted && world.tick % 30 === 0) s.pebbleHp = Math.min(1, s.pebbleHp + 0.02);
    const p = pebbleOf(world, e);
    if (p && (world.tick + p.id) % 15 === 0) { p.ad = e.ad * 0.9; p.armor = e.armor + 55; p.mr = e.mr + 15; }
    // Pebble helps with Gus's target
    if (p && e.targetId >= 0 && e.order === ORDER.ATTACK && world.tick % 10 === 0) { const t = world.get(e.targetId); if (t && Math.hypot(t.x - p.x, t.y - p.y) < 500) { p.targetId = t.id; p.order = ORDER.ATTACK; } }
  },
  onDeath(world, e) { const p = pebbleOf(world, e); if (p) world.despawn(p); e.heroState.pebbleId = -1; e.heroState.mounted = true; e.heroState.pebbleHp = 1; e.statsDirty = true; },
  onPebbleDeath(world, p) {
    const g = world.get(p.ownerId); if (!g) return;
    g.heroState.pebbleId = -1; g.heroState.rebuildAt = world.tick + sec(20); g.heroState.pebbleHp = 0.5;
    fx(world, g, 'pebble-crumble', p.x, p.y);
    for (const h of world.heroes) if (h.team !== p.team && !h.dead && Math.hypot(h.x - p.x, h.y - p.y) < 1200) giveGold(world, h, 60);
  },
  abilities: {
    Q: { values: [Q_VAL1, Q_VAL2], name: 'Rock Slam / Pebble Shot', cd: [6, 5.5, 5, 4.5, 4], cost: [40, 45, 50, 55, 60], range: 900, freeTarget: false,
      desc: 'Mounted: Pebble slams the ground, knocking enemies up. Dismounted: Gus lobs a rock at long range.',
      cast(world, e, c) {
        const rank = c.rank;
        if (e.heroState.mounted) {
          const a = Math.atan2(c.y - e.y, c.x - e.x), cx = e.x + Math.cos(a) * 140, cy = clampY(e.y + Math.sin(a) * 140);
          aoe(world, e.team, cx, cy, 190, (u) => { knockUp(world, u, 0.75); dealDamage(world, e, u, amount(e, Q_VAL1, rank), DMG.PHYS, { ability: true }); });
          fx(world, e, 'gus-slam', cx, cy);
        } else {
          const x = c.x, y = c.y;
          fx(world, e, 'gus-lob', x, y, 0.6);
          world.schedule(sec(0.6), (w) => {
            aoe(w, e.team, x, y, 160, (u) => dealDamage(w, e, u, amount(e, Q_VAL2, rank), DMG.PHYS, { ability: true }));
            fx(w, e, 'gus-rock-impact', x, y);
          });
        }
      } },
    W: { name: 'Hop Off / Hop On', cd: 4, cost: 0,
      desc: 'Dismount or remount. Remounting needs Pebble within 200.',
      cast(world, e, c) {
        const s = e.heroState, t = world.tick;
        if (s.mounted) {
          if (s.rebuildAt > t) return false;
          spawnPebble(world, e);
          const a = Math.atan2(c.y - e.y, c.x - e.x);
          dash(world, e, e.x + Math.cos(a) * 160, e.y + Math.sin(a) * 160, 0.25, null, null, 'gus-hop');
          e.statsDirty = true; fx(world, e, 'gus-dismount');
          return;
        }
        const p = pebbleOf(world, e);
        if (!p) { if (s.rebuildAt > t) return false; mount(world, e); fx(world, e, 'gus-rebuild'); return; }
        if (Math.hypot(p.x - e.x, p.y - e.y) > 220) { p.order = ORDER.MOVE; p.moveX = e.x; p.moveY = e.y; p.targetId = -1; return false; }
        e.x = p.x; e.y = p.y; mount(world, e); fx(world, e, 'gus-mount');
      } },
    E: { values: [E_VAL1], name: 'Boulder Roll', cd: [14, 13, 12, 11, 10], cost: 60, range: 650, freeTarget: true,
      desc: 'Pebble curls up and rolls forward, knocking enemies aside.',
      cast(world, e, c) {
        const roller = e.heroState.mounted ? e : pebbleOf(world, e);
        if (!roller) return false;
        const a = Math.atan2(c.rawY - roller.y, c.rawX - roller.x), dist = 620, rank = c.rank;
        const hitIds = [];
        dash(world, roller, roller.x + Math.cos(a) * dist, roller.y + Math.sin(a) * dist, 0.6, (w, r) => {
          aoe(w, r.team, r.x, r.y, r.radius + 30, (u) => {
            if (hitIds.includes(u.id)) return; hitIds.push(u.id);
            const side = ((u.x - r.x) * -Math.sin(a) + (u.y - r.y) * Math.cos(a)) >= 0 ? 1 : -1;
            knock(w, u, -Math.sin(a) * side, Math.cos(a) * side, 180, 0.3, true);
            dealDamage(w, e, u, amount(e, E_VAL1, rank), DMG.MAGIC, { ability: true });
          });
        }, null, 'pebble-roll');
        if (roller !== e) roller.aiControlled = false, world.schedule(sec(0.6), () => { roller.aiControlled = true; });
      } },
    R: { values: [R_VAL1], name: 'Avalanche', cd: [90, 75, 60], cost: 100, range: 800,
      desc: 'Gus climbs Pebble and they leap to a target area, stunning on landing.',
      cast(world, e, c) {
        const s = e.heroState, t = world.tick;
        if (!s.mounted) { if (!pebbleOf(world, e) && s.rebuildAt > t) return false; mount(world, e); }
        const x = c.x, y = c.y, rank = c.rank;
        e.untargetableUntil = t + sec(0.8);
        fx(world, e, 'gus-avalanche-warn', x, y, 0.8);
        dash(world, e, x, y, 0.8, null, (w) => {
          aoe(w, e.team, x, y, 300, (u) => { stun(w, u, 1.25); dealDamage(w, e, u, amount(e, R_VAL1, rank), DMG.MAGIC, { ability: true }); });
          fx(w, e, 'gus-avalanche', x, y);
        }, 'gus-leap');
        e.airborneUntil = t + sec(0.8);
      } },
  },
};
