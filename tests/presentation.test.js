import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { HEROES, HERO_KEYS } from '../src/sim/heroes/index.js';
import { HERO_VIEWS } from '../src/presentation/heroes/index.js';
import { DECAL_STYLES } from '../src/presentation/kit.js';
import { SCRIPTS } from '../src/ai/heroes/index.js';
import { HERO_LOOKS } from '../src/assets/manifest.js';
import { ITEMS } from '../src/sim/items/index.js';

// Every hero is complete: sim module, bot script, look, and a presentation pack that covers what the sim emits.
describe('hero presentation packs', () => {
  it('every hero has a pack, a bot script, a look and a valid build', () => {
    for (const k of HERO_KEYS) {
      const v = HERO_VIEWS[k];
      expect(v, `${k} pack`).toBeTruthy(); expect(v.key).toBe(k);
      expect(SCRIPTS[k], `${k} bot`).toBeTypeOf('function');
      expect(HERO_LOOKS[k], `${k} look`).toBeTruthy();
      expect(HEROES[k].build.length, `${k} build`).toBe(6);
      for (const it of HEROES[k].build) expect(ITEMS[it], `${k} build ${it}`).toBeTruthy();
    }
    expect(Object.keys(HERO_VIEWS).sort()).toEqual([...HERO_KEYS].sort());
  });
  it('packs declare identity, style, four aim shapes and sounds', () => {
    for (const k of HERO_KEYS) {
      const v = HERO_VIEWS[k];
      expect(v.accent).toMatch(/^#[0-9a-f]{6}$/i); expect(v.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(v.emblem.length).toBeGreaterThan(20);
      expect(DECAL_STYLES).toContain(v.style);
      expect(v.aim).toHaveLength(4); for (const a of v.aim) expect(a.kind).toBeTruthy();
      expect(v.sounds.cast).toBeTypeOf('function'); expect(v.sounds.auto).toBeTypeOf('function');
    }
  });
  it('every hero has an attack look: melee swipe, or a styled auto-attack projectile', () => {
    for (const k of HERO_KEYS) {
      const v = HERO_VIEWS[k], melee = HEROES[k].base.range < 250;
      if (melee) expect(v.melee && v.melee[k], `${k} melee`).toBeTruthy();
      else expect(v.projectiles && v.projectiles[`${k}-auto`], `${k} auto projectile`).toBeTruthy();
    }
  });
  it('every ability projectile kind a hero spawns has a style in its pack', () => {
    for (const k of HERO_KEYS) {
      const src = readFileSync(new URL(`../src/sim/heroes/${k}.js`, import.meta.url), 'utf8');
      const kinds = [...src.matchAll(/skillshot\([^)]*kind: '([a-z-]+)'/g)].map((m) => m[1]);
      for (const kind of kinds) expect(HERO_VIEWS[k].projectiles[kind], `${k}: projectile ${kind}`).toBeTruthy();
    }
  });
});
