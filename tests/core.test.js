import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng.js';
import { SpatialHash } from '../src/core/spatial-hash.js';
import { EventStream } from '../src/core/events.js';
import { segIntersects, pointInPoly, segDist2 } from '../src/core/math.js';
import { Pool } from '../src/core/pool.js';

describe('Rng', () => {
  it('is deterministic per seed and restorable', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    const s = a.getState(); const v = a.next(); a.setState(s); expect(a.next()).toBe(v);
  });
  it('stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) { const v = r.int(3, 5); expect(v >= 3 && v <= 5).toBe(true); }
  });
});
describe('SpatialHash', () => {
  it('finds nearby ids and not far ones', () => {
    const h = new SpatialHash(4000, 900, 200);
    h.insert(1, 100, 100); h.insert(2, 3900, 800); h.insert(3, 150, 180);
    const out = new Int32Array(16); const n = h.query(120, 120, 100, out);
    const got = [...out.slice(0, n)].sort();
    expect(got).toEqual([1, 3]);
  });
});
describe('EventStream', () => {
  it('drains in order and overwrites oldest when full', () => {
    const s = new EventStream(3); for (let i = 1; i <= 4; i++) s.push(1, i);
    const ticks = []; s.drain(e => ticks.push(e.tick)); expect(ticks).toEqual([2, 3, 4]);
  });
});
describe('geometry', () => {
  it('segments and polygons', () => {
    expect(segIntersects(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segIntersects(0, 0, 1, 1, 5, 5, 6, 7)).toBe(false);
    expect(pointInPoly(5, 5, [0, 0, 10, 0, 10, 10, 0, 10])).toBe(true);
    expect(segDist2(5, 5, 0, 0, 10, 0)).toBe(25);
  });
});
describe('Pool', () => {
  it('reuses released objects', () => {
    const p = new Pool(() => ({ v: 0 }), o => { o.v = 0; }, 1);
    const a = p.acquire(); a.v = 3; p.release(a); expect(p.acquire()).toBe(a); expect(a.v).toBe(0);
  });
});
