// Client-side driver: runs the simulation at a fixed rate and renders at display
// rate, handing the renderer an interpolation alpha in [0, 1).
export class FixedLoop {
  constructor({ hz = 30, step, render, maxCatchUp = 5, now = () => performance.now() }) {
    this.dt = 1000 / hz; this.step = step; this.render = render; this.maxCatchUp = maxCatchUp; this.now = now;
    this.acc = 0; this.last = 0; this.running = false; this.frame = this.frame.bind(this);
    this.timeScale = 1;
  }
  start() { this.running = true; this.last = this.now(); requestAnimationFrame(this.frame); }
  stop() { this.running = false; }
  frame(t) {
    if (!this.running) return;
    const now = this.now();
    let elapsed = (now - this.last) * this.timeScale; this.last = now;
    if (elapsed > 250) elapsed = 250; // tab was hidden; don't spiral
    this.acc += elapsed;
    let n = 0;
    while (this.acc >= this.dt && n < this.maxCatchUp) { this.step(); this.acc -= this.dt; n++; }
    if (n === this.maxCatchUp) this.acc = 0;
    this.render(this.acc / this.dt, t);
    requestAnimationFrame(this.frame);
  }
}
