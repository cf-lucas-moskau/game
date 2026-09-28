// The lane strip: the whole whale lane across the top of the screen (structures, minions, heroes,
// camera window, whale-roll warning). Canvas 2D, redrawn at 15 Hz with no per-draw allocation.
import { LANE, KIND } from '../sim/constants.js';
import { S } from '../render/palette.js';

const COL = { 0: '#45c4e6', 1: '#f0476e' }, DIM = { 0: 'rgba(69,196,230,.35)', 1: 'rgba(240,71,110,.35)' };
export class LaneStrip {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.next = 0; this.w = 0; this.h = 0; }
  fit() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w && h && (w !== this.w || h !== this.h)) { this.c.width = this.w = w; this.c.height = this.h = h; }
  }
  update(world, me, renderer, now) {
    if (now < this.next) return; this.next = now + 66;
    this.fit(); const { ctx, w, h } = this; if (!w) return;
    const pad = h * 0.5, sx = (x) => pad + (x / LANE.W) * (w - pad * 2), sy = (y) => h * 0.15 + (y / LANE.H) * h * 0.7;
    ctx.clearRect(0, 0, w, h);
    // whale-roll warning: the endangered edge glows
    const wh = world.state.whale;
    if (wh.phase !== 'idle') {
      const on = wh.phase === 'roll' || ((now / 180) | 0) % 2 === 0;
      if (on) { ctx.fillStyle = wh.phase === 'roll' ? 'rgba(240,71,110,.55)' : 'rgba(247,178,103,.55)'; const y = wh.dir > 0 ? sy(LANE.EDGE_MAX) : sy(0); ctx.fillRect(pad, y, w - pad * 2, wh.dir > 0 ? sy(LANE.H) - y : sy(LANE.EDGE_MIN) - y); }
    }
    // spine of the lane
    ctx.strokeStyle = 'rgba(232,220,196,.18)'; ctx.lineWidth = Math.max(1, h * 0.04);
    ctx.beginPath(); ctx.moveTo(pad, h / 2); ctx.lineTo(w - pad, h / 2); ctx.stroke();
    // camera window
    if (renderer) {
      const cx = renderer.cam.x / S, half = 900;
      ctx.strokeStyle = 'rgba(232,220,196,.45)'; ctx.lineWidth = Math.max(1, h * 0.04);
      ctx.strokeRect(sx(cx - half), h * 0.1, sx(cx + half) - sx(cx - half), h * 0.8);
    }
    const ents = world.entities;
    // minions
    const mr = Math.max(1.2, h * 0.045);
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i]; if (!e.alive || e.dead || (e.kind !== KIND.MELEE && e.kind !== KIND.RANGED && e.kind !== KIND.SIEGE)) continue;
      ctx.fillStyle = DIM[e.team]; ctx.fillRect(sx(e.x) - mr, sy(e.y) - mr, mr * 2, mr * 2);
    }
    // structures
    for (const s of world.structures) {
      const x = sx(s.x), y = h / 2, r = s.kind === KIND.HEART ? h * 0.2 : h * 0.15;
      if (!s.alive) { ctx.strokeStyle = 'rgba(232,220,196,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x - r, y - r, r * 2, r * 2); continue; }
      ctx.fillStyle = COL[s.team]; ctx.globalAlpha = s.vulnerable ? 1 : 0.55;
      if (s.kind === KIND.HEART) { ctx.beginPath(); ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      const f = s.hp / s.maxHp; if (f < 0.999) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - r, y + r + 1, r * 2, 2.5); ctx.fillStyle = COL[s.team]; ctx.fillRect(x - r, y + r + 1, r * 2 * f, 2.5); }
    }
    // heroes
    const hr = Math.max(3, h * 0.13);
    for (const e of world.heroes) {
      if (e.dead) continue;
      const x = sx(e.x), y = sy(e.y);
      ctx.beginPath(); ctx.arc(x, y, e === me ? hr * 1.2 : hr, 0, Math.PI * 2);
      ctx.fillStyle = COL[e.team]; ctx.fill();
      ctx.lineWidth = Math.max(1, h * 0.04); ctx.strokeStyle = e === me ? '#fff' : 'rgba(12,14,36,.9)'; ctx.stroke();
    }
    for (const p of world.pickups) { ctx.fillStyle = '#7ee07a'; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), mr * 1.4, 0, Math.PI * 2); ctx.fill(); }
  }
}
