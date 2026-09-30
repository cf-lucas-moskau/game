// Online lobby: seats, picks, readiness, refusals, and the handoff from lobby to a lockstep match.
import { describe, it, expect } from 'vitest';
import { LobbyHost, LobbyClient } from '../src/net/lobby.js';
import { HostAuthority, ClientAuthority } from '../src/net/authority.js';
import { createMatch, stateHash } from '../src/sim/match.js';
import { CONTENT } from '../src/sim/content.js';
import { BotDirector } from '../src/ai/director.js';
import { LocalTransport } from '../src/net/transport.js';
import { MSG } from '../src/net/protocol.js';

/** In-memory channel pair: JSON round trip, delivered when `flush()` runs (like the next network turn). */
function pair(net) {
  const mk = () => ({ onmessage: null, onclose: null, open: true });
  const a = mk(), b = mk();
  const link = (from, to) => {
    from.send = (m) => { if (from.open) net.queue.push(() => to.open && to.onmessage && to.onmessage(JSON.parse(JSON.stringify(m)))); };
    from.close = () => { if (!from.open) return; from.open = to.open = false; net.queue.push(() => to.onclose && to.onclose()); };
  };
  link(a, b); link(b, a);
  return [a, b];
}
const makeNet = () => { const net = { queue: [] }; net.flush = () => { while (net.queue.length) net.queue.shift()(); }; return net; };

function lobbyWith(n, opts = {}) {
  const net = makeNet(); const states = [];
  const host = new LobbyHost({ name: 'Ana', heroKey: 'gus', onChange: (s) => states.push(s), seed: 77 });
  const clients = [];
  for (let i = 0; i < n; i++) {
    const [h, c] = pair(net);
    host.join(h);
    const cl = { closed: null, start: null, state: null, seat: -1 };
    cl.lobby = new LobbyClient({ channel: c, name: `P${i}`, heroKey: 'saffi', ...opts,
      onChange: (s, seat) => { cl.state = s; cl.seat = seat; }, onStart: (x) => { cl.start = x; }, onClosed: (r) => { cl.closed = r; } });
    clients.push(cl);
  }
  net.flush();
  return { net, host, clients, states };
}

describe('online lobby', () => {
  it('seats joiners on the team with fewer humans and shows everyone the same lobby', () => {
    const { host, clients } = lobbyWith(3);
    expect(clients.map((c) => c.seat)).toEqual([3, 1, 4]);
    for (const c of clients) expect(c.state.seats.map((s) => s.kind)).toEqual(['host', 'player', 'open', 'player', 'player', 'open']);
    expect(host.canStart).toBe(false); // joiners are not ready yet
  });
  it('picks, readiness and team switches reach the host; start needs everyone ready', () => {
    const { net, host, clients } = lobbyWith(2);
    clients[0].lobby.pick('wisp', 'classic'); clients[0].lobby.ready(true); net.flush();
    expect(host.seats[3]).toMatchObject({ heroKey: 'wisp', ready: true });
    expect(host.canStart).toBe(false);
    clients[1].lobby.switchTeam(); net.flush();
    expect(clients[1].state.seats[1].kind).toBe('open');
    const moved = host.seats.find((s) => s.name === 'P1'); expect(moved.team).toBe(1);
    clients[1].lobby.ready(true); net.flush();
    expect(host.canStart).toBe(true);
    clients[0].lobby.pick('lumen', 'classic'); net.flush(); // a new pick un-readies
    expect(host.canStart).toBe(false);
  });
  it('refuses a sixth joiner and a different game version', () => {
    const { clients } = lobbyWith(6);
    expect(clients.filter((c) => c.closed).map((c) => c.closed)).toEqual(['The lobby is full.']);
    const net = makeNet(), host = new LobbyHost({ name: 'Ana', heroKey: 'gus' }), [h, c] = pair(net);
    host.join(h); let refused = null;
    c.onmessage = (m) => { if (m.k === MSG.REFUSE) refused = m.reason; };
    c.send({ k: MSG.HELLO, v: 1, build: 'some-other-build', name: 'Old' }); net.flush();
    expect(refused).toMatch(/different version/);
  });
  it('a player who leaves frees the seat', () => {
    const { net, host, clients } = lobbyWith(2);
    clients[0].lobby.leave(); net.flush();
    expect(host.seats[3].kind).toBe('open');
    expect(clients[1].state.seats[3].kind).toBe('open');
  });
  it('start gives everyone the same roster (bots fill open seats) and hands over to a lockstep match', () => {
    const { net, host, clients } = lobbyWith(2);
    for (const c of clients) c.lobby.ready(true);
    net.flush();
    const h = host.start(); net.flush();
    expect(h.roster.map((r) => r.isBot)).toEqual([false, false, true, false, true, true]);
    for (const c of clients) { expect(c.start.roster).toEqual(h.roster); expect(c.start.seed).toBe(h.seed); }
    // matches: the host's session and each client's, over the same channels (messages sent before the sessions
    // existed are held and delivered when the authorities attach)
    const hostWorld = createMatch({ seed: h.seed, roster: h.roster, content: CONTENT });
    const auth = new HostAuthority({ world: hostWorld, bots: new BotDirector(hostWorld, h.difficulty), transport: new LocalTransport(), peers: h.peers });
    const cls = clients.map((c) => { const world = createMatch({ seed: c.start.seed, roster: c.start.roster, content: CONTENT }); return { world, auth: new ClientAuthority({ world, channel: c.start.channel, player: c.start.player }), cmds: [] }; });
    const cmds = [];
    for (let i = 0; i < 900; i++) {
      if (auth.collect(i * 33, cmds, () => {})) hostWorld.step(cmds);
      net.flush();
      for (const c of cls) while (c.auth.collect(0, c.cmds, () => {})) c.world.step(c.cmds);
    }
    expect(hostWorld.tick).toBeGreaterThan(850); // started as soon as both clients loaded
    for (const c of cls) { expect(c.world.tick).toBe(hostWorld.tick); expect(stateHash(c.world)).toBe(stateHash(hostWorld)); }
  });
});
