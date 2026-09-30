// Online play screens: choose to host or join, then the lobby (seats for both teams, hero and skin pick, readiness,
// bot difficulty, start). The lobby logic lives in src/net/lobby.js and connections in src/net/peer.js; this file
// only draws them and forwards clicks.
import { h, clear } from './dom.js';
import { identity } from './identity.js';
import { emblem } from './menu.js';
import { OPTIONS } from './settings.js';
import { skinsFor, validSkin, DEFAULT_SKIN } from '../assets/skins.js';
import { LobbyHost, LobbyClient } from '../net/lobby.js';
import { normalizeCode, CODE_LENGTH } from '../net/peer.js';

const TEAM = ['Blue', 'Red'];

export class OnlineScreen {
  /**
   * @param net      { openLobby(opts), joinLobby(code, opts) } (src/net/peer.js, injectable for tests)
   * @param onStart  ({ role: 'host' | 'client', lobby, start }) => void once the match begins
   * @param resume   { host, registration } or { client } to show an existing lobby again (after a match)
   */
  constructor(root, { heroes, settings, heroKey, skin, joinCode = '', net, onStart, onBack, resume = null }) {
    this.heroes = heroes; this.settings = settings; this.net = net; this.onStart = onStart; this.onBack = onBack;
    this.heroKey = heroes[heroKey] ? heroKey : Object.keys(heroes)[0]; this.skin = validSkin(this.heroKey, skin) ? skin : DEFAULT_SKIN;
    this.el = h('div', { class: 'online screen' }); this.card = h('section', { class: 'online-card' }); this.el.append(this.card);
    root.append(this.el);
    this.host = null; this.client = null; this.registration = null; this.state = null; this.seat = -1; this.note = '';
    if (resume && resume.host) { this.host = resume.host; this.registration = resume.registration; this.host.onChange = (st) => this.lobbyChanged(st, 0); this.lobbyChanged(this.host.state(), 0); }
    else if (resume && resume.client) this.adoptClient(resume.client);
    else if (joinCode) { this.renderChoice(normalizeCode(joinCode)); this.join(normalizeCode(joinCode)); }
    else this.renderChoice('');
  }
  get name() { return this.settings.get('name') || ''; }
  // ------------------------------------------------------------ choice
  renderChoice(code) {
    const nameIn = h('input', { class: 'interactive text', type: 'text', maxlength: 16, placeholder: 'Your name', value: this.name, 'aria-label': 'Your name',
      oninput: (e) => this.settings.set('name', e.target.value) });
    const codeIn = h('input', { class: 'interactive text code', type: 'text', maxlength: CODE_LENGTH + 2, placeholder: 'CODE', value: code, 'aria-label': 'Lobby code', autocapitalize: 'characters', spellcheck: 'false',
      oninput: (e) => { e.target.value = normalizeCode(e.target.value); join.disabled = e.target.value.length < CODE_LENGTH; },
      onkeydown: (e) => { if (e.key === 'Enter' && !join.disabled) this.join(codeIn.value); } });
    const join = h('button', { class: 'btn', 'data-act': 'join', disabled: code.length < CODE_LENGTH, onclick: () => this.join(codeIn.value) }, 'Join');
    clear(this.card).append(
      h('div', { class: 'eyebrow' }, 'Play online'),
      h('h2', {}, 'Friends against friends'),
      h('p', { class: 'lede' }, 'Host a lobby and share its code, or join a friend with theirs. Your browser connects directly to theirs; empty seats are played by bots.'),
      h('label', { class: 'field' }, h('span', {}, 'Name'), nameIn),
      h('div', { class: 'choices' },
        h('div', { class: 'choice' }, h('h3', {}, 'Host'), h('p', {}, 'Create a lobby and get a code to share.'), h('button', { class: 'btn primary', 'data-act': 'host', onclick: () => this.hostLobby() }, 'Create lobby')),
        h('div', { class: 'choice' }, h('h3', {}, 'Join'), h('p', {}, 'Enter the code your friend shared.'), h('div', { class: 'join-row' }, codeIn, join))),
      this.noteEl = h('p', { class: 'note', role: 'status' }, this.note),
      h('div', { class: 'actions' }, h('button', { class: 'btn small', 'data-act': 'back', onclick: () => this.back() }, 'Back')));
  }
  status(text, error = false) { this.note = text; if (this.noteEl) { this.noteEl.textContent = text; this.noteEl.classList.toggle('error', error); } }
  async hostLobby() {
    this.status('Opening a lobby…');
    const host = new LobbyHost({ name: this.name, heroKey: this.heroKey, skin: this.skin, difficulty: this.settings.get('difficulty') || 'medium', onChange: (st) => this.lobbyChanged(st, 0) });
    try {
      this.registration = await this.net.openLobby({ onJoin: (ch) => host.join(ch) });
    } catch (e) { this.status(e.message, true); return; }
    if (this.disposed) { this.registration.close(); return; }
    this.host = host; host.code = this.registration.code; host.changed();
  }
  async join(code) {
    code = normalizeCode(code); if (code.length < CODE_LENGTH) return;
    this.status(`Connecting to lobby ${code}…`);
    let ch;
    try { ch = await this.net.joinLobby(code); } catch (e) { this.status(e.message, true); return; }
    if (this.disposed) { ch.close(); return; }
    this.adoptClient(new LobbyClient({ channel: ch, name: this.name, heroKey: this.heroKey, skin: this.skin }));
  }
  adoptClient(client) {
    this.client = client;
    client.onChange = (st, seat) => this.lobbyChanged(st, seat);
    client.onStart = (start) => this.onStart({ role: 'client', lobby: client, start });
    client.onClosed = (reason) => { this.client = null; this.state = null; this.renderChoice(''); this.status(reason, true); };
    if (client.state) this.lobbyChanged(client.state, client.seat);
    else { clear(this.card).append(h('div', { class: 'eyebrow' }, 'Play online'), this.noteEl = h('p', { class: 'note', role: 'status' }, 'Joined. Waiting for the lobby…')); }
  }
  // ------------------------------------------------------------ lobby
  lobbyChanged(st, seat) {
    this.state = st; this.seat = seat;
    const me = st.seats[seat];
    if (me && me.heroKey) { this.heroKey = me.heroKey; this.skin = me.skin; }
    this.renderLobby();
  }
  renderLobby() {
    const st = this.state, isHost = !!this.host, me = st.seats[this.seat];
    const seatCard = (s) => {
      const mine = s.seat === this.seat, bot = s.kind === 'open';
      const tag = bot ? 'Bot plays' : s.kind === 'host' ? (mine ? 'You · host' : 'Host') : mine ? (s.ready ? 'You · ready' : 'You') : s.ready ? 'Ready' : 'Picking';
      return h('li', { class: `seat${bot ? ' bot' : ''}${mine ? ' mine' : ''}${s.ready || s.kind === 'host' ? ' ready' : ''}`, 'data-seat': s.seat, style: s.heroKey ? { '--accent': identity(s.heroKey).accent } : {} },
        bot ? h('div', { class: 'emblem sm dice' }, '?') : emblem(s.heroKey, 'sm', s.skin),
        h('div', { class: 'who' }, h('div', { class: 'nm' }, bot ? 'Open seat' : s.name), h('div', { class: 'tag' }, bot ? tag : `${this.heroes[s.heroKey] ? this.heroes[s.heroKey].short || this.heroes[s.heroKey].name.split(' ')[0] : ''} · ${tag}`)));
    };
    const teams = [0, 1].map((t) => h('div', { class: `team t${t}` }, h('h3', {}, TEAM[t]), h('ul', {}, st.seats.filter((s) => s.team === t).map(seatCard))));
    const codeBlock = h('div', { class: 'code-block' },
      h('div', { class: 'eyebrow' }, 'Lobby code'),
      h('div', { class: 'code-row' }, h('span', { class: 'code', 'data-code': st.code }, st.code || '…'),
        st.code ? h('button', { class: 'btn small', onclick: (e) => this.copy(st.code, e.target) }, 'Copy') : null,
        st.code && /^https?:/.test(location.protocol) ? h('button', { class: 'btn small', onclick: (e) => this.copy(`${location.origin}${location.pathname}?join=${st.code}`, e.target) }, 'Copy invite link') : null));
    // hero pick: the roster as small tiles, skins for the picked hero
    const grid = h('div', { class: 'mini-roster', role: 'listbox', 'aria-label': 'Your hero' }, Object.keys(this.heroes).map((k) =>
      h('button', { class: `tile${k === this.heroKey ? ' on' : ''}`, 'data-hero': k, role: 'option', 'aria-selected': k === this.heroKey ? 'true' : 'false', title: this.heroes[k].name, style: { '--accent': identity(k).accent },
        onclick: () => this.pick(k, DEFAULT_SKIN) }, emblem(k), h('span', { class: 'nm' }, this.heroes[k].short || this.heroes[k].name.split(' ')[0]))));
    const skins = skinsFor(this.heroKey);
    const swatches = skins.length > 1 ? h('div', { class: 'swatches' }, skins.map((s) => h('button', { class: `swatch${s.key === this.skin ? ' on' : ''}`, 'data-skin': s.key, style: { '--accent': s.accent }, onclick: () => this.pick(this.heroKey, s.key) }, emblem(this.heroKey, 'sm', s.key), h('span', {}, s.name)))) : null;
    const controls = isHost
      ? [h('div', { class: 'row' }, h('label', {}, 'Bots'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Bot difficulty' }, OPTIONS.difficulty.map(([v, label]) =>
          h('button', { class: v === st.difficulty ? 'on' : '', 'aria-pressed': v === st.difficulty ? 'true' : 'false', onclick: () => { this.settings.set('difficulty', v); this.host.setDifficulty(v); } }, label)))),
        h('div', { class: 'actions' }, h('button', { class: 'btn small', onclick: () => this.host.hostSwitchTeam() }, 'Switch team'), h('button', { class: 'btn small', 'data-act': 'leave', onclick: () => this.back() }, 'Close lobby'),
          h('button', { class: 'btn primary', 'data-act': 'start', disabled: !st.canStart, onclick: () => this.start() }, st.canStart ? 'Start match' : 'Waiting for ready…'))]
      : [h('div', { class: 'actions' }, h('button', { class: 'btn small', onclick: () => this.client.switchTeam() }, 'Switch team'), h('button', { class: 'btn small', 'data-act': 'leave', onclick: () => this.back() }, 'Leave'),
          h('button', { class: `btn primary${me && me.ready ? ' on' : ''}`, 'data-act': 'ready', onclick: () => this.client.ready(!(me && me.ready)) }, me && me.ready ? 'Ready ✓' : 'Ready'))];
    clear(this.card).append(
      h('div', { class: 'lobby-head' }, h('div', {}, h('div', { class: 'eyebrow' }, isHost ? 'Your lobby' : 'Lobby'), h('h2', {}, isHost ? 'Share the code' : 'Get ready')), codeBlock),
      h('div', { class: 'teams' }, teams),
      h('div', { class: 'pick' }, h('h3', {}, 'Your hero'), grid, swatches),
      ...controls,
      this.noteEl = h('p', { class: 'note', role: 'status' }, isHost ? 'Open seats are played by bots. Start when everyone is ready.' : 'The host starts the match when everyone is ready.'));
  }
  pick(heroKey, skin) {
    this.heroKey = heroKey; this.skin = validSkin(heroKey, skin) ? skin : DEFAULT_SKIN;
    this.settings.set('hero', heroKey); this.settings.set('skin', this.skin);
    if (this.host) this.host.setHost({ heroKey, skin: this.skin }); else if (this.client) this.client.pick(heroKey, this.skin);
  }
  copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {}); else done();
  }
  start() {
    const start = this.host.start(); if (!start) return;
    if (this.registration) this.registration.peer.disconnect(); // the lobby is closed to newcomers; games run peer to peer
    this.onStart({ role: 'host', lobby: this.host, registration: this.registration, start });
  }
  back() {
    if (this.host) { this.host.close(); if (this.registration) this.registration.close(); }
    if (this.client) this.client.leave();
    this.host = this.client = null; this.onBack();
  }
  dispose() { this.disposed = true; this.el.remove(); }
}
