// How every attack looks: one entry per projectile kind (sim `p.kind`) and per melee attacker.
// Presentation data only; swapping a style never touches the sim. Colours are hex strings, sizes in
// render units, times in seconds.
//   shape: how the projectile sprite is drawn (projectile shader in overlays.js)
//   stretch: elongation along the flight direction; spin: turns per second; arc: lob height
//   trail / launch / impact: particle recipes played by combat-fx.js
export const SHAPE = { ORB: 0, LANCE: 1, GEAR: 2, INK: 3, BEE: 4, COIN: 5, ROCK: 6, SHARD: 7 };

export const PROJECTILE_STYLES = {
  // structures and minions
  'tower-bolt': { shape: SHAPE.LANCE, color: '#ffd36b', color2: '#ffffff', size: 0.5, glow: 3.4, y: 2.5, stretch: 3.2,
    trail: { color: '#ff9a3c', rate: 1.6, size: 0.34, life: 0.4, up: 0.2 }, launch: 'tower', impact: 'tower' },
  'minion-bolt': { shape: SHAPE.SHARD, team: ['#7fe0ff', '#ff7f96'], color2: '#ffffff', size: 0.2, glow: 2.2, stretch: 1.6,
    trail: { team: true, rate: 0.5, size: 0.1, life: 0.2 }, impact: 'spark' },
  'siege-shot': { shape: SHAPE.ROCK, color: '#4a3f38', color2: '#ffb070', size: 0.34, glow: 1, arc: 1.4, spin: 1.5,
    trail: { color: '#9aa0b8', rate: 0.9, size: 0.3, life: 0.6, up: 0.4, smoke: true }, impact: 'siege' },
  // hero auto-attacks: each hero reads at a glance
  'morrow-auto': { shape: SHAPE.GEAR, color: '#f2c14e', color2: '#fff1c2', size: 0.28, glow: 1.8, spin: 3,
    trail: { color: '#ffd27a', rate: 0.9, size: 0.08, life: 0.3, sparks: true }, launch: 'brass', impact: 'brass' },
  'vesper-auto': { shape: SHAPE.INK, color: '#1a1030', color2: '#9d8cff', size: 0.3, glow: 1.6, stretch: 1.3,
    trail: { color: '#6f5cff', rate: 1.1, size: 0.14, life: 0.45, drip: true }, launch: 'ink', impact: 'ink' },
  'brindle-auto': { shape: SHAPE.BEE, color: '#ffcf3d', color2: '#20160a', size: 0.26, glow: 1.2, wobble: 0.18,
    trail: { color: '#ffe27a', rate: 0.6, size: 0.06, life: 0.25 }, launch: 'honey', impact: 'honey' },
  'auctioneer-auto': { shape: SHAPE.COIN, color: '#f2c14e', color2: '#fff6c9', size: 0.26, glow: 1.9, spin: 4,
    trail: { color: '#ffe07a', rate: 0.7, size: 0.07, life: 0.3, glint: true }, launch: 'coin', impact: 'coin' },
  'saffi-auto': { shape: SHAPE.SHARD, color: '#ff9d4d', color2: '#fff4d6', size: 0.18, glow: 2, stretch: 1.8, impact: 'ember' },
  'gus-auto': { shape: SHAPE.ROCK, color: '#8a7a66', color2: '#d9c3a0', size: 0.24, glow: 1, arc: 0.8, spin: 2, impact: 'dust' },
  // ability projectiles
  'morrow-cog': { shape: SHAPE.GEAR, color: '#f2c14e', color2: '#fffbe6', size: 0.5, glow: 2.4, spin: 5,
    trail: { color: '#ffd27a', rate: 1.6, size: 0.12, life: 0.35, sparks: true }, impact: 'brass' },
  'auctioneer-gavel': { shape: SHAPE.COIN, color: '#f2c14e', color2: '#ffffff', size: 0.5, glow: 2.8, spin: 6,
    trail: { color: '#ffe07a', rate: 1.6, size: 0.14, life: 0.4, glint: true }, impact: 'coin' },
  'brindle-sting': { shape: SHAPE.BEE, color: '#ffd000', color2: '#20160a', size: 0.3, glow: 1.4, wobble: 0.3,
    trail: { color: '#ffe27a', rate: 1, size: 0.07, life: 0.3 }, impact: 'honey' },
};
export const DEFAULT_PROJECTILE = { shape: SHAPE.ORB, color: '#ffffff', color2: '#ffffff', size: 0.16, glow: 1.5, impact: 'spark' };

// Melee attackers: a crescent swipe in front of the unit at the moment the hit lands.
//   arc: sweep in radians, radius/width in render units, dur in s, heavy: dust ring + shake on hit
export const MELEE_STYLES = {
  saffi: { color: '#ff8a3d', edge: '#fff2cf', arc: 2.1, radius: 1.05, width: 0.34, dur: 0.2, alternate: true, impact: 'ember' },
  gus: { color: '#c9a26a', edge: '#fff3dc', arc: 2.6, radius: 1.25, width: 0.45, dur: 0.26, heavy: true, impact: 'dust' },
  pebble: { color: '#a39580', edge: '#e8dcc4', arc: 2.2, radius: 1.3, width: 0.5, dur: 0.28, heavy: true, impact: 'dust' },
  'minion-0': { color: '#45c4e6', edge: '#d8f6ff', arc: 1.6, radius: 0.85, width: 0.2, dur: 0.16, impact: 'spark' },
  'minion-1': { color: '#f0476e', edge: '#ffd9e1', arc: 1.6, radius: 0.85, width: 0.2, dur: 0.16, impact: 'spark' },
};
