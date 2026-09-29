// The single place the game refers to asset files. Every model is addressed by key;
// swapping art means replacing a GLB in ./models (or re-pointing tools/assets.config.js)
// and, if needed, adjusting the look parameters below. No other file names assets.
const files = import.meta.glob('./models/*.glb', { eager: true, query: '?url', import: 'default' });
export const MODEL_URLS = Object.fromEntries(Object.entries(files).map(([p, url]) => [p.slice(9, -4), url]));

// Animation clip names used by the renderer, mapped onto each rig's clip names.
export const CLIPS = { idle: 'idle', walk: 'walk', run: 'sprint', attack: 'attack-melee-right', shoot: 'holding-right-shoot', cast: 'interact-right', die: 'die', emote: 'emote-yes', hold: 'holding-right' };

// How each hero looks: rig, height in render units, held props and tint accents. `palette` names the rig's
// palette layout (skins.js PALETTES; default 'mini'). Skins (skins.js) are patches over these looks.
// A prop with `hold` sits in the fist at the end of its arm bone (grip found on the mesh): `grip` = share of its
// height below the fist, `tilt` = forward lean (rad), `roll` = sideways turn, `flip` for art authored head-down. `on: 'top'` stands a prop on the highest
// point of its bone's mesh (`lift` adjusts). Others use explicit bone-local pos/rot. Check props with `node tools/lab.mjs heroes`.
export const HERO_LOOKS = {
  morrow:     { model: 'hero-morrow', height: 1.45, attack: 'shoot', props: [{ key: 'prop-wrench', bone: 'arm-right', hold: true, size: 0.55 }], accent: '#e7b24c' },
  saffi:      { model: 'hero-saffi', height: 1.35, attack: 'attack', props: [{ key: 'prop-dagger', bone: 'arm-right', hold: true, size: 0.5, grip: 0.15 }, { key: 'prop-candle', bone: 'head', on: 'top', lift: -0.02, size: 0.3, glow: '#ffb35c' }], accent: '#ff9d4d' },
  vesper:     { model: 'hero-vesper', height: 1.45, attack: 'shoot', props: [{ key: 'prop-brush', bone: 'arm-right', hold: true, size: 0.7, grip: 0.35 }, { key: 'prop-spellbook', bone: 'arm-left', hold: true, size: 0.22, grip: 0.5, tilt: 0.3 }], accent: '#8b7bff' },
  gus:        { model: 'hero-gus', palette: 'dungeon', height: 0.95, attack: 'shoot', props: [{ key: 'prop-hammer', bone: 'arm-right', hold: true, size: 0.5 }], accent: '#c9a26a', pebble: ['rock-a', 'rock-b', 'rock-c'] },
  brindle:    { model: 'hero-brindle', height: 1.4, attack: 'shoot', props: [{ key: 'prop-lantern', bone: 'arm-right', hold: true, size: 0.38, grip: 0.95, tilt: 0, glow: '#ffd866' }], accent: '#ffcf3d', bees: 'bee' },
  auctioneer: { model: 'hero-auctioneer', height: 1.5, attack: 'shoot', props: [{ key: 'prop-mallet', bone: 'arm-right', hold: true, grip: 0.02, size: 0.6 }], accent: '#f2c14e' },
  nimbus:     { model: 'hero-nimbus', height: 1.45, attack: 'shoot', props: [{ key: 'prop-rod', bone: 'arm-right', hold: true, size: 0.8, grip: 0.3, glow: '#a8f0ff' }], accent: '#a8f0ff' },
  coralie:    { model: 'hero-coralie', height: 1.5, attack: 'attack', props: [{ key: 'prop-spear', bone: 'arm-right', hold: true, size: 0.85, grip: 0.4 }, { key: 'prop-spiked-shield', bone: 'arm-left', hold: true, size: 0.45, grip: 0.5, tilt: 0 }], accent: '#ff9e8a' },
  kestrel:    { model: 'hero-kestrel', height: 1.4, attack: 'shoot', props: [{ key: 'prop-crossbow', bone: 'arm-right', hold: true, size: 0.42, grip: 0.3, tilt: 1.2 }], accent: '#d4ff5a' },
  mistral:    { model: 'hero-mistral', height: 1.4, attack: 'shoot', props: [{ key: 'prop-wand', bone: 'arm-right', hold: true, size: 0.45, grip: 0.25, glow: '#bff5e6' }], accent: '#bff5e6' },
  rime:       { model: 'hero-rime', height: 1.45, attack: 'shoot', props: [{ key: 'prop-staff', bone: 'arm-right', hold: true, size: 0.85, grip: 0.3, glow: '#9ec9ff' }], accent: '#9ec9ff' },
  thorne:     { model: 'hero-thorne', height: 1.45, attack: 'shoot', props: [{ key: 'prop-trowel', bone: 'arm-right', hold: true, size: 0.55, grip: 0.3 }], accent: '#6fd66a' },
  cantor:     { model: 'hero-cantor', height: 1.4, attack: 'shoot', props: [{ key: 'prop-bell', bone: 'arm-right', hold: true, size: 0.3, grip: 0.15, tilt: 0.2 }], accent: '#ff9ee6' },
  lumen:      { model: 'hero-lumen', height: 1.4, attack: 'shoot', props: [{ key: 'prop-compass', bone: 'arm-right', hold: true, size: 0.5, grip: 0.35 }, { key: 'prop-star', bone: 'head', on: 'top', lift: 0.02, size: 0.22, glow: '#ffe9b0' }], accent: '#ffe9b0' },
  dredge:     { model: 'hero-dredge', height: 1.55, attack: 'attack', props: [{ key: 'prop-axe', bone: 'arm-right', hold: true, size: 0.78, grip: 0.12 }], accent: '#b7c3cf' },
  wisp:       { model: 'hero-wisp', height: 1.4, attack: 'attack', props: [{ key: 'prop-dagger-b', bone: 'arm-right', hold: true, size: 0.45, grip: 0.15 }, { key: 'prop-lantern-mini', bone: 'arm-left', hold: true, size: 0.26, grip: 0.95, tilt: 0, glow: '#d65cff' }], accent: '#d65cff' },
};
// Minions: [team][kind] -> rig + height. Siege uses a static model.
export const MINION_LOOKS = {
  0: { melee: { model: 'minion-blue', height: 1.0 }, ranged: { model: 'minion-blue-caster', height: 0.95 }, siege: { model: 'siege-ram', height: 1.1, static: true } },
  1: { melee: { model: 'minion-red', height: 1.05 }, ranged: { model: 'minion-red-caster', height: 1.0 }, siege: { model: 'siege-ram', height: 1.1, static: true } },
};
export const STRUCTURE_LOOKS = {
  tower: { parts: ['tower-base', 'tower-mid', 'tower-mid', 'tower-roof'], width: 1.9, crystal: 'crystal-small' },
  heart: { model: 'crystal', height: 2.6 },
  flag: 'flag', banner: 'banner',
};
export const SCENERY = { trees: ['tree', 'tree-bare'], bush: 'bush', rocks: ['rock-a', 'rock-b', 'rock-c'], lamp: 'lamp', coin: 'prop-coin' };
