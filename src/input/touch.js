// Touch controls: floating joystick (left), attack + ability buttons (right), drag-to-aim with a
// cancel zone, drawn abilities traced directly on the battlefield, three-finger tap for the perf overlay.
import { moveCmd, attackCmd, castCmd, spellCmd, stopCmd } from '../sim/commands.js';
import { autoTarget, clampToRange, forward, lead, screenPick } from './intent.js';
import { aimFor, isDrawn, SPELL_AIM } from './aim.js';
import { byRank } from '../sim/abilities.js';

const CSS = `
.tc{position:fixed;inset:0;pointer-events:none;z-index:5;touch-action:none;-webkit-user-select:none;user-select:none}
.tc-zone{position:absolute;left:0;top:0;bottom:0;width:46%;pointer-events:auto}
.tc-stick{position:absolute;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;border:2px solid rgba(232,220,196,.45);background:rgba(28,31,74,.28);opacity:0;transition:opacity .12s}
.tc-stick.on{opacity:1}
.tc-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(232,220,196,.8);box-shadow:0 2px 10px rgba(0,0,0,.35)}
.tc-btn{position:absolute;pointer-events:auto;border-radius:50%;display:grid;place-items:center;color:#e8dcc4;font:700 17px/1 system-ui,sans-serif;
  background:radial-gradient(circle at 35% 30%,rgba(90,110,170,.55),rgba(28,31,74,.78));border:2px solid rgba(232,220,196,.55);box-shadow:0 3px 12px rgba(0,0,0,.35);overflow:hidden}
.tc-btn .cd{position:absolute;inset:0;border-radius:50%;pointer-events:none}
.tc-btn .t{position:relative;font-size:15px;text-shadow:0 1px 2px #000}
.tc-btn.lock{filter:grayscale(1) brightness(.6)}
.tc-btn.down{transform:scale(.93)}
.tc-atk{width:88px;height:88px;font-size:14px;border-color:rgba(242,193,78,.8)}
.tc-cancel{position:absolute;right:26px;top:22px;width:64px;height:64px;border-radius:50%;display:none;place-items:center;color:#fff;font:700 26px system-ui;
  background:rgba(240,71,110,.35);border:2px solid rgba(240,71,110,.9)}
.tc-cancel.on{display:grid}.tc-cancel.hot{background:rgba(240,71,110,.8)}
@media (prefers-reduced-motion: reduce){.tc-stick{transition:none}}`;

export class TouchInput {
  constructor(session, root, { onToggle = () => {}, onInspect = () => {} } = {}) {
    this.s = session; this.onToggle = onToggle; this.onInspect = onInspect; this.aim = session.renderer.aim = session.renderer.aim || { active: false };
    if (!document.getElementById('tc-css')) { const st = document.createElement('style'); st.id = 'tc-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = this.el = document.createElement('div'); el.className = 'tc'; root.appendChild(el);
    el.innerHTML = `<div class="tc-zone"></div><div class="tc-stick"><div class="tc-knob"></div></div><div class="tc-cancel">✕</div>`;
    this.zone = el.querySelector('.tc-zone'); this.stick = el.querySelector('.tc-stick'); this.knob = el.querySelector('.tc-knob'); this.cancel = el.querySelector('.tc-cancel');
    this.buttons = [];
    const mk = (cls, label, onStart) => { const b = document.createElement('div'); b.className = `tc-btn ${cls}`; b.innerHTML = `<div class="cd"></div><span class="t">${label}</span>`; el.appendChild(b); b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); onStart(e, b); }); this.buttons.push(b); return b; };
    this.atk = mk('tc-atk', 'Attack', (e, b) => this.attackStart(e, b));
    this.slots = ['Q', 'W', 'E', 'R'].map((k, i) => mk('tc-ab', k, (e, b) => this.abilityStart(e, b, i)));
    this.spells = ['D', 'F'].map((k, i) => mk('tc-sp', k, (e, b) => this.spellStart(e, b, i)));
    this.joy = null; this.lastMove = 0;
    this.zone.addEventListener('pointerdown', (e) => this.joyStart(e));
    window.addEventListener('pointermove', (this._mv = (e) => this.pointerMove(e)));
    window.addEventListener('pointerup', (this._up = (e) => this.pointerUp(e)));
    window.addEventListener('pointercancel', this._up);
    // three-finger tap -> perf overlay
    window.addEventListener('touchstart', (this._tt = (e) => { if (e.touches.length === 3) this.onToggle('perf'); }), { passive: true });
    // a tap on the battlefield (outside the joystick zone and buttons) inspects the unit under the finger
    const cv = session.renderer.canvas;
    cv.addEventListener('pointerdown', (this._tap = (e) => {
      if (e.pointerType !== 'touch') return; this._tapAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    }));
    cv.addEventListener('pointerup', (this._tapUp = (e) => {
      const a = this._tapAt; this._tapAt = null; if (!a || e.pointerType !== 'touch' || performance.now() - a.t > 350 || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 14) return;
      const r = cv.getBoundingClientRect();
      const u = screenPick(this.s.renderer, this.s.world, null, e.clientX - r.left, e.clientY - r.top, true, 22); this.onInspect(u ? u.id : -1);
    }));
    this.layout(); window.addEventListener('resize', (this._rs = () => this.layout()));
    this.active = new Map(); // pointerId -> gesture
  }
  get me() { return this.s.me; }
  /** Buttons sized in CSS px (56 px ability targets); placed in an arc around the attack button. */
  layout() {
    const W = innerWidth, H = innerHeight, k = Math.max(0.85, Math.min(1.15, H / 420));
    const ax = W - 70 * k - 20, ay = H - 70 * k - 16;
    const place = (b, x, y, size) => Object.assign(b.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
    place(this.atk, ax, ay, 88 * k);
    const r = 108 * k, angles = [200, 232, 264, 296].map((d) => (d * Math.PI) / 180);
    this.slots.forEach((b, i) => place(b, ax + Math.cos(angles[i]) * r, ay + Math.sin(angles[i]) * r, 58 * k));
    // summoner spells sit outside the ability arc, staggered so thumbs don't clip them
    [[-222, -62], [-196, -128]].forEach(([dx, dy], i) => place(this.spells[i], ax + dx * k, ay + dy * k, 46 * k));
    this.center = { ax, ay };
  }
  // ---------- joystick
  joyStart(e) {
    e.preventDefault(); this.zone.setPointerCapture(e.pointerId);
    this.active.set(e.pointerId, { type: 'joy', ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
    Object.assign(this.stick.style, { left: `${e.clientX}px`, top: `${e.clientY}px` }); this.stick.classList.add('on'); this.knob.style.transform = '';
  }
  // ---------- attack
  attackStart(e, b) { b.classList.add('down'); this.active.set(e.pointerId, { type: 'atk', b }); this.attackNearest(); this.nextAttack = performance.now() + 320; }
  attackNearest() { const t = autoTarget(this.s.world, this.me, this.me.range + 220); if (t) this.s.send(attackCmd(this.s.player, t.id)); }
  // ---------- abilities
  abilityStart(e, b, slot) {
    b.classList.add('down');
    const a = aimFor(this.me, slot);
    const g = { type: 'ab', b, slot, a, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, pts: isDrawn(a) ? [] : null };
    this.active.set(e.pointerId, g);
    if (a.kind !== 'self') Object.assign(this.aim, { active: true, slot, shape: a, x: this.me.x, y: this.me.y, pts: null });
  }
  spellStart(e, b, slot) {
    b.classList.add('down');
    const g = { type: 'sp', b, slot, a: SPELL_AIM[slot], sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    this.active.set(e.pointerId, g);
  }
  aimPoint(g, e) {
    const me = this.me, dx = e.clientX - g.sx, dy = e.clientY - g.sy, len = Math.sqrt(dx * dx + dy * dy);
    // screen drag direction -> world direction: project two screen points to the ground
    const r = this.s.renderer, p0 = r.worldToScreen(me.x, me.y), w1 = r.screenToWorld(p0.x + dx, p0.y + dy);
    if (!w1) return { x: me.x, y: me.y };
    const wx = w1.x - me.x, wy = w1.y - me.y, wl = Math.sqrt(wx * wx + wy * wy) || 1;
    const range = g.a.range || 400, frac = Math.min(1, len / 110);
    return { x: me.x + (wx / wl) * range * frac, y: me.y + (wy / wl) * range * frac };
  }
  overCancel(e) { const c = this.cancel.getBoundingClientRect(); return e.clientX >= c.left - 10 && e.clientX <= c.right + 10 && e.clientY >= c.top - 10 && e.clientY <= c.bottom + 10; }
  pointerMove(e) {
    const g = this.active.get(e.pointerId); if (!g) return;
    if (g.type === 'joy') {
      let dx = e.clientX - g.ox, dy = e.clientY - g.oy; const l = Math.sqrt(dx * dx + dy * dy), max = 54;
      if (l > max) { dx = dx / l * max; dy = dy / l * max; }
      g.dx = dx; g.dy = dy; this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      return;
    }
    if (g.type === 'ab' || g.type === 'sp') {
      if (!g.moved && (e.clientX - g.sx) ** 2 + (e.clientY - g.sy) ** 2 > 14 * 14) { g.moved = true; this.cancel.classList.add('on'); }
      if (!g.moved) return;
      this.cancel.classList.toggle('hot', this.overCancel(e));
      if (g.pts) { // drawn ability: the finger draws directly on the ground
        const w = this.s.renderer.screenToWorld(e.clientX, e.clientY); if (!w) return;
        const n = g.pts.length; if (n < 2 || (g.pts[n - 2] - w.x) ** 2 + (g.pts[n - 1] - w.y) ** 2 > 18 * 18) g.pts.push(w.x, w.y);
        Object.assign(this.aim, { active: true, x: w.x, y: w.y, pts: g.pts });
      } else if (g.type === 'ab') { const p = this.aimPoint(g, e); this.aim.x = p.x; this.aim.y = p.y; }
    }
  }
  pointerUp(e) {
    const g = this.active.get(e.pointerId); if (!g) return; this.active.delete(e.pointerId);
    if (g.b) g.b.classList.remove('down');
    const p = this.s.player, me = this.me;
    if (g.type === 'joy') { this.stick.classList.remove('on'); this.s.send(stopCmd(p)); return; }
    if (g.type === 'atk') return;
    const cancelled = g.moved && this.overCancel(e);
    this.cancel.classList.remove('on', 'hot'); this.aim.active = false;
    if (cancelled) return;
    if (g.type === 'sp') {
      const t = g.slot === 0 ? (g.moved ? this.aimPoint(g, e) : forward(me, 400)) : me;
      this.s.send(spellCmd(p, g.slot, t.x, t.y)); return;
    }
    const a = g.a; let x, y, id = -1, pts = null;
    if (g.pts && g.pts.length >= 6) { pts = g.pts; x = pts[pts.length - 2]; y = pts[pts.length - 1]; }
    else if (g.moved && !g.pts) ({ x, y } = this.aimPoint(g, e));
    else { // quick tap: auto-aim
      const t = a.kind === 'ally' ? autoTarget(this.s.world, me, a.range, { allies: true }) : a.kind === 'self' ? null : autoTarget(this.s.world, me, (a.range || 500) + 80, { heroesOnly: a.heroesOnly });
      if (t) { const q = lead(t, 0.25); x = q.x; y = q.y; id = t.id; } else if (a.kind === 'ally') { x = me.x; y = me.y; } else ({ x, y } = forward(me, Math.min(a.range || 400, 400)));
    }
    this.s.send(castCmd(p, g.slot, x, y, pts, id));
    if (navigator.vibrate) navigator.vibrate(8);
  }
  /** Per frame: joystick steering (throttled), attack hold, cooldown sweeps. */
  update() {
    const now = performance.now(), me = this.me;
    for (const g of this.active.values()) {
      if (g.type === 'joy' && (g.dx * g.dx + g.dy * g.dy) > 12 * 12 && now - this.lastMove > 90) {
        this.lastMove = now;
        const r = this.s.renderer, p0 = r.worldToScreen(me.x, me.y), w1 = r.screenToWorld(p0.x + g.dx, p0.y + g.dy);
        if (w1) { const wx = w1.x - me.x, wy = w1.y - me.y, l = Math.sqrt(wx * wx + wy * wy) || 1; this.s.send(moveCmd(this.s.player, me.x + wx / l * 260, me.y + wy / l * 260)); }
      }
      if (g.type === 'atk' && now > this.nextAttack) { this.nextAttack = now + 320; this.attackNearest(); }
    }
    this.paintCooldowns();
  }
  paintCooldowns() {
    const me = this.me, w = this.s.world, def = w.registry.heroes[me.heroKey];
    this.slots.forEach((b, i) => {
      const key = 'QWER'[i], ab = def.abilities[key], rank = me.ranks[key];
      const total = rank > 0 ? Math.max(1, (typeof ab.cd === 'function' ? 10 : byRank(ab.cd, rank)) * 30 * (1 - me.cdr)) : 1;
      const f = rank <= 0 ? 1 : me.cds[i] / total;
      const cd = b.firstChild;
      const v = f > 0 ? `conic-gradient(rgba(10,12,30,.72) ${f * 360}deg, transparent 0)` : '';
      if (cd._v !== v) { cd.style.background = v; cd._v = v; }
      const lock = rank <= 0 || me.dead; if (b._lock !== lock) { b.classList.toggle('lock', lock); b._lock = lock; }
    });
    this.spells.forEach((b, i) => { const f = me.spellCds[i] / (i === 0 ? 900 : 1800); const v = f > 0 ? `conic-gradient(rgba(10,12,30,.72) ${f * 360}deg, transparent 0)` : ''; if (b.firstChild._v !== v) { b.firstChild.style.background = v; b.firstChild._v = v; } });
  }
  dispose() { const cv = this.s.renderer.canvas; cv.removeEventListener('pointerdown', this._tap); cv.removeEventListener('pointerup', this._tapUp); this.el.remove(); window.removeEventListener('pointermove', this._mv); window.removeEventListener('pointerup', this._up); window.removeEventListener('pointercancel', this._up); window.removeEventListener('touchstart', this._tt); window.removeEventListener('resize', this._rs); }
}
