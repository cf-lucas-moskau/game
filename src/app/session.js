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
import { pickSkin, validSkin, DEFAULT_SKIN } from '../assets/skins.js';

export class GameSession {
  /**
   * @param o.heroKey  hero for the local player
   * @param o.skin     skin for the local player (presentation only; bots pick their own)
   * @param o.net      { ping, jitter, loss } simulated network conditions
   * @param o.autopilot  drive the local player with a bot through the same input path (benchmarks)
   */
  constructor({ canvas, lib, seed = 1, heroKey, skin = DEFAULT_SKIN, heroes = null, quality, telemetry, difficulty = 'medium', net = {}, autopilot = false, fixedBuffer = null, skipSeconds = 0 }) {
    const rng = new Rng(seed ^ 0x5eed);
    const pick = () => rng.pick(HERO_KEYS);
    const valid = (k) => HERO_KEYS.includes(k);
    const roster = [{ playerId: 0, heroKey: (heroes && valid(heroes[0]) && heroes[0]) || heroKey || pick(), team: 0, isBot: false }];
    for (let p = 1; p < 6; p++) roster.push({ playerId: p, heroKey: (heroes && valid(heroes[p]) && heroes[p]) || pick(), team: p < 3 ? 0 : 1, isBot: true });
    // skins ride in the roster like they will in a lobby; the sim ignores them
    const look = new Rng(seed ^ 0x51c1), rand = () => look.next();
    for (const r of roster) r.skin = r.isBot ? pickSkin(r.heroKey, rand) : (validSkin(r.heroKey, skin) ? skin : DEFAULT_SKIN);
    this.roster = roster;
    this.world = createMatch({ seed, roster, content: CONTENT });
    this.bots = new BotDirector(this.world, difficulty);
    this.transport = new LocalTransport({ ...net, seed });
    this.telemetry = telemetry; this.player = 0; this.me = this.world.heroes[0];
    this.inbox = []; this.cmds = [];
    this.autopilot = autopilot ? new Bot(0, difficulty, seed + 99) : null;
    while (this.world.tick < skipSeconds * TICK_HZ) { this.bots.commands(this.world, this.cmds); if (this.autopilot) for (const c of this.autopilot.think(this.world)) if (c) this.cmds.push(c); this.world.step(this.cmds); }
    this.world.events.drain(() => {});
    this.renderer = new GameRenderer(canvas, lib, this.world, { quality, telemetry, fixedBuffer });
    this.renderer.focusId = this.me.id; this.renderer.myTeam = this.me.team;
    for (const r of roster) this.renderer.units.skins.set(r.playerId, r.skin);
    this.predictor = new Predictor(this.world, this.me, telemetry);
    this.renderer.predictor = this.predictor;
    this.listeners = new Set();
    this.last = performance.now();
    this.loop = new FixedLoop({ hz: TICK_HZ, step: () => this.tick(), render: (alpha) => this.frame(alpha) });
  }
  start() { this.loop.start(); return this; }
  stop() { this.loop.stop(); }
  /** Receive every sim event the renderer drains (UI: kill feed, banners, damage numbers). */
  tapEvents(fn) { const tap = { onEvent: fn, update() {} }; this.renderer.extra.push(tap); return () => { const i = this.renderer.extra.indexOf(tap); if (i >= 0) this.renderer.extra.splice(i, 1); }; }
  /** Stop the match and free the renderer and input devices. */
  dispose() {
    this.stop(); this.listeners.clear();
    for (const i of this.inputs || []) i.dispose();
    this.renderer.dispose();
  }
  /** Local input entry point: stamp, predict, send. */
  send(cmd) {
    const now = performance.now();
    if (!this.transport.send(cmd, now)) return false;
    cmd.ts = now; // local issue time (ignored by the sim and the server)
    this.predictor.onLocalCommand(cmd, now);
    return true;
  }
  tick() {
    const w = this.world, now = performance.now();
    this.bots.commands(w, this.cmds);
    if (this.autopilot) { const out = this.autopilot.think(w); for (let i = 0; i < out.length; i++) if (out[i]) this.send(out[i]); }
    this.transport.receive(now, this.inbox);
    for (const c of this.inbox) {
      this.cmds.push(c);
      if (c.ts !== undefined) { this.telemetry && this.telemetry.inputProcessed(c.ts); this.predictor.onAck(c); }
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
