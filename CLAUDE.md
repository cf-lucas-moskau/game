# CLAUDE.md: handover for Leviathan Lane

Read this first. It is the state of the project and how to keep working on it.

## What this is
**Leviathan Lane**: an original browser 3v3 single-lane arena brawler (ARAM-like), 5 to 10 minute
matches, fought on the back of a giant sky-whale. Sixteen original heroes (with skins), 40 items in a build tree (components, upgrades, finished), bots, desktop
(mouse + keyboard) and mobile (touch) controls. 3D with three.js on a fixed angled camera, gameplay on
a 2D plane. Everything must be original (no League of Legends IP).

The owner's goals, in their words: "fully build the game as specced. No shortcuts, no placeholders or
workarounds. Everything must be easily replaceable later. Architecture fully modular. State of the art.
Make logical commits and PRs, merge them yourself on your set rules. We aim to win awards."
Performance and smoothness are critical: always measure (frame time, sim, render, GC, latency) with data.
The owner writes in German or English; answer in the language of their message.

Spec document (Claude Docs): https://claude.ai/code/artifact/9992dd94-0c29-42d7-aca8-44a8a11e3378
Updated after PR #27 (16 heroes with passives and kits, hero select, skins); earlier after PR #21 (3D rendering, rules numbers, auto ranks, pooled records,
measurement method). Keep it in sync when rules or tech change.

## Commands
```
npm install
npx playwright install chromium        # needed by e2e, bench, soak (or set PW_PATH to a playwright install)
npm run dev                            # play: http://localhost:5173/ (hero select), or ?hero=vesper&ping=100 to skip it
npm test                               # vitest: sim, heroes, items, bots, transport, predictor
npm run build                          # single self-contained dist/index.html (assets inlined), must stay < 16 MB
node tools/simlab.mjs run --matches 960           # simulation lab: bot matches -> balance statistics (docs/SIMLAB.md)
node tools/simlab.mjs run --focus saffi --set heroes.saffi.base.ad=x1.1 --ab   # try a balance change, A/B
node tools/bench.mjs                   # performance benchmark (see docs/PERF.md)
node tools/soak.mjs 4                  # leak check: retained-heap slope
node tools/shot.mjs "?quality=medium&skip=150" out.png 15 1280 720   # screenshot helper
node tools/lab.mjs heroes --cam front                  # Leviathan Lab: every hero up close (contact sheet PNG)
node tools/lab.mjs strip --hero saffi --clip attack    # animation frames across a clip
node tools/lab.mjs ability --hero gus --slot R         # timeline of an ability after the cast
node tools/lab.mjs attack --hero vesper                # auto-attack timeline;  shot / info: see the file header
```
URL parameters: `join=CODE` (online invite), `broker=host:port`, `netdebug=1`, `lab=1` (Leviathan Lab: isolated stage, `window.__lab`, panel; `cam= zoom= paused=1 panel=0 dummy= dummies=`), `hero=`, `heroes=a,b,c,d,e,f` (roster), `ping= jitter= loss=` (simulated network),
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
- The repository now lives on GitHub (`cf-lucas-moskau/game`); `main` holds PRs 1-46. Earlier notes: PRs 1-11: PR #10 (VFX) merged after a gate rerun in the new container (see docs/prs/0010-vfx.md), and
  PR #11 (UI) adds the full playable loop: hero select -> match -> end screen -> hero select.
- Playwright in this container: `PW_PATH=/opt/node22/lib/node_modules/playwright` (Chromium in /opt/pw-browsers).
- `src/app/app.js` owns the flow (menu with a bot-match backdrop, match, end screen) and tears each match
  down completely (renderer GL context, inputs, UI). URL shortcuts `hero= heroes= play=` skip hero select.
- Surrender is a sim command (`CMD.SURRENDER`), so it will work unchanged with the server.
- Numbers from the last full runs (gate for PRs 22-27; headless Chromium, SwiftShader software GPU):
  sim tick p95 0.1-0.2 ms desktop / 0.8 ms emulated phone, render update p95 0.3 ms desktop / 1.3 ms phone,
  scene draw calls 34-45 (budget 50: little headroom, batch pack props and domes next), heap 17.4 MB (inlined models
  of 16 heroes; dist 5.4 MB), corrections 0.3-0.6 per 10 s at 100 ms ping, soak slope 2.8 MB per 10 min.
  `gcPauseMaxMs` fails bench-eval on contention outliers (scavenger threads waiting behind SwiftShader GPU tasks);
  the A/B method and trace breakdown are in docs/prs/0027-hero-select.md. A justified bench-eval gets a `.ok` whose
  text points at the write-up.

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
   `leviathan-lane-src.zip` (`git archive` of main).
7. Done (PRs #22-#27, owner request "portraits, 10 more heroes, a hero select screen, skins"): modular skins
   (`src/assets/skins.js`, palette swaps into own atlas cells), hero presentation packs (`src/presentation/heroes/`),
   ten new heroes (Nimbus, Coralie, Kestrel, Mistral, Rime, Thorne, Cantor, Lumen, Dredge, Wisp), painted portraits
   rendered at runtime (`src/render/portraits.js`), sunk-head fix in `mergeSkinned`, screen-space picking, and the
   hero select screen. Balance by bot matches is recorded in docs/prs/0024-ten-heroes.md (the original six were
   already spread 37-73%; melee divers Saffi/Wisp are low because of shared bot engagement logic, not their kits).
8. Done (PRs #28-#33, owner request "simulation lab, diver bots, draw calls, client-hosted online play"):
   simulation lab (`tools/simlab.mjs`, `docs/SIMLAB.md`); sudden-death tiebreak fix (blue lost every simultaneous
   heart break); bots recover at the fountain and melee divers commit on kills; empty instanced layers no longer draw;
   the spectate bench ran 16 heroes since PR #24 (fixed); deterministic sim math; lockstep authorities; online
   lobbies over WebRTC through the public PeerJS broker (`docs/ONLINE.md`).
9. Done (PRs #35-#38): kill credit (last hero damage within 15 s), level 6 sooner, 40-item build tree, and a balance
   pass (docs/prs/0038-balance-pass.md): every hero within 41-58% on two seeds (sd 12.3 -> 4.9 points). Passive numbers
   live in a patchable `tuning` block per hero (Saffi, Dredge, Coralie so far). Bench scenarios pin `seed=7`.
10. Done (PRs #39-#40, owner request "a bigger part in the middle where turrets can't attack you; bots shouldn't go back
   and wait"): lane 4800 (560 units of open ground between the outer towers), whale scales with `LANE.W`, waves
   hit harder (minion attack x1.5, `RULES.MINION_VS_STRUCTURE`/`SIEGE_VS_STRUCTURE`), bots wait mid-lane between
   waves, rebalance for the new map (40-58% on two seeds). Ideas offered to the owner: neutral camps in the middle,
   a mid-lane objective, whale-roll events with pickups.
11. Done (PR #41): relics mirrored per side; combat, movement, hero upkeep and relic pickups alternate their order
   every tick; waves alternate spawn side; bot think phase from the seat within the team. Blue 51.6% (z 1.9) remains.
12. Done (PRs #42-#46, owner request "do all of them"): Barnacle Crab camps (neutral team, timed buffs), the Sky Pearl
   objective (capture, Pearl's Blessing, Pearl Golem waves), whale-roll loot, comeback bounties (streaks, shutdowns), Gale
   Shrines (Tailwind). Map features: `src/sim/{camps,pearl,pickups,shrines,buffs}.js`, bots `src/ai/objectives.js`, render
   `src/render/map-features.js`, UI `src/ui/objectives.js`. Matches 9.0 min mean (8.5% under 5 min), spread 41.6-59.5%.
13. Next: bots take few camps (1.6 per match); residual blue edge (~1.5 points, docs/prs/0041); online join sometimes hangs past 30 s (seen on main too, docs/prs/0039); Wisp is at the low edge (40-42%); predictor modelling of attack-move engagements and short hops (Saffi
   corrects ~1 per 10 s at 100 ms ping); desync resync (replay the command log), optional self-hosted broker, more skins.

## Architecture map
- `src/core/`: seeded RNG (sfc32), pools, spatial hash, event stream, state hasher, fixed 30 Hz loop.
- `src/sim/`: deterministic world (`world.js`), rules and systems (`match.js`, `systems/`), damage pipeline
  (`damage.js`), abilities framework (`abilities.js`), heroes (`heroes/*.js`, one module each), items
  (`items/index.js`), commands schema + validation (`commands.js`). Same seed + command log = same state hash.
- `src/ai/`: bots as ordinary clients emitting commands (states lane/trade/allin/retreat/siege; per-hero scripts).
- `src/net/`: `authority.js` (local / online host / online client), `protocol.js` (messages, command validation, build
  id), `lobby.js` (lobby state machines), `peer.js` (WebRTC via the public PeerJS broker), `transport.js`
  (LocalTransport with ping/jitter/loss + redundancy, allocation-free).
- `src/app/`: `session.js` (player + bots through the transport), `predictor.js` (client prediction),
  `spectate.js` (bot-only).
- `src/input/`: `desktop.js`, `touch.js`, shared `intent.js` targeting and `aim.js` aim shapes.
- `src/render/`: renderer, environment (procedural whale/sky/clouds), units (skinned heroes, VAT-instanced
  minions, structures), overlays, indicators, fx + GPU particles, zones, post (custom bloom), quality presets.
  `interp.js` is the single source of render positions (interpolation + prediction offset).
- `src/assets/`: `manifest.js` (only place naming assets), `skins.js` (skins as patches over looks; `resolveLook`), `models/*.glb` (CC0, produced by
  `tools/assets.mjs` from `tools/assets.config.js`), `CREDITS.md`.
- `src/presentation/heroes/`: one presentation pack per hero (identity, aim, attack styles, sounds, effect hooks);
  `src/render/hero-fx.js` runs them against the generic decal/zone/particle engines. A hero = sim module +
  `src/ai/heroes/<hero>.js` bot + pack; `tests/presentation.test.js` checks completeness.
- `src/ui/`: DOM UI (hero select, HUD, lane strip, shop, scoreboard, end screen, settings, perf overlay).
  Portraits come from `src/render/portraits.js` through `ui/identity.js#setPortraitSource`.
- `src/audio/`: Web Audio engine, synth voices, sounds, sfx director (sim events -> sounds), music director.
- `src/app/app.js`: application flow and lifecycle.
- `src/perf/`: telemetry (`window.__perf`) and budgets.
- `src/stats/`: simulation lab core (match statistics collector from events, match plans, patches, aggregation,
  reports); CLI `tools/simlab.mjs`, guide `docs/SIMLAB.md`.

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
- Skinning matrices exist only after a render (or `skeleton.update()`): a precise `Box3` of a skinned mesh before that
  is wrong. Measure what is drawn (the portrait studio renders a small silhouette) instead of trusting bind data.
- `mergeSkinned` must keep each part's mesh world and bind matrices when re-binding (dropping them sank heads).
- Pick units in screen space (`intent.screenPick`), not by projecting the cursor onto the ground.
- Balance by bot matches needs 480-960 matches per round (a hero's win rate has ~3% standard error at ~350 games). Use the
  simulation lab (`tools/simlab.mjs`): an `--ab` run diverges chaotically from its baseline, so judge only the patched hero's z.
- Balance levers are few and not obvious: most kit numbers have no measurable effect on bot win rates. Run a
  sensitivity sweep first (one hard-pushed lever per `--focus X --set ... --ab`, 480 matches), then scale only the
  levers with |z| > 2, and verify on a fresh seed with 1920 matches. Put passive constants in the hero's `tuning` block.
- Never iterate units in a fixed order when it decides who acts first: alternate per tick (ids are not team-neutral).
  Map positions are per side (`sideX`), never absolute x.
- Bench runs must pin their match seed: the roster alone swings prediction corrections and load.
- Kenney rigs face +z at yaw 0 (`faceToRotY = PI/2 - a`); verified by close-up, don't "fix" it.
- Background processes do not survive between tool calls in some environments; keep each gate step short.
- Never run builds, browsers or the simulation lab while gate bench steps run: contention shows up as GC outliers
  (a 46.9 ms desktop pause during a concurrent e2e run).
- The sim must stay cross-engine deterministic for online play: only `src/core/dmath.js` math (tests enforce it).
- The container's proxy blocks WebSocket upgrades: the public PeerJS broker cannot be reached from here; the online
  e2e runs a local PeerJS server (`peer`) with the same protocol.
