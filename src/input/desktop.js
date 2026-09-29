// Mouse + keyboard controls.
//   Right click: move, or attack the enemy under the cursor (hold to keep steering)
//   Q W E R: quick-cast at the cursor; hold Shift to preview and release to cast
//   Vesper: hold Q/W/E and move the mouse to draw, release to cast
//   D / F: summoner spells, S: stop, A + left click: attack-move, 1-6: item actives
import { moveCmd, attackCmd, attackMoveCmd, castCmd, spellCmd, stopCmd, itemActiveCmd } from '../sim/commands.js';
import { hoverTarget, clampToRange } from './intent.js';
import { aimFor, isDrawn, SPELL_AIM } from './aim.js';

const SLOT_KEYS = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };
export class DesktopInput {
  constructor(session, canvas, { onToggle = () => {}, onInspect = () => {} } = {}) {
    this.s = session; this.canvas = canvas; this.onToggle = onToggle; this.onInspect = onInspect;
    this.mouse = { sx: 0, sy: 0, x: 0, y: 0, right: false };
    this.aim = session.renderer.aim = { active: false }; this.attackArmed = false; this.lastSteer = 0;
    this.stroke = null;
    const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); (this.off ||= []).push(() => t.removeEventListener(ev, f, o)); };
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(canvas, 'pointermove', (e) => { if (e.pointerType === 'mouse') this.move(e); });
    on(canvas, 'pointerdown', (e) => { if (e.pointerType === 'mouse') this.down(e); });
    on(window, 'pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 2) this.mouse.right = false; });
    on(window, 'keydown', (e) => this.key(e, true));
    on(window, 'keyup', (e) => this.key(e, false));
    on(window, 'blur', () => { this.mouse.right = false; this.cancelAim(); });
  }
  get me() { return this.s.me; }
  world() { return this.s.world; }
  toWorld() { const p = this.s.renderer.screenToWorld(this.mouse.sx, this.mouse.sy); if (p) { this.mouse.x = p.x; this.mouse.y = p.y; } return this.mouse; }
  move(e) {
    this.mouse.sx = e.clientX; this.mouse.sy = e.clientY; this.toWorld();
    const h = hoverTarget(this.world(), this.me, this.mouse.x, this.mouse.y);
    this.s.renderer.hoverId = h && h.team !== this.me.team ? h.id : -1;
    if (this.stroke) this.addStrokePoint();
    if (this.aim.active) { this.aim.x = this.mouse.x; this.aim.y = this.mouse.y; }
  }
  down(e) {
    this.mouse.sx = e.clientX; this.mouse.sy = e.clientY; this.toWorld();
    const p = this.s.player, m = this.mouse;
    if (e.button === 2) {
      this.mouse.right = true; this.attackArmed = false;
      const h = hoverTarget(this.world(), this.me, m.x, m.y);
      if (this.aim.active && !this.stroke) { this.cancelAim(); return; } // right click cancels a Shift preview
      if (h && h.team !== this.me.team) { this.s.send(attackCmd(p, h.id)); this.s.renderer.marker(h.x, h.y, 'attack'); }
      else { this.s.send(moveCmd(p, m.x, m.y)); this.s.renderer.marker(m.x, m.y, 'move'); }
      this.lastSteer = performance.now();
    } else if (e.button === 0) {
      if (this.aim.active && !this.stroke) { this.release(this.aim.slot); return; }
      if (this.attackArmed) { this.attackArmed = false; this.s.send(attackMoveCmd(p, m.x, m.y)); this.s.renderer.marker(m.x, m.y, 'attack'); return; }
      // left click on a unit (ally, enemy, yourself, minion or tower) opens its details; on the ground closes them
      const u = hoverTarget(this.world(), null, m.x, m.y, 60, true);
      this.onInspect(u ? u.id : -1);
    }
  }
  /** Called every frame: holding right mouse keeps steering (throttled to 8/s). */
  update() {
    const now = performance.now();
    if (this.mouse.right && !this.stroke && now - this.lastSteer > 125) {
      this.lastSteer = now; this.toWorld();
      const h = hoverTarget(this.world(), this.me, this.mouse.x, this.mouse.y);
      if (!(h && h.team !== this.me.team)) this.s.send(moveCmd(this.s.player, this.mouse.x, this.mouse.y));
    }
    if (this.aim.active) { this.toWorld(); this.aim.x = this.mouse.x; this.aim.y = this.mouse.y; }
  }
  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const p = this.s.player, code = e.code;
    if (code in SLOT_KEYS) {
      e.preventDefault(); const slot = SLOT_KEYS[code]; if (e.repeat) return;
      const a = aimFor(this.me, slot);
      if (down) {
        if (isDrawn(a)) { this.beginAim(slot, a); this.stroke = []; this.toWorld(); this.addStrokePoint(); }
        else if (e.shiftKey || this.holdPreview) this.beginAim(slot, a);
        else this.cast(slot, a);
      } else if (this.aim.active && this.aim.slot === slot) this.release(slot);
      return;
    }
    if (!down) { if (code === 'ShiftLeft' || code === 'ShiftRight') this.s.renderer.showRange = false; return; }
    if (e.repeat) return;
    switch (code) {
      case 'ShiftLeft': case 'ShiftRight': this.s.renderer.showRange = true; break;
      case 'KeyD': case 'KeyF': { const slot = code === 'KeyD' ? 0 : 1; this.toWorld(); const t = clampToRange(this.me, this.mouse.x, this.mouse.y, SPELL_AIM[0].range); this.s.send(spellCmd(p, slot, t.x, t.y)); break; }
      case 'KeyS': this.s.send(stopCmd(p)); break;
      case 'KeyA': this.attackArmed = true; break;
      case 'Escape': this.cancelAim(); this.attackArmed = false; this.onToggle('escape'); break;
      case 'Tab': e.preventDefault(); this.onToggle('scoreboard'); break;
      case 'KeyP': this.onToggle('shop'); break;
      case 'F3': e.preventDefault(); this.onToggle('perf'); break;
      default:
        if (code.startsWith('Digit')) { const i = +code.slice(5) - 1; if (i >= 0 && i < 6) { this.toWorld(); this.s.send(itemActiveCmd(p, i, this.mouse.x, this.mouse.y)); } }
    }
  }
  beginAim(slot, a) { Object.assign(this.aim, { active: true, slot, shape: a, x: this.mouse.x, y: this.mouse.y, pts: null }); }
  cancelAim() { this.aim.active = false; this.stroke = null; }
  addStrokePoint() {
    const s = this.stroke, m = this.mouse; const n = s.length;
    if (n >= 2 && (s[n - 2] - m.x) ** 2 + (s[n - 1] - m.y) ** 2 < 18 * 18) return;
    if (n >= 160) return;
    s.push(m.x, m.y); this.aim.pts = s;
  }
  cast(slot, a, x = this.mouse.x, y = this.mouse.y, pts = null) {
    const h = hoverTarget(this.world(), this.me, x, y);
    const id = h && (a.kind === 'ally' ? h.team === this.me.team : h.team !== this.me.team) ? h.id : -1;
    this.s.send(castCmd(this.s.player, slot, x, y, pts, id));
  }
  release(slot) {
    const a = this.aim.shape;
    if (this.stroke) {
      const pts = this.stroke; this.stroke = null; this.aim.active = false;
      // a real drag casts the drawn shape; a tap (no drag) casts the ability's default shape at the cursor
      if (pts.length >= 6) this.cast(slot, a, pts[pts.length - 2], pts[pts.length - 1], pts);
      else { this.toWorld(); this.cast(slot, a); }
      return;
    }
    this.aim.active = false; this.toWorld(); this.cast(slot, a);
  }
  dispose() { for (const f of this.off || []) f(); }
}
