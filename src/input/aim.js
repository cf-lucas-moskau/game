// How each ability is aimed and previewed. Presentation/input data only; the sim never reads this.
// kind: line | cone | circle | point | unit | ally | self | stroke | loop | echo
import { HERO_VIEWS } from '../presentation/heroes/index.js';
/** Aim shapes per hero, from the presentation packs: [Q, W, E, R]. */
export const AIM = Object.fromEntries(Object.entries(HERO_VIEWS).map(([k, v]) => [k, v.aim]));
export const SPELL_AIM = [{ kind: 'point', range: 400, radius: 50 }, { kind: 'self', radius: 850 }];
/** The shape for a slot; a pack may resolve context-dependent shapes (Gus's Q depends on the mount). */
export function aimFor(me, slot) {
  const v = HERO_VIEWS[me.heroKey], a = v.aim[slot];
  return v.aimFor ? v.aimFor(me, slot, a) : a;
}
export const isDrawn = (a) => a.kind === 'stroke' || a.kind === 'loop';
