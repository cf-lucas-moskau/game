// The Sky Pearl: a mid-map objective. It is announced PEARL_WARN seconds ahead, surfaces at the centre, and is captured
// by holding its circle with no enemy hero inside for PEARL_CAPTURE seconds (a contested circle freezes; an empty one
// drains). Capture: Pearl's Blessing for every living hero of the team, PEARL_GOLD for each holder, and a Pearl Golem
// (an empowered siege minion) in the team's next PEARL_WAVES waves. Unclaimed after PEARL_LIFETIME, it sinks.
import { EV } from '../core/events.js';
import { MAP, RULES, sec, TICK_HZ } from './constants.js';
import { giveGold } from './damage.js';
import { addBuff } from './buffs.js';
import { sq } from '../core/dmath.js';

export function setupPearl(w) {
  w.state.pearl = { phase: 'idle', at: sec(RULES.PEARL_FIRST - RULES.PEARL_WARN), x: MAP.PEARL[0], y: MAP.PEARL[1], holder: -1, prog: 0, until: 0, inside: [0, 0] };
  w.state.pearlWaves = [0, 0]; // empowered waves owed to each team
}
/** Heroes of each team inside the circle (counts into p.inside; bit mask of holders' player ids returned per team). */
function countInside(w, p) {
  p.inside[0] = p.inside[1] = 0; const r2 = sq(RULES.PEARL_RADIUS);
  for (const h of w.heroes) if (!h.dead && sq(h.x - p.x) + sq(h.y - p.y) <= r2) p.inside[h.team]++;
}
export function pearlSystem(w) {
  const p = w.state.pearl, t = w.tick;
  if (p.phase === 'idle') {
    if (t >= p.at) { p.phase = 'warn'; p.until = t + sec(RULES.PEARL_WARN); w.events.push(EV.OBJECTIVE, t, -1, -1, p.x, p.y, RULES.PEARL_WARN, 'pearl-warn'); }
    return;
  }
  if (p.phase === 'warn') {
    if (t >= p.until) { p.phase = 'up'; p.holder = -1; p.prog = 0; p.until = t + sec(RULES.PEARL_LIFETIME); w.events.push(EV.OBJECTIVE, t, -1, -1, p.x, p.y, 0, 'pearl-up'); }
    return;
  }
  // up: capture
  countInside(w, p);
  const rate = 1 / (RULES.PEARL_CAPTURE * TICK_HZ), [b, r] = p.inside;
  if (b && !r || r && !b) {
    const team = b ? 0 : 1;
    if (p.holder === team || p.prog <= 0) { p.holder = team; p.prog = Math.min(1, p.prog + rate); }
    else p.prog = Math.max(0, p.prog - rate * 1.5); // wrestle it back from the other team first
  } else if (!b && !r) p.prog = Math.max(0, p.prog - rate * 0.5);
  if (p.prog <= 0 && !b && !r) p.holder = -1;
  if (p.prog >= 1) return capture(w, p, p.holder);
  if (t >= p.until) { p.phase = 'idle'; p.at = t + sec(RULES.PEARL_INTERVAL - RULES.PEARL_WARN); p.holder = -1; p.prog = 0; w.events.push(EV.OBJECTIVE, t, -1, -1, p.x, p.y, 0, 'pearl-sank'); }
}
function capture(w, p, team) {
  const t = w.tick; let mask = 0, credited = -1;
  for (const h of w.heroes) {
    if (h.team !== team || h.dead) continue;
    addBuff(w, h, 'pearl-blessing');
    if (sq(h.x - p.x) + sq(h.y - p.y) <= sq(RULES.PEARL_RADIUS)) { giveGold(w, h, RULES.PEARL_GOLD); mask |= 1 << h.playerId; if (credited < 0) credited = h.id; }
  }
  w.state.pearlWaves[team] += RULES.PEARL_WAVES;
  w.events.push(EV.OBJECTIVE, t, credited, team, p.x, p.y, RULES.PEARL_WAVES, 'pearl-taken', mask);
  p.phase = 'idle'; p.at = t + sec(RULES.PEARL_INTERVAL - RULES.PEARL_WARN); p.holder = -1; p.prog = 0;
}
