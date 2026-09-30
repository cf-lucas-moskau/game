// Cross-engine determinism: online play runs the same sim on every player's machine from one command stream, so
// the sim may only use arithmetic that is bit-identical in every JavaScript engine.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sin, cos, atan2, atan, hypot, sq } from '../src/core/dmath.js';

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; });
// engine-approximated math, randomness and wall clocks have no place in the simulation
const FORBIDDEN = /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log1p|log2|log10|pow|hypot|cbrt|random)\b|\*\*|Date\.now|performance\.now/;

describe('cross-engine determinism', () => {
  it('the sim and core use only deterministic math (src/core/dmath.js)', () => {
    const bad = [];
    for (const f of [...files('src/sim'), ...files('src/core')]) {
      if (f.endsWith('dmath.js') || f.endsWith('fixed-loop.js')) continue; // the frame loop reads the clock; it never touches sim state
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\/?\*.*$/, ''); // comments may mention them
        if (FORBIDDEN.test(code)) bad.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });
  it('dmath matches the engine within an ulp or two', () => {
    let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 20000; i++) {
      const x = (r() - 0.5) * 2e4, y = (r() - 0.5) * 8000, z = (r() - 0.5) * 8000;
      expect(Math.abs(sin(x) - Math.sin(x))).toBeLessThan(1e-15);
      expect(Math.abs(cos(x) - Math.cos(x))).toBeLessThan(1e-15);
      expect(Math.abs(atan2(y, z) - Math.atan2(y, z))).toBeLessThan(2e-15);
      expect(Math.abs(hypot(y, z) - Math.hypot(y, z))).toBeLessThan(Math.hypot(y, z) * 1e-15);
    }
    expect([atan2(0, 0), atan2(0, -1), atan2(1, 0), atan2(-1, 0)]).toEqual([0, Math.PI, Math.PI / 2, -Math.PI / 2]);
    expect(sq(-3)).toBe(9); expect(atan(1)).toBe(Math.PI / 4); expect(sin(0)).toBe(0); expect(cos(0)).toBe(1);
  });
  it('dmath is pinned: fixed inputs give these exact bits (a change here breaks online matches between versions)', () => {
    const bits = (v) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, v); return b.getBigUint64(0).toString(16); };
    expect([sin(1.234), cos(-5.678), atan2(3.3, -7.1), hypot(3.1, 4.2)].map(bits)).toEqual(PINNED);
  });
});
const PINNED = ["3fee33c23ed44442","3fea5112dbd01f75","4005a6ee08da21ef","4014e16fdacff937"];
