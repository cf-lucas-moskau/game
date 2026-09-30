// End of match: result, how it ended, both teams' stats, and the way back into the loop.
import { h } from './dom.js';
import { teamTables } from './scoreboard.js';
import { clock } from './format.js';

export class EndScreen {
  /** actions: [{ label, act, primary, onClick }] replace the single-player buttons (online: back to lobby, leave). */
  constructor(root, session, { surrendered, onPlayAgain, onRematch, actions = null, note = '' }) {
    const w = session.world, me = session.me, win = w.state.winner === me.team;
    const why = surrendered ? (win ? 'The enemy team surrendered' : 'Your team surrendered')
      : `${win ? 'The enemy' : 'Your'} Heartstone shattered at ${clock(w.tick)}${w.state.suddenDeath ? ' in sudden death' : ''}`;
    this.el = h('div', { class: 'modal end screen', role: 'dialog', 'aria-label': win ? 'Victory' : 'Defeat' },
      h('div', { class: 'panel' },
        h('h1', { class: win ? 'win' : 'loss' }, win ? 'Victory' : 'Defeat'),
        h('div', { class: 'why' }, why),
        ...teamTables(w, me, null, (x) => session.skinOf(x)),
        note ? h('div', { class: 'why note' }, note) : null,
        h('div', { class: 'actions' }, (actions || [
          { label: 'Rematch (same hero)', act: 'rematch', onClick: onRematch },
          { label: 'Play again', act: 'again', primary: true, onClick: onPlayAgain },
        ]).map((a) => h('button', { class: `btn${a.primary ? ' primary' : ''}`, onclick: a.onClick, 'data-act': a.act }, a.label)))));
    root.append(this.el);
    const first = this.el.querySelector('.primary') || this.el.querySelector('.actions .btn'); if (first) first.focus({ preventScroll: true });
  }
  dispose() { this.el.remove(); }
}
