// Player-to-player connections for online play: WebRTC data channels, introduced through a public signaling broker,
// so nobody hosts anything. The host's browser registers a short lobby code with the broker; joiners connect by code.
// After the introduction, all game traffic goes directly between the browsers (or through a public TURN relay when
// both sit behind strict NATs); the broker never sees it.
//
//   const lobby = await openLobby({ onJoin: (channel) => ... });   // host: lobby.code, lobby.close()
//   const channel = await joinLobby('K7QM4');                      // client
// Channels are { send(obj), onmessage, onclose, close() } carrying JSON over an ordered, reliable data channel,
// the interface src/net/authority.js and src/net/lobby.js expect.
//
// The broker defaults to the free public PeerJS server; `?broker=host:port` (or `{ broker }`) points at another
// PeerJS-compatible server, e.g. a local one in the e2e test or a self-hosted one later.
import { Peer } from 'peerjs';

export const PUBLIC_BROKER = { host: '0.peerjs.com', port: 443, secure: true, path: '/' };
// public STUN, plus the PeerJS project's public TURN relay for players behind strict NATs
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];
const PREFIX = 'leviathan-lane-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I: codes are read aloud and typed on phones
export const CODE_LENGTH = 5;

/** Broker options from a "host:port" string (a local or self-hosted PeerJS server); null means the public one. */
export function brokerFrom(spec) {
  if (!spec) return PUBLIC_BROKER;
  const [host, port] = String(spec).split(':');
  const local = host === 'localhost' || host === '127.0.0.1';
  return { host, port: port ? +port : local ? 9000 : 443, secure: !local, path: '/' };
}
export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
function randomCode() { let s = ''; const r = crypto.getRandomValues(new Uint32Array(CODE_LENGTH)); for (const v of r) s += ALPHABET[v % ALPHABET.length]; return s; }

/** A PeerJS data connection as a game channel. */
function channelOf(conn) {
  const ch = {
    onmessage: null, onclose: null, open: true,
    send(obj) { if (ch.open) conn.send(obj); },
    close() { if (!ch.open) return; ch.open = false; conn.close(); },
  };
  conn.on('data', (m) => { if (ch.onmessage) ch.onmessage(m); });
  let fired = false;
  const closed = () => { ch.open = false; if (fired) return; fired = true; if (ch.onclose) ch.onclose(); };
  conn.on('close', closed); conn.on('error', closed);
  // a vanished peer can leave the data channel "open"; ICE disconnection tells us sooner
  conn.on('iceStateChanged', (s) => { if (s === 'failed' || s === 'closed' || s === 'disconnected') closed(); });
  return ch;
}
// `?netdebug=1` logs connection errors, `?netdebug=3` the whole signaling and WebRTC negotiation (support, diagnostics)
const DEBUG = typeof location !== 'undefined' ? +((/[?&]netdebug=(\d)/.exec(location.search) || [])[1] || 0) : 0; // 1 errors, 3 everything
function newPeer(id, broker) {
  return new Peer(id, { ...broker, config: { iceServers: ICE }, debug: DEBUG });
}
const ERRORS = {
  'peer-unavailable': 'No lobby with that code. Check the code, or ask the host whether the lobby is still open.',
  network: 'Could not reach the matchmaking service. Check your internet connection.',
  'server-error': 'The matchmaking service is not responding. Try again in a moment.',
  'socket-error': 'Could not reach the matchmaking service. Check your internet connection.',
  'socket-closed': 'The connection to the matchmaking service closed.',
  'browser-incompatible': 'This browser cannot play online (WebRTC is unavailable).',
  'webrtc': 'The direct connection to the other player failed.',
};
export const errorText = (e) => ERRORS[e && e.type] || (e && e.message) || 'Something went wrong with the connection.';

/**
 * Open a lobby: registers a free code with the broker and hands every joining player's channel to `onJoin`.
 * Resolves to { code, close() }.
 */
export async function openLobby({ onJoin, broker = PUBLIC_BROKER, attempts = 6 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const code = randomCode();
    const peer = newPeer(PREFIX + code, broker);
    const ok = await new Promise((res, rej) => {
      peer.on('open', () => res(true));
      peer.on('error', (e) => { if (e.type === 'unavailable-id') res(false); else rej(Object.assign(new Error(errorText(e)), { type: e.type })); });
    }).catch((e) => { peer.destroy(); throw e; });
    if (!ok) { peer.destroy(); continue; }
    peer.on('connection', (conn) => conn.on('open', () => onJoin(channelOf(conn), conn.metadata || {})));
    // keep the broker registration alive while the lobby is open (the broker drops idle sockets)
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    return { code, peer, close() { peer.destroy(); } };
  }
  throw new Error('Could not find a free lobby code. Try again.');
}

/**
 * A timeout that tolerates a busy page: when it fires late (the main thread was blocked, e.g. by a slow device
 * painting portraits), the network had no chance to deliver, so it grants another period (at most twice).
 */
function patientTimeout(fn, ms) {
  let due = performance.now() + ms, extensions = 0, id = 0;
  const tick = () => { const late = performance.now() - due; if (late > 1000 && extensions < 2) { extensions++; due = performance.now() + ms; id = setTimeout(tick, ms); } else fn(); };
  id = setTimeout(tick, ms);
  return () => clearTimeout(id);
}

/** Join a lobby by code. Resolves to an open channel, or rejects with a readable message. */
export function joinLobby(code, { broker = PUBLIC_BROKER, metadata = {}, timeoutMs = 15000, brokerTimeoutMs = 30000 } = {}) {
  return new Promise((res, rej) => {
    const peer = newPeer(undefined, broker);
    let cancel = () => {};
    const fail = (e) => { if (DEBUG) console.warn('join failed', e && e.type, e && e.message); cancel(); peer.destroy(); rej(Object.assign(new Error(errorText(e)), { type: e && e.type })); };
    // two phases, two clocks: reaching the broker, then the direct connection to the host
    cancel = patientTimeout(() => fail({ type: 'network' }), brokerTimeoutMs);
    peer.on('error', fail);
    peer.on('open', () => {
      cancel(); cancel = patientTimeout(() => fail({ type: 'webrtc' }), timeoutMs);
      const conn = peer.connect(PREFIX + normalizeCode(code), { reliable: true, serialization: 'json', metadata });
      conn.on('open', () => {
        cancel();
        const ch = channelOf(conn);
        const close = ch.close; ch.close = () => { close(); peer.destroy(); };
        // once connected, the broker is no longer needed
        peer.disconnect();
        res(ch);
      });
    });
  });
}
