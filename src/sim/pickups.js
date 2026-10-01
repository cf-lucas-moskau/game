// Pickups on the lane: health relics (on a timer, mirrored per side) and whale-roll loot (treasure that washes up in the
// endangered edge band while the whale rolls). A hero who touches one takes it; ties go alternately (team-neutral).
// pickup: { id, kind: 'relic' | 'loot', x, y, born, until (0 = until taken) }
import { EV } from '../core/events.js';
import { MAP, RULES, LANE, sec, sideX, TEAM } from './constants.js';
import { heal, giveGold, giveXp } from './damage.js';
import { sq } from '../core/dmath.js';

const add = (w, kind, x, y, until) => { const p = { id: w.tick * 16 + w.pickups.length, kind, x, y, born: w.tick, until }; w.pickups.push(p); return p; };

/** Treasure along the edge the whale rolls toward, at mirrored distances from both ends. */
export function spawnRollLoot(w, dir) {
  const y = dir > 0 ? (LANE.EDGE_MAX + LANE.MAX_Y) / 2 : (LANE.EDGE_MIN + LANE.MIN_Y) / 2;
  const until = w.tick + sec(RULES.WHALE_DURATION + RULES.LOOT_LINGER);
  for (const fromMid of RULES.LOOT_X) for (const t of [TEAM.BLUE, TEAM.RED]) add(w, 'loot', sideX(t, LANE.W / 2 - fromMid), y, until);
  w.events.push(EV.OBJECTIVE, w.tick, -1, -1, LANE.W / 2, y, RULES.LOOT_X.length * 2, 'loot-up');
}

export function pickupSystem(w) {
  const t = w.tick, st = w.state;
  if (t >= st.nextRelic) {
    for (const [x, y] of MAP.RELICS) if (!w.pickups.some((p) => p.kind === 'relic' && p.x === x && p.y === y)) add(w, 'relic', x, y, 0);
    st.nextRelic = t + sec(RULES.RELIC_INTERVAL);
    w.events.push(EV.RELIC, t, 0, 0, 0, 0, 1);
  }
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const p = w.pickups[i];
    if (p.until && t >= p.until) { w.pickups.splice(i, 1); continue; }
    const nh = w.heroes.length, r = p.kind === 'relic' ? RULES.RELIC_RADIUS : RULES.LOOT_RADIUS;
    for (let k = 0; k < nh; k++) {
      const h = w.heroes[t & 1 ? nh - 1 - k : k]; // alternate who reaches a contested pickup first
      if (h.dead || sq(h.x - p.x) + sq(h.y - p.y) > sq(r + h.radius)) continue;
      if (p.kind === 'relic') {
        heal(w, h, h, h.maxHp * RULES.RELIC_HEAL); h.mana = Math.min(h.maxMana, h.mana + h.maxMana * 0.15);
        w.events.push(EV.RELIC, t, h.id, 0, p.x, p.y, 0);
      } else {
        giveGold(w, h, RULES.LOOT_GOLD); giveXp(w, h, RULES.LOOT_XP);
        w.events.push(EV.PICKUP, t, h.id, 0, p.x, p.y, RULES.LOOT_GOLD, 'loot');
      }
      w.pickups.splice(i, 1); break;
    }
  }
}
