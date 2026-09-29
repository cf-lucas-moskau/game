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

/** Hero registry. Adding a hero = adding a module here; nothing else in the sim changes. */
export const HEROES = { morrow, saffi, vesper, gus, brindle, auctioneer, nimbus, coralie, kestrel, mistral, rime, thorne, cantor, lumen, dredge, wisp };
export const HERO_KEYS = Object.keys(HEROES);
