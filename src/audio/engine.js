// Web Audio engine: one context (created and resumed on the first user gesture), a master chain
// (master gain -> compressor -> output), separate music and sfx buses, a shared noise buffer and a
// voice budget so bursts of combat never pile up hundreds of nodes.
const BUDGET = { sfx: 28, music: 22 };
// measured: peaks about 0.15 at unity (20 s of autopilot combat); the compressor catches the rest
const MAKEUP = 2.4;
export class AudioEngine {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.voices = { sfx: 0, music: 0 }; this.dropped = 0; this.played = 0;
    settings.on((k) => { if (k === 'volume' || k === 'music' || k === 'sfx') this.applyVolumes(); });
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true); addEventListener('touchend', unlock, true);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (this.unlocked) this.ctx.resume(); });
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  /** Must run inside a user gesture the first time (browser autoplay rules). */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.create(AC);
    this.unlocked = true;
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  }
  create(AC) {
    const c = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain(); this.musicTone = c.createBiquadFilter(); this.musicTone.type = 'lowpass'; this.musicTone.frequency.value = 18000;
    this.music.connect(this.musicTone).connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    this.applyVolumes();
  }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.settings;
    this.master.gain.setTargetAtTime(s.get('volume') * MAKEUP, t, 0.05);
    this.music.gain.setTargetAtTime(s.get('music') * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.get('sfx'), t, 0.05);
  }
  /** Muffle the music (respawn screen, menus over a match). */
  muffle(on) { if (this.ctx) this.musicTone.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.25); }
  /** Reserve a voice on a bus ('sfx' | 'music'); false when its budget is spent (the sound is skipped). */
  claim(bus) {
    if (!this.ready) return false;
    if (this.voices[bus] >= BUDGET[bus]) { this.dropped++; return false; }
    this.voices[bus]++; this.played++; return true;
  }
  release(bus) { this.voices[bus] = Math.max(0, this.voices[bus] - 1); }
}
