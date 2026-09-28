// Transport: the only path from input devices/bots to the simulation.
// LocalTransport runs the authoritative sim in-process and can simulate network conditions
// (ping, jitter, packet loss) so prediction and smoothing are testable before a server exists.
// A NetTransport (WebSocket to the Node.js server) implements the same interface.
// Allocation-free in steady state: packet records are pooled and dedupe uses a sequence ring.
import { Rng } from '../core/rng.js';
import { validCommand } from '../sim/commands.js';

const RING = 4096;
export class LocalTransport {
  /** @param {{ping?:number, jitter?:number, loss?:number, redundancy?:number, seed?:number}} o */
  constructor(o = {}) {
    this.setConditions(o);
    this.rng = new Rng(o.seed || 12345); // transport randomness never touches the sim RNG
    this.inflight = []; this.pool = [];
    this.seq = 0; this.seen = new Int32Array(RING).fill(-1); this.stats = { sent: 0, lost: 0, delivered: 0 };
  }
  setConditions({ ping = 0, jitter = 0, loss = 0, redundancy = 3 } = {}) { this.ping = ping; this.jitter = jitter; this.loss = loss; this.redundancy = redundancy; }
  packet(deliverAt, cmd, seq) { const p = this.pool.pop() || { deliverAt: 0, cmd: null, seq: 0 }; p.deliverAt = deliverAt; p.cmd = cmd; p.seq = seq; this.inflight.push(p); }
  /** Send a command at client time `now` (ms). Each command rides in `redundancy` packets. */
  send(cmd, now) {
    if (!validCommand(cmd)) return false;
    const seq = ++this.seq; this.stats.sent++;
    if (this.ping === 0 && this.loss === 0) { this.packet(now, cmd, seq); return true; }
    for (let k = 0; k < this.redundancy; k++) {
      if (this.rng.chance(this.loss)) { this.stats.lost++; continue; }
      const oneWay = this.ping / 2 + this.rng.range(-this.jitter, this.jitter) + k * 16; // each redundant copy rides the next packet
      this.packet(now + Math.max(0, oneWay), cmd, seq);
    }
    return true;
  }
  /** Commands that have arrived by `now`, in send order, deduplicated. Fills and returns `out`. */
  receive(now, out) {
    out.length = 0;
    const list = this.inflight, seen = this.seen, seqs = this._seqs || (this._seqs = []);
    seqs.length = 0;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.deliverAt > now) { list[w++] = p; continue; }
      const slot = p.seq & (RING - 1);
      if (seen[slot] !== p.seq) { seen[slot] = p.seq; // insertion by sequence number (arrivals can reorder under jitter)
        let j = out.length; out.push(p.cmd); seqs.push(p.seq);
        while (j > 0 && seqs[j - 1] > p.seq) { out[j] = out[j - 1]; seqs[j] = seqs[j - 1]; j--; }
        out[j] = p.cmd; seqs[j] = p.seq;
      }
      p.cmd = null; this.pool.push(p);
    }
    list.length = w;
    this.stats.delivered += out.length;
    return out;
  }
  get rtt() { return this.ping; }
}
