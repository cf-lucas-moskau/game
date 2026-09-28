// Client-side prediction for the local hero (presentation only; the sim stays authoritative).
// While a move command is in flight, the rendered hero already walks toward the target at its own
// speed; once the server has applied it, the rendered position eases onto the authoritative one.
// A visible snap (>= CORRECTION_UNITS after easing) is counted as a correction.
import { moveSpeed } from '../sim/stats.js';
import { CMD } from '../sim/commands.js';

const CORRECTION_UNITS = 90;
export class Predictor {
  constructor(world, me, telemetry) {
    this.world = world; this.me = me; this.tel = telemetry;
    this.id = me.id; this.inflight = 0; this.target = null; this.px = me.x; this.py = me.y;
    this.ox = 0; this.oy = 0; this.lastFrame = 0; this.snapping = false;
  }
  onLocalCommand(cmd, now) {
    if (cmd.t === CMD.MOVE || cmd.t === CMD.ATTACK_MOVE) { this.inflight++; this.target = { x: cmd.x, y: cmd.y }; }
    else if (cmd.t === CMD.STOP) { this.inflight++; this.target = null; }
  }
  onAck(cmd) { if (cmd.t === CMD.MOVE || cmd.t === CMD.ATTACK_MOVE || cmd.t === CMD.STOP) this.inflight = Math.max(0, this.inflight - 1); }
  afterTick() {}
  /** Compute the render offset for this frame. */
  frame(alpha, now) {
    const e = this.me, w = this.world;
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0; this.lastFrame = now;
    const ax = e.px + (e.x - e.px) * alpha, ay = e.py + (e.y - e.py) * alpha;
    if (e.dead || e.dashUntil > w.tick || e.knockUntil > w.tick) { this.px = ax; this.py = ay; this.ox = this.oy = 0; return; }
    if (this.inflight > 0 && this.target && e.stunUntil <= w.tick && e.rootUntil <= w.tick) {
      const dx = this.target.x - this.px, dy = this.target.y - this.py, d = Math.sqrt(dx * dx + dy * dy);
      const step = moveSpeed(w, e) * dt;
      if (d > 1) { const k = Math.min(1, step / d); this.px += dx * k; this.py += dy * k; }
    } else {
      // converge on authority (critically damped feel, ~80 ms)
      const k = 1 - Math.exp(-dt * 12);
      this.px += (ax - this.px) * k; this.py += (ay - this.py) * k;
    }
    let ox = this.px - ax, oy = this.py - ay; const err = Math.sqrt(ox * ox + oy * oy);
    if (err > 260) { this.px = ax; this.py = ay; ox = oy = 0; } // teleports (blink, rewind, respawn) are not predicted
    if (this.inflight === 0 && err > CORRECTION_UNITS) { if (!this.snapping) { this.snapping = true; if (this.tel) this.tel.corrections++; } }
    else if (err < CORRECTION_UNITS * 0.5) this.snapping = false;
    this.ox = ox; this.oy = oy;
  }
}
