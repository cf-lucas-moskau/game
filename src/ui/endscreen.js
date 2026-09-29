// End of match: result, how it ended, both teams' stats, and the way back into the loop.
import { h } from './dom.js';
import { teamTables } from './scoreboard.js';
import { clock } from './format.js';

export class EndScreen {
  constructor(root, session, { surrendered, onPlayAgain, onRematch }) {
    const w = session.world, me = session.me, win = w.state.winner === me.team;
    const why = surrendered ? (win ? 'The enemy team surrendered' : 'Your team surrendered')
      : `${win ? 'The enemy' : 'Your'} Heartstone shattered at ${clock(w.tick)}${w.state.suddenDeath ? ' in sudden death' : ''}`;
    this.el = h('div', { class: 'modal end screen', role: 'dialog', 'aria-label': win ? 'Victory' : 'Defeat' },
      h('div', { class: 'panel' },
        h('h1', { class: win ? 'win' : 'loss' }, win ? 'Victory' : 'Defeat'),
        h('div', { class: 'why' }, why),
        ...teamTables(w, me),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: onRematch, 'data-act': 'rematch' }, 'Rematch (same hero)'),
          h('button', { class: 'btn primary', onclick: onPlayAgain, 'data-act': 'again' }, 'Play again'))));
    root.append(this.el);
    this.el.querySelector('.primary').focus({ preventScroll: true });
  }
  dispose() { this.el.remove(); }
}
