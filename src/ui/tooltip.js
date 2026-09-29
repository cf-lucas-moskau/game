// One shared tooltip element, positioned above its anchor and kept on screen.
import { h } from './dom.js';

export class Tooltip {
  constructor(root) { this.el = h('div', { class: 'tip hidden', role: 'tooltip' }, h('div', { class: 'h' }), h('div', { class: 'm' }), h('div', { class: 'c' })); root.append(this.el); }
  show(anchor, title, body, meta) {
    const [t, b, c] = this.el.children; t.textContent = title; b.textContent = body; c.textContent = meta || '';
    b.classList.toggle('hidden', !body); c.classList.toggle('hidden', !meta);
    this.el.classList.remove('hidden');
    const r = anchor.getBoundingClientRect(), tr = this.el.getBoundingClientRect();
    const x = Math.max(8, Math.min(innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
    const y = r.top - tr.height - 10 < 8 ? r.bottom + 10 : r.top - tr.height - 10;
    this.el.style.left = `${x}px`; this.el.style.top = `${y}px`;
  }
  hide() { this.el.classList.add('hidden'); }
}
