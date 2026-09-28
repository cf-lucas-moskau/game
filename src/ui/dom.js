// Tiny DOM helpers for the UI layer. Per-frame updates go through setText/setStyle/toggle,
// which skip the DOM write when the value did not change.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') el.className = v;
    else if (k === 'style') for (const p in v) { if (p.startsWith('--')) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export function setText(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
export function setStyle(el, prop, v) { const k = '_s' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
export function toggle(el, cls, on) { const k = '_c' + cls; if (el[k] !== on) { el[k] = on; el.classList.toggle(cls, on); } }
export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }
/** Per-frame numeric setters: compare numbers first, build a string only when the shown value changes. */
export function setNum(el, n, fmt) { if (el._n !== n) { el._n = n; el.textContent = fmt ? fmt(n) : String(n); } }
export function setScaleX(el, f) { const q = Math.round(Math.max(0, Math.min(1, f)) * 1000); if (el._q !== q) { el._q = q; el.style.transform = `scaleX(${q / 1000})`; } }
/** Cooldown sweep: f in [0, 1] of the remaining time, drawn as a conic mask (1 degree steps). */
export function setSweep(el, f) {
  const d = f > 0 ? Math.max(1, Math.round(f * 360)) : 0;
  if (el._d !== d) { el._d = d; el.style.background = d ? `conic-gradient(rgba(8,10,28,.74) ${d}deg, transparent 0)` : ''; }
}
