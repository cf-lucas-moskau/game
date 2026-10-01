// Map objectives for bots: when nothing more urgent is going on (no fight, no retreat), a bot may take a neutral camp.
// Fills the bot's own intent { kind, id, x, y } and returns it, or returns null; bot.js turns it into commands.
// Read-only, like perception.js.
import { KIND, RULES, sec } from '../sim/constants.js';
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
    let started = false; if (crab.aggroId >= 0) for (const a of snap.allies) if (a.id === crab.aggroId) { started = true; break; }
    if (!started) { let closest = true; for (const a of snap.allies) if (d(a, crab) < dist - 50) { closest = false; break; } if (!closest) continue; }
    // a crab that would win the trade is left for later (a weak hero against a grown crab)
    if (crab.hp > me.hp * 2.2 && !started) continue;
    if (dist < bd) { bd = dist; best = crab; }
  }
  return best ? set(out, 'camp', best.id, best.x, best.y) : null;
}

/** The Sky Pearl: everyone healthy enough goes once it is about to surface, unless the enemy holds it with more heroes. */
function pearlIntent(world, me, snap, out) {
  const p = world.state.pearl; if (!p) return null;
  const soon = p.phase === 'up' || (p.phase === 'warn' && p.until - world.tick < sec(8));
  if (!soon || hpr(me) < 0.4) return null;
  const dist = d(me, p); if (dist > 2800) return null; // the pearl state has x, y
  let theirs = 0, ours = dist < RULES.PEARL_RADIUS + 400 ? 1 : 0;
  for (const e of snap.enemies) if (d(e, p) < RULES.PEARL_RADIUS + 400) theirs++;
  for (const a of snap.allies) if (d(a, p) < RULES.PEARL_RADIUS + 400) ours++;
  if (theirs > ours + 1) return null;
  // spread out inside the circle by seat so the team does not stack on one spot
  const seat = me.playerId % 3, ang = seat * 2.1 + (me.team ? Math.PI : 0), rr = RULES.PEARL_RADIUS * 0.45;
  return set(out, 'pearl', -1, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr);
}

/** Whale-roll loot close by, when healthy enough to brave the edge. */
function lootIntent(world, me, snap, out) {
  if (hpr(me) < 0.5) return null;
  let best = null, bd = 520;
  for (const p of world.pickups) { if (p.kind !== 'loot') continue; const dd = d(me, p); if (dd < bd) { bd = dd; best = p; } }
  return best ? set(out, 'loot', -1, best.x, best.y) : null;
}

/** A ready Gale Shrine nearby, when no enemy hero is close enough to punish the channel. */
function shrineIntent(world, me, snap, out) {
  if (hpr(me) < 0.5 || !world.state.shrines) return null;
  for (const s of world.state.shrines) {
    if (world.tick < s.readyAt || (s.heroId >= 0 && s.heroId !== me.id)) continue;
    if (d(me, s) > 700) continue;
    let danger = false; for (const e of snap.enemies) if (d(e, s) < 900) { danger = true; break; }
    if (danger) continue;
    return set(out, 'shrine', s.i, s.x, s.y);
  }
  return null;
}

/** What map objective this bot should work on, if any (called only when no fight or retreat is going on). */
export function objectiveIntent(world, me, snap, out) {
  for (const e of snap.enemies) if (d(e, me) < 700) return null; // stay with the fight first
  return pearlIntent(world, me, snap, out) || lootIntent(world, me, snap, out) || shrineIntent(world, me, snap, out) || campIntent(world, me, snap, out);
}
