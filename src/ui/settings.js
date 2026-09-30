// Player settings: persisted per browser, applied live where possible.
const KEY = 'leviathan-lane:settings';
export const DEFAULTS = { quality: 'auto', shake: 1, ping: 0, damageNumbers: true, cursor: 'game', difficulty: 'medium', hero: '', skin: 'classic', name: '', volume: 0.8, music: 0.6, sfx: 1 };
export const OPTIONS = {
  quality: [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
  shake: [[0, 'Off'], [0.5, 'Low'], [1, 'Full']],
  ping: [[0, 'Off'], [50, '50 ms'], [100, '100 ms'], [200, '200 ms']],
  damageNumbers: [[true, 'On'], [false, 'Off']],
  cursor: [['game', 'Game'], ['system', 'System']],
  difficulty: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']],
  volume: [[0, 'Off'], [0.4, '40%'], [0.8, '80%'], [1, '100%']],
  music: [[0, 'Off'], [0.3, 'Low'], [0.6, 'Medium'], [1, 'High']],
  sfx: [[0, 'Off'], [0.5, 'Low'], [1, 'Full']],
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
