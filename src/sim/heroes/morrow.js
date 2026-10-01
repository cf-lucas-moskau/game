// Morrow, the Clockwright: leaves echoes, steps back through them, rewinds 4 seconds.
import { EV } from '../../core/events.js';
import { skillshot, aoe, enemiesNearPolyline, dealDamage, DMG, scale, sec, fx, amount } from './kit.js';
import { addShield, haste } from '../damage.js';
import { hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL1 = { label: 'Magic damage', type: 'magic', base: [36, 56, 76, 95, 114], ratio: 0.55, stat: 'ap', bonus: { ratio: 0.2, stat: 'ad' } };
const W_VAL1 = { label: 'Shield', type: 'shield', base: [64, 92, 120, 148, 176], ratio: 0.5, stat: 'ap' };
const E_VAL1 = { label: 'Magic damage', type: 'magic', base: [60, 95, 130, 165, 200], ratio: 0.5, stat: 'ap' };

const HISTORY = sec(4);
const addEcho = (world, e) => addEchoAt(world, e.heroState, e.x, e.y);
function addEchoAt(world, s, x, y) {
  s.echoes.push({ x, y, until: world.tick + sec(4), id: world.nextFxId++ });
  if (s.echoes.length > 4) s.echoes.shift();
}
export default {
  key: 'morrow', name: 'Morrow', title: 'the Clockwright', role: 'Skirmisher', resource: 'mana', difficulty: 'Medium',
  rankOrder: ['Q', 'E', 'W'],
  build: ['lanternfish-lens', 'stormstep-sandals', 'kelp-crown', 'deepwater-codex', 'borrowed-seconds', 'stillwater-pendant'], // recommended items: shop highlights and bot purchase order
  passive: { name: 'Echoes', desc: 'His spells leave clock-faced echoes where he stood (up to 4, 4 s). Step Through blinks to the latest; Rewind returns him 4 s back in time, health included.' },
  base: { hp: 590, hpL: 96, ad: 54, adL: 3.2, armor: 26, armorL: 4.2, mr: 30, mrL: 1.3, as: 0.66, asL: 0.02, range: 450, speed: 335, mana: 380, manaL: 45, manaRegen: 3, projectile: 1600, radius: 34 },
  init(world, e) { e.heroState = { echoes: [], hist: new Float32Array(HISTORY * 3), histHead: 0, histFill: 0, windupShield: 0 }; },
  onTick(world, e) {
    const s = e.heroState, t = world.tick;
    const i = s.histHead * 3; s.hist[i] = e.x; s.hist[i + 1] = e.y; s.hist[i + 2] = e.hp;
    s.histHead = (s.histHead + 1) % HISTORY; if (s.histFill < HISTORY) s.histFill++;
    while (s.echoes.length && s.echoes[0].until <= t) s.echoes.shift();
    if (s.windupShield && (e.shield <= 0 || e.shieldUntil <= t)) {
      if (e.shield <= 0 && e.shieldUntil > t) { haste(world, e, 0.4, 2); fx(world, e, 'morrow-spring'); }
      s.windupShield = 0;
    }
  },
  onRespawn(world, e) { e.heroState.echoes.length = 0; e.heroState.histFill = 0; },
  abilities: {
    Q: { values: [Q_VAL1], name: 'Cog Toss', cd: [6, 5.5, 5, 4.5, 4], cost: [45, 50, 55, 60, 65], range: 700, freeTarget: true,
      desc: 'Throw a gear that flies out and returns, damaging on both passes.',
      cast(world, e, c) {
        addEcho(world, e);
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'morrow-cog', speed: 1300, range: 700, radius: 55, boomerang: true,
          onHit: (w, p, u) => dealDamage(w, e, u, amount(e, Q_VAL1, rank), DMG.MAGIC, { ability: true }) });
      } },
    W: { values: [W_VAL1], name: 'Wind-Up', cd: [12, 11, 10, 9, 8], cost: 60,
      desc: 'Shield for 2 s. If it breaks, gain 40% move speed.',
      cast(world, e, c) { addEcho(world, e); addShield(world, e, amount(e, W_VAL1, c.rank), 2, e); e.heroState.windupShield = 1; } },
    E: { values: [E_VAL1], name: 'Step Through', cd: [14, 13, 12, 11, 10], cost: 70,
      desc: 'Teleport to your most recent echo, damaging enemies along the path.',
      cast(world, e, c) {
        const s = e.heroState; const echo = s.echoes[s.echoes.length - 1];
        if (!echo || hypot(echo.x - e.x, echo.y - e.y) > 1100) return false;
        const fx0 = e.x, fy0 = e.y;
        const hit = enemiesNearPolyline(world, e.team, [fx0, fy0, echo.x, echo.y], 60);
        for (const u of hit) dealDamage(world, e, u, amount(e, E_VAL1, c.rank), DMG.MAGIC, { ability: true });
        s.echoes.pop();
        e.x = e.px = echo.x; e.y = e.py = echo.y; e.windup = 0;
        addEchoAt(world, s, fx0, fy0);
        world.events.push(EV.BLINK, world.tick, e.id, 0, fx0, fy0, 0, 'morrow-step');
      } },
    R: { name: 'Rewind', cd: [80, 65, 50], cost: 100, castTime: 0.5,
      desc: 'After 0.5 s, snap back to your position and health from 4 seconds ago.',
      cast(world, e) {
        e.channelUntil = world.tick + sec(0.5);
        world.events.push(EV.REWIND, world.tick, e.id, 0, e.x, e.y, 0);
        world.schedule(sec(0.5), (w) => {
          if (e.dead) return;
          const s = e.heroState; const back = Math.min(s.histFill, HISTORY) - 1;
          const i = ((s.histHead - 1 - back + HISTORY * 2) % HISTORY) * 3;
          const fx0 = e.x, fy0 = e.y;
          e.x = e.px = s.hist[i]; e.y = e.py = s.hist[i + 1]; e.hp = Math.min(e.maxHp, Math.max(e.hp, s.hist[i + 2]));
          e.stunUntil = 0; e.rootUntil = 0; e.slowUntil = 0; e.knockUntil = 0;
          w.events.push(EV.BLINK, w.tick, e.id, 1, fx0, fy0, 0, 'morrow-rewind');
        });
      } },
  },
};
