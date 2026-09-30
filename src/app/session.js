// A playable match: the local player (or a scripted stand-in for benchmarks), bots, and in online play the other
// players. Every tick the session asks its authority (src/net/authority.js) which commands to apply: locally that is
// bots + the player through LocalTransport; online the host adds remote players and broadcasts, a client steps on
// the host's command stream. Render, UI, audio and prediction are the same in every mode.
import { createMatch, stateHash } from '../sim/match.js';
import { CONTENT } from '../sim/content.js';
import { HERO_KEYS } from '../sim/heroes/index.js';
import { BotDirector } from '../ai/director.js';
import { Bot } from '../ai/bot.js';
import { FixedLoop } from '../core/fixed-loop.js';
import { TICK_HZ } from '../sim/constants.js';
import { LocalTransport } from '../net/transport.js';
import { LocalAuthority, HostAuthority, ClientAuthority } from '../net/authority.js';
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
   * @param o.roster     the match roster (online: from the lobby); generated from `heroKey`/`heroes` when absent
   * @param o.player     the local player's id in the roster
   * @param o.online     { role: 'host', peers: Map<playerId, channel>, onPeer } or { role: 'client', channel, onHost }
   */
  constructor({ canvas, lib, seed = 1, heroKey, skin = DEFAULT_SKIN, heroes = null, quality, telemetry, difficulty = 'medium', net = {}, autopilot = false, fixedBuffer = null, skipSeconds = 0, roster = null, player = 0, online = null }) {
    if (!roster) {
      const rng = new Rng(seed ^ 0x5eed);
      const pick = () => rng.pick(HERO_KEYS);
      const valid = (k) => HERO_KEYS.includes(k);
      roster = [{ playerId: 0, heroKey: (heroes && valid(heroes[0]) && heroes[0]) || heroKey || pick(), team: 0, isBot: false }];
      for (let p = 1; p < 6; p++) roster.push({ playerId: p, heroKey: (heroes && valid(heroes[p]) && heroes[p]) || pick(), team: p < 3 ? 0 : 1, isBot: true });
      // skins ride in the roster like they do in a lobby; the sim ignores them
      const look = new Rng(seed ^ 0x51c1), rand = () => look.next();
      for (const r of roster) r.skin = r.isBot ? pickSkin(r.heroKey, rand) : (validSkin(r.heroKey, skin) ? skin : DEFAULT_SKIN);
    }
    this.roster = roster; this.online = online ? online.role : null;
    this.world = createMatch({ seed, roster, content: CONTENT });
    this.telemetry = telemetry; this.player = player; this.me = this.world.heroes.find((h) => h.playerId === player);
    this.cmds = [];
    // bots run where the match is decided: locally or on the host, never on a client
    this.bots = this.online === 'client' ? null : new BotDirector(this.world, difficulty);
    this.transport = new LocalTransport(online ? {} : { ...net, seed });
    if (!online) this.authority = new LocalAuthority({ world: this.world, bots: this.bots, transport: this.transport });
    else if (online.role === 'host') this.authority = new HostAuthority({ world: this.world, bots: this.bots, transport: this.transport, peers: online.peers, difficulty, onPeer: online.onPeer });
    else this.authority = new ClientAuthority({ world: this.world, channel: online.channel, player, onHost: online.onHost });
    this.onApplied = (c) => { if (c.ts !== undefined) { this.telemetry && this.telemetry.inputProcessed(c.ts); this.predictor.onAck(c); } };
    this.autopilot = autopilot ? new Bot(player, difficulty, seed + 99) : null;
    if (!online) while (this.world.tick < skipSeconds * TICK_HZ) { this.bots.commands(this.world, this.cmds); if (this.autopilot) for (const c of this.autopilot.think(this.world)) if (c) this.cmds.push(c); this.world.step(this.cmds); }
    this.world.events.drain(() => {});
    this.renderer = new GameRenderer(canvas, lib, this.world, { quality, telemetry, fixedBuffer });
    this.renderer.focusId = this.me.id; this.renderer.myTeam = this.me.team;
    for (const r of roster) this.renderer.units.skins.set(r.playerId, r.skin);
    this.predictor = new Predictor(this.world, this.me, telemetry);
    this.renderer.predictor = this.predictor;
    this.listeners = new Set();
    this.last = performance.now();
    this.loop = new FixedLoop({ hz: TICK_HZ, step: () => this.tick(), render: (alpha) => this.frame(alpha), background: !!online });
  }
  start() { this.loop.start(); return this; }
  /** State hash of the world (tests and online diagnostics: every player's world must hash the same at a tick). */
  hash() { return stateHash(this.world); }
  /** The skin a hero wears in this match (presentation only). */
  skinOf(e) { const r = this.roster[e.playerId]; return r ? r.skin : 'classic'; }
  stop() { this.loop.stop(); }
  /** Receive every sim event the renderer drains (UI: kill feed, banners, damage numbers). */
  tapEvents(fn) { const tap = { onEvent: fn, update() {} }; this.renderer.extra.push(tap); return () => { const i = this.renderer.extra.indexOf(tap); if (i >= 0) this.renderer.extra.splice(i, 1); }; }
  /** Stop the match and free the renderer and input devices; `keepChannels` hands online connections back to the lobby. */
  dispose(keepChannels = false) {
    this.stop(); this.listeners.clear(); this.authority.dispose(keepChannels);
    for (const i of this.inputs || []) i.dispose();
    this.renderer.dispose();
  }
  /** Local input entry point: stamp, predict, send. */
  send(cmd) {
    const now = performance.now();
    if (!this.authority.send(cmd, now)) return false;
    cmd.ts = now; // local issue time (ignored by the sim and the server)
    this.predictor.onLocalCommand(cmd, now);
    return true;
  }
  tick() {
    // an online client runs a few ticks behind the host; when ticks pile up (a hitch, a slow frame) it catches up
    for (let n = 0; n < 4; n++) { if (!this.step()) return; if (this.authority.backlog <= 2) return; }
  }
  /** One simulation tick, if the authority has one to give (a client may wait for the host). */
  step() {
    const w = this.world, now = performance.now();
    if (this.autopilot) { const out = this.autopilot.think(w); for (let i = 0; i < out.length; i++) if (out[i]) this.send(out[i]); }
    if (!this.authority.collect(now, this.cmds, this.onApplied)) return false;
    const t0 = performance.now(); w.step(this.cmds); this.telemetry && this.telemetry.sim.push(performance.now() - t0);
    this.predictor.afterTick();
    if (w.state.over && !this.ended) { this.ended = true; for (const f of this.listeners) f('end', w.state.winner); }
    return true;
  }
  frame(alpha) {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const tel = this.telemetry;
    tel && tel.beginFrame(now);
    this.authority.update(now);
    this.predictor.frame(alpha, now);
    for (const f of this.listeners) f('frame', dt);
    this.renderer.render(alpha, dt);
    tel && tel.inputsPresented(performance.now());
    if (tel) { const a = this.authority; tel.gauges.ping = a.ping; tel.gauges.jitter = a.jitter; tel.gauges.loss = a.loss; }
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
}
