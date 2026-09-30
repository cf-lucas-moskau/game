// Authorities decide which commands the simulation applies at each tick. GameSession asks its authority every tick
// and steps the world with what it gets; everything else (render, UI, audio, prediction) is the same in every mode.
//
//   LocalAuthority   single player: bots + the local player through LocalTransport (simulated network conditions)
//   HostAuthority    online host: bots + the host player + remote players' validated commands; broadcasts every
//                    tick's commands (and a periodic state hash) to the clients
//   ClientAuthority  online client: sends the player's commands to the host; steps only on the host's tick bundles
//
// Lockstep works because the sim is deterministic across engines (src/core/dmath.js): the same seed, roster and
// command stream give the same world on every machine. Bots run only where the match is decided (local or host).
import { stateHash } from '../sim/match.js';
import { validCommand } from '../sim/commands.js';
import { MSG, HASH_EVERY, wireCommand, acceptCommand, attach } from './protocol.js';

const LOAD_TIMEOUT_MS = 15000;

export class LocalAuthority {
  constructor({ world, bots, transport }) { this.world = world; this.bots = bots; this.transport = transport; this.inbox = []; }
  send(cmd, now) { return this.transport.send(cmd, now); }
  /** Fill `out` with this tick's commands; `onApplied(cmd)` for each of the local player's. Always ticks. */
  collect(now, out, onApplied) {
    this.bots.commands(this.world, out);
    this.transport.receive(now, this.inbox);
    for (const c of this.inbox) { out.push(c); onApplied(c); }
    return true;
  }
  get backlog() { return 0; }
  update() {}
  get ping() { return this.transport.ping; } get jitter() { return this.transport.jitter; } get loss() { return this.transport.loss; }
  dispose() {}
}

export class HostAuthority {
  /**
   * @param peers   Map playerId -> channel ({ send(obj), onmessage, onclose, close() }) for each remote player
   * @param onPeer  (event, playerId) => void: 'left' when a player disconnects (a bot takes over their hero)
   */
  constructor({ world, bots, transport, peers, difficulty = 'medium', onPeer = () => {} }) {
    this.world = world; this.bots = bots; this.transport = transport; this.inbox = []; this.remote = [];
    this.difficulty = difficulty; this.onPeer = onPeer; this.peers = new Map(); this.rtt = new Map();
    this.waiting = new Set(peers.keys()); this.since = 0; // the match begins once every client has loaded it
    for (const [p, ch] of peers) this.addPeer(p, ch);
  }
  addPeer(playerId, ch) {
    this.peers.set(playerId, ch);
    ch.onclose = () => this.drop(playerId);
    attach(ch, (m) => {
      if (m.k === MSG.CMD) { if (acceptCommand(m.c, playerId)) this.remote.push(wireCommand(m.c)); }
      else if (m.k === MSG.PING) ch.send({ k: MSG.PONG, ts: m.ts });
      else if (m.k === MSG.LOADED) this.waiting.delete(playerId);
    });
  }
  /** A player left: their hero plays on as a bot, through the same command stream. */
  drop(playerId) {
    if (!this.peers.has(playerId)) return;
    this.peers.delete(playerId); this.waiting.delete(playerId); this.bots.addBot(this.world, playerId, this.difficulty);
    this.onPeer('left', playerId);
  }
  send(cmd, now) { return this.transport.send(cmd, now); }
  /** True while the host still waits for clients to load the match (at most LOAD_TIMEOUT_MS). */
  get loading() { return this.waiting.size > 0; }
  collect(now, out, onApplied) {
    const w = this.world;
    if (this.waiting.size) { if (!this.since) this.since = now; if (now - this.since < LOAD_TIMEOUT_MS) return false; this.waiting.clear(); }
    this.bots.commands(w, out);
    for (let i = 0; i < out.length; i++) out[i] = wireCommand(out[i]);
    this.transport.receive(now, this.inbox);
    for (const c of this.inbox) { const x = wireCommand(c); out.push(x); onApplied(x); }
    for (const c of this.remote) out.push(c);
    this.remote.length = 0;
    // the host steps with exactly what it broadcasts
    const bundle = { k: MSG.TICK, t: w.tick, c: out.slice() };
    if (w.tick % HASH_EVERY === 0) bundle.h = stateHash(w);
    this.broadcast(bundle);
    return true;
  }
  broadcast(msg) { for (const ch of this.peers.values()) ch.send(msg); }
  get backlog() { return 0; }
  update() {}
  get ping() { return this.transport.ping; } get jitter() { return 0; } get loss() { return 0; }
  /** End the match for everyone, or with `keepChannel` hand the connections back to the lobby. */
  dispose(keepChannel = false) {
    if (!keepChannel) { this.broadcast({ k: MSG.BYE, reason: 'The host left the match.' }); for (const ch of this.peers.values()) ch.close(); }
    this.peers.clear();
  }
}

export class ClientAuthority {
  /** @param onHost (event, info) => void: 'desync' { tick }, 'bye' { reason }, 'lost' when the host connection drops */
  constructor({ world, channel, player, onHost = () => {} }) {
    this.world = world; this.ch = channel; this.player = player; this.onHost = onHost;
    this.buf = []; this.rttMs = 0; this.lastPing = 0; this.desync = null; this.stalls = 0; this.closed = false;
    channel.onclose = () => { if (!this.closed) { this.closed = true; this.onHost('lost', {}); } };
    attach(channel, (m) => {
      if (m.k === MSG.TICK) this.buf.push(m);
      else if (m.k === MSG.PONG) this.rttMs = performance.now() - m.ts;
      else if (m.k === MSG.BYE) { this.closed = true; this.onHost('bye', { reason: m.reason }); }
      else if (m.k === MSG.LOBBY) this.onHost('lobby', m); // the host reopened the lobby after the match
    });
    channel.send({ k: MSG.LOADED });
  }
  send(cmd) { if (!validCommand(cmd)) return false; this.ch.send({ k: MSG.CMD, c: wireCommand(cmd) }); return true; }
  collect(now, out, onApplied) {
    const w = this.world;
    while (this.buf.length && this.buf[0].t < w.tick) this.buf.shift(); // duplicates (never expected on a reliable channel)
    const b = this.buf[0];
    if (!b || b.t !== w.tick) { this.stalls++; return false; }
    this.buf.shift();
    if (b.h !== undefined && !this.desync && stateHash(w) !== b.h) { this.desync = { tick: w.tick }; this.onHost('desync', this.desync); }
    out.length = 0;
    for (const c of b.c) { out.push(c); if (c.p === this.player) onApplied(c); }
    return true;
  }
  /** Ticks received but not yet simulated (the session catches up when this grows). */
  get backlog() { return this.buf.length; }
  update(now) { if (now - this.lastPing > 1000) { this.lastPing = now; this.ch.send({ k: MSG.PING, ts: now }); } }
  get ping() { return Math.round(this.rttMs); } get jitter() { return 0; } get loss() { return 0; }
  /** Leave the match; `keepChannel` hands the connection back to the lobby instead of closing it. */
  dispose(keepChannel = false) { this.closed = true; if (!keepChannel) this.ch.close(); }
}
