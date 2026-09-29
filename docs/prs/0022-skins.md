# PR #22: Modular skin system

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Owner request: "Add skins to a handful of characters through a modular skin system." Skins are presentation-only
patches over a hero's look, declared in one registry (`src/assets/skins.js`):

- **Palette swaps.** The Kenney rigs colour themselves from one shared palette texture (columns of shaded strips;
  layouts `mini` and `dungeon` are named in `PALETTES`). A skin swaps columns (`{ white: 'red' }`) or tints them to
  a hex colour while keeping the shading. At load, `buildAtlas` renders each skin's recoloured palette into its own
  atlas cell; each hero view already owns its merged geometry, so only that skin's body UVs are moved to the new
  cell before props are baked in. Props keep their colours, and a skin adds no texture, material, program or draw call.
- **Look overrides.** Props can be patched or swapped per index (key, size, grip, glow), plus rig, height, UI accent,
  an ability-effect tint for later, and Gus's golem colours (`pebbleTint`, `pebbleEyes`).
- **Roster, not sim.** The session writes a skin into every roster entry (the player's choice, bots pick one from a
  seeded presentation RNG) and hands the map to the renderer; the menu backdrop shows random skins. The sim never
  reads a skin, so determinism and the future server protocol are unaffected.
- **Lab.** `?skin=` / `lab.setHero(hero, { skin })`, a Skin row in the panel, and `node tools/lab.mjs skins
  [--hero x]` renders a contact sheet of every skin.

11 skins: Morrow (Tidewright with a compass, Gilded Hour), Saffi (Bluewick with a blue candle flame, Ember Queen),
Vesper (Vermilion Seal, Moon Script), Gus (Frost Miner: glacier Pebble), Brindle (Queen Bee, Nightshade Keeper with a
violet lantern), the Auctioneer (Crimson Gavel, Black Market).

## Found while building it

- Vertex counts per palette column (first attempt at finding which column colours what) are misleading: large flat
  faces have few vertices. A debug pass that paints each column a distinct hue in the live atlas showed the real
  mapping (e.g. Vesper's coat is the white column; Gus's face and tunic share one column, so his skin tints Pebble instead).
- Near-white targets (cream on white) vanish under the scene's blue-violet sky light; skins use clear hue changes.
- A prop swap to the coin stack looked wrong in the hand and was dropped.

## Checks

- `tests/skins.test.js`: every skin names valid colours for its hero's palette layout and valid asset keys; look
  resolution (patch, not replace; manifest untouched; unknown skins fall back); bot picks deterministic and valid;
  recolour copies a column with its shading and tints keeping the gradient.
- e2e: every hero/skin look loads in the Lab (17), and each palette skin's body has no vertex left in the base
  palette cell and some in its own cell.
- Visual: `tools/lab.mjs skins` sheets for all heroes (front and three-quarter cameras).
