// Title + hero select: a roster of every hero (painted portraits, role filters), a detail card with the passive,
// the four abilities and the skins, bot difficulty, and a Random button that always rolls a different hero.
import { h, clear } from './dom.js';
import { identity, portraitFor } from './identity.js';
import { OPTIONS } from './settings.js';
import { skinsFor, validSkin, DEFAULT_SKIN } from '../assets/skins.js';

const RES = { mana: 'Mana', flame: 'Flame', ink: 'Ink', swarm: 'Bee swarm', gold: 'Gold', energy: 'Energy', none: 'Cooldowns' };
/** Role filters: each hero's `role` text falls into one group. */
const GROUPS = [
  ['all', 'All', () => true],
  ['mage', 'Mages', (r) => /mage/i.test(r)],
  ['front', 'Frontline', (r) => /tank|juggernaut|skirmisher/i.test(r)],
  ['marksman', 'Marksmen', (r) => /marksman/i.test(r)],
  ['support', 'Supports', (r) => /support|enchanter|bard/i.test(r)],
  ['assassin', 'Assassins', (r) => /assassin/i.test(r)],
];

/** A hero's round badge: the painted portrait (in the given skin) once ready, the emblem until then. */
export function emblem(key, cls = '', skin = 'classic') {
  const id = identity(key); const el = h('div', { class: `emblem ${cls}`, style: { '--accent': id.accent } }); el.innerHTML = id.emblem;
  const show = (url) => { el.classList.add('painted'); el.style.backgroundImage = `url("${url}")`; };
  const url = portraitFor(key, skin, show); if (url) show(url);
  return el;
}

export class HeroSelect {
  /**
   * @param heroes   registry { key: def }
   * @param pick     () => random hero key
   * @param settings Settings store (hero, skin and difficulty are remembered)
   * @param onPlay   ({ heroKey, skin, difficulty }) => void
   * @param onOnline ({ heroKey, skin }) => void: open online play (host or join a lobby)
   */
  constructor(root, { heroes, pick, settings, touch, onPlay, onSettings, onOnline = null }) {
    this.heroes = heroes; this.pick = pick; this.settings = settings; this.onPlay = onPlay; this.onOnline = onOnline; this.group = 'all';
    const last = settings.get('hero');
    this.heroKey = heroes[last] ? last : pick(); this.random = !heroes[last];
    this.skin = validSkin(this.heroKey, settings.get('skin')) ? settings.get('skin') : DEFAULT_SKIN;
    this.card = h('section', { class: 'hero-card', 'aria-live': 'polite' });
    this.filters = h('div', { class: 'seg roles', role: 'group', 'aria-label': 'Filter heroes by role' });
    this.grid = h('div', { class: 'roster', role: 'listbox', 'aria-label': 'Heroes' });
    const controls = touch
      ? [['Left thumb', 'Move (floating joystick)'], ['Attack', 'Hit the nearest enemy'], ['Q W E R', 'Tap to auto-aim, drag to aim'], ['Drag to ✕', 'Cancel an aimed ability'], ['Gold button', 'Shop at your fountain']]
      : [['Right click', 'Move, or attack what is under the cursor'], ['Q W E R', 'Cast at the cursor (hold Shift to preview)'], ['Vesper', 'Hold Q/W/E and draw with the mouse'], ['D / F', 'Dash / Heal'], ['A + click', 'Attack-move'], ['P / Tab', 'Shop / scoreboard'], ['Esc', 'Menu, settings, surrender']];
    this.el = h('div', { class: 'menu screen' },
      h('div', { class: 'left' },
        h('div', { class: 'brand' },
          h('h1', {}, 'Leviathan ', h('em', {}, 'Lane')),
          h('p', {}, 'Three against three on the back of a sky-whale. Break both towers, then shatter the enemy Heartstone.')),
        h('div', { class: 'picker' }, h('div', { class: 'picker-head' }, h('h3', {}, 'Choose your hero'), this.filters), this.grid),
        h('div', { class: 'foot' },
          h('details', { class: 'controls-help' }, h('summary', {}, 'Controls'), h('div', { class: 'keys' }, controls.map(([k, v]) => [h('b', {}, k), h('span', {}, v)]))),
          h('button', { class: 'btn small', onclick: onSettings, 'data-act': 'settings' }, 'Settings'))),
      this.card);
    root.append(this.el);
    this.renderFilters(); this.renderGrid(); this.render();
  }
  renderFilters() {
    clear(this.filters).append(...GROUPS.filter(([k, , f]) => k === 'all' || Object.values(this.heroes).some((d) => f(d.role))).map(([k, label]) =>
      h('button', { class: k === this.group ? 'on' : '', 'aria-pressed': k === this.group ? 'true' : 'false', onclick: () => { this.group = k; this.renderFilters(); this.renderGrid(); } }, label)));
  }
  renderGrid() {
    const f = GROUPS.find(([k]) => k === this.group)[2];
    const tiles = Object.keys(this.heroes).filter((k) => f(this.heroes[k].role)).map((k) => {
      const d = this.heroes[k], on = k === this.heroKey;
      return h('button', { class: `tile${on ? ' on' : ''}`, role: 'option', 'aria-selected': on ? 'true' : 'false', 'data-hero': k, title: `${d.name}, ${d.title}`, style: { '--accent': identity(k).accent },
        onclick: () => this.choose(k, false) }, emblem(k), h('span', { class: 'nm' }, d.short || d.name.split(' ')[0]));
    });
    tiles.push(h('button', { class: 'tile random', 'data-act': 'random', title: 'A random hero', onclick: () => this.reroll() }, h('div', { class: 'emblem dice' }, '?'), h('span', { class: 'nm' }, 'Random')));
    clear(this.grid).append(...tiles);
  }
  choose(k, random) {
    if (k !== this.heroKey) this.skin = DEFAULT_SKIN;
    this.heroKey = k; this.random = random;
    this.settings.set('hero', random ? '' : k); this.settings.set('skin', this.skin);
    this.renderGrid(); this.render();
  }
  render() {
    const def = this.heroes[this.heroKey], diff = this.settings.get('difficulty'), skins = skinsFor(this.heroKey);
    const P = def.passive;
    clear(this.card).append(
      h('div', { class: 'eyebrow' }, this.random ? 'The whale chose your hero' : 'Your hero'),
      h('div', { class: 'who' }, emblem(this.heroKey, 'big', this.skin),
        h('div', {}, h('h2', {}, def.name), h('div', { class: 'title' }, def.title),
          h('div', { class: 'tags' }, h('span', { class: 'tag' }, def.role), h('span', { class: 'tag' }, `${def.difficulty} to play`), h('span', { class: 'tag' }, RES[def.resource] || def.resource)))),
      h('ul', { class: 'kit' },
        P ? h('li', { class: 'passive' }, h('span', { class: 'k' }, 'P'), h('div', {}, h('div', { class: 'n' }, P.name), h('div', { class: 'd' }, P.desc))) : null,
        ['Q', 'W', 'E', 'R'].map((k) => { const a = def.abilities[k]; return h('li', {}, h('span', { class: 'k' }, k), h('div', {}, h('div', { class: 'n' }, a.name), h('div', { class: 'd' }, a.desc || ''))); })),
      skins.length > 1 ? h('div', { class: 'skins', role: 'radiogroup', 'aria-label': 'Skin' },
        h('label', {}, 'Skin'),
        h('div', { class: 'swatches' }, skins.map((s) => h('button', { class: `swatch${s.key === this.skin ? ' on' : ''}`, role: 'radio', 'aria-checked': s.key === this.skin ? 'true' : 'false', 'data-skin': s.key,
          title: s.blurb ? `${s.name}: ${s.blurb}` : s.name, style: { '--accent': s.accent }, onclick: () => { this.skin = s.key; this.settings.set('skin', s.key); this.render(); } },
          emblem(this.heroKey, 'sm', s.key), h('span', {}, s.name))))) : null,
      h('div', { class: 'row' }, h('label', {}, 'Bots'),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Bot difficulty' }, OPTIONS.difficulty.map(([v, label]) =>
          h('button', { class: v === diff ? 'on' : '', 'aria-pressed': v === diff ? 'true' : 'false', onclick: () => { this.settings.set('difficulty', v); this.render(); } }, label)))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => this.reroll(), 'data-act': 'reroll', title: 'A random hero (always a different one)' }, 'Random'),
        this.onOnline ? h('button', { class: 'btn', onclick: () => this.onOnline({ heroKey: this.heroKey, skin: this.skin }), 'data-act': 'online', title: 'Play with friends: host or join a lobby' }, 'Online') : null,
        h('button', { class: 'btn primary', 'data-act': 'play', onclick: () => this.onPlay({ heroKey: this.heroKey, skin: this.skin, difficulty: this.settings.get('difficulty') }) }, 'Fight')));
  }
  reroll() {
    let k = this.pick(); for (let i = 0; i < 16 && k === this.heroKey; i++) k = this.pick(); // always a different hero
    this.choose(k, true);
  }
  dispose() { this.el.remove(); }
}
