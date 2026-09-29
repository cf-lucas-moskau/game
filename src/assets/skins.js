// Hero skins: presentation-only variants of a hero's look. The sim never sees a skin; the roster carries
// one per player and the renderer, portraits and UI resolve it here.
//
// A skin may change any part of the look declared in manifest.js (HERO_LOOKS) and recolour the model:
//   palette: { <colour name>: <colour name> | '#rrggbb' }
//     The Kenney rigs colour themselves from a shared palette texture (columns of shaded strips). A swap
//     copies another column over the named one, or tints it to a hex colour keeping its shading. The
//     recoloured palette gets its own atlas cell at load and only this skin's body UVs point at it, so
//     held props keep their colours and a skin costs no extra texture, material or draw call.
//   props: { <index>: { ...patch } }   patch a held prop (key, size, grip, tilt, glow); null removes it
//   accent: UI and portrait accent colour; fxTint: optional colour the ability effects may lean towards
//   model / height: swap the rig itself (any rig with the standard clips works)
//   pebbleTint / pebbleEyes: Gus's golem colours
// Palette swaps must read under the game's blue-violet sky light: pick clear hue changes, not near-whites.
// Adding a skin = adding an entry below. Colour names per palette layout are listed in PALETTES.
import { HERO_LOOKS } from './manifest.js';

/**
 * Palette layouts of the texture families, as [column, row] in an 8 x 4 grid over the texture.
 * mini: Kenney Mini Characters / Arcade / Market; dungeon: Kenney Mini Dungeon.
 */
export const PALETTES = {
  mini: {
    pink: [0, 1],
    cream: [0, 2], green: [1, 2], yellow: [2, 2], orange: [3, 2], red: [4, 2], blue: [5, 2], ice: [6, 2], violet: [7, 2],
    charcoal: [0, 3], grey: [1, 3], slate: [2, 3], steel: [3, 3], white: [4, 3], salmon: [5, 3], umber: [6, 3], tan: [7, 3],
  },
  dungeon: {
    ice: [0, 1], violet: [1, 1], pink: [2, 1],
    umber: [0, 2], tan: [1, 2], cream: [2, 2], green: [3, 2], yellow: [4, 2], orange: [5, 2], red: [6, 2], blue: [7, 2],
    silver: [0, 3], copper: [1, 3], charcoal: [2, 3], grey: [3, 3], slate: [4, 3], steel: [5, 3], white: [6, 3], salmon: [7, 3],
  },
};
export const DEFAULT_SKIN = 'classic';

export const SKINS = {
  morrow: {
    tidewright: { name: 'Tidewright', blurb: 'Keeps the tides on schedule.', palette: { blue: 'green', yellow: 'ice', charcoal: '#20344a' }, accent: '#45c4e6', fxTint: '#6fe0d0',
      props: { 0: { key: 'prop-compass', size: 0.5, grip: 0.3 } } },
    'gilded-hour': { name: 'Gilded Hour', blurb: 'Every second polished to a shine.', palette: { blue: '#7a1f3d', charcoal: '#2a1a12', yellow: 'white' }, accent: '#f2c14e' },
  },
  saffi: {
    bluewick: { name: 'Bluewick', blurb: 'Burns cold and burns longer.', palette: { violet: 'blue', yellow: 'ice' }, accent: '#6fd0ff', fxTint: '#7fd8ff',
      props: { 1: { glow: '#7fd0ff' } } },
    'ember-queen': { name: 'Ember Queen', blurb: 'Crowned in her own smoke.', palette: { violet: 'red', yellow: 'orange', white: '#3a2a2a' }, accent: '#ff5a3d' },
  },
  vesper: {
    vermilion: { name: 'Vermilion Seal', blurb: 'Signs every stroke in red.', palette: { white: 'red', steel: 'cream', blue: 'orange' }, accent: '#f0476e', fxTint: '#ff6a5a' },
    'moon-script': { name: 'Moon Script', blurb: 'Writes only by starlight.', palette: { white: '#23306e', charcoal: '#c9d2ee', steel: 'ice' }, accent: '#9fc3ff' },
  },
  gus: {
    'frost-miner': { name: 'Frost Miner', blurb: 'Dug too deep into a cloud; Pebble came back glacier.', palette: { slate: 'ice' }, accent: '#9fd8ff',
      pebbleTint: '#9fcfe8', pebbleEyes: '#ffffff' },
  },
  brindle: {
    'queen-bee': { name: 'Queen Bee', blurb: 'The hive answers to her.', palette: { grey: 'yellow', white: 'cream', charcoal: '#3a2410' }, accent: '#ffcf3d',
      props: { 0: { glow: '#ffe07a' } } },
    nightshade: { name: 'Nightshade Keeper', blurb: 'Tends the bees that fly at night.', palette: { grey: 'violet', white: '#d8c8ff' }, accent: '#b48cff', fxTint: '#c9a0ff',
      props: { 0: { glow: '#c49bff' } } },
  },
  auctioneer: {
    'crimson-gavel': { name: 'Crimson Gavel', blurb: 'Final offers only.', palette: { green: 'red', charcoal: '#4a0f1c', grey: '#6a1a2a' }, accent: '#f0476e' },
    'black-market': { name: 'Black Market', blurb: 'No receipts.', palette: { green: '#39405a', grey: 'charcoal', charcoal: '#1a1d28' }, accent: '#9aa0b8' },
  },
};

/** Skins a hero can wear, the classic look first: [{ key, name, blurb, accent }]. */
export function skinsFor(hero) {
  const base = HERO_LOOKS[hero];
  const out = [{ key: DEFAULT_SKIN, name: 'Classic', blurb: '', accent: base ? base.accent : '#e8dcc4' }];
  const list = SKINS[hero] || {};
  for (const k in list) out.push({ key: k, name: list[k].name, blurb: list[k].blurb || '', accent: list[k].accent || out[0].accent });
  return out;
}
/** A random skin for a bot (rand: () => [0, 1)); the classic look about a third of the time. */
export function pickSkin(hero, rand) {
  const list = skinsFor(hero); if (list.length < 2 || rand() < 0.34) return DEFAULT_SKIN;
  return list[1 + Math.floor(rand() * (list.length - 1))].key;
}
export const validSkin = (hero, skin) => skin === DEFAULT_SKIN || !!(SKINS[hero] && SKINS[hero][skin]);
/** Palette variant id for a hero/skin, or null when the skin keeps the model's own colours. */
export const variantId = (hero, skin) => (SKINS[hero] && SKINS[hero][skin] && SKINS[hero][skin].palette ? `${hero}:${skin}` : null);

/** Every palette variant the atlas must hold: [{ id, model, layout, swaps }]. */
export function paletteVariants() {
  const out = [];
  for (const hero in SKINS) for (const skin in SKINS[hero]) {
    const s = SKINS[hero][skin]; if (!s.palette) continue;
    const look = HERO_LOOKS[hero]; if (!look) continue;
    out.push({ id: `${hero}:${skin}`, model: s.model || look.model, layout: PALETTES[look.palette || 'mini'], swaps: s.palette });
  }
  return out;
}

/**
 * The look a hero wears with a skin: HERO_LOOKS merged with the skin's overrides.
 * Adds { skin, skinName, variant } (variant = palette variant id or null). Unknown skins fall back to classic.
 */
export function resolveLook(hero, skin = DEFAULT_SKIN) {
  const base = HERO_LOOKS[hero]; if (!base) return null;
  const s = (SKINS[hero] && SKINS[hero][skin]) || null;
  if (!s) return { ...base, skin: DEFAULT_SKIN, skinName: 'Classic', variant: null };
  let props = base.props || [];
  if (s.props) props = props.map((p, i) => (s.props[i] === null ? null : s.props[i] ? { ...p, ...s.props[i] } : p)).filter(Boolean);
  return { ...base, model: s.model || base.model, height: s.height || base.height, accent: s.accent || base.accent, fxTint: s.fxTint || null,
    pebbleTint: s.pebbleTint || null, pebbleEyes: s.pebbleEyes || null,
    props, skin, skinName: s.name, variant: s.palette ? `${hero}:${skin}` : null };
}
