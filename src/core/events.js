// Simulation -> presentation event stream. The sim pushes plain records
// (type + numeric payload) into a ring buffer; render/audio/ui drain it each frame.
// Records are reused; consumers must copy what they keep.
export const EV = Object.freeze({
  DAMAGE: 1, HEAL: 2, DEATH: 3, CAST: 4, PROJECTILE_HIT: 5, TOWER_SHOT: 6, LEVEL_UP: 7,
  GOLD: 8, WHALE_WARN: 9, WHALE_ROLL: 10, WHALE_END: 11, STRUCTURE_DOWN: 12, RESPAWN: 13,
  ITEM_BOUGHT: 14, SHIELD: 15, STUN: 16, BLINK: 17, REWIND: 18, MATCH_END: 19, RELIC: 20,
  KILL: 21, AUTO_ATTACK: 22, FX: 23, SLOW: 24, ASSIST: 25,
});
export class EventStream {
  constructor(capacity = 2048) {
    this.buf = Array.from({ length: capacity }, () => ({ type: 0, tick: 0, a: 0, b: 0, x: 0, y: 0, v: 0, s: '', c: 0 }));
    this.cap = capacity; this.head = 0; this.len = 0;
  }
  push(type, tick, a = 0, b = 0, x = 0, y = 0, v = 0, s = '', c = 0) {
    const e = this.buf[(this.head + this.len) % this.cap];
    if (this.len < this.cap) this.len++; else this.head = (this.head + 1) % this.cap;
    e.type = type; e.tick = tick; e.a = a; e.b = b; e.x = x; e.y = y; e.v = v; e.s = s; e.c = c;
    return e;
  }
  drain(fn) {
    while (this.len) { const e = this.buf[this.head]; this.head = (this.head + 1) % this.cap; this.len--; fn(e); }
  }
}
