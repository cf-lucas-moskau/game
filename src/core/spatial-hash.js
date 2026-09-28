// Uniform-grid spatial hash rebuilt every tick. Queries write into a caller-owned
// array to avoid allocation. Entities are referenced by integer id.
export class SpatialHash {
  constructor(width, height, cell = 200, capacity = 4096) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell) + 2;
    this.rows = Math.ceil(height / cell) + 2;
    const n = this.cols * this.rows;
    this.heads = new Int32Array(n).fill(-1);
    this.next = new Int32Array(capacity);
    this.ids = new Int32Array(capacity);
    this.count = 0;
    this.stamp = new Uint32Array(capacity);
    this.stampId = 1;
  }
  clear() { this.heads.fill(-1); this.count = 0; }
  _cell(x, y) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell) + 1));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell) + 1));
    return cy * this.cols + cx;
  }
  insert(id, x, y) {
    const c = this._cell(x, y), i = this.count++;
    this.ids[i] = id; this.next[i] = this.heads[c]; this.heads[c] = i;
  }
  /** Collect ids whose cell overlaps the circle's bounding box into out; returns count. */
  query(x, y, r, out) {
    const cs = this.cell;
    const x0 = Math.max(0, Math.floor((x - r) / cs) + 1), x1 = Math.min(this.cols - 1, Math.floor((x + r) / cs) + 1);
    const y0 = Math.max(0, Math.floor((y - r) / cs) + 1), y1 = Math.min(this.rows - 1, Math.floor((y + r) / cs) + 1);
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = this.heads[cy * this.cols + cx]; i !== -1; i = this.next[i]) out[n++] = this.ids[i];
    }
    return n;
  }
}
