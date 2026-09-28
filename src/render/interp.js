// The one place render positions are derived from sim state: interpolation between ticks plus the
// local player's prediction offset. Every view (units, bars, rings, camera, indicators) uses this.
export const view = { alpha: 1, predId: -1, ox: 0, oy: 0 };
export const rx = (e) => e.px + (e.x - e.px) * view.alpha + (e.id === view.predId ? view.ox : 0);
export const ry = (e) => e.py + (e.y - e.py) * view.alpha + (e.id === view.predId ? view.oy : 0);
