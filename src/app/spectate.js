// Bot-only match driven by the fixed loop: used by the bench harness and as the menu backdrop.
import { createMatch } from '../sim/match.js';
import { CONTENT } from '../sim/content.js';
import { HERO_KEYS } from '../sim/heroes/index.js';
import { BotDirector } from '../ai/director.js';
import { FixedLoop } from '../core/fixed-loop.js';
import { TICK_HZ } from '../sim/constants.js';
import { GameRenderer } from '../render/renderer.js';

export function startSpectate({ canvas, lib, seed = 1, quality = 'medium', telemetry, heroes = null, difficulty = 'medium', timeScale = 1, skipSeconds = 0 }) {
  const roster = (heroes || [...HERO_KEYS]).map((k, p) => ({ playerId: p, heroKey: k, team: p < 3 ? 0 : 1, isBot: true }));
  const world = createMatch({ seed, roster, content: CONTENT });
  const dir = new BotDirector(world, difficulty); const cmds = [];
  while (world.tick < skipSeconds * TICK_HZ && !world.state.over) { dir.commands(world, cmds); world.step(cmds); }
  world.events.drain(() => {});
  const renderer = new GameRenderer(canvas, lib, world, { quality, telemetry });
  renderer.focusId = world.heroes[0].id;
  let last = performance.now();
  const loop = new FixedLoop({ hz: TICK_HZ,
    step: () => { dir.commands(world, cmds); const t0 = performance.now(); world.step(cmds); telemetry && telemetry.sim.push(performance.now() - t0); },
    render: (alpha) => {
      const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      telemetry && telemetry.beginFrame(now);
      // spectator camera: follow the most interesting living hero (the one closest to action)
      const f = world.entities[renderer.focusId];
      if (!f || f.dead) { const alive = world.heroes.find((h) => !h.dead); if (alive) renderer.focusId = alive.id; }
      renderer.render(alpha, dt);
      if (telemetry && (world.tick & 31) === 0) { let n = 0; for (const e of world.entities) if (e.alive) n++; telemetry.gauges.entities = n; }
    } });
  loop.timeScale = timeScale;
  loop.start();
  return { world, renderer, loop };
}
