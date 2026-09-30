// Game cursors: drawn here as SVG in the game's palette, rasterized once at start-up at 1x and 2x, and handed to CSS as
// custom properties (--cur-<name>). They are native CSS cursors, so the operating system moves them: no frame of lag
// and no render cost. Swapping the art means editing an entry below (or pointing it at an image).
//
// Use in CSS: `cursor: var(--cur-attack, crosshair)`. The canvas picks one per frame through `data-cursor`
// (src/input/desktop.js); the `cursor` setting switches back to the system cursors.
const INK = '#1c1f4a', BONE = '#e8dcc4', DUSK = '#f7b267', TIDE = '#45c4e6', CORAL = '#f0476e';
const SIZE = 32;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 32 32">${body}</svg>`;
// a slim arrow with a dark rim (readable on the bright sky and the dark whale), tip at (3, 2)
const ARROW = 'M3 2 L3 24 L9 18.5 L13 27.5 L17 25.8 L13 17 L21 17 Z';
const arrow = (fill, accent) => `<path d="${ARROW}" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
  + `<path d="M5.5 7 L5.5 18" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`;

/** name -> { svg, hot: [x, y] (CSS px), fallback (system cursor) } */
export const CURSORS = {
  default: { svg: svg(arrow(BONE, DUSK)), hot: [3, 2], fallback: 'default' },
  // buttons and other clickable UI: the arrow lights up
  pointer: { svg: svg(arrow(DUSK, '#fff4e0')), hot: [3, 2], fallback: 'pointer' },
  // an enemy under the cursor: a sword (right click attacks)
  attack: { svg: svg(`<g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">`
    + `<path d="M3 3 L7.5 3.5 L22 18 L18 22 L3.5 7.5 Z" fill="${CORAL}"/>`
    + `<path d="M17 25 L25 17" fill="none" stroke-width="5"/><path d="M17 25 L25 17" fill="none" stroke="${DUSK}" stroke-width="2.4"/>`
    + `<path d="M22.5 22.5 L28 28" stroke-width="4.5"/><path d="M22.5 22.5 L28 28" stroke="${BONE}" stroke-width="2"/></g>`
    + `<path d="M6 5.5 L19 18.5" stroke="#ffd0da" stroke-width="1.2" stroke-linecap="round"/>`), hot: [3, 3], fallback: 'crosshair' },
  // an ally (or yourself) under the cursor: the arrow with a friendly ring
  ally: { svg: svg(arrow(BONE, TIDE) + `<circle cx="24" cy="24" r="5.5" fill="none" stroke="${INK}" stroke-width="4"/><circle cx="24" cy="24" r="5.5" fill="none" stroke="${TIDE}" stroke-width="2.2"/>`), hot: [3, 2], fallback: 'default' },
  // aiming an ability, drawing a shape, or attack-move armed: a reticle, hot spot in its centre
  target: { svg: svg(`<g fill="none" stroke-linecap="round"><circle cx="16" cy="16" r="9" stroke="${INK}" stroke-width="4.5"/><circle cx="16" cy="16" r="9" stroke="${BONE}" stroke-width="2" stroke-dasharray="10.1 4"/>`
    + `<path d="M16 2 V8 M16 24 V30 M2 16 H8 M24 16 H30" stroke="${INK}" stroke-width="4.5"/><path d="M16 2.8 V8 M16 24 V29.2 M2.8 16 H8 M24 16 H29.2" stroke="${DUSK}" stroke-width="2"/></g>`
    + `<circle cx="16" cy="16" r="2.2" fill="${CORAL}" stroke="${INK}" stroke-width="1.2"/>`), hot: [16, 16], fallback: 'crosshair' },
};

const dataUrl = (s) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
function rasterize(src, scale) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE * scale; const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); };
    img.onerror = rej; img.src = src;
  });
}
/**
 * Publish every cursor as a CSS custom property. Crisp on high-DPI screens where image-set() cursors are supported
 * (2x raster), plain 1x otherwise; the system cursor is always the final fallback.
 */
export async function installCursors(root = document.documentElement) {
  const sets = typeof CSS !== 'undefined' && CSS.supports('cursor', 'image-set(url("a.png") 1x) 0 0, auto');
  await Promise.all(Object.entries(CURSORS).map(async ([name, c]) => {
    const src = dataUrl(c.svg), [x, y] = c.hot;
    let value;
    try {
      const [a, b] = await Promise.all([rasterize(src, 1), rasterize(src, 2)]);
      value = sets ? `image-set(url("${a}") 1x, url("${b}") 2x) ${x} ${y}, ${c.fallback}` : `url("${a}") ${x} ${y}, ${c.fallback}`;
    } catch { value = `url("${src}") ${x} ${y}, ${c.fallback}`; }
    root.style.setProperty(`--cur-${name}`, value);
  }));
}
/** The system cursors instead (setting "Cursor: System"). */
export function uninstallCursors(root = document.documentElement) { for (const name of Object.keys(CURSORS)) root.style.removeProperty(`--cur-${name}`); }
