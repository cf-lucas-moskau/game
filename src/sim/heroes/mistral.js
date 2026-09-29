// Mistral Aveline, the Windcaller: an enchanter who carries her team on the wind.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { skillshot, aoe, alliesInRadius, dealDamage, DMG, sec, fx, amount, enemiesNearPolyline, clampY } from './kit.js';
import { slow, knockUp, haste, addShield } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Magic damage', type: 'magic', base: [70, 105, 140, 175, 210], ratio: 0.55, stat: 'ap' };
const W_VAL = { label: 'Magic damage', type: 'magic', base: [50, 80, 110, 140, 170], ratio: 0.45, stat: 'ap' };
const E_VAL = { label: 'Shield', type: 'shield', base: [85, 120, 155, 190, 225], ratio: 0.6, stat: 'ap' };
const R_VAL = { label: 'Shield per second inside', type: 'shield', base: [30, 45, 60], ratio: 0.12, stat: 'ap' };

export default {
  key: 'mistral', name: 'Mistral Aveline', title: 'the Windcaller', role: 'Enchanter', resource: 'mana', difficulty: 'Easy',
  rankOrder: ['E', 'Q', 'W'],
  build: ['stormglass-orb', 'stormcallers-horn', 'quickcurrent-boots', 'kelp-crown', 'molted-shell', 'cloudwool-cloak'], // recommended items: shop highlights and bot purchase order
  base: { hp: 540, hpL: 88, ad: 46, adL: 2.8, armor: 24, armorL: 4, mr: 30, mrL: 1.3, as: 0.64, asL: 0.018, range: 540, speed: 340, mana: 380, manaL: 45, manaRegen: 3.2, projectile: 1500, radius: 30 },
  passive: { name: 'Tailwind', desc: 'Every 2 s, allies near her (and she) gain 10% move speed for 2.5 s.' },
  init(world, e) { e.heroState = {}; },
  onTick(world, e) {
    if (world.tick % sec(2) !== 0) return;
    for (const a of alliesInRadius(world, e.team, e.x, e.y, 550)) haste(world, a, 0.1, 2.5);
  },
  abilities: {
    Q: { values: [Q_VAL], name: 'Crosswind', cd: [8, 7.5, 7, 6.5, 6], cost: [55, 60, 65, 70, 75], range: 850, freeTarget: true,
      desc: 'A gust along a line: damages and slows enemies 30%; allies it passes gain 25% move speed.',
      cast(world, e, c) {
        const rank = c.rank, a = Math.atan2(c.y - e.y, c.x - e.x), x1 = e.x + Math.cos(a) * 850, y1 = clampY(e.y + Math.sin(a) * 850);
        skillshot(world, e, x1, y1, { kind: 'mistral-gust', speed: 1500, range: 850, radius: 70, pierce: true,
          onHit: (w, p, u) => { dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.MAGIC, { ability: true }); slow(w, u, 0.3, 1.5); } });
        world.forEachInRadius((e.x + x1) / 2, (e.y + y1) / 2, 520, e.team, 'ally', (u) => {
          if (u.kind !== KIND.HERO) return;
          const ex = x1 - e.x, ey = y1 - e.y, l2 = ex * ex + ey * ey, k = Math.max(0, Math.min(1, ((u.x - e.x) * ex + (u.y - e.y) * ey) / l2));
          if (Math.hypot(u.x - e.x - ex * k, u.y - e.y - ey * k) < 90) haste(world, u, 0.25, 1.5);
        });
      } },
    W: { values: [W_VAL], name: 'Updraft', cd: [14, 13, 12, 11, 10], cost: 70, range: 750,
      desc: 'A rising column of air: after 0.5 s, enemies inside are damaged and knocked up for 0.75 s.',
      cast(world, e, c) {
        const rank = c.rank, x = c.x, y = c.y;
        spawnZone(world, { kind: 'mistral-updraft', team: e.team, owner: e.id, x, y, r: 170, duration: 0.5 });
        world.schedule(sec(0.5), (w) => { aoe(w, e.team, x, y, 170, (u) => { dealDamage(w, e, u, amount(e, W_VAL, rank), DMG.MAGIC, { ability: true }); knockUp(w, u, 0.75); }); fx(w, e, 'mistral-updraft', x, y); });
      } },
    E: { values: [E_VAL], name: 'Carried Aloft', cd: [11, 10, 9, 8, 7], cost: 60, range: 700,
      desc: 'Shields an ally (or herself) for 2.5 s and gives them 40% move speed, fading over 2 s.',
      cast(world, e, c) {
        let best = null, bd = Infinity;
        for (const a of alliesInRadius(world, e.team, e.x, e.y, 700)) { if (a.kind !== KIND.HERO) continue; const d = (a.x - c.rawX) ** 2 + (a.y - c.rawY) ** 2 + (a.id === c.targetId ? -1e9 : 0); if (d < bd) { bd = d; best = a; } }
        const t = best || e;
        addShield(world, t, amount(e, E_VAL, c.rank), 2.5); haste(world, t, 0.4, 2);
        fx(world, e, 'mistral-carry', t.x, t.y, 0, t.id);
      } },
    R: { values: [R_VAL], name: 'Jetstream', cd: [100, 85, 70], cost: 100, range: 1400, freeTarget: true,
      desc: 'A 1400-long jetstream for 5 s: allies inside gain 40% move speed and a growing shield; enemies inside are slowed 35%.',
      cast(world, e, c) {
        const rank = c.rank, a = Math.atan2(c.y - e.y, c.x - e.x), x2 = e.x + Math.cos(a) * 1400, y2 = clampY(e.y + Math.sin(a) * 1400);
        spawnZone(world, { kind: 'mistral-jet', team: e.team, owner: e.id, x: e.x, y: e.y, x2, y2, r: 150, duration: 5, every: 0.25,
          onTick: (w, z) => {
            const pts = [z.x, z.y, z.x2, z.y2], second = (w.tick - z.born) % sec(1) === 0;
            for (const u of enemiesNearPolyline(w, z.team, pts, z.r)) slow(w, u, 0.35, 0.4);
            w.forEachInRadius((z.x + z.x2) / 2, (z.y + z.y2) / 2, 760, z.team, 'ally', (u) => {
              if (u.kind !== KIND.HERO) return;
              const ex = z.x2 - z.x, ey = z.y2 - z.y, l2 = ex * ex + ey * ey, k = Math.max(0, Math.min(1, ((u.x - z.x) * ex + (u.y - z.y) * ey) / l2));
              if (Math.hypot(u.x - z.x - ex * k, u.y - z.y - ey * k) < z.r + u.radius) { haste(w, u, 0.4, 0.4); if (second) addShield(w, u, amount(e, R_VAL, rank), 1.5); }
            });
          } });
        fx(world, e, 'mistral-jet', e.x, e.y, a);
      } },
  },
};
