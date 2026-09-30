// Client-side driver: runs the simulation at a fixed rate and renders at display
// rate, handing the renderer an interpolation alpha in [0, 1).
// With `background`, the simulation keeps running while the tab is hidden (browsers stop animation frames there):
// an online host or client must not freeze the match for everyone when a player switches tabs.
export class FixedLoop {
  constructor({ hz = 30, step, render, maxCatchUp = 5, now = () => performance.now(), background = false }) {
    this.dt = 1000 / hz; this.step = step; this.render = render; this.maxCatchUp = maxCatchUp; this.now = now;
    this.acc = 0; this.last = 0; this.running = false; this.frame = this.frame.bind(this);
    this.timeScale = 1; this.background = background; this.timer = 0;
    this.onVisibility = () => this.syncBackground();
  }
  start() {
    this.running = true; this.last = this.now(); requestAnimationFrame(this.frame);
    if (this.background && typeof document !== 'undefined') { document.addEventListener('visibilitychange', this.onVisibility); this.syncBackground(); }
  }
  stop() {
    this.running = false; clearInterval(this.timer); this.timer = 0;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }
  /** Hidden tab: step on a timer (catching up in real time, no rendering); visible again: back to frames. */
  syncBackground() {
    clearInterval(this.timer); this.timer = 0;
    if (!this.running || !document.hidden) { this.last = this.now(); return; }
    this.timer = setInterval(() => {
      const now = this.now(); this.acc += Math.min(2000, now - this.last) * this.timeScale; this.last = now;
      let n = 0; while (this.acc >= this.dt && n < 60) { this.step(); this.acc -= this.dt; n++; }
      if (n === 60) this.acc = 0;
    }, 50);
  }
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
