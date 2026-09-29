// Bundled typefaces (offline, inlined into the single-file build): Gloock for titles and hero names,
// Bricolage Grotesque (variable) for HUD text with tabular numbers.
import gloock from '@fontsource/gloock/files/gloock-latin-400-normal.woff2?url';
import bricolage from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url';

export async function loadFonts() {
  if (typeof FontFace === 'undefined') return;
  const faces = [
    new FontFace('Gloock', `url(${gloock}) format('woff2')`, { weight: '400', display: 'swap' }),
    new FontFace('Bricolage Grotesque', `url(${bricolage}) format('woff2')`, { weight: '200 800', display: 'swap' }),
  ];
  await Promise.all(faces.map(async (f) => { try { document.fonts.add(await f.load()); } catch { /* fall back to system fonts */ } }));
}
