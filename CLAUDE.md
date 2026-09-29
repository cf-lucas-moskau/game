# CLAUDE.md: handover for Leviathan Lane

Read this first. It is the state of the project and how to keep working on it.

## What this is
**Leviathan Lane**: an original browser 3v3 single-lane arena brawler (ARAM-like), 5 to 10 minute
matches, fought on the back of a giant sky-whale. Six original heroes, 15 items, bots, desktop
(mouse + keyboard) and mobile (touch) controls. 3D with three.js on a fixed angled camera, gameplay on
a 2D plane. Everything must be original (no League of Legends IP).

The owner's goals, in their words: "fully build the game as specced. No shortcuts, no placeholders or
workarounds. Everything must be easily replaceable later. Architecture fully modular. State of the art.
Make logical commits and PRs, merge them yourself on your set rules. We aim to win awards."
Performance and smoothness are critical: always measure (frame time, sim, render, GC, latency) with data.
The owner writes in German or English; answer in the language of their message.

Spec document (Claude Docs): https://claude.ai/code/artifact/9992dd94-0c29-42d7-aca8-44a8a11e3378
Updated after PR #21 (3D rendering, rules numbers, Brindle and Auctioneer passives, auto ranks, pooled records,
measurement method). Keep it in sync when rules or tech change.

## Commands
```
npm install
npx playwright install chromium        # needed by e2e, bench, soak (or set PW_PATH to a playwright install)
npm run dev                            # play: http://localhost:5173/ (hero select), or ?hero=vesper&ping=100 to skip it
npm test                               # vitest: sim, heroes, items, bots, transport, predictor
npm run build                          # single self-contained dist/index.html (assets inlined), must stay < 16 MB
node tools/simulate.mjs 10             # headless bot-vs-bot matches: length, win rates, sim cost
node tools/bench.mjs                   # performance benchmark (see docs/PERF.md)
node tools/soak.mjs 4                  # leak check: retained-heap slope
node tools/shot.mjs "?quality=medium&skip=150" out.png 15 1280 720   # screenshot helper
node tools/lab.mjs heroes --cam front                  # Leviathan Lab: every hero up close (contact sheet PNG)
node tools/lab.mjs strip --hero saffi --clip attack    # animation frames across a clip
node tools/lab.mjs ability --hero gus --slot R         # timeline of an ability after the cast
node tools/lab.mjs attack --hero vesper                # auto-attack timeline;  shot / info: see the file header
```
URL parameters: `lab=1` (Leviathan Lab: isolated stage, `window.__lab`, panel; `cam= zoom= paused=1 panel=0 dummy= dummies=`), `hero=`, `heroes=a,b,c,d,e,f` (roster), `ping= jitter= loss=` (simulated network),
`bots=easy|medium|hard`, `quality=low|medium|high`, `spectate=1`, `play=auto` (autopilot through the
input path), `skip=<seconds>` (fast-forward the sim), `seed=`, `touch=1`, `cpu=1` (CPU measurement mode), `bench=1`.

## Workflow and merge rules (see CONTRIBUTING.md)
- One concern per PR, branch per PR: `scripts/pr.sh open <n> <branch> "<title>"` creates the branch and
  `docs/prs/NNNN-branch.md`; write the description there (what, why, what was measured, bugs found).
- Conventional commits. The sim never imports render/ui/audio/input. Assets only via `src/assets/manifest.js`.
- **The gate** is split into steps because the full run takes about 10 minutes:
  `bash scripts/check.sh list` -> tests build e2e bench-desktop bench-play bench-mobile bench-eval soak.
  Run each with `bash scripts/check.sh <step>` on a clean, committed tree. Each success writes
  `.gate/<key>/<step>.ok`, where the key is a content hash of all tracked files except `docs/prs/` and
  `scripts/pr.sh`. `scripts/pr.sh merge <n>` refuses unless every step passed for the current key, then
  appends results to the PR write-up and merges `--no-ff`.
- If a gate step fails, investigate the cause with data (profiles, traces, screenshots). Do not loosen a
  budget or tolerance without evidence, and document any measurement change in docs/PERF.md.
- Visual work: look at it before merging. Use the Leviathan Lab (`tools/lab.mjs`, `?lab=1`) for heroes, props,
  animations and effects up close (frame-exact, no match needed); use full-game screenshots for scene-level checks.

## Current state
- The repository now lives on GitHub (`cf-lucas-moskau/game`); `main` holds PRs 1-21. Earlier notes: PRs 1-11: PR #10 (VFX) merged after a gate rerun in the new container (see docs/prs/0010-vfx.md), and
  PR #11 (UI) adds the full playable loop: hero select -> match -> end screen -> hero select.
- Playwright in this container: `PW_PATH=/opt/node22/lib/node_modules/playwright` (Chromium in /opt/pw-browsers).
- `src/app/app.js` owns the flow (menu with a bot-match backdrop, match, end screen) and tears each match
  down completely (renderer GL context, inputs, UI). URL shortcuts `hero= heroes= play=` skip hero select.
- Surrender is a sim command (`CMD.SURRENDER`), so it will work unchanged with the server.
- Numbers from the last full runs (headless Chromium, SwiftShader software GPU, 1 CPU):
  sim tick p95 0.1-0.2 ms, render update p95 0.3 ms desktop / 2.6 ms emulated phone,
  GC max 0.3-0.5 ms desktop / 3.4 ms phone, scene draw calls 40-43 (budget 50),
  corrections 0.3-0.7 per 10 s at 100 ms ping, retained heap slope about 1.5 MB per 10 min.

## Next work, in order
1. Done: PR #10 merged, PR #11 UI (`src/ui/`) built as designed below. Remaining UI polish: painted hero
   portraits and item icons (swap `src/ui/identity.js` emblems and the item abbreviations), volume setting
   in settings now exists too.
2. (Design record for PR #11, UI:)
   - Fonts bundled offline via npm: `@fontsource/gloock` (titles, hero names) and
     `@fontsource-variable/bricolage-grotesque` (HUD text, tabular numbers). Palette in `src/render/palette.js`
     (abyss #1c1f4a, dusk #f7b267, slate #3e5c6b, bone #e8dcc4, tide #45c4e6, coral #f0476e, gold #f2c14e).
   - The one bold element: a lane-strip minimap across the top (whole whale lane, towers, heroes, whale-roll warning).
   - Hero select (random hero + unlimited rerolls, bots may duplicate heroes, default bot difficulty medium),
     HUD (portrait + level/XP ring, HP and resource bars, ability slots with cooldowns, D/F, 6 items, gold,
     team kills, match clock, kill feed, sudden-death and whale-roll banners, respawn timer),
     shop (P; buy only at fountain or while dead; `BUILDS` recommendations), scoreboard (Tab),
     end screen, F3 perf overlay with "Copy report" (`window.__perf.summary()`), settings
     (quality, volume, camera shake, simulated ping), floating damage numbers (pooled DOM).
   - Input already dispatches `ll-toggle` events ('shop', 'scoreboard', 'perf', 'escape'); desktop ability bar
     hidden on touch (touch buttons live in `src/input/touch.js`).
3. Done (PR #12): audio in `src/audio/` (engine, synth voices, sound palette, sfx director, generative music).
   Sound design is tuned by measurement only (levels, voice counts); a listening pass by the owner is still due.
4. Done (PR #13): runtime texture atlas + shared material, one-draw Pebble, props baked into heroes, fixed glow-light
   pool. Remaining allocation is three.js uniform uploads (V8 boxes doubles passed to gl.uniform3f); next lever is
   fewer lit programs/materials (environment materials, glow materials) or a three.js upgrade/patch.
   Open measurement issue: in this container `gcPauseMaxMs` on the emulated phone swings 8-47 ms on identical code
   (SwiftShader contention); consider re-baselining on a machine with a real GPU.
5. Done (PRs #14-#18, owner feedback round): props in hands, unlimited rerolls, readable combat (distinct attacks, tower
   range + lock-on), real numbers in tooltips/shop, unit inspection, per-hero ability styles, Leviathan Lab.
6. Done (PRs #19-#21): item icons (`src/ui/identity.js`), mobile polish (portrait + landscape, e2e overlap check),
   `docs/ARCHITECTURE.md`. Spec doc updated. Deliverables: `release/` (gitignored) holds `leviathan-lane.html` (the build) and
   `leviathan-lane-src.zip` (`git archive` of main). Remaining: painted hero portraits.
7. Later (phase 5): `NetTransport` + Node.js WebSocket authoritative server (the owner can host Node).

## Architecture map
- `src/core/`: seeded RNG (sfc32), pools, spatial hash, event stream, state hasher, fixed 30 Hz loop.
- `src/sim/`: deterministic world (`world.js`), rules and systems (`match.js`, `systems/`), damage pipeline
  (`damage.js`), abilities framework (`abilities.js`), heroes (`heroes/*.js`, one module each), items
  (`items/index.js`), commands schema + validation (`commands.js`). Same seed + command log = same state hash.
- `src/ai/`: bots as ordinary clients emitting commands (states lane/trade/allin/retreat/siege; per-hero scripts).
- `src/net/transport.js`: LocalTransport with ping/jitter/loss + redundancy, allocation-free.
- `src/app/`: `session.js` (player + bots through the transport), `predictor.js` (client prediction),
  `spectate.js` (bot-only).
- `src/input/`: `desktop.js`, `touch.js`, shared `intent.js` targeting and `aim.js` aim shapes.
- `src/render/`: renderer, environment (procedural whale/sky/clouds), units (skinned heroes, VAT-instanced
  minions, structures), overlays, indicators, fx + GPU particles, zones, post (custom bloom), quality presets.
  `interp.js` is the single source of render positions (interpolation + prediction offset).
- `src/assets/`: `manifest.js` (only place naming assets), `models/*.glb` (CC0, produced by
  `tools/assets.mjs` from `tools/assets.config.js`), `CREDITS.md`.
- `src/ui/`: DOM UI (hero select, HUD, lane strip, shop, scoreboard, end screen, settings, perf overlay).
- `src/audio/`: Web Audio engine, synth voices, sounds, sfx director (sim events -> sounds), music director.
- `src/app/app.js`: application flow and lifecycle.
- `src/perf/`: telemetry (`window.__perf`) and budgets.

## Lessons learned (keep these)
- Declare every entity field in `createEntity()`. Adding properties later put V8 objects in dictionary mode
  and every double write allocated (541 -> 116 KB per simulated second after fixing).
- Avoid per-frame allocation in render code (pre-parse colours, no `Object.values`/spreads/string keys per frame).
- In hot per-vertex loops write typed arrays directly (`attr.array[i] = v`): non-inlined `setXYZ` calls box each double
  argument (measured 40 KB/s for the swipe ribbons). Pool per-attack records; never add fields to sim entities from render
  code (keep presentation state in maps). `for..of` over a Map allocates an entry per element: use `forEach` with a stored callback.
- In the container, SwiftShader makes frame time, FPS and GL submission meaningless: gate CPU-side metrics,
  use `?cpu=1` (160x90 buffer, >= 200 frames), GC pauses as thread CPU time, heap growth via soak slope,
  and verify CPU throttling with a warmed probe. Details in docs/PERF.md.
- Kenney rigs face +z at yaw 0 (`faceToRotY = PI/2 - a`); verified by close-up, don't "fix" it.
- Background processes do not survive between tool calls in some environments; keep each gate step short.
