// Scoreboard (Tab): both teams with level, K/D/A, minions, items. Also used by the end screen.
import { h, clear } from './dom.js';
import { emblem } from './menu.js';
import { itemIcon } from './identity.js';

export function teamTables(world, me, onPick = null) {
  const items = world.registry.items;
  return [0, 1].map((team) => {
    const kills = world.heroes.filter((x) => x.team === team).reduce((a, x) => a + x.kills, 0);
    return h('div', {},
      h('div', { class: `team-h t${team}` }, `${team === 0 ? 'Blue' : 'Red'} team · ${kills} kill${kills === 1 ? '' : 's'}`),
      h('table', { class: 'sb' },
        h('thead', {}, h('tr', {}, ['Hero', 'Lvl', 'K / D / A', 'Minions', 'Items'].map((t) => h('th', {}, t)))),
        h('tbody', {}, world.heroes.filter((x) => x.team === team).map((x) => {
          const def = world.registry.heroes[x.heroKey];
          return h('tr', { class: `${x === me ? 'me' : ''}${x.dead ? ' dead' : ''}`, 'data-id': onPick ? String(x.id) : null, onclick: onPick ? () => onPick(x.id) : null },
            h('td', {}, h('div', { class: 'hero' }, emblem(x.heroKey), h('div', {}, def.name, h('div', { class: 'who' }, x === me ? 'You' : `Bot${x.dead ? ' · respawning' : ''}`)))),
            h('td', {}, String(x.level)), h('td', { class: 'kda' }, `${x.kills} / ${x.deaths} / ${x.assists}`), h('td', {}, String(x.cs)),
            h('td', {}, h('div', { class: 'chips' }, x.items.map((k) => h('span', { class: 'chip', title: items[k].name }, itemIcon(k, items[k]), h('span', { class: 'nm' }, items[k].name))))));
        }))));
  });
}
export class Scoreboard {
  constructor(root, session, { onClose, onPick = null }) {
    this.s = session; this.onPick = onPick;
    this.body = h('div');
    this.el = h('div', { class: 'modal screen hidden', role: 'dialog', 'aria-label': 'Scoreboard', onpointerdown: (e) => { if (e.target === this.el) onClose(); } },
      h('div', { class: 'panel' }, h('header', {}, h('h2', {}, 'Scoreboard'), h('button', { class: 'x-btn', onclick: onClose, 'aria-label': 'Close scoreboard' }, '✕')), this.body));
    root.append(this.el); this.open = false; this.next = 0;
  }
  show() { this.open = true; this.el.classList.remove('hidden'); this.next = 0; }
  hide() { this.open = false; this.el.classList.add('hidden'); }
  update(now) { if (!this.open || now < this.next) return; this.next = now + 500; clear(this.body).append(...teamTables(this.s.world, this.s.me, this.onPick)); }
  dispose() { this.el.remove(); }
}
