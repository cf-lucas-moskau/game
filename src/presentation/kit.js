// Shared vocabulary for hero presentation packs (src/presentation/heroes/*.js).
//
// A pack is everything a hero looks and sounds like, in one module, with no engine imports:
//   key, accent, emblem         identity for the UI (emblem: SVG body in a 48 x 48 viewBox, stroked)
//   style                       ground-decal style name (DECAL_STYLES), used for cast signatures and states
//   aim: [Q, W, E, R]           aim shapes (input/aim.js); aimFor(me, slot, shape) may resolve context-dependent ones
//   projectiles: { kind: style } attack/ability projectile looks (render/attack-styles.js), keyed by sim `p.kind`
//   melee: { key: style }       melee swipes, keyed by hero key (or companion key)
//   sounds: { cast, auto }      (engine, bus, t, pan, gain, voices) => void; voices = { tone, noise }
//   fx: hooks called by render/hero-fx.js with its api (see there):
//     cast(api, c)                 c = { slot, ent, cx, cz, tx, tz }            on EV.CAST by this hero
//     events: { name(api, c) }     c = { e, x, z, ent }                         on EV.FX with that name
//     blink: { name(api, c) }      c = { e, x, z, tx, tz, ent }                 on EV.BLINK with that name
//     decals(api, h)               each frame per living hero of this pack       lasting ground states
//     particles(api, h, rate)      each frame per living hero of this pack       continuous particles
//     ground(api, h)               each frame per living hero of this pack       discs and ribbons (zone layer)
//     world(api, world)            each frame once, when this hero is in the match (statuses it puts on others)
//     zones: { kind: { draw(api, z, k), decal(api, z, k), particles(api, z, rate) } }   per live sim zone
//     shieldStyle(h)               decal style for this hero's own shield ring, or null for the default
// Adding a hero's presentation = adding a pack and listing it in heroes/index.js.

/** Projectile sprite shapes (the projectile shader in render/overlays.js draws each). */
export const SHAPE = { ORB: 0, LANCE: 1, GEAR: 2, INK: 3, BEE: 4, COIN: 5, ROCK: 6, SHARD: 7 };
/** Ground decal outlines (render/ability-fx.js). */
export const DECAL = { DISC: 0, RING: 1, CONE: 2, LINE: 3 };
/** Ground decal styles, one visual language per hero (the decal shader draws each). */
export const DECAL_STYLES = ['clock', 'flame', 'ink', 'stone', 'honey', 'gold'];
/** Zone-layer primitives (render/zones.js). */
export const RIBBON = { INK: 0, WALL: 1, FIRE: 2 };
export const DISC = { HONEY: 0, ECHO: 1, TELEGRAPH: 2, RELIC: 3 };
export const rnd = (a, b) => a + Math.random() * (b - a);
