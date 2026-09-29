// Visual identity per hero for the UI: accent colour and an emblem (inline SVG), and item icons.
// The only place the UI names hero and item art.
import { HERO_VIEWS } from '../presentation/heroes/index.js';
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Accent and emblem per hero, from the presentation packs (src/presentation/heroes). */
export const IDENTITY = Object.fromEntries(Object.entries(HERO_VIEWS).map(([k, v]) => [k, { accent: v.accent, emblem: svg(v.emblem) }]));
export const identity = (key) => IDENTITY[key] || { accent: '#e8dcc4', emblem: svg('<circle cx="24" cy="24" r="14"/>') };

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
};
export const ITEM_TAG_COLOR = { attack: '#f7b267', magic: '#a99bff', defense: '#45c4e6', movement: '#7ee07a' };
/** An item icon element (tinted by the item's category). */
export function itemIcon(key, item, cls = 'ico') {
  const span = document.createElement('span'); span.className = cls; span.innerHTML = ITEM_ICONS[key] || icon('<circle cx="12" cy="12" r="7"/>');
  span.style.color = ITEM_TAG_COLOR[(item && item.tags && item.tags[0]) || 'defense'] || '#e8dcc4'; return span;
}
