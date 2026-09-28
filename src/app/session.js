// A playable match: one local human (or a scripted stand-in for benchmarks) + bots.
// Every player command goes through the transport, exactly as it will with the Node server.
import { createMatch } from '../sim/match.js';
import { CONTENT } from '../sim/content.js';
import { HERO_KEYS } from '../sim/heroes/index.js';
import { BotDirector } from '../ai/director.js';
import { Bot } from '../ai/bot.js';
import { FixedLoop } from '../core/fixed-loop.js';
import { TICK_HZ } from '../sim/constants.js';
import { LocalTransport } from '../net/transport.js';
import { Rng } from '../core/rng.js';
import { GameRenderer } from '../render/renderer.js';
import { Predictor } from './predictor.js';

export class GameSession {
  /**
   * @param o.heroKey  hero for the local player
   * @param o.net      { ping, jitter, loss } simulated network conditions
   * @param o.autopilot  drive the local player with a bot through the same input path (benchmarks)
   */
  constructor({ canvas, lib, seed = 1, heroKey, quality, telemetry, difficulty = 'medium', net = {}, autopilot = false, fixedBuffer = null, skipSeconds = 0 }) {
    const rng = new Rng(seed ^ 0x5eed);
    const pick = () => rng.pick(HERO_KEYS);
    const roster = [{ playerId: 0, heroKey: heroKey || pick(), team: 0, isBot: false }];
    for (let p = 1; p < 6; p++) roster.push({ playerId: p, heroKey: pick(), team: p < 3 ? 0 : 1, isBot: true });
    this.world = createMatch({ seed, roster, content: CONTENT });
    this.bots = new BotDirector(this.world, difficulty);
    this.transport = new LocalTransport({ ...net, seed });
    this.telemetry = telemetry; this.player = 0; this.me = this.world.heroes[0];
    this.inbox = []; this.cmds = []; this.issued = new Map(); // command -> issue time (ms)
    this.autopilot = autopilot ? new Bot(0, difficulty, seed + 99) : null;
    while (this.world.tick < skipSeconds * TICK_HZ) { this.bots.commands(this.world, this.cmds); if (this.autopilot) for (const c of this.autopilot.think(this.world)) if (c) this.cmds.push(c); this.world.step(this.cmds); }
    this.world.events.drain(() => {});
    this.renderer = new GameRenderer(canvas, lib, this.world, { quality, telemetry, fixedBuffer });
    this.renderer.focusId = this.me.id; this.renderer.myTeam = this.me.team;
    this.predictor = new Predictor(this.world, this.me, telemetry);
    this.renderer.predictor = this.predictor;
    this.listeners = new Set();
    this.last = performance.now();
    this.loop = new FixedLoop({ hz: TICK_HZ, step: () => this.tick(), render: (alpha) => this.frame(alpha) });
  }
  start() { this.loop.start(); return this; }
  stop() { this.loop.stop(); }
  /** Local input entry point: stamp, predict, send. */
  send(cmd) {
    const now = performance.now();
    if (!this.transport.send(cmd, now)) return false;
    this.issued.set(cmd, now);
    this.predictor.onLocalCommand(cmd, now);
    return true;
  }
  tick() {
    const w = this.world, now = performance.now();
    this.bots.commands(w, this.cmds);
    if (this.autopilot) for (const c of this.autopilot.think(w)) if (c) this.send({ ...c });
    this.transport.receive(now, this.inbox);
    for (const c of this.inbox) {
      this.cmds.push(c);
      const t = this.issued.get(c); if (t !== undefined) { this.issued.delete(c); this.telemetry && this.telemetry.inputProcessed(t); this.predictor.onAck(c); }
    }
    const t0 = performance.now(); w.step(this.cmds); this.telemetry && this.telemetry.sim.push(performance.now() - t0);
    this.predictor.afterTick();
    if (w.state.over && !this.ended) { this.ended = true; for (const f of this.listeners) f('end', w.state.winner); }
  }
  frame(alpha) {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const tel = this.telemetry;
    tel && tel.beginFrame(now);
    this.predictor.frame(alpha, now);
    for (const f of this.listeners) f('frame', dt);
    this.renderer.render(alpha, dt);
    tel && tel.inputsPresented(performance.now());
    if (tel) { tel.gauges.ping = this.transport.ping; tel.gauges.jitter = this.transport.jitter; tel.gauges.loss = this.transport.loss; }
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
}
