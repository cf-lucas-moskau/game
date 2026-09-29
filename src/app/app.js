// Application flow: hero select (with a live bot match as backdrop) -> match -> end screen -> again.
// Owns canvases, sessions, input devices and the UI layer, and tears each match down completely.
import { GameSession } from './session.js';
import { startSpectate } from './spectate.js';
import { DesktopInput } from '../input/desktop.js';
import { TouchInput } from '../input/touch.js';
import { defaultQuality } from '../render/quality.js';
import { HEROES, HERO_KEYS } from '../sim/heroes/index.js';
import { surrenderCmd } from '../sim/commands.js';
import { Settings } from '../ui/settings.js';
import { HeroSelect } from '../ui/menu.js';
import { Hud } from '../ui/hud.js';
import { Floaters } from '../ui/floaters.js';
import { Shop } from '../ui/shop.js';
import { Scoreboard } from '../ui/scoreboard.js';
import { EndScreen } from '../ui/endscreen.js';
import { PauseMenu, SettingsPanel } from '../ui/pause.js';
import { PerfOverlay } from '../ui/perf-overlay.js';
import { Tooltip } from '../ui/tooltip.js';
import { h, toggle } from '../ui/dom.js';
import { AudioEngine } from '../audio/engine.js';
import { MusicDirector } from '../audio/music.js';
import { SfxDirector } from '../audio/sfx.js';
import { SOUNDS } from '../audio/sounds.js';
import { intensityFor } from '../audio/theory.js';

const END_SCREEN_DELAY = 2600; // let the Heartstone shatter before the result covers it

export class App {
  constructor({ root, lib, telemetry, params = new URLSearchParams() }) {
    this.root = root; this.lib = lib; this.telemetry = telemetry; this.params = params;
    this.settings = new Settings();
    this.touch = matchMedia('(pointer: coarse)').matches || params.get('touch') === '1';
    this.ui = h('div', { class: `ui${this.touch ? ' touch' : ''}` });
    this.ui.addEventListener('contextmenu', (e) => e.preventDefault());
    root.append(this.ui);
    this.tooltip = new Tooltip(this.ui);
    this.settingsPanel = new SettingsPanel(this.ui, this.settings, { onClose: () => this.settingsPanel.hide() });
    this.perf = new PerfOverlay(this.ui);
    this.dim = h('div', { class: 'dim' }); this.ui.prepend(this.dim);
    this.settings.on((k, v) => this.applySetting(k, v));
    addEventListener('ll-toggle', (e) => this.onToggle(e.detail));
    addEventListener('keydown', (e) => { if (!this.match && e.code === 'Escape') this.settingsPanel.hide(); if (!this.match && e.code === 'F3') { e.preventDefault(); this.perf.toggle(); } });
    this.last = { heroKey: null, difficulty: 'medium' };
    this.audio = new AudioEngine(this.settings);
    this.music = new MusicDirector(this.audio); this.music.start();
    this.ui.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) this.sound('ui'); });
  }
  sound(name) { const a = this.audio; if (a.ready) SOUNDS[name](a, a.sfx, a.now, 0, 1); }
  quality() { const q = this.params.get('quality') || this.settings.get('quality'); return q === 'auto' || !q ? defaultQuality() : q; }
  canvas() {
    const c = h('canvas', { class: 'view', style: { position: 'fixed', inset: '0', width: '100vw', height: '100vh', display: 'block', touchAction: 'none' } });
    this.root.prepend(c); return c;
  }
  num(k, d) { return this.params.has(k) ? +this.params.get(k) : d; }

  // ---------------------------------------------------------------- menu
  showMenu() {
    this.teardown();
    const canvas = this.canvas();
    this.backdrop = startSpectate({ canvas, lib: this.lib, seed: (Math.random() * 0xffff) | 0, quality: this.touch ? 'low' : this.quality(), skipSeconds: 95 });
    this.backdrop.canvas = canvas;
    this.music.set(intensityFor({ inMenu: true }), 84); this.audio.muffle(false);
    this.menu = new HeroSelect(this.ui, {
      heroes: HEROES, settings: this.settings, touch: this.touch,
      pick: () => HERO_KEYS[(Math.random() * HERO_KEYS.length) | 0],
      onPlay: (cfg) => this.startMatch(cfg),
      onSettings: () => this.settingsPanel.show(),
    });
  }

  // ---------------------------------------------------------------- match
  /** cfg: { heroKey, difficulty, heroes?, seed?, net?, autopilot?, skipSeconds? } */
  startMatch(cfg) {
    this.teardown();
    this.last = { heroKey: cfg.heroKey, difficulty: cfg.difficulty };
    const canvas = this.canvas();
    const ping = this.settings.get('ping');
    const net = cfg.net || { ping, jitter: Math.round(ping * 0.15), loss: ping ? 0.01 : 0 };
    const session = new GameSession({
      canvas, lib: this.lib, seed: cfg.seed ?? ((Math.random() * 0xffff) | 0 || 7), quality: this.quality(), telemetry: this.telemetry,
      heroKey: cfg.heroKey, heroes: cfg.heroes || null, net, autopilot: !!cfg.autopilot, difficulty: cfg.difficulty || 'medium',
      skipSeconds: cfg.skipSeconds || 0, fixedBuffer: this.params.get('cpu') ? [160, 90] : null,
    });
    session.renderer.shakeScale = this.settings.get('shake');
    const toggle = (what) => dispatchEvent(new CustomEvent('ll-toggle', { detail: what }));
    const inputs = [];
    if (!cfg.autopilot) {
      if (matchMedia('(pointer: fine)').matches || !this.touch) inputs.push(new DesktopInput(session, canvas, { onToggle: toggle }));
      if (this.touch || 'ontouchstart' in window) inputs.push(new TouchInput(session, this.root, { onToggle: toggle }));
    }
    session.inputs = inputs;
    const m = this.match = { session, canvas, ended: false };
    m.hud = new Hud(this.ui, session, { touch: this.touch, tooltip: this.tooltip, onShop: () => this.onToggle('shop'), onScoreboard: () => this.onToggle('scoreboard'), onMenu: () => this.onToggle('escape') });
    m.floaters = new Floaters(this.ui, session, this.settings);
    m.sfx = new SfxDirector(this.audio, session);
    m.shop = new Shop(this.ui, session, { onClose: () => m.shop.hide() });
    m.scoreboard = new Scoreboard(this.ui, session, { onClose: () => m.scoreboard.hide() });
    m.pause = new PauseMenu(this.ui, {
      onResume: () => m.pause.hide(),
      onSettings: () => this.settingsPanel.show(),
      onSurrender: () => { m.pause.hide(); session.send(surrenderCmd(session.player)); },
      onLeave: () => this.showMenu(),
    });
    session.on((ev, arg) => {
      if (ev === 'frame') {
        for (const i of inputs) i.update();
        const now = performance.now();
        m.hud.update(now); m.floaters.update(now); m.shop.update(); m.scoreboard.update(now); this.perf.update(now);
        toggle(this.dim, 'on', session.me.dead);
        const t1 = performance.now();
        m.sfx.update(); this.updateMusic(m);
        if (this.telemetry) { this.telemetry.ui.push(t1 - now); this.telemetry.audio.push(performance.now() - t1); }
      } else if (ev === 'end') this.onMatchEnd(arg);
    });
    window.__game = session;
    session.start();
    return session;
  }
  /** Music follows the local player's situation: calm lane, combat, sudden death, respawn. */
  updateMusic(m) {
    const w = m.session.world, me = m.session.me;
    if (w.tick === m.musicTick) return; m.musicTick = w.tick;
    const combat = w.tick - me.lastCombatTick < 90;
    this.music.set(intensityFor({ suddenDeath: w.state.suddenDeath, combat, dead: me.dead, over: w.state.over }), w.state.suddenDeath ? 112 : 96);
    if (me.dead !== m.muffled) { m.muffled = me.dead; this.audio.muffle(me.dead); }
  }
  onMatchEnd(winner) {
    const m = this.match; if (!m || m.ended) return; m.ended = true;
    this.audio.muffle(false); m.muffled = false;
    this.sound(winner === m.session.me.team ? 'victory' : 'defeat');
    for (const i of m.session.inputs) i.dispose(); m.session.inputs = [];
    m.endTimer = setTimeout(() => {
      if (this.match !== m) return;
      m.shop.hide(); m.scoreboard.hide(); m.pause.hide(); this.tooltip.hide(); toggle(this.dim, 'on', false);
      m.hud.el.classList.add('hidden'); m.floaters.el.classList.add('hidden');
      m.end = new EndScreen(this.ui, m.session, {
        surrendered: m.session.world.state.surrendered,
        onPlayAgain: () => this.showMenu(),
        onRematch: () => this.startMatch({ ...this.last }),
      });
    }, END_SCREEN_DELAY);
  }
  onToggle(what) {
    const m = this.match;
    if (what === 'perf') { this.perf.toggle(); return; }
    if (!m || m.ended) return;
    const panels = [this.settingsPanel, m.shop, m.scoreboard, m.pause];
    if (what === 'escape') {
      const top = panels.find((p) => p.open);
      if (top) top.hide(); else m.pause.show();
      return;
    }
    const target = what === 'shop' ? m.shop : what === 'scoreboard' ? m.scoreboard : null;
    if (!target) return;
    if (target.open) target.hide(); else { for (const p of panels) if (p !== target && p !== this.settingsPanel) p.hide(); target.show(); }
  }
  applySetting(k, v) {
    const s = this.match && this.match.session;
    if (!s) return;
    if (k === 'shake') s.renderer.shakeScale = v;
    if (k === 'ping') s.transport.setConditions({ ping: v, jitter: Math.round(v * 0.15), loss: v ? 0.01 : 0 });
  }
  /** Dispose whatever is on screen: the menu with its backdrop, or a match with its UI. */
  teardown() {
    this.tooltip.hide(); this.settingsPanel.hide(); toggle(this.dim, 'on', false);
    if (this.menu) { this.menu.dispose(); this.menu = null; }
    if (this.backdrop) { this.backdrop.dispose(); this.backdrop.canvas.remove(); this.backdrop = null; }
    const m = this.match;
    if (m) {
      clearTimeout(m.endTimer);
      for (const x of [m.hud, m.floaters, m.sfx, m.shop, m.scoreboard, m.pause, m.end]) if (x) x.dispose();
      m.session.dispose(); m.canvas.remove();
      this.match = null; if (window.__game === m.session) window.__game = null;
    }
  }
}
