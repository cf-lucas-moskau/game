// Gale Shrines: two shrines in the neutral middle (symmetric through the centre). A hero who stands in a ready shrine
// for SHRINE_CHANNEL seconds without fighting, and with no enemy hero inside, gets Tailwind (speed and attack speed,
// but more damage taken). The shrine then recharges for SHRINE_COOLDOWN seconds.
import { EV } from '../core/events.js';
import { MAP, RULES, sec } from './constants.js';
import { addBuff } from './buffs.js';
import { sq } from '../core/dmath.js';

export function setupShrines(w) {
  w.state.shrines = MAP.SHRINES.map(([x, y], i) => ({ i, x, y, readyAt: sec(RULES.SHRINE_FIRST), heroId: -1, start: 0, prog: 0 }));
}
export function shrineSystem(w) {
  const t = w.tick, r2 = sq(RULES.SHRINE_RADIUS), need = sec(RULES.SHRINE_CHANNEL);
  for (const s of w.state.shrines) {
    if (t < s.readyAt) { s.heroId = -1; s.prog = 0; continue; }
    if (t === s.readyAt) w.events.push(EV.OBJECTIVE, t, -1, -1, s.x, s.y, s.i, 'shrine-ready');
    // who is inside: the channeling hero keeps it while they stay calm and alone with their team
    let cur = s.heroId >= 0 ? w.get(s.heroId) : null, teams = 0, first = null;
    const nh = w.heroes.length;
    for (let k = 0; k < nh; k++) {
      const h = w.heroes[t & 1 ? nh - 1 - k : k]; // ties alternate (team-neutral)
      if (h.dead || sq(h.x - s.x) + sq(h.y - s.y) > r2) continue;
      teams |= 1 << h.team; if (!first) first = h;
    }
    if (cur && (cur.dead || sq(cur.x - s.x) + sq(cur.y - s.y) > r2 || cur.lastCombatTick > s.start)) cur = null;
    if (!cur) { if (first && first.lastCombatTick < t) { s.heroId = first.id; s.start = t; } else s.heroId = -1; s.prog = 0; continue; }
    if (teams === 3) { s.start = t; s.prog = 0; continue; } // an enemy in the shrine: the gale will not answer
    s.prog = (t - s.start) / need;
    if (t - s.start >= need) {
      addBuff(w, cur, 'tailwind');
      s.readyAt = t + sec(RULES.SHRINE_COOLDOWN); s.heroId = -1; s.prog = 0;
      w.events.push(EV.OBJECTIVE, t, cur.id, cur.team, s.x, s.y, s.i, 'shrine');
    }
  }
}
