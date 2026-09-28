// Fixed-capacity object pool. Hot paths acquire/release instead of allocating,
// so gameplay produces no garbage and no GC pauses.
export class Pool {
  constructor(factory, reset, initial = 64) {
    this.factory = factory; this.reset = reset;
    this.free = [];
    for (let i = 0; i < initial; i++) this.free.push(factory());
    this.created = initial;
  }
  acquire() {
    const o = this.free.length ? this.free.pop() : (this.created++, this.factory());
    return o;
  }
  release(o) { this.reset(o); this.free.push(o); }
}
