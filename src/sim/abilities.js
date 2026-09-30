import { EV } from '../core/events.js';
import { sec, KIND, LANE } from './constants.js';
import { canCast } from './stats.js';
import { heal, haste } from './damage.js';
import { canPay, spend } from './resources.js';
import { atan2, hypot, sq } from '../core/dmath.js';

export const SLOTS = ['Q', 'W', 'E', 'R'];

/** Ability ranks derived from level (auto-leveling, mobile friendly). */
export function ranksForLevel(level, order = ['Q', 'E', 'W']) {
  const r = level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0;
  const ranks = { Q: 0, W: 0, E: 0, R: r };
  let pts = level - r;
  for (const s of ['Q', 'W', 'E']) if (pts > 0) { ranks[s] = 1; pts--; }
  let lvl = 3;
  while (pts > 0) {
    lvl++;
    let placed = false;
    for (const s of order) {
      if (ranks[s] < 5 && ranks[s] < Math.ceil(lvl / 2)) { ranks[s]++; placed = true; break; }
    }
    if (!placed) for (const s of ['Q', 'W', 'E']) if (ranks[s] < 5) { ranks[s]++; placed = true; break; }
    pts--;
    if (!placed) break;
  }
  return ranks;
}
const at = (v, rank) => (Array.isArray(v) ? v[Math.max(0, Math.min(v.length - 1, rank - 1))] : v);
export const byRank = at;

/** An ability's cost right now (costs may depend on state, e.g. a free spell). */
export const abilityCost = (world, e, ab, rank) => (typeof ab.cost === 'function' ? ab.cost(world, e, rank) : at(ab.cost || 0, rank));
/** An ability's base cooldown in seconds right now, before cooldown reduction. */
export const abilityCooldown = (world, e, ab, rank) => (typeof ab.cd === 'function' ? ab.cd(world, e, rank) : at(ab.cd, rank));
/** Try to cast ability slot (0..3). Returns true when cast. */
export function tryCast(world, e, slot, cmd) {
  const def = world.registry.heroes[e.heroKey];
  const key = SLOTS[slot]; const ab = def.abilities[key];
  if (!ab || e.dead) return false;
  const rank = e.ranks[key];
  if (rank <= 0 || e.cds[slot] > 0 || !canCast(world, e)) return false;
  const cost = abilityCost(world, e, ab, rank);
  if (!payable(world, e, def, ab, cost)) return false;
  // clamp target to range
  let tx = cmd.x, ty = cmd.y;
  if (ab.range) {
    const dx = tx - e.x, dy = ty - e.y, d = hypot(dx, dy);
    if (d > ab.range && !ab.freeTarget) { tx = e.x + (dx / d) * ab.range; ty = e.y + (dy / d) * ab.range; }
  }
  ty = Math.max(LANE.MIN_Y, Math.min(LANE.MAX_Y, ty));
  const ctx = { x: tx, y: ty, rawX: cmd.x, rawY: cmd.y, pts: cmd.pts, targetId: cmd.id ?? -1, rank, slot };
  const ok = ab.cast(world, e, ctx);
  if (ok === false) return false;
  pay(world, e, def, ab, cost);
  const baseCd = abilityCooldown(world, e, ab, rank);
  e.cds[slot] = sec(baseCd * (1 - e.cdr));
  if (ab.castTime) e.castLockUntil = world.tick + sec(ab.castTime);
  e.facing = atan2(ty - e.y, tx - e.x);
  if (e.order === 2 && !ab.keepAttack) e.windup = 0;
  world.events.push(EV.CAST, world.tick, e.id, slot, tx, ty, rank, e.heroKey);
  if (def.onCast) def.onCast(world, e, slot, ctx);
  for (const k of e.items) { const it = world.registry.items[k]; if (it && it.onAbilityCast) it.onAbilityCast(world, e, slot); }
  return true;
}
function payable(world, e, def, ab, cost) { return canPay(e, ab.costType || def.resource, cost); }
function pay(world, e, def, ab, cost) { spend(e, ab.costType || def.resource, cost); }

// ---- summoner spells ------------------------------------------------------------
export const SPELLS = {
  dash: { name: 'Dash', cd: 30, cast(world, e, x, y) {
    const dx = x - e.x, dy = y - e.y, d = hypot(dx, dy) || 1, r = Math.min(400, d);
    const fx = e.x, fy = e.y;
    e.x += (dx / d) * r; e.y = Math.max(LANE.MIN_Y, Math.min(LANE.MAX_Y, e.y + (dy / d) * r)); e.px = e.x; e.py = e.y;
    world.events.push(EV.BLINK, world.tick, e.id, 0, fx, fy, 0, 'dash');
    return true; } },
  heal: { name: 'Heal', cd: 60, cast(world, e) {
    const amt = 90 + 15 * e.level;
    heal(world, e, e, amt); haste(world, e, 0.3, 1);
    let best = null, bd = 850 * 850;
    for (const h of world.heroes) if (h !== e && h.team === e.team && !h.dead) { const d = sq(h.x - e.x) + sq(h.y - e.y); if (d < bd && h.hp / h.maxHp < 1) { bd = d; best = h; } }
    if (best) { heal(world, e, best, amt); haste(world, best, 0.3, 1); }
    world.events.push(EV.FX, world.tick, e.id, 0, e.x, e.y, 0, 'heal-spell');
    return true; } },
};
export function trySpell(world, e, slot, x, y) {
  const key = e.spells[slot]; const sp = SPELLS[key];
  if (!sp || e.spellCds[slot] > 0 || e.dead || !canCast(world, e) || (key === 'dash' && e.rootUntil > world.tick)) return false;
  if (sp.cast(world, e, x, y)) { e.spellCds[slot] = sec(sp.cd); return true; }
  return false;
}
export const isHeroish = (e) => e.kind === KIND.HERO;
