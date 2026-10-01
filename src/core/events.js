// Simulation -> presentation event stream. The sim pushes plain records
// (type + numeric payload) into a ring buffer; render/audio/ui drain it each frame.
// Records are reused; consumers must copy what they keep.
export const EV = Object.freeze({
  DAMAGE: 1, HEAL: 2, DEATH: 3, CAST: 4, PROJECTILE_HIT: 5, TOWER_SHOT: 6, LEVEL_UP: 7,
  GOLD: 8, WHALE_WARN: 9, WHALE_ROLL: 10, WHALE_END: 11, STRUCTURE_DOWN: 12, RESPAWN: 13,
  ITEM_BOUGHT: 14, SHIELD: 15, STUN: 16, BLINK: 17, REWIND: 18, MATCH_END: 19, RELIC: 20,
  KILL: 21, AUTO_ATTACK: 22, FX: 23, SLOW: 24, ASSIST: 25,
  // map features: BUFF a = hero, s = buff key, v = seconds; OBJECTIVE s = what happened ('camp-up', 'camp-slain', ...),
  // a = credited hero or -1, b = team or -1; PICKUP a = hero, s = kind, v = value
  BUFF: 26, OBJECTIVE: 27, PICKUP: 28,
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
