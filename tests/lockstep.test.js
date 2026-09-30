// Online lockstep: a host and clients over in-memory channels with latency must simulate identical worlds.
import { describe, it, expect } from 'vitest';
import { createMatch, stateHash } from '../src/sim/match.js';
import { CONTENT } from '../src/sim/content.js';
import { BotDirector } from '../src/ai/director.js';
import { Bot } from '../src/ai/bot.js';
import { LocalTransport } from '../src/net/transport.js';
import { HostAuthority, ClientAuthority } from '../src/net/authority.js';
import { moveCmd } from '../src/sim/commands.js';
import { Rng } from '../src/core/rng.js';

/** A channel pair that serializes like a data channel and delivers after a latency (in pump steps) with jitter. */
function channelPair(clock, latency, jitter, rng) {
  const mk = () => ({ onmessage: null, onclose: null, open: true, q: [] });
  const a = mk(), b = mk();
  const wire = (from, to) => {
    from.send = (m) => { if (!from.open) return; const due = Math.max(to.lastDue || 0, clock.t + latency + rng.int(0, jitter)); to.lastDue = due; to.q.push({ due, data: JSON.stringify(m) }); };
    from.close = () => { if (!from.open) return; from.open = to.open = false; if (to.onclose) to.onclose(); };
  };
  wire(a, b); wire(b, a);
  const pump = (end) => { while (end.q.length && end.q[0].due <= clock.t) { const m = end.q.shift(); if (end.onmessage) end.onmessage(JSON.parse(m.data)); } };
  return { host: a, client: b, pump: () => { pump(a); pump(b); } };
}
const ROSTER = ['gus', 'saffi', 'vesper', 'morrow', 'lumen', 'wisp'].map((heroKey, p) => ({ playerId: p, heroKey, team: p < 3 ? 0 : 1, isBot: ![1, 4].includes(p) }));

function setup({ seed = 21, latency = 3, jitter = 2 } = {}) {
  const clock = { t: 0 }, rng = new Rng(99);
  const host = createMatch({ seed, roster: ROSTER, content: CONTENT });
  const pairs = new Map([[1, channelPair(clock, latency, jitter, rng)], [4, channelPair(clock, latency, jitter, rng)]]);
  const events = [];
  const auth = new HostAuthority({ world: host, bots: new BotDirector(host, 'medium'), transport: new LocalTransport(), peers: new Map([...pairs].map(([p, c]) => [p, c.host])), onPeer: (e, p) => events.push([e, p]) });
  const clients = [...pairs].map(([p, c]) => {
    const world = createMatch({ seed, roster: ROSTER, content: CONTENT });
    const flags = [];
    return { p, world, pair: c, flags, bot: new Bot(p, 'medium', 5 + p), auth: new ClientAuthority({ world, channel: c.client, player: p, onHost: (e, i) => flags.push([e, i]) }), cmds: [] };
  });
  const noop = () => {};
  const hostCmds = [];
  const loop = (ticks, { hostSteps = true } = {}) => {
    for (let i = 0; i < ticks; i++) {
      clock.t++;
      if (hostSteps && !host.state.over && auth.collect(0, hostCmds, noop)) host.step(hostCmds);
      for (const c of pairs.values()) c.pump();
      for (const cl of clients) {
        if (cl.auth.closed) continue;
        for (const cmd of cl.bot.think(cl.world)) if (cmd) cl.auth.send(cmd);
        while (cl.auth.collect(0, cl.cmds, noop)) cl.world.step(cl.cmds); // catch up on everything received
      }
    }
  };
  return { host, auth, clients, loop, events, pairs };
}

describe('online lockstep', () => {
  it('clients simulate the host\'s world exactly, with latency and jitter, through a whole match', () => {
    const { host, clients, loop } = setup();
    loop(30 * 60 * 14);
    expect(host.state.over).toBe(true);
    loop(20, { hostSteps: false }); // let the last bundles arrive
    for (const cl of clients) {
      expect(cl.world.tick).toBe(host.tick);
      expect(stateHash(cl.world)).toBe(stateHash(host));
      expect(cl.flags).toEqual([]);
      expect(cl.world.state.winner).toBe(host.state.winner);
    }
    // the remote players really played: their heroes moved and fought
    for (const p of [1, 4]) expect(host.heroes.find((h) => h.playerId === p).level).toBeGreaterThan(5);
  }, 120000);
  it('a client whose world diverges detects it at the next hash', () => {
    const { clients, loop } = setup();
    loop(100);
    clients[0].world.heroes[0].gold += 50; // corrupt one client (health would be healed back at the fountain)
    loop(80);
    expect(clients[0].flags.some(([e]) => e === 'desync')).toBe(true);
    expect(clients[1].flags).toEqual([]);
  });
  it('a player who leaves is taken over by a bot; the others stay in sync', () => {
    const { host, clients, loop, events, pairs } = setup();
    loop(300);
    pairs.get(1).client.close();
    loop(30 * 60 * 3);
    expect(events).toEqual([['left', 1]]);
    const saffi = host.heroes.find((h) => h.playerId === 1), before = { x: saffi.x, lvl: saffi.level };
    loop(30 * 30);
    expect(saffi.x !== before.x || saffi.level > before.lvl).toBe(true); // a bot keeps playing her
    loop(10, { hostSteps: false });
    const other = clients[1];
    expect(stateHash(other.world)).toBe(stateHash(host));
  }, 60000);
  it('the host ignores commands for someone else\'s hero', () => {
    const { auth, clients, loop } = setup();
    loop(60);
    for (let i = 0; i < 20; i++) clients[0].pair.client.send({ k: 'c', c: moveCmd(0, 3900, 800) }); // client of player 1 forges player 0
    clients[0].pair.client.send({ k: 'c', c: moveCmd(1, 1000, 450) }); // and one legitimate command
    loop(10, { hostSteps: false }); // delivered, not yet applied
    const ps = auth.remote.map((c) => c.p);
    expect(ps).toContain(1); expect(ps).not.toContain(0);
    loop(60);
    for (const cl of clients) expect(cl.flags).toEqual([]);
  });
});
