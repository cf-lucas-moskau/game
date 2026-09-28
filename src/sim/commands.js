// Command schema shared by input devices, bots and the network transport.
// Every command is a plain, JSON-serializable object stamped with a tick and player id.
export const CMD = Object.freeze({ MOVE: 1, ATTACK: 2, CAST: 3, STOP: 4, BUY: 5, SELL: 6, SPELL: 7, ATTACK_MOVE: 8, SWAP: 9, ITEM_ACTIVE: 10, PICK_HERO: 11 });

export const moveCmd = (player, x, y) => ({ t: CMD.MOVE, p: player, x: Math.round(x), y: Math.round(y) });
export const attackCmd = (player, id) => ({ t: CMD.ATTACK, p: player, id });
export const attackMoveCmd = (player, x, y) => ({ t: CMD.ATTACK_MOVE, p: player, x: Math.round(x), y: Math.round(y) });
/** slot 0..3 = Q W E R; pts = optional flat stroke [x0,y0,...] for drawn abilities */
export const castCmd = (player, slot, x, y, pts = null, targetId = -1) => ({ t: CMD.CAST, p: player, s: slot, x: Math.round(x), y: Math.round(y), pts: pts ? quantizeStroke(pts) : null, id: targetId });
export const spellCmd = (player, slot, x, y) => ({ t: CMD.SPELL, p: player, s: slot, x: Math.round(x), y: Math.round(y) });
export const buyCmd = (player, item) => ({ t: CMD.BUY, p: player, item });
export const sellCmd = (player, index) => ({ t: CMD.SELL, p: player, i: index });
export const stopCmd = (player) => ({ t: CMD.STOP, p: player });
export const swapCmd = (player) => ({ t: CMD.SWAP, p: player });
export const itemActiveCmd = (player, index, x, y) => ({ t: CMD.ITEM_ACTIVE, p: player, i: index, x: Math.round(x), y: Math.round(y) });

export const MAX_STROKE_POINTS = 40;
/** Resample to <= MAX_STROKE_POINTS points, integers, to keep packets small and deterministic. */
export function quantizeStroke(pts) {
  const n = pts.length / 2;
  if (n <= MAX_STROKE_POINTS) return pts.map(Math.round);
  const out = []; const step = (n - 1) / (MAX_STROKE_POINTS - 1);
  for (let i = 0; i < MAX_STROKE_POINTS; i++) { const k = Math.round(i * step); out.push(Math.round(pts[k * 2]), Math.round(pts[k * 2 + 1])); }
  return out;
}
/** Validate untrusted commands (network/server side). */
export function validCommand(c) {
  if (!c || typeof c !== 'object' || !Number.isInteger(c.p)) return false;
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5;
  switch (c.t) {
    case CMD.MOVE: case CMD.ATTACK_MOVE: return num(c.x) && num(c.y);
    case CMD.ATTACK: return Number.isInteger(c.id);
    case CMD.CAST: return Number.isInteger(c.s) && c.s >= 0 && c.s < 4 && num(c.x) && num(c.y) && (c.pts === null || (Array.isArray(c.pts) && c.pts.length <= MAX_STROKE_POINTS * 2 && c.pts.every(num)));
    case CMD.SPELL: return (c.s === 0 || c.s === 1) && num(c.x) && num(c.y);
    case CMD.BUY: return typeof c.item === 'string' && c.item.length < 40;
    case CMD.SELL: case CMD.ITEM_ACTIVE: return Number.isInteger(c.i) && c.i >= 0 && c.i < 6;
    case CMD.STOP: case CMD.SWAP: return true;
    default: return false;
  }
}
