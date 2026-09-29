// Presentation packs by hero key. Adding a hero's look, sound and effects = adding a module here
// (the sim side is src/sim/heroes/, the bot side src/ai/heroes/). See ../kit.js for the pack format.
import morrow from './morrow.js';
import saffi from './saffi.js';
import vesper from './vesper.js';
import gus from './gus.js';
import brindle from './brindle.js';
import auctioneer from './auctioneer.js';
import nimbus from './nimbus.js';
import coralie from './coralie.js';
import kestrel from './kestrel.js';
import mistral from './mistral.js';
import rime from './rime.js';
import thorne from './thorne.js';
import cantor from './cantor.js';
import lumen from './lumen.js';
import dredge from './dredge.js';
import wisp from './wisp.js';

export const HERO_VIEWS = { morrow, saffi, vesper, gus, brindle, auctioneer, nimbus, coralie, kestrel, mistral, rime, thorne, cantor, lumen, dredge, wisp };
/** Every projectile style declared by a pack, merged: { kind: style }. */
export const PACK_PROJECTILES = Object.assign({}, ...Object.values(HERO_VIEWS).map((v) => v.projectiles || {}));
/** Every melee style declared by a pack, merged: { key: style }. */
export const PACK_MELEE = Object.assign({}, ...Object.values(HERO_VIEWS).map((v) => v.melee || {}));
