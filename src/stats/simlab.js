// Simulation lab core: plans bot matches reproducibly from a run config, runs them headless, and applies balance
// patches. Pure (no Node APIs), so tests and any runner can use it; the CLI is tools/simlab.mjs.
//
// Reproducibility: match i of a run is fully determined by (config, i) and the code: its seed, roster, sides and
// builds come from a seeded RNG, the sim and the bots are deterministic. Worker count and order do not matter.
import { createMatch } from '../sim/match.js';
import { CONTENT } from '../sim/content.js';
import { RULES, MINION, STRUCT, TICK_HZ } from '../sim/constants.js';
import { BotDirector } from '../ai/director.js';
import { Rng } from '../core/rng.js';
import { MatchStats } from './match-stats.js';

export const BUILD_MODES = ['recommended', 'shuffled', 'role', 'random'];
export const DEFAULTS = {
  matches: 200, seed: 1, pool: null, blue: null, red: null, focus: [], swap: true, duplicates: false,
  difficulty: 'medium', blueDifficulty: null, redDifficulty: null, builds: 'recommended', maxMinutes: 20, patch: {},
};

/** Seed of match i: a 32-bit mix of the run seed and the index (FNV-1a over both). */
export function matchSeed(base, i) {
  let h = 2166136261;
  for (const v of [base >>> 0, i >>> 0, 0x9e3779b9]) for (let k = 0; k < 4; k++) { h ^= (v >>> (k * 8)) & 255; h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

/** Normalise a partial config: fills defaults and checks hero and item keys against the content. */
export function resolveConfig(cfg, content = CONTENT) {
  const c = { ...DEFAULTS, ...Object.fromEntries(Object.entries(cfg).filter(([, v]) => v !== undefined && v !== null)) };
  const heroes = Object.keys(content.heroes);
  const check = (list, what) => { for (const k of list || []) if (!content.heroes[k]) throw new Error(`unknown hero in ${what}: ${k} (known: ${heroes.join(', ')})`); };
  c.pool = c.pool && c.pool.length ? c.pool : heroes;
  check(c.pool, 'pool'); check(c.blue, 'blue'); check(c.red, 'red'); check(c.focus, 'focus');
  for (const t of ['blue', 'red']) if (c[t] && c[t].length > 3) throw new Error(`--${t} takes at most 3 heroes`);
  if (!BUILD_MODES.includes(c.builds)) throw new Error(`builds must be one of ${BUILD_MODES.join(', ')}`);
  if (!c.duplicates && c.pool.length < 6 && !(c.blue && c.red)) throw new Error('the pool needs at least 6 heroes without --duplicates');
  if (c.focus.length > 6) throw new Error('at most 6 focus heroes');
  return c;
}

/**
 * The plan for match i: seed, roster (player ids 0-2 blue, 3-5 red), bot difficulty per player and item builds.
 * With `swap`, matches 2k and 2k+1 field the same six heroes on opposite sides (paired design: side and roster
 * effects cancel out in each pair).
 */
export function planMatch(c, i, content = CONTENT) {
  const pair = c.swap ? i >> 1 : i, flip = c.swap && (i & 1) === 1;
  const r = new Rng(matchSeed(c.seed, pair * 2 + 1));
  const taken = new Set();
  const draw = () => {
    const free = c.duplicates ? c.pool : c.pool.filter((k) => !taken.has(k));
    const k = r.pick(free.length ? free : c.pool); taken.add(k); return k;
  };
  const teams = [(c.blue || []).slice(), (c.red || []).slice()];
  for (const k of [...teams[0], ...teams[1]]) taken.add(k);
  // focus heroes: each joins a random side that has room (unless already fixed)
  for (const k of c.focus) {
    if (teams[0].includes(k) || teams[1].includes(k)) continue;
    const open = [0, 1].filter((t) => teams[t].length < 3); if (!open.length) break;
    teams[r.pick(open)].push(k); taken.add(k);
  }
  for (const t of [0, 1]) while (teams[t].length < 3) teams[t].push(draw());
  if (flip) teams.reverse();
  const roster = [];
  teams.forEach((list, team) => list.forEach((heroKey, j) => roster.push({ playerId: team * 3 + j, heroKey, team, isBot: true })));
  const diff = [c.blueDifficulty || c.difficulty, c.redDifficulty || c.difficulty];
  if (flip) diff.reverse(); // the difficulty stays with the heroes, like the roster
  const builds = {};
  for (const p of roster) builds[p.playerId] = buildFor(c.builds, content, p.heroKey, r);
  return { index: i, pair, flip, seed: matchSeed(c.seed, i * 2), roster, difficulty: roster.map((p) => diff[p.team]), builds };
}

/** An item build for a bot under the run's build mode. */
export function buildFor(mode, content, heroKey, r) {
  const rec = content.heroes[heroKey].build || [];
  if (mode === 'recommended') return rec.slice();
  if (mode === 'shuffled') return shuffle(rec.slice(), r);
  const keys = Object.keys(content.items);
  const tags = new Set(rec.flatMap((k) => (content.items[k] && content.items[k].tags) || []));
  const pool = mode === 'role' ? keys.filter((k) => (content.items[k].tags || []).some((t) => tags.has(t))) : keys;
  return shuffle(pool.slice(), r).slice(0, 6);
}

/** Seeded Fisher-Yates shuffle, in place. */
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = r.int(0, i); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/** Play one planned match to the end (or `maxMinutes`) and return its statistics record. */
export function runMatch(plan, c, content = CONTENT) {
  const w = createMatch({ seed: plan.seed, roster: plan.roster, content });
  const bots = new BotDirector(w, (p) => plan.difficulty[p], { builds: plan.builds });
  const stats = new MatchStats(w);
  const cmds = []; const limit = c.maxMinutes * 60 * TICK_HZ;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  while (!w.state.over && w.tick < limit) { bots.commands(w, cmds); w.step(cmds); w.events.drain(stats.onEvent); stats.sample(w); }
  const rec = stats.finish(w);
  rec.index = plan.index; rec.pair = plan.pair; rec.flip = plan.flip;
  rec.difficulty = plan.difficulty; rec.simMs = +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(1);
  return rec;
}

// ---- balance patches ----------------------------------------------------------------------------------------
// A patch maps dotted paths to new values, applied in place before any match (each worker applies it once; a
// worker only ever runs one configuration). Ability numbers live in module-level value specs that the casts
// reference directly, so changing them in place is the only way that affects play.
//   { "heroes.saffi.base.ad": 60,                      set a number
//     "heroes.saffi.abilities.Q.cd": [7, 6.5, 6, 5.5, 5], set an array
//     "heroes.vesper.abilities.R.values.0.base": "x0.9",  scale (arrays element-wise)
//     "items.iron-fin.cost": "+100",                       add
//     "rules.RESPAWN_BASE": 8 }                            rules / minions / structures constants
export const PATCH_ROOTS = { heroes: () => CONTENT.heroes, items: () => CONTENT.items, rules: () => RULES, minions: () => MINION, structures: () => STRUCT };

export function applyPatch(patch, roots = PATCH_ROOTS) {
  const applied = [];
  for (const [path, value] of Object.entries(patch || {})) {
    const parts = path.split('.'); const rootKey = parts.shift();
    if (!roots[rootKey]) throw new Error(`patch path must start with ${Object.keys(roots).join(' | ')}: ${path}`);
    let o = roots[rootKey]();
    for (let j = 0; j < parts.length - 1; j++) { o = o[parts[j]]; if (o === undefined || o === null) throw new Error(`patch path not found: ${path}`); }
    const key = parts[parts.length - 1];
    if (!(key in o)) throw new Error(`patch path not found: ${path}`);
    const before = o[key];
    o[key] = patchValue(before, value, path);
    applied.push({ path, before, after: o[key] });
  }
  return applied;
}
function patchValue(before, value, path) {
  if (typeof value === 'string') {
    const m = /^([x*+-])\s*(-?[\d.]+)$/.exec(value.trim()); if (!m) throw new Error(`patch value must be a number, an array, "x1.1" or "+5": ${path}`);
    const n = +m[2], op = (v) => (m[1] === 'x' || m[1] === '*' ? v * n : m[1] === '+' ? v + n : v - n);
    if (Array.isArray(before)) return before.map((v) => +op(v).toFixed(4));
    if (typeof before !== 'number') throw new Error(`cannot scale a non-number: ${path}`);
    return +op(before).toFixed(4);
  }
  if (typeof before === 'number' && typeof value !== 'number') throw new Error(`expected a number: ${path}`);
  if (Array.isArray(before) && !Array.isArray(value) && typeof value !== 'number') throw new Error(`expected an array or a number: ${path}`);
  return Array.isArray(before) && typeof value === 'number' ? before.map(() => value) : value;
}

/** Numeric paths a patch can change for one hero (base stats, ability cooldowns, costs, ranges, value specs). */
export function patchablePaths(heroKey, content = CONTENT) {
  const def = content.heroes[heroKey]; if (!def) throw new Error(`unknown hero ${heroKey}`);
  const out = [];
  for (const [k, v] of Object.entries(def.base)) out.push([`heroes.${heroKey}.base.${k}`, v]);
  for (const [slot, a] of Object.entries(def.abilities)) {
    for (const k of ['cd', 'cost', 'range']) if (a[k] !== undefined) out.push([`heroes.${heroKey}.abilities.${slot}.${k}`, a[k]]);
    (a.values || []).forEach((spec, j) => { for (const k of ['base', 'ratio']) if (spec[k] !== undefined) out.push([`heroes.${heroKey}.abilities.${slot}.values.${j}.${k}`, spec[k], spec.label]); });
  }
  return out;
}
