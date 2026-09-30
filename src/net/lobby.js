// Lobby state machines for online play, independent of UI and transport (channels from src/net/peer.js, or in-memory
// pairs in tests). Six seats: 0-2 blue, 3-5 red; the host sits in seat 0. Joiners take the team with fewer humans.
// Seats nobody takes are played by bots. The host starts the match once every joined player is ready; everyone
// then gets the same roster and seed and creates the match (GameSession with online: host / client).
import { MSG, PROTOCOL, BUILD, holdMessages } from './protocol.js';
import { HERO_KEYS } from '../sim/heroes/index.js';
import { validSkin, pickSkin, DEFAULT_SKIN } from '../assets/skins.js';
import { Rng } from '../core/rng.js';

export const SEATS = 6;
const teamOf = (seat) => (seat < 3 ? 0 : 1);
const cleanName = (s, fallback) => (String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || fallback);
const heroOr = (k, fallback) => (HERO_KEYS.includes(k) ? k : fallback);

export class LobbyHost {
  /** @param onChange (lobbyState) => void after every change (for the host's UI) */
  constructor({ name, heroKey, skin = DEFAULT_SKIN, difficulty = 'medium', onChange = () => {}, seed = (Math.random() * 2 ** 31) | 0 }) {
    this.seats = Array.from({ length: SEATS }, (_, i) => ({ seat: i, team: teamOf(i), kind: 'open', name: '', heroKey: null, skin: DEFAULT_SKIN, ready: false, ch: null }));
    Object.assign(this.seats[0], { kind: 'host', name: cleanName(name, 'Host'), heroKey: heroOr(heroKey, HERO_KEYS[0]), skin, ready: true });
    this.difficulty = difficulty; this.onChange = onChange; this.seed = seed; this.started = false; this.code = '';
  }
  /** A player's channel arrived (after the WebRTC connection opened). */
  join(ch) {
    ch.onmessage = (m) => this.message(ch, m);
    ch.onclose = () => this.leave(ch);
  }
  seatOf(ch) { return this.seats.find((s) => s.ch === ch); }
  message(ch, m) {
    if (m.k === MSG.HELLO) {
      if (this.started) return this.refuse(ch, 'The match has already started.');
      if (m.v !== PROTOCOL || m.build !== BUILD) return this.refuse(ch, 'The host plays a different version of the game. Both players need the same version.');
      const humans = (t) => this.seats.filter((s) => s.team === t && s.kind !== 'open').length;
      const order = humans(0) <= humans(1) ? [0, 1, 2, 3, 4, 5] : [3, 4, 5, 0, 1, 2];
      const seat = order.map((i) => this.seats[i]).find((s) => s.kind === 'open');
      if (!seat) return this.refuse(ch, 'The lobby is full.');
      Object.assign(seat, { kind: 'player', ch, name: cleanName(m.name, `Player ${seat.seat + 1}`), heroKey: heroOr(m.heroKey, HERO_KEYS[seat.seat % HERO_KEYS.length]), skin: DEFAULT_SKIN, ready: false });
      if (validSkin(seat.heroKey, m.skin)) seat.skin = m.skin;
      ch.send({ k: MSG.WELCOME, seat: seat.seat });
      return this.changed();
    }
    const s = this.seatOf(ch); if (!s || this.started) return;
    if (m.k === MSG.PICK) { s.heroKey = heroOr(m.heroKey, s.heroKey); s.skin = validSkin(s.heroKey, m.skin) ? m.skin : DEFAULT_SKIN; s.ready = false; }
    else if (m.k === MSG.READY) s.ready = !!m.ready;
    else if (m.k === 'team') { this.moveTeam(s); }
    else if (m.k === MSG.PING) { ch.send({ k: MSG.PONG, ts: m.ts }); return; }
    else return;
    this.changed();
  }
  refuse(ch, reason) { ch.send({ k: MSG.REFUSE, reason }); setTimeout(() => ch.close(), 200); }
  /** Move a player to a free seat on the other team. */
  moveTeam(s) {
    const free = this.seats.find((x) => x.team !== s.team && x.kind === 'open'); if (!free) return;
    const { kind, ch, name, heroKey, skin, ready } = s;
    Object.assign(free, { kind, ch, name, heroKey, skin, ready });
    Object.assign(s, { kind: 'open', ch: null, name: '', heroKey: null, ready: false });
  }
  leave(ch) { const s = this.seatOf(ch); if (!s) return; Object.assign(s, { kind: 'open', ch: null, name: '', heroKey: null, ready: false }); if (!this.started) this.changed(); }
  /** The host's own choices. */
  setHost({ name, heroKey, skin }) { const h = this.seats[0]; if (name !== undefined) h.name = cleanName(name, 'Host'); if (heroKey) { h.heroKey = heroOr(heroKey, h.heroKey); h.skin = validSkin(h.heroKey, skin) ? skin : DEFAULT_SKIN; } this.changed(); }
  setDifficulty(d) { this.difficulty = d; this.changed(); }
  hostSwitchTeam() { this.moveTeam(this.seats.find((s) => s.kind === 'host')); this.changed(); }
  get canStart() { return !this.started && this.seats.every((s) => s.kind !== 'player' || s.ready); }
  state() {
    return { k: MSG.LOBBY, code: this.code, difficulty: this.difficulty, canStart: this.canStart,
      seats: this.seats.map(({ seat, team, kind, name, heroKey, skin, ready }) => ({ seat, team, kind, name, heroKey, skin, ready })) };
  }
  changed() { const st = this.state(); for (const s of this.seats) if (s.ch) s.ch.send(st); this.onChange(st); }
  /**
   * Start the match: bots take the open seats (heroes and skins from the seed), everyone gets the same roster.
   * Returns what the host's GameSession needs: { seed, roster, player, peers: Map<playerId, channel>, difficulty }.
   */
  start() {
    if (!this.canStart) return null;
    this.started = true;
    const r = new Rng(this.seed ^ 0x10bb1), rand = () => r.next();
    const taken = new Set(this.seats.filter((s) => s.heroKey && s.kind !== 'open').map((s) => s.heroKey));
    const roster = this.seats.map((s) => {
      if (s.kind === 'open') {
        const free = HERO_KEYS.filter((k) => !taken.has(k)), heroKey = r.pick(free.length ? free : HERO_KEYS); taken.add(heroKey);
        return { playerId: s.seat, heroKey, team: s.team, isBot: true, skin: pickSkin(heroKey, rand), name: '' };
      }
      return { playerId: s.seat, heroKey: s.heroKey, team: s.team, isBot: false, skin: s.skin, name: s.name };
    });
    const peers = new Map();
    for (const s of this.seats) if (s.ch) { peers.set(s.seat, s.ch); holdMessages(s.ch); s.ch.send({ k: MSG.START, seed: this.seed, roster, difficulty: this.difficulty, player: s.seat }); }
    return { seed: this.seed, roster, player: this.seats.find((s) => s.kind === 'host').seat, peers, difficulty: this.difficulty };
  }
  /** After a match: the same players, back in the lobby (players who left meanwhile free their seats). */
  reopen() {
    this.started = false; this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    for (const s of this.seats) {
      if (s.kind !== 'player') continue;
      if (!s.ch || s.ch.open === false) { Object.assign(s, { kind: 'open', ch: null, name: '', heroKey: null, ready: false }); continue; }
      s.ready = false; this.join(s.ch);
    }
    this.changed();
  }
  close(reason = 'The host closed the lobby.') { for (const s of this.seats) if (s.ch) { s.ch.send({ k: MSG.BYE, reason }); s.ch.close(); } }
}

export class LobbyClient {
  /**
   * @param onChange (lobbyState, mySeat) => void    @param onStart ({ seed, roster, player, difficulty, channel }) => void
   * @param onClosed (reason) => void: refused, host left, or connection lost
   */
  constructor({ channel, name, heroKey, skin = DEFAULT_SKIN, onChange = () => {}, onStart = () => {}, onClosed = () => {} }) {
    this.ch = channel; this.seat = -1; this.state = null; this.done = false;
    this.onChange = onChange; this.onStart = onStart; this.onClosed = onClosed;
    this.rebind();
    channel.send({ k: MSG.HELLO, v: PROTOCOL, build: BUILD, name, heroKey, skin });
  }
  /** (Re)attach to the channel: on joining, and when the host reopens the lobby after a match. */
  rebind(state = null) {
    const channel = this.ch; this.done = false;
    if (state) this.state = state;
    channel.onmessage = (m) => {
      if (m.k === MSG.WELCOME) this.seat = m.seat;
      else if (m.k === MSG.LOBBY) { this.state = m; this.onChange(m, this.seat); }
      else if (m.k === MSG.REFUSE) this.end(m.reason);
      else if (m.k === MSG.BYE) this.end(m.reason);
      else if (m.k === MSG.START) { this.done = true; holdMessages(channel); this.onStart({ seed: m.seed, roster: m.roster, player: m.player, difficulty: m.difficulty, channel }); }
    };
    channel.onclose = () => this.end('The connection to the host was lost.');
  }
  end(reason) { if (this.done) return; this.done = true; this.onClosed(reason); }
  pick(heroKey, skin) { this.ch.send({ k: MSG.PICK, heroKey, skin }); }
  ready(ready) { this.ch.send({ k: MSG.READY, ready }); }
  switchTeam() { this.ch.send({ k: 'team' }); }
  leave() { this.done = true; this.ch.close(); }
}
