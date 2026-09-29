// Generative music on the Web Audio clock: a D-dorian progression with a soft pad, a plucked
// arpeggio and light percussion. Intensity (0..1) thins or fills the arrangement and opens the pad
// filter; tempo rises in sudden death. A lookahead scheduler queues notes 0.25 s ahead, so the
// timer's jitter never reaches the beat.
import { tone, noise, Pad } from './synth.js';
import { mtof, chord, PROGRESSION, sixteenth } from './theory.js';

const LOOKAHEAD = 0.25, TICK_MS = 50;
export class MusicDirector {
  constructor(engine) {
    this.e = engine; this.intensity = 0.2; this.bpm = 84; this.step = 0; this.next = 0; this.timer = 0;
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }
  stop() { clearInterval(this.timer); this.timer = 0; this.next = 0; if (this.pad) this.pad.silence(this.e.now); }
  set(intensity, bpm) { this.intensity = intensity; if (bpm) this.bpm = bpm; }
  schedule() {
    const e = this.e; if (!e.ready) return;
    if (this.next < e.now) this.next = e.now + 0.05; // (re)start or recover from a suspended context
    while (this.next < e.now + LOOKAHEAD) { this.note(this.step, this.next); this.next += sixteenth(this.bpm); this.step++; }
  }
  note(step, t) {
    const e = this.e, bus = e.music, I = this.intensity, s16 = step % 16, bar = Math.floor(step / 16);
    const deg = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length], notes = chord(deg, I > 0.6);
    // pad: persistent detuned voices glide to a new chord every two bars
    if (s16 === 0 && bar % 2 === 0) {
      if (!this.pad) this.pad = new Pad(e);
      this.pad.chord(t, notes.map(mtof), mtof(notes[0] - 12), I);
    }
    // arpeggio: eighth notes, denser and higher as intensity rises
    const density = 0.25 + I * 0.6;
    if (s16 % 2 === 0 && Math.random() < density) {
      const n = notes[(step / 2 + bar) % notes.length] + (Math.random() < I * 0.5 ? 24 : 12);
      tone(e, bus, { type: 'triangle', f0: mtof(n), t, dur: 0.35, gain: 0.035 + I * 0.02, attack: 0.004 });
    }
    // percussion: soft kick on the beat once there is some tension, hats when it is high
    if (I >= 0.4 && s16 % 8 === 0) tone(e, bus, { type: 'sine', f0: 120, f1: 45, t, dur: 0.22, gain: 0.16 * I });
    if (I >= 0.4 && s16 === 12 && Math.random() < I) noise(e, bus, { type: 'bandpass', f0: 1800, t, dur: 0.12, gain: 0.05 * I, q: 1.2 });
    if (I >= 0.7 && s16 % 2 === 1) noise(e, bus, { type: 'highpass', f0: 7000, t, dur: 0.03, gain: 0.02 + 0.015 * (s16 % 4 === 3) });
  }
}
