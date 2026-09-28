// Title + hero select: a random hero with one reroll, bot difficulty, controls help.
import { h, clear } from './dom.js';
import { identity } from './identity.js';
import { OPTIONS } from './settings.js';

const RES = { mana: 'Mana', flame: 'Flame', ink: 'Ink', swarm: 'Bee swarm', gold: 'Gold' };
export function emblem(key, cls = '') {
  const id = identity(key); const el = h('div', { class: `emblem ${cls}`, style: { '--accent': id.accent } }); el.innerHTML = id.emblem; return el;
}
export class HeroSelect {
  /**
   * @param heroes   registry { key: def }
   * @param pick     () => random hero key
   * @param settings Settings store (difficulty is remembered)
   * @param onPlay   ({ heroKey, difficulty }) => void
   */
  constructor(root, { heroes, pick, settings, touch, onPlay, onSettings }) {
    this.heroes = heroes; this.pick = pick; this.settings = settings; this.onPlay = onPlay;
    this.heroKey = pick(); this.rerolls = 1;
    this.card = h('section', { class: 'hero-card', 'aria-live': 'polite' });
    const controls = touch
      ? [['Left thumb', 'Move (floating joystick)'], ['Attack', 'Hit the nearest enemy'], ['Q W E R', 'Tap to auto-aim, drag to aim'], ['Drag to ✕', 'Cancel an aimed ability'], ['Gold button', 'Shop at your fountain']]
      : [['Right click', 'Move, or attack what is under the cursor'], ['Q W E R', 'Cast at the cursor (hold Shift to preview)'], ['Vesper', 'Hold Q/W/E and draw with the mouse'], ['D / F', 'Dash / Heal'], ['A + click', 'Attack-move'], ['P / Tab', 'Shop / scoreboard'], ['Esc', 'Menu, settings, surrender']];
    this.el = h('div', { class: 'menu screen' },
      h('div', { class: 'left' },
        h('div', { class: 'brand' },
          h('h1', {}, 'Leviathan ', h('em', {}, 'Lane')),
          h('p', {}, 'Three against three on the back of a sky-whale. Break both towers, then shatter the enemy Heartstone.')),
        h('div', { class: 'foot' },
          h('div', { class: 'controls-help' }, h('h3', {}, 'Controls'), controls.map(([k, v]) => [h('b', {}, k), h('span', {}, v)])),
          h('button', { class: 'btn small', onclick: onSettings, 'data-act': 'settings' }, 'Settings'))),
      this.card);
    root.append(this.el);
    this.render();
  }
  render() {
    const def = this.heroes[this.heroKey], diff = this.settings.get('difficulty');
    clear(this.card).append(
      h('div', { class: 'eyebrow' }, 'The whale chose your hero'),
      h('div', { class: 'who' }, emblem(this.heroKey),
        h('div', {}, h('h2', {}, def.name), h('div', { class: 'title' }, def.title),
          h('div', { class: 'tags' }, h('span', { class: 'tag' }, def.role), h('span', { class: 'tag' }, `${def.difficulty} to play`), h('span', { class: 'tag' }, RES[def.resource] || def.resource)))),
      h('ul', { class: 'kit' }, ['Q', 'W', 'E', 'R'].map((k) => { const a = def.abilities[k]; return h('li', {}, h('span', { class: 'k' }, k), h('div', {}, h('div', { class: 'n' }, a.name), h('div', { class: 'd' }, a.desc || ''))); })),
      h('div', { class: 'row' }, h('label', {}, 'Bots'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Bot difficulty' }, OPTIONS.difficulty.map(([v, label]) =>
          h('button', { class: v === diff ? 'on' : '', 'aria-pressed': v === diff ? 'true' : 'false', onclick: () => { this.settings.set('difficulty', v); this.render(); } }, label)))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: this.rerolls <= 0, onclick: () => this.reroll(), 'data-act': 'reroll' }, this.rerolls > 0 ? 'Reroll (1)' : 'No rerolls'),
        h('button', { class: 'btn primary', 'data-act': 'play', onclick: () => this.onPlay({ heroKey: this.heroKey, difficulty: this.settings.get('difficulty') }) }, 'Fight')));
  }
  reroll() {
    if (this.rerolls <= 0) return;
    let k = this.pick(); for (let i = 0; i < 8 && k === this.heroKey; i++) k = this.pick();
    this.heroKey = k; this.rerolls--; this.render();
  }
  dispose() { this.el.remove(); }
}
