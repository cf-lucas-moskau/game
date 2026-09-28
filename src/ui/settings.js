// Player settings: persisted per browser, applied live where possible.
const KEY = 'leviathan-lane:settings';
export const DEFAULTS = { quality: 'auto', shake: 1, ping: 0, damageNumbers: true, difficulty: 'medium' };
export const OPTIONS = {
  quality: [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
  shake: [[0, 'Off'], [0.5, 'Low'], [1, 'Full']],
  ping: [[0, 'Off'], [50, '50 ms'], [100, '100 ms'], [200, '200 ms']],
  damageNumbers: [[true, 'On'], [false, 'Off']],
  difficulty: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']],
};
export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const k in DEFAULTS) if (k in s) this.values[k] = s[k]; } catch { /* storage blocked: defaults */ }
    this.listeners = new Set();
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    this.values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* not persisted */ }
    for (const f of this.listeners) f(k, v);
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
}
