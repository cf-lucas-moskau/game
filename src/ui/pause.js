// Esc menu (the match keeps running, as it will online) and the settings panel.
import { h, clear } from './dom.js';
import { OPTIONS } from './settings.js';

export class PauseMenu {
  constructor(root, { onResume, onSettings, onSurrender, onLeave, leaveLabel = 'Leave to hero select' }) {
    this.confirming = false;
    this.body = h('div', { class: 'stack' });
    this.el = h('div', { class: 'modal pause screen hidden', role: 'dialog', 'aria-label': 'Menu', onpointerdown: (e) => { if (e.target === this.el) onResume(); } },
      h('div', { class: 'panel' }, h('header', {}, h('h2', {}, 'Menu'), h('button', { class: 'x-btn', onclick: onResume, 'aria-label': 'Close menu' }, '✕')), this.body));
    this.actions = { onResume, onSettings, onSurrender, onLeave, leaveLabel };
    root.append(this.el); this.open = false;
  }
  render() {
    const a = this.actions;
    clear(this.body).append(
      h('button', { class: 'btn primary', onclick: a.onResume }, 'Resume'),
      h('button', { class: 'btn', onclick: a.onSettings }, 'Settings'),
      this.confirming
        ? h('div', { class: 'stack' }, h('div', { class: 'sub' }, 'Surrender ends the match as a loss for your team.'),
          h('button', { class: 'btn danger', onclick: a.onSurrender, 'data-act': 'confirm-surrender' }, 'Yes, surrender'),
          h('button', { class: 'btn', onclick: () => { this.confirming = false; this.render(); } }, 'Keep fighting'))
        : h('button', { class: 'btn danger', onclick: () => { this.confirming = true; this.render(); }, 'data-act': 'surrender' }, 'Surrender'),
      h('button', { class: 'btn', onclick: a.onLeave, 'data-act': 'leave' }, a.leaveLabel));
  }
  show() { this.open = true; this.confirming = false; this.render(); this.el.classList.remove('hidden'); }
  hide() { this.open = false; this.el.classList.add('hidden'); }
  dispose() { this.el.remove(); }
}

const ROWS = [
  ['volume', 'Volume', ''],
  ['music', 'Music', ''],
  ['sfx', 'Sound effects', ''],
  ['quality', 'Graphics quality', 'Applies from the next match'],
  ['shake', 'Camera shake', ''],
  ['damageNumbers', 'Damage numbers', ''],
  ['cursor', 'Cursor', 'Game cursors change with what is under them'],
  ['ping', 'Simulated ping', 'Test how the game feels online'],
];
export class SettingsPanel {
  constructor(root, settings, { onClose }) {
    this.settings = settings;
    this.body = h('div');
    this.el = h('div', { class: 'modal settings screen hidden', role: 'dialog', 'aria-label': 'Settings', onpointerdown: (e) => { if (e.target === this.el) onClose(); } },
      h('div', { class: 'panel' }, h('header', {}, h('h2', {}, 'Settings'), h('button', { class: 'x-btn', onclick: onClose, 'aria-label': 'Close settings' }, '✕')), this.body));
    root.append(this.el); this.open = false;
  }
  render() {
    clear(this.body).append(...ROWS.map(([key, label, hint]) => h('div', { class: 'set-row' },
      h('div', { class: 'l' }, label, hint ? h('small', {}, hint) : null),
      h('div', { class: 'seg', role: 'group', 'aria-label': label }, OPTIONS[key].map(([v, name]) => {
        const on = this.settings.get(key) === v;
        return h('button', { class: on ? 'on' : '', 'aria-pressed': on ? 'true' : 'false', onclick: () => { this.settings.set(key, v); this.render(); } }, name);
      })))));
  }
  show() { this.open = true; this.render(); this.el.classList.remove('hidden'); }
  hide() { this.open = false; this.el.classList.add('hidden'); }
  dispose() { this.el.remove(); }
}
