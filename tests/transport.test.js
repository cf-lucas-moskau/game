import { describe, it, expect } from 'vitest';
import { LocalTransport } from '../src/net/transport.js';
import { moveCmd } from '../src/sim/commands.js';

describe('LocalTransport', () => {
  it('delivers immediately with no simulated latency', () => {
    const t = new LocalTransport(); const out = [];
    t.send(moveCmd(0, 10, 20), 0); expect(t.receive(0, out).length).toBe(1);
  });
  it('delays by half the ping and never duplicates', () => {
    const t = new LocalTransport({ ping: 100, redundancy: 3 }); const out = [];
    t.send(moveCmd(0, 1, 1), 0);
    expect(t.receive(40, out).length).toBe(0);
    expect(t.receive(60, out).length).toBe(1);
    expect(t.receive(500, out).length).toBe(0);
  });
  it('masks 2% packet loss with redundancy', () => {
    const t = new LocalTransport({ ping: 100, jitter: 20, loss: 0.02, redundancy: 3, seed: 5 }); const out = [];
    let got = 0; for (let i = 0; i < 2000; i++) { t.send(moveCmd(0, i, 1), i * 10); got += t.receive(i * 10, out).length; }
    got += t.receive(1e9, out).length;
    expect(got).toBeGreaterThanOrEqual(1999);
  });
  it('rejects malformed commands', () => {
    const t = new LocalTransport();
    expect(t.send({ t: 1, p: 0, x: NaN, y: 1 }, 0)).toBe(false);
    expect(t.send({ t: 3, p: 0, s: 9, x: 1, y: 1 }, 0)).toBe(false);
  });
});
