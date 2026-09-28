// Transport: the only path from input devices/bots to the simulation.
// LocalTransport runs the authoritative sim in-process and can simulate network conditions
// (ping, jitter, packet loss) so prediction and smoothing are testable before a server exists.
// A NetTransport (WebSocket to the Node.js server) implements the same interface.
import { Rng } from '../core/rng.js';
import { validCommand } from '../sim/commands.js';

export class LocalTransport {
  /** @param {{ping?:number, jitter?:number, loss?:number, redundancy?:number, seed?:number}} o */
  constructor(o = {}) {
    this.setConditions(o);
    this.rng = new Rng(o.seed || 12345); // transport randomness never touches the sim RNG
    this.inflight = []; // {deliverAt, cmd, seq}
    this.seq = 0; this.delivered = new Set(); this.stats = { sent: 0, lost: 0, delivered: 0 };
  }
  setConditions({ ping = 0, jitter = 0, loss = 0, redundancy = 3 } = {}) { this.ping = ping; this.jitter = jitter; this.loss = loss; this.redundancy = redundancy; }
  /** Send a command at client time `now` (ms). Each command rides in `redundancy` packets. */
  send(cmd, now) {
    if (!validCommand(cmd)) return false;
    const seq = ++this.seq; this.stats.sent++;
    if (this.ping === 0 && this.loss === 0) { this.inflight.push({ deliverAt: now, cmd, seq }); return true; }
    for (let k = 0; k < this.redundancy; k++) {
      if (this.rng.chance(this.loss)) { this.stats.lost++; continue; }
      const oneWay = this.ping / 2 + this.rng.range(-this.jitter, this.jitter) + k * 16; // each redundant copy rides the next packet
      this.inflight.push({ deliverAt: now + Math.max(0, oneWay), cmd, seq });
    }
    return true;
  }
  /** Commands that have arrived by `now`, in send order, deduplicated. */
  receive(now, out) {
    out.length = 0;
    let w = 0;
    this.inflight.sort((a, b) => a.deliverAt - b.deliverAt || a.seq - b.seq);
    for (const p of this.inflight) {
      if (p.deliverAt <= now) { if (!this.delivered.has(p.seq)) { this.delivered.add(p.seq); out.push(p); } }
      else this.inflight[w++] = p;
    }
    this.inflight.length = w;
    out.sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < out.length; i++) out[i] = out[i].cmd;
    this.stats.delivered += out.length;
    if (this.delivered.size > 4096) this.delivered = new Set([...this.delivered].slice(-1024));
    return out;
  }
  get rtt() { return this.ping; }
}
