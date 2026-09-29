import { describe, it, expect } from 'vitest';
import { mtof, degree, chord, spatial, Throttle, intensityFor, sixteenth, SCALE, PROGRESSION } from '../src/audio/theory.js';

describe('audio theory', () => {
  it('maps MIDI notes to frequencies', () => {
    expect(mtof(69)).toBeCloseTo(440);
    expect(mtof(81)).toBeCloseTo(880);
  });
  it('builds D dorian degrees and chords across octaves', () => {
    expect(degree(0)).toBe(50); // D3
    expect(degree(7)).toBe(62); // D4
    expect(degree(-1)).toBe(50 - 12 + SCALE[6]); // C3
    expect(chord(0)).toEqual([50, 53, 57]); // D F A
    expect(chord(0, true)).toHaveLength(4);
    for (const d of PROGRESSION) for (const n of chord(d)) expect(SCALE).toContain(((n - 50) % 12 + 12) % 12);
  });
  it('places sounds by camera distance', () => {
    expect(spatial(1000, 1000)).toEqual({ pan: 0, gain: 1 });
    expect(spatial(3000, 1000).pan).toBe(1);
    expect(spatial(-500, 1000).pan).toBeLessThan(0);
    expect(spatial(5000, 1000).gain).toBe(0);
  });
  it('rate-limits each sound independently', () => {
    const t = new Throttle({ hit: 0.1 });
    expect(t.ok('hit', 0)).toBe(true);
    expect(t.ok('hit', 0.05)).toBe(false);
    expect(t.ok('other', 0.05)).toBe(true);
    expect(t.ok('hit', 0.12)).toBe(true);
  });
  it('raises intensity with combat and sudden death, lowers it when dead or in menus', () => {
    const lane = intensityFor({}), fight = intensityFor({ combat: true }), sd = intensityFor({ suddenDeath: true });
    expect(fight).toBeGreaterThan(lane); expect(sd).toBeGreaterThan(fight);
    expect(intensityFor({ combat: true, dead: true })).toBeLessThan(lane);
    expect(intensityFor({ inMenu: true })).toBeLessThan(lane);
    expect(sixteenth(120)).toBeCloseTo(0.125);
  });
});
