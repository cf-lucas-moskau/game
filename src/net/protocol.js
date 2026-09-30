// Online play protocol: plain JSON messages over an ordered, reliable channel (a WebRTC data channel, or an in-memory
// pair in tests). The host runs the match; clients run the same deterministic sim from the host's command stream.
//
//   client -> host   hello { v, build, name }        join request (protocol and build must match the host's)
//   host -> client   welcome { slot } | refuse { reason }
//   host -> all      lobby { players, settings }      lobby state: slots, names, heroes, skins, ready, bots
//   client -> host   pick { heroKey, skin }  ready { ready }
//   host -> all      start { seed, roster, settings } everyone creates the same match
//   client -> host   loaded {}                        the match is created; the host starts when everyone has loaded
//   client -> host   c { c: command }                 the player's commands (the host validates them)
//   host -> all      t { t, c: [commands], h? }       the commands applied at tick t; every HASH_EVERY ticks the
//                                                     state hash before stepping t, so clients detect a desync
//   either           ping { ts } / pong { ts }        round-trip time
//   host -> all      bye { reason }                   the host closes the match or lobby
import { validCommand } from '../sim/commands.js';

export const PROTOCOL = 1;
export const HASH_EVERY = 30;
/** Build identity: two players can only play together on the same sim code. Set at build time (vite define). */
export const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

export const MSG = { HELLO: 'hello', WELCOME: 'welcome', REFUSE: 'refuse', LOBBY: 'lobby', PICK: 'pick', READY: 'ready', START: 'start',
  CMD: 'c', TICK: 't', PING: 'ping', PONG: 'pong', BYE: 'bye', CHAT: 'chat', LOADED: 'loaded' };

/**
 * A command as it travels: only the fields the sim reads, numbers kept finite. `ts` (the sender's issue time) rides
 * along untouched so the sender can measure its own input latency when the command comes back in a tick bundle.
 */
export function wireCommand(c) {
  const o = { t: c.t, p: c.p };
  for (const k of ['x', 'y', 's', 'id', 'item', 'i', 'ts']) if (c[k] !== undefined) o[k] = c[k];
  if ('pts' in c) o.pts = c.pts ? Array.from(c.pts) : null;
  return o;
}
/** Host-side check of a client's command: well-formed, and only for the client's own player. */
/** Hold a channel's messages until the next owner attaches (between lobby start and match creation). */
export function holdMessages(ch) { const q = []; ch.pending = q; ch.onmessage = (m) => q.push(m); }
/** Attach a message handler and deliver anything held for it. */
export function attach(ch, fn) { ch.onmessage = fn; const q = ch.pending; ch.pending = null; if (q) for (const m of q) fn(m); }
export function acceptCommand(c, playerId) { return !!c && typeof c === 'object' && c.p === playerId && validCommand(c); }
