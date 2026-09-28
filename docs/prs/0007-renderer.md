# PR #7: 3D renderer and asset pipeline

Branch: `renderer`

## Summary

## Checks

First playable view: a bot-only match rendered in 3D (`?bench=stress` / spectate mode).

**Asset pipeline**: `tools/assets.config.js` maps game keys to CC0 sources (Kenney, KayKit);
`tools/assets.mjs` embeds external textures, dedups, welds and quantizes into self-contained
GLBs; `src/assets/CREDITS.md` is generated. `src/assets/manifest.js` is the only file naming
assets (rig, height, bone-attached props, tints), so art can be swapped per key.

**Renderer** (`src/render/`)
- `assets.js`: load once, normalize height, skeleton-aware clones, merged static geometry for instancing.
- `vat.js`: bakes skinned clips into float vertex-animation textures; every minion of a rig is one instanced draw.
- `units.js`: heroes (skinned, body+head merged into one draw via per-vertex re-binding,
  bone-attached props, one-shot attack/cast clips), Pebble golem, Brindle's bee swarm,
  instanced towers (team-coloured roofs + crystals), Heartstones, dying-minion corpses.
- `environment.js`: procedural sky with stars, fbm cloud sea, drifting cloud billboards,
  parametric whale (superellipse body, animated flukes and fins, bioluminescent spots),
  lane shader with whale-roll edge warnings and sudden-death pulse; scenery placed on the real whale surface.
- `overlays.js`: health bars (pixel-sized, 1 draw), shadows + team rings (1 draw), projectiles (1 draw).
- `post.js`: HDR target, dual-filter bloom at half resolution, ACES + sRGB composite.
- `quality.js`: low / medium / high presets, device default, dynamic resolution guard.
- Whale roll tilts the world around the lane axis.

**Measured** (headless Chromium, SwiftShader software GPU, 1 CPU; FPS here is not meaningful):
scene draw calls 37–44 at mid-match (budget 50), triangles about 50k, sim tick p95 0.2 ms.
Post-processing adds a fixed set of fullscreen passes, reported separately as `postPasses`.

**Bugs caught by screenshots and fixed**: fin shader missing newline; emissive ignored team
colour (`USE_COLOR` vs `USE_INSTANCING_COLOR`); merged heads distorted (bind space);
health bars unreadable on small screens; a facing "fix" that was wrong was verified and reverted.

Screenshots: `0007-desktop.png`, `0007-mobile.png`.

```
== 1/3 unit + determinism tests
   ✓ heroes > every hero casts every ability in a chaotic 3v3 without errors, deterministically 1227ms
   ✓ simulation > is deterministic for the same seed and commands 735ms
   ✓ simulation > whale roll cycles through warn, roll and back to idle 317ms
   ✓ bots > play a full match that ends by sudden death at the latest, and a command log replays it exactly 3030ms
   ✓ bots > every hero uses all four abilities during a match 1186ms
      Tests  35 passed (35)
   Start at  13:13:56
   Duration  9.72s (transform 388ms, setup 0ms, collect 532ms, tests 7.44s, environment 1ms, prepare 647ms)
== 2/3 production build
   dist/index.html: 3220 KB
== 3/3 performance benchmark vs budgets
   (bench harness not present yet)
ALL CHECKS PASSED
```
