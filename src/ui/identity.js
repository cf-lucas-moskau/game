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
