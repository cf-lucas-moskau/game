// How each ability is aimed and previewed. Presentation/input data only; the sim never reads this.
// kind: line | cone | circle | point | unit | ally | self | stroke | loop | echo
export const AIM = {
  morrow: [{ kind: 'line', range: 700, width: 110 }, { kind: 'self', radius: 90 }, { kind: 'echo', range: 1100 }, { kind: 'self', radius: 120 }],
  saffi: [{ kind: 'point', range: 350, radius: 60 }, { kind: 'cone', range: 400, angle: Math.PI * 0.4 }, { kind: 'unit', range: 550 }, { kind: 'self', radius: 200 }],
  vesper: [{ kind: 'stroke', range: 550, maxLen: 400 }, { kind: 'loop', range: 650 }, { kind: 'stroke', range: 600, maxLen: 500 }, { kind: 'self', radius: 120 }],
  gus: [{ kind: 'gusq', range: 900, radius: 160 }, { kind: 'self', radius: 220 }, { kind: 'line', range: 620, width: 160 }, { kind: 'point', range: 800, radius: 300 }],
  brindle: [{ kind: 'unit', range: 650 }, { kind: 'ally', range: 700 }, { kind: 'point', range: 700, radius: 220 }, { kind: 'self', radius: 340 }],
  auctioneer: [{ kind: 'line', range: 900, width: 90 }, { kind: 'unit', range: 800 }, { kind: 'unit', range: 700 }, { kind: 'unit', range: 700, heroesOnly: true }],
};
export const SPELL_AIM = [{ kind: 'point', range: 400, radius: 50 }, { kind: 'self', radius: 850 }];
/** Resolve Gus's context-dependent Q shape. */
export function aimFor(me, slot) {
  const a = AIM[me.heroKey][slot];
  if (a.kind === 'gusq') return me.heroState.mounted ? { kind: 'point', range: 140, radius: 190, anchored: true } : { kind: 'point', range: 900, radius: 160 };
  return a;
}
export const isDrawn = (a) => a.kind === 'stroke' || a.kind === 'loop';
