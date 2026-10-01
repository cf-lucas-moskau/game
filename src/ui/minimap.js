// The lane strip: the whole whale lane across the top of the screen (structures, minions, heroes,
// camera window, whale-roll warning). Canvas 2D, redrawn at 15 Hz with no per-draw allocation.
import { LANE, KIND } from '../sim/constants.js';
import { S } from '../render/palette.js';

const COL = { 0: '#45c4e6', 1: '#f0476e' }, DIM = { 0: 'rgba(69,196,230,.35)', 1: 'rgba(240,71,110,.35)' };
export class LaneStrip {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.next = 0; this.w = 0; this.h = 0; this.css = null;
    // size from a ResizeObserver: reading layout (getBoundingClientRect) per redraw would force a synchronous layout
    this.ro = new ResizeObserver((entries) => { const r = entries[entries.length - 1].contentRect; this.css = { w: r.width, h: r.height }; });
    this.ro.observe(canvas);
  }
  fit() {
    if (!this.css) return;
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(this.css.w * dpr), h = Math.round(this.css.h * dpr);
    if (w && h && (w !== this.w || h !== this.h)) { this.c.width = this.w = w; this.c.height = this.h = h; }
  }
  dispose() { this.ro.disconnect(); }
  sx(x) { const pad = this.h * 0.5; return pad + (x / LANE.W) * (this.w - pad * 2); }
  sy(y) { return this.h * 0.15 + (y / LANE.H) * this.h * 0.7; }
  /** Structures and the spine change rarely: cache them on a layer, redrawn only when their state changes. */
  staticLayer(world) {
    let sig = this.w * 7 + this.h;
    for (const st of world.structures) sig = (sig * 31 + (st.alive ? 1 + (st.vulnerable ? 2 : 0) + Math.ceil(st.hp / st.maxHp * 20) * 4 : 0)) | 0;
    if (this.layer && sig === this.layerSig) return this.layer;
    const { w, h } = this;
    if (!this.layer) this.layer = document.createElement('canvas');
    if (this.layer.width !== w || this.layer.height !== h) { this.layer.width = w; this.layer.height = h; }
    const ctx = this.layer.getContext('2d'); ctx.clearRect(0, 0, w, h);
    const pad = h * 0.5;
    ctx.strokeStyle = 'rgba(232,220,196,.18)'; ctx.lineWidth = Math.max(1, h * 0.04);
    ctx.beginPath(); ctx.moveTo(pad, h / 2); ctx.lineTo(w - pad, h / 2); ctx.stroke();
    for (const st of world.structures) {
      const x = this.sx(st.x), y = h / 2, r = st.kind === KIND.HEART ? h * 0.2 : h * 0.15;
      if (!st.alive) { ctx.strokeStyle = 'rgba(232,220,196,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x - r, y - r, r * 2, r * 2); continue; }
      ctx.fillStyle = COL[st.team]; ctx.globalAlpha = st.vulnerable ? 1 : 0.55;
      if (st.kind === KIND.HEART) { ctx.beginPath(); ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      const f = st.hp / st.maxHp; if (f < 0.999) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - r, y + r + 1, r * 2, 2.5); ctx.fillStyle = COL[st.team]; ctx.fillRect(x - r, y + r + 1, r * 2 * f, 2.5); }
    }
    this.layerSig = sig; return this.layer;
  }
  update(world, me, renderer, now) {
    if (now < this.next) return; this.next = now + 66;
    this.fit(); const { ctx, w, h } = this; if (!w) return;
    const pad = h * 0.5;
    ctx.clearRect(0, 0, w, h);
    // whale-roll warning: the endangered edge glows
    const wh = world.state.whale;
    if (wh.phase !== 'idle' && (wh.phase === 'roll' || ((now / 180) | 0) % 2 === 0)) {
      ctx.fillStyle = wh.phase === 'roll' ? 'rgba(240,71,110,.55)' : 'rgba(247,178,103,.55)';
      const y = wh.dir > 0 ? this.sy(LANE.EDGE_MAX) : this.sy(0);
      ctx.fillRect(pad, y, w - pad * 2, wh.dir > 0 ? this.sy(LANE.H) - y : this.sy(LANE.EDGE_MIN) - y);
    }
    ctx.drawImage(this.staticLayer(world), 0, 0);
    // camera window
    if (renderer) {
      const cx = renderer.cam.x / S, half = 900;
      ctx.strokeStyle = 'rgba(232,220,196,.45)'; ctx.lineWidth = Math.max(1, h * 0.04);
      ctx.strokeRect(this.sx(cx - half), h * 0.1, this.sx(cx + half) - this.sx(cx - half), h * 0.8);
    }
    // minions: one path and one fill per team
    const ents = world.entities, mr = Math.max(1.2, h * 0.045);
    for (let team = 0; team < 2; team++) {
      ctx.beginPath();
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i]; if (!e.alive || e.dead || e.team !== team || (e.kind !== KIND.MELEE && e.kind !== KIND.RANGED && e.kind !== KIND.SIEGE)) continue;
        ctx.rect(this.sx(e.x) - mr, this.sy(e.y) - mr, mr * 2, mr * 2);
      }
      ctx.fillStyle = DIM[team]; ctx.fill();
    }
    // relics
    if (world.pickups.length) { ctx.beginPath(); for (const p of world.pickups) { const x = this.sx(p.x), y = this.sy(p.y); ctx.moveTo(x + mr * 1.4, y); ctx.arc(x, y, mr * 1.4, 0, Math.PI * 2); } ctx.fillStyle = '#7ee07a'; ctx.fill(); }
    // neutral camps: a gold diamond while the crab is up, a faint ring while it is down
    const camps = world.state.camps;
    if (camps) for (const c of camps) {
      const x = this.sx(c.x), y = this.sy(c.y), r = mr * 1.9;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
      if (c.crabId >= 0) { ctx.fillStyle = '#f2c14e'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(242,193,78,.45)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // heroes
    const hr = Math.max(3, h * 0.13); ctx.lineWidth = Math.max(1, h * 0.04);
    for (const e of world.heroes) {
      if (e.dead) continue;
      ctx.beginPath(); ctx.arc(this.sx(e.x), this.sy(e.y), e === me ? hr * 1.2 : hr, 0, Math.PI * 2);
      ctx.fillStyle = COL[e.team]; ctx.fill();
      ctx.strokeStyle = e === me ? '#fff' : 'rgba(12,14,36,.9)'; ctx.stroke();
    }
  }
}
