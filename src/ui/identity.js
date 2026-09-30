// Visual identity per hero for the UI: accent colour and an emblem (inline SVG), and item icons.
// The only place the UI names hero and item art.
import { HERO_VIEWS } from '../presentation/heroes/index.js';
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Accent and emblem per hero, from the presentation packs (src/presentation/heroes). */
export const IDENTITY = Object.fromEntries(Object.entries(HERO_VIEWS).map(([k, v]) => [k, { accent: v.accent, emblem: svg(v.emblem) }]));
export const identity = (key) => IDENTITY[key] || { accent: '#e8dcc4', emblem: svg('<circle cx="24" cy="24" r="14"/>') };

// Painted portraits: a source with get(hero, skin) -> url | null and paint(hero, skin) -> Promise<url>
// (the app wires render/portraits.js). Screens call portraitFor and keep the emblem until the painting is ready.
let portraits = null;
export function setPortraitSource(src) { portraits = src; }
/** The portrait URL if painted, else null; `onReady(url)` is called once it is (painting starts on first ask). */
export function portraitFor(hero, skin = 'classic', onReady = null) {
  if (!portraits) return null;
  const url = portraits.get(hero, skin); if (url) return url;
  const p = portraits.paint(hero, skin); if (onReady) p.then(onReady);
  return null;
}

// Item icons: one original glyph per item (24 x 24, stroked in the category colour). The only place the UI
// names item art; swap for painted icons later without touching the screens.
const icon = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ITEM_ICONS = {
  'iron-fin': icon('<path d="M4 20C8 15 10 9 11 3c3 4 7 10 9 17z"/><path d="M11 3v17"/>'),
  'stormglass-orb': icon('<circle cx="12" cy="11" r="7"/><path d="M13 6l-3 5h4l-3 5"/><path d="M8 20h8"/>'),
  'whalehide-vest': icon('<path d="M8 3l-4 3v14h16V6l-4-3-4 3z"/><path d="M12 6v14"/><path d="M8 11h2M14 11h2"/>'),
  'cloudwool-cloak': icon('<path d="M6 10a4 4 0 0 1 7-3 4 4 0 0 1 5 4 3 3 0 0 1 0 6H6a3 3 0 0 1 0-7z"/><path d="M8 17v4M12 17v4M16 17v4"/>'),
  'tidal-heart': icon('<path d="M12 20S4 14 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 11-8 11z"/><path d="M7 12c2-1 3 1 5 0s3-1 5 0"/>'),
  'quickcurrent-boots': icon('<path d="M8 3v10l-4 4v3h14l2-3-8-3V3z"/><path d="M2 8h4M1 12h4"/>'),
  'borrowed-seconds': icon('<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/>'),
  'magnet-boots': icon('<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 4h3v8a3 3 0 0 0 6 0V4h3"/><path d="M6 8h3M15 8h3"/>'),
  'cursed-coin': icon('<circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/><path d="M9 15.5c2-1 4-1 6 0"/>'),
  'barnacle-plate': icon('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><circle cx="9" cy="10" r="1.3"/><circle cx="14" cy="9" r="1"/><circle cx="12" cy="14" r="1.5"/>'),
  'lanternfish-lens': icon('<path d="M4 6c4-4 8-2 8 2"/><circle cx="12" cy="10" r="2"/><path d="M4 15c3-4 13-4 16 0-3 4-13 4-16 0z"/><circle cx="12" cy="15" r="1.5"/>'),
  'harpoon-chain': icon('<path d="M4 20L18 6"/><path d="M14 4l6 0 0 6"/><path d="M4 14c-2 2 0 4 2 2M8 18c-2 2 0 4 2 2"/>'),
  'kelp-crown': icon('<path d="M4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/><path d="M4 20h16"/><path d="M8 17c0-2 1-3 0-5M16 17c0-2-1-3 0-5"/>'),
  "stormcallers-horn": icon('<path d="M3 9c6 0 11-3 15-6v18c-4-3-9-6-15-6z"/><path d="M3 9v6"/><path d="M21 9l2-1M21 15l2 1"/>'),
  'molted-shell': icon('<path d="M12 21c-5 0-8-3-8-7 0-6 4-11 8-11s8 5 8 11c0 4-3 7-8 7z"/><path d="M12 3v18M7 7c2 3 2 9 0 13M17 7c-2 3-2 9 0 13"/>'),
  // components
  'shark-tooth': icon('<path d="M6 4h12l-6 16z"/><path d="M9 8h6"/>'),
  'gull-feather': icon('<path d="M5 19C9 11 14 6 20 4c-1 6-6 11-14 15z"/><path d="M5 19l8-8"/>'),
  'leech-fang': icon('<path d="M7 4c0 7 2 12 5 16 3-4 5-9 5-16"/><path d="M12 12v4"/><path d="M9 4h6"/>'),
  'pearl-shard': icon('<path d="M12 3l6 7-6 11-6-11z"/><path d="M6 10h12"/>'),
  'moon-pearl': icon('<circle cx="12" cy="12" r="7"/><path d="M14 7a5 5 0 0 0 0 10 6 6 0 0 1 0-10z"/>'),
  'tide-charm': icon('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M6 17c2-1 3 1 6 0s4-1 6 0"/>'),
  'kelp-wrap': icon('<path d="M8 21c-2-5 3-7 1-11S8 4 9 3"/><path d="M15 21c2-5-3-7-1-11s1-6 0-7"/><path d="M6 12h12"/>'),
  'barnacle-scale': icon('<path d="M4 18c0-7 4-12 8-12s8 5 8 12z"/><path d="M8 18c0-4 2-7 4-7s4 3 4 7"/>'),
  'sea-glass': icon('<path d="M7 4h10l3 7-8 10-8-10z"/><path d="M4 11h16M12 4v17"/>'),
  'driftwood-boots': icon('<path d="M9 3v10l-5 4v3h13l2-3-7-3V3z"/>'),
  // upgrades
  'riptide-bow': icon('<path d="M6 3c8 3 8 15 0 18"/><path d="M6 3v18"/><path d="M3 12h16l-3-3M19 12l-3 3"/>'),
  'anglerfin-blade': icon('<path d="M5 19L17 7l2-4-4 2L3 17z"/><path d="M5 15l4 4"/><circle cx="19" cy="9" r="1.5"/>'),
  'brinecaller-sash': icon('<path d="M4 5l16 6-16 8z"/><path d="M4 5v14"/><circle cx="14" cy="11" r="2"/>'),
  'wardens-bark': icon('<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="M9 9c2 2 4 2 6 0M9 14c2 2 4 2 6 0"/>'),
  'swiftfin-treads': icon('<path d="M9 3v10l-5 4v3h13l2-3-7-3V3z"/><path d="M18 5l3-2M17 9l4-1"/>'),
  'stormstep-sandals': icon('<path d="M9 3v10l-5 4v3h13l2-3-7-3V3z"/><path d="M19 3l-2 4h3l-2 4"/>'),
  'anchor-boots': icon('<path d="M9 3v10l-5 4v3h13l2-3-7-3V3z"/><circle cx="19" cy="5" r="1.5"/><path d="M19 7v5M17 10c0 2 4 2 4 0"/>'),
  // finished
  'leviathans-maw': icon('<path d="M3 8c5-5 13-5 18 0l-3 3-3-2-3 2-3-2-3 2z"/><path d="M3 16c5 5 13 5 18 0l-3-3-3 2-3-2-3 2-3-2z"/>'),
  'reefbreaker': icon('<path d="M4 20l8-8"/><path d="M10 6l8 8 3-3-8-8z"/><path d="M14 3l1 3M20 9l-3 1"/>'),
  'squall-bell': icon('<path d="M6 16c0-8 3-12 6-12s6 4 6 12z"/><path d="M4 16h16"/><path d="M12 19v2"/><path d="M13 7l-2 4h3l-2 4"/>'),
  'storm-cutlass': icon('<path d="M5 19C9 13 14 8 20 4c-2 7-7 12-13 17z"/><path d="M4 16l4 4"/><path d="M15 4l-2 3h3l-2 3"/>'),
  'deepwater-codex': icon('<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M8 13c2-1 3 1 5 0s3-1 5 0"/><path d="M9 8h6"/>'),
  'tidewatch-hourglass': icon('<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M9 18c2-1 4-1 6 0"/>'),
  'coral-aegis': icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v10M8 10c2 1 2 3 4 3M16 9c-2 1-2 4-4 4"/>'),
  'stillwater-pendant': icon('<path d="M8 3l4 6 4-6"/><path d="M12 9c-4 0-6 3-6 6a6 6 0 0 0 12 0c0-3-2-6-6-6z"/><path d="M9 16c2-1 4-1 6 0"/>'),
};
export const ITEM_TAG_COLOR = { attack: '#f7b267', magic: '#a99bff', defense: '#45c4e6', movement: '#7ee07a', support: '#ff9ee6' };
/** An item icon element (tinted by the item's category). */
export function itemIcon(key, item, cls = 'ico') {
  const span = document.createElement('span'); span.className = cls; span.innerHTML = ITEM_ICONS[key] || icon('<circle cx="12" cy="12" r="7"/>');
  span.style.color = ITEM_TAG_COLOR[(item && item.tags && item.tags[0]) || 'defense'] || '#e8dcc4'; return span;
}
