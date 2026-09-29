// Visual identity per hero for the UI: accent colour and an emblem (inline SVG).
// The only place the UI names hero art; swap emblems for painted portraits later without touching screens.
const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const gear = () => {
  let d = '';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const x1 = 24 + Math.cos(a) * 13, y1 = 24 + Math.sin(a) * 13, x2 = 24 + Math.cos(a) * 19, y2 = 24 + Math.sin(a) * 19; d += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }
  return svg(`<circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="4.5"/>${d}<path d="M24 24 L24 17"/>`);
};
export const IDENTITY = {
  morrow: { accent: '#f7b267', emblem: gear() },
  saffi: { accent: '#ff8a4c', emblem: svg('<path d="M24 6c5 7 10 12 10 20a10 10 0 0 1-20 0c0-5 3-8 5-11 1 4 3 6 5 6 0-6-2-10 0-15z"/><rect x="17" y="36" width="14" height="6" rx="2"/>') },
  vesper: { accent: '#8b7bff', emblem: svg('<path d="M8 36c6-2 9-8 14-15s10-11 18-11"/><path d="M34 6l6 4-16 20-6-4z"/><path d="M8 40c4 0 8-1 12-3"/>') },
  gus: { accent: '#9fb8a0', emblem: svg('<path d="M6 36l8-14 7 6 8-14 13 22z"/><circle cx="33" cy="12" r="4"/>') },
  brindle: { accent: '#f2c14e', emblem: svg('<path d="M24 6l14 8v16l-14 8-14-8V14z"/><ellipse cx="24" cy="23" rx="5" ry="7"/><path d="M19 20h10M19 26h10"/>') },
  auctioneer: { accent: '#d9a7ff', emblem: svg('<rect x="10" y="10" width="18" height="10" rx="2" transform="rotate(-30 19 15)"/><path d="M22 22l14 14"/><path d="M8 42h20"/>') },
};
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
