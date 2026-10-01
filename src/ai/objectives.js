// Map objectives for bots: when nothing more urgent is going on (no fight, no retreat), a bot may take a neutral camp.
// Fills the bot's own intent { kind, id, x, y } and returns it, or returns null; bot.js turns it into commands.
// Read-only, like perception.js.
import { KIND } from '../sim/constants.js';
import { alive, d, hpr } from './perception.js';

export const newIntent = () => ({ kind: '', id: -1, x: 0, y: 0 });
const set = (out, kind, id, x, y) => { out.kind = kind; out.id = id; out.x = x; out.y = y; return out; };

/** Nearest living crab worth taking now, or null. One bot per team goes (the closest), others join once it started. */
function campIntent(world, me, snap, out) {
  if (hpr(me) < 0.55) return null;
  let best = null, bd = Infinity;
  for (const camp of world.state.camps) {
    const crab = camp.crabId >= 0 ? world.get(camp.crabId) : null; if (!alive(crab) || crab.kind !== KIND.CRAB) continue;
    const dist = d(me, crab); if (dist > 1500) continue;
    // enemies near the camp make it a fight, not a camp
    let contested = false; for (const e of snap.enemies) if (d(e, crab) < 900) { contested = true; break; }
    if (contested) continue;
    const started = crab.aggroId >= 0 && snap.allies.some((a) => a.id === crab.aggroId);
    if (!started) { let closest = true; for (const a of snap.allies) if (d(a, crab) < dist - 50) { closest = false; break; } if (!closest) continue; }
    // a crab that would win the trade is left for later (a weak hero against a grown crab)
    if (crab.hp > me.hp * 2.2 && !started) continue;
    if (dist < bd) { bd = dist; best = crab; }
  }
  return best ? set(out, 'camp', best.id, best.x, best.y) : null;
}

/** What map objective this bot should work on, if any (called only when no fight or retreat is going on). */
export function objectiveIntent(world, me, snap, out) {
  for (const e of snap.enemies) if (d(e, me) < 700) return null; // stay with the fight first
  return campIntent(world, me, snap, out);
}
