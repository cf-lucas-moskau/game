import morrow from './morrow.js';
import saffi from './saffi.js';
import vesper from './vesper.js';
import gus from './gus.js';
import brindle from './brindle.js';
import auctioneer from './auctioneer.js';

/** Hero registry. Adding a hero = adding a module here; nothing else in the sim changes. */
export const HEROES = { morrow, saffi, vesper, gus, brindle, auctioneer };
export const HERO_KEYS = Object.keys(HEROES);
