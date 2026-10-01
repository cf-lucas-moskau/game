# Architecture

Leviathan Lane is split into layers that depend in one direction only:

```
            input/ (desktop, touch)        ai/ (bots)
                     \                      /
                      commands (plain objects, validated)
                                 |
                          net/transport.js   <- LocalTransport today, NetTransport + Node server later
                                 |
                  sim/ (deterministic World, 30 Hz)   <- imports core/ only
                                 |
                   core/events.js ring buffer (sim -> presentation)
                     /            |             \
              render/          ui/            audio/
                     \            |             /
                       app/ (flow, session, prediction, lab)
```

The rules that keep it replaceable:

- **The sim never imports render, ui, audio, input or app.** It has no DOM, no wall clock and no
  `Math.random`. Same seed + same command log = same state hash (`stateHash` in `sim/match.js`, checked by tests).
- **Every action is a command.** The local player, bots, the shop and surrender all send the same plain command
  objects through the transport (`sim/commands.js` defines and validates them). A network server only has to
  replace the transport.
- **Presentation reads, never writes.** Renderer, UI and audio read the world and drain the event stream. They
  keep their own state in maps keyed by entity id; they never add fields to sim entities.
- **Assets are named in one file.** `assets/manifest.js` maps keys to GLB files, animation clips and hero looks.
  Swapping art means replacing a GLB (or re-pointing `tools/assets.config.js`) and adjusting the look entry.
- **Skins are patches over looks.** `assets/skins.js` lists each hero's skins: palette swaps (a recoloured copy of
  the rig's palette texture in its own atlas cell; only that skin's body UVs point at it), prop, rig, accent and
  golem-tint overrides. `resolveLook(hero, skin)` is the only way presentation code gets a look. Skins ride in
  the roster (`session.roster[i].skin`, bots pick one from a presentation RNG); the sim never sees them.
- **Content is data + hooks.** A hero is three modules: its rules in `sim/heroes/<hero>.js` (stats, abilities,
  recommended build), its bot in `ai/heroes/<hero>.js`, and its presentation pack in `presentation/heroes/<hero>.js`
  (identity, aim shapes, attack styles, sounds and effect hooks). An item is one entry in `sim/items/index.js`.
  Adding either touches no system code; `tests/presentation.test.js` checks that every hero is complete.

## Frame and tick

`core/fixed-loop.js` runs the sim at a fixed 30 Hz and renders at display rate with an interpolation factor.

One tick (`GameSession.tick` in `app/session.js`):

1. Bots think (`ai/director.js`) and push commands.
2. The transport delivers the player's commands that have "arrived" (simulated ping, jitter and loss, with
   redundancy and dedupe).
3. `World.step(commands)` saves previous positions, rebuilds the spatial hash, runs due timers, then runs the
   systems in order: command, clock, hero, movement, combat, projectile, zone, economy, win (`sim/match.js`).
4. The predictor is told which of the player's commands were applied.

One frame (`GameSession.frame`):

1. The predictor advances the local hero's visual offset (`app/predictor.js`).
2. UI listeners update (HUD, lane strip, shop, floaters).
3. `GameRenderer.render(alpha, dt)` drains the sim events to its extras (fx, combat fx, ability fx, zones,
   indicators, audio, UI taps), interpolates positions (`render/interp.js` is the only source of render
   positions), updates views and draws.

## Simulation (`src/sim/`)

- `world.js`: the `World`: entity records (index = id, pooled via a free list), spatial hash queries
  (`query`, `forEachInRadius`, `nearestEnemy`, all allocation-free), timers, `step`.
- `entity.js`: `createEntity()` declares **every** entity field up front so V8 keeps one hidden class.
  Adding a field anywhere else puts records into dictionary mode (see "Lessons" in CLAUDE.md).
- `match.js`: `createMatch`, the rules systems (commands, clock, whale roll, sudden death, economy, shop,
  win/surrender) and `stateHash`.
- `systems/movement.js`, `systems/combat.js`: pathing on the lane plane, auto-attacks, tower targeting.
- `damage.js`: the one damage pipeline (armor/MR, shields, item hooks, kill credit, events).
- `abilities.js`: casting, costs, cooldowns (static or state-dependent: `abilityCost`, `abilityCooldown`) and
  auto-leveled ranks (`ranksForLevel`). `resources.js`: which pool each resource type pays from (mana, gold, a
  hero's own bar such as ink, swarm or energy, or nothing).
- `heroes/kit.js`: helpers for hero modules (skillshots, AoE, polylines, `amount()` for value specs).
- `heroes/*.js`: one module per hero (16): base stats, a passive, hooks (`init`, `onTick`, `onRespawn`,
  `onBasicAttack`, `onDealtDamage`, `onTookDamage`, `modifyDamageIn`, `modifyStats`, `onCast`, `onTakedown`...) and four abilities. Ability
  numbers are **value specs** (`{ base, ratio, stat }`) used both by the cast and by tooltips, so the UI never
  duplicates a number.
- `items/index.js`: a build tree of 40 items (`from` recipes; tiers 1-3 follow from it; `group` for boots): stats summed by
  `stats.js` (including cooldown reduction, penetration, tenacity, regeneration), unique effects as hooks (`onBasicHit`,
  `onDealtDamage`, `onAbilityCast`, `onLethal`, `onTick`, ...). `match.js#purchasePlan` prices a purchase after the
  components it uses up; the shop and the bots both use it. Recommended builds live in the hero modules (`build`).
- `constants.js`: lane geometry, tick rate, rules (tower HP, gold, respawn, sudden death), map feature spots (`MAP.CAMPS`,
  `PEARL`, `SHRINES`, `RELICS`: every one on the centre or in pairs symmetric through it or mirrored per side).
- Map features, each one module with a `setup*` and a system in `createMatch`:
  - `camps.js`: Barnacle Crab camps (`TEAM.NEUTRAL`, `KIND.CRAB`, `NEUTRAL` specs): spawn, chase-and-leash, rewards.
  - `pearl.js`: the Sky Pearl objective (announce, surface, capture by holding the circle, Pearl Golem waves).
  - `pickups.js`: health relics and whale-roll loot (pickup kinds).
  - `shrines.js`: Gale Shrines (channel for Tailwind).
  - `buffs.js`: data-driven timed buffs (`BUFFS`), folded into hero stats by `stats.js`, expired in hero upkeep.
  - Comeback bounties live in `damage.js#kill` (`streak`, `shutdownGold`).
  - Events: `EV.BUFF`, `EV.OBJECTIVE` (s names what happened), `EV.PICKUP`. Bots: `src/ai/objectives.js`; render:
    `render/map-features.js` (crabs, Pearl, coins, bounty stars, shrine cairns) and disc kinds in `render/zones.js`;
    UI: `ui/objectives.js` (buff chips, Pearl bar, banners, feed).

## Presentation

### Render (`src/render/`)
three.js on a fixed angled camera; gameplay stays on a 2D plane.

- `renderer.js`: owns the WebGL context, camera (with shake and an override for the Lab), resize guard,
  post-processing and the list of pluggable **extras** (`onEvent(e)` + `update(world, alpha, dt, now, renderer)`).
- `environment.js`: procedural whale back, sky, clouds and props.
- `units.js`: skinned heroes (merged meshes, props baked into the skin, per-hero looks from the manifest),
  VAT-instanced minions (`vat.js`), structures, the Pebble companion.
- `overlays.js`: health bars, ground decals, projectile views (shape shader per `attack-styles.js`).
- `combat-fx.js`: melee swipes, tower range rings, lock-on tethers, launch flashes and impacts (pooled records).
- `hero-fx.js`: runs the presentation packs. It dispatches casts, blinks and named effects to the pack that owns
  them and gives packs one api over three generic engines, each of which calls a hook between its per-frame reset
  and its GPU upload: `ability-fx.js` (ground decals in each hero's style), `zones.js` (ribbons, discs, domes,
  telegraphs) and `fx.js` + `particles.js` (GPU particles). `indicators.js`: aim shapes.
- `atlas.js`: runtime texture atlas + one shared lit material (draw calls stay under 50).
- `glow-lights.js`: a fixed pool of point lights assigned to the nearest glowing props.
- `quality.js`: low/medium/high presets and the `ResolutionGuard` that lowers resolution under load.

### UI (`src/ui/`)
Plain DOM, no framework. `dom.js` has `h()` and change-detected setters so per-frame updates do not touch the
DOM unless a value changed. Screens: hero select (`menu.js`), HUD (`hud.js`, lane strip `minimap.js`), shop,
scoreboard, inspect panel, end screen, pause and settings, perf overlay, floating damage numbers (pooled).
`numbers.js` computes every number shown to players from the sim's own declarations (value specs, item stats).
`identity.js` holds hero emblems and item icons (SVG) in one place, so painted art can replace them later.

### Audio (`src/audio/`)
Web Audio. `engine.js` (context, buses, unlock), `synth.js` (persistent voice pools, no graph per sound),
`sounds.js` (the sound palette), `sfx.js` (sim events to sounds, positioned by camera distance and rate-limited per sound) and `music.js` +
`theory.js` (generative music; intensity follows the fighting, tempo rises in sudden death).

### Input (`src/input/`)
`desktop.js` (mouse + keyboard) and `touch.js` (floating joystick, ability buttons with drag-to-aim and cancel)
both turn gestures into commands through the session. `intent.js` resolves targets, `aim.js` defines aim
shapes shared with the indicators. Both dispatch `ll-toggle` events for UI panels (shop, scoreboard, perf, menu).

## Application (`src/app/`)

- `app.js`: the flow: menu with a live bot-match backdrop, match, end screen, back to the menu. Each match is
  torn down completely (GL context, inputs, UI, audio voices).
- `session.js`: one match: world, authority (local, online host or client), bots where the match is decided,
  renderer, predictor, loop (which keeps simulating in hidden tabs online).
- `predictor.js`: client-side prediction for the local hero's movement; corrections are counted by telemetry.
- `spectate.js`: bot-only matches (menu backdrop, `?spectate=1`).
- `lab.js`: the Leviathan Lab (`?lab=1`): one hero on an isolated stage with dummies, camera presets, forced
  animation clips, casting, pause and frame stepping. `tools/lab.mjs` drives it from the command line.

## Networking (`src/net/`, `docs/ONLINE.md`)

Every tick `GameSession` asks its **authority** which commands to apply (`authority.js`):
- `LocalAuthority`: single player. Bots, plus the player through `transport.js` (`LocalTransport`), which simulates
  ping, jitter and loss (each command rides in several packets, deduplicated by sequence number).
- `HostAuthority`: the online host. Bots, the host player and remote players' validated commands (`protocol.js`); it
  broadcasts every tick's commands, and a state hash every 30 ticks.
- `ClientAuthority`: an online client. It sends the player's commands to the host and steps only on the host's
  tick bundles (lockstep with the host as authority); it detects desyncs and catches up after hitches.

Lockstep needs the same world on every machine from the same inputs, so the sim uses `core/dmath.js` instead of
engine-approximated math (a test forbids `Math.sin`, `atan2`, `hypot`, `**` in the sim). Players connect directly by
WebRTC (`peer.js`), introduced through the public PeerJS broker by a lobby code; `lobby.js` holds the lobby state
machines (seats, picks, readiness, start, back to lobby). No server of ours runs anywhere.

## Statistics and the simulation lab (`src/stats/`, `docs/SIMLAB.md`)

`match-stats.js` builds per-hero and per-match statistics from the event stream alone (damage events carry their
cause, crowd control, slows and shields their source). `simlab.js` plans reproducible bot matches (rosters, sides,
builds, seeds from the run seed and match index) and applies balance patches; `aggregate.js` and `report.js` turn
records into tables. `tools/simlab.mjs` runs matches on worker threads.

## Performance (`src/perf/`, `tools/`, `docs/PERF.md`)

`telemetry.js` records sim, render, UI and audio times, GC pauses, draw calls, input latency and prediction
corrections (`window.__perf`, the F3 overlay). `budgets.js` holds the budgets; `tools/bench.mjs` and
`tools/soak.mjs` measure them in headless Chromium and `scripts/check.sh` gates merges. Measurement method and
the limits of a software GPU are documented in `docs/PERF.md`.

## Build

Vite with `vite-plugin-singlefile` produces one self-contained `dist/index.html`: code, fonts and GLB models
are inlined (models as data URLs decoded without `fetch`, so the file also works from `file://`).
