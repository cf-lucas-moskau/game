// How every attack looks: one entry per projectile kind (sim `p.kind`) and per melee attacker.
// Presentation data only; swapping a style never touches the sim. Colours are hex strings, sizes in
// render units, times in seconds.
//   shape: how the projectile sprite is drawn (projectile shader in overlays.js)
//   stretch: elongation along the flight direction; spin: turns per second; arc: lob height
//   trail / launch / impact: particle recipes played by combat-fx.js
import { SHAPE } from '../presentation/kit.js';
import { PACK_PROJECTILES, PACK_MELEE } from '../presentation/heroes/index.js';
export { SHAPE };

// Structures and minions here; every hero's attack and ability projectiles come from its presentation pack.
export const PROJECTILE_STYLES = {
  'tower-bolt': { shape: SHAPE.LANCE, color: '#ffd36b', color2: '#ffffff', size: 0.5, glow: 3.4, y: 2.5, stretch: 3.2,
    trail: { color: '#ff9a3c', rate: 1.6, size: 0.34, life: 0.4, up: 0.2 }, launch: 'tower', impact: 'tower' },
  'minion-bolt': { shape: SHAPE.SHARD, team: ['#7fe0ff', '#ff7f96'], color2: '#ffffff', size: 0.2, glow: 2.2, stretch: 1.6,
    trail: { team: true, rate: 0.5, size: 0.1, life: 0.2 }, impact: 'spark' },
  'siege-shot': { shape: SHAPE.ROCK, color: '#4a3f38', color2: '#ffb070', size: 0.34, glow: 1, arc: 1.4, spin: 1.5,
    trail: { color: '#9aa0b8', rate: 0.9, size: 0.3, life: 0.6, up: 0.4, smoke: true }, impact: 'siege' },
  ...PACK_PROJECTILES,
};
export const DEFAULT_PROJECTILE = { shape: SHAPE.ORB, color: '#ffffff', color2: '#ffffff', size: 0.16, glow: 1.5, impact: 'spark' };

// Melee attackers: a crescent swipe in front of the unit at the moment the hit lands.
//   arc: sweep in radians, radius/width in render units, dur in s, heavy: dust ring + shake on hit
export const MELEE_STYLES = {
  'minion-0': { color: '#45c4e6', edge: '#d8f6ff', arc: 1.6, radius: 0.85, width: 0.2, dur: 0.16, impact: 'spark' },
  'minion-1': { color: '#f0476e', edge: '#ffd9e1', arc: 1.6, radius: 0.85, width: 0.2, dur: 0.16, impact: 'spark' },
  ...PACK_MELEE,
};
