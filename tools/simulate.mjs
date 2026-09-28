// Headless bot-vs-bot matches for balance and length checks: node tools/simulate.mjs [matches]
import { createMatch } from '../src/sim/match.js';
import { CONTENT } from '../src/sim/content.js';
import { HERO_KEYS } from '../src/sim/heroes/index.js';
import { BotDirector } from '../src/ai/director.js';
import { Rng } from '../src/core/rng.js';
import { TICK_HZ } from '../src/sim/constants.js';

export function simulate(seed, difficulty = 'medium', maxMin = 16) {
  const r = new Rng(seed);
  const roster = [0, 1, 2, 3, 4, 5].map((p) => ({ playerId: p, heroKey: r.pick(HERO_KEYS), team: p < 3 ? 0 : 1, isBot: true }));
  const w = createMatch({ seed, roster, content: CONTENT });
  const dir = new BotDirector(w, difficulty); const cmds = [];
  let ms = 0;
  while (!w.state.over && w.tick < maxMin * 60 * TICK_HZ) { dir.commands(w, cmds); const t0 = performance.now(); w.step(cmds); ms += performance.now() - t0; }
  return { seed, minutes: +(w.tick / TICK_HZ / 60).toFixed(2), winner: w.state.winner, roster: roster.map((x) => x.heroKey),
    kda: w.heroes.map((h) => `${h.heroKey}:${h.kills}/${h.deaths}/${h.assists} L${h.level} ${h.items.length}it`), simMsPerTick: +(ms / w.tick).toFixed(3) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +(process.argv[2] || 6); const res = [];
  for (let s = 1; s <= n; s++) { const x = simulate(s * 101); res.push(x); console.log(JSON.stringify(x)); }
  const mins = res.map((x) => x.minutes); console.log('avg minutes', (mins.reduce((a, b) => a + b) / n).toFixed(2), 'max', Math.max(...mins), 'blue wins', res.filter((x) => x.winner === 0).length, '/', n);
}
