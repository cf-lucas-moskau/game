# Simulation lab

`tools/simlab.mjs` plays headless bot matches as fast as the machine allows (about 15 matches per second on 4 cores)
and turns them into balance statistics: win rates with confidence intervals, damage dealt and taken, healing,
shielding, crowd control, gold, items, builds, matchups and match flow. Runs are reproducible: the same command on
the same commit produces the same matches, whatever the worker count.

It is the Leviathan Lab's counterpart for balance. The Leviathan Lab (`tools/lab.mjs`) shows one hero up close; the
simulation lab shows how the whole roster performs across hundreds of matches.

## Commands

```
node tools/simlab.mjs run [options]                 play matches, print the report, save the results (JSON)
node tools/simlab.mjs report <results.json>         re-print a saved run  (--hero, --md, --csv, --json)
node tools/simlab.mjs compare <a.json> <b.json>     per-hero and per-item win-rate changes, A = baseline
node tools/simlab.mjs paths <hero>                  the numbers a patch can change for a hero
```

Options for `run`:

| option | meaning | default |
| --- | --- | --- |
| `--matches N` | number of matches | 200 |
| `--seed S` | run seed; match i's roster, sides, builds and sim seed derive from (S, i) | 1 |
| `--pool a,b,...` | heroes to draw from | all |
| `--blue a,b,c` / `--red d,e,f` | fixed heroes per side (fewer than 3 are filled from the pool) | random |
| `--focus a,b` | these heroes play in every match, on a random side | none |
| `--no-swap` | independent matches instead of side-swapped pairs | pairs |
| `--duplicates` | allow a hero more than once per match | off |
| `--difficulty d` | bot difficulty `easy`, `medium`, `hard` | medium |
| `--blue-difficulty d` / `--red-difficulty d` | per side (the difficulty stays with its heroes when pairs swap sides) | |
| `--builds mode` | `recommended` (each hero's build), `shuffled` (same items, random order), `role` (random items sharing tags with the recommended build), `random` (any items) | recommended |
| `--max-minutes M` | stop a match after M minutes (counted as timed out, left out of win rates) | 20 |
| `--set path=value` | balance patch, repeatable (see below) | |
| `--patch file.json` | balance patch from a file `{ "path": value }` | |
| `--ab` | play the same match plans without and with the patch and compare them | |
| `--hero h` | print one hero in depth (every stat, matchups, partners) | |
| `--workers N` | worker threads | CPU count |
| `--out file` / `--label name` | where to save the results | `simlab-results/<time>[-label].json` |
| `--md file` / `--csv dir` / `--json` | Markdown report, CSV tables (one row per hero-game, per hero, per item), aggregate as JSON | |

## Balance patches

A patch changes numbers for one run without editing code. Paths start at `heroes`, `items`, `rules`, `minions` or
`structures`; `paths <hero>` lists a hero's base stats, ability cooldowns, costs, ranges and value specs.

```
--set heroes.saffi.base.ad=70                         set a number
--set heroes.saffi.abilities.Q.cd=[7,6.5,6,5.5,5]     set an array (quote it in the shell)
--set heroes.vesper.abilities.R.values.0.base=x0.9    scale (arrays element-wise)
--set items.iron-fin.cost=+100                        add or subtract (+N, -N)
--set rules.RESPAWN_BASE=6
```

Patches are applied in place inside the worker threads, once, before any match (ability casts read their module-level
value specs directly, so an in-place change is the only one play sees). Each worker runs a single configuration.
When a change works, write it into the hero module; the patch is for trying.

## Workflow for a balance change

1. Baseline: `node tools/simlab.mjs run --matches 960 --label base`. Heroes marked ▲ or ▼ have a 95% interval that
   excludes 50%.
2. Look at why: `report <file> --hero saffi` (damage split, CC, deaths, time dead, matchups), and the damage profile
   table (basic/ability/other and physical/magic/true shares, casts per ability).
3. Try a change: `run --focus saffi --matches 960 --set heroes.saffi.abilities.Q.cd=x0.85 --ab`.
4. Keep it if the focus hero's delta is significant (z ≥ 1.96, marked `*`) in the right direction and nobody else moved
   far; write it into the code; re-run the baseline.

## Reading the numbers

- **Sample size.** A win rate from n games has a standard error of about 50%/√n: ±3.5 points at 200 games, ±2.2 at
  500, ±1.6 at 1000 (95% intervals are about twice that). A hero appears in about 6/16 of matches drawn from all 16,
  so 960 matches give about 360 games per hero. Use `--focus` to put a hero in every match.
- **A/B noise.** `--ab` plays the same plans (rosters, sides, builds, seeds) with and without the patch, but one
  changed number makes every later moment of a match different, so outcomes diverge like independent samples. Heroes
  the patch does not touch still move by a few points in small runs. Judge the patched hero by its z value and use
  enough matches.
- **Side-swapped pairs.** With pairs (default) each roster plays both sides, so side advantage cancels out. The summary
  counts pairs won by the same roster on both sides: a high share means the roster (hero strength) decides more than
  side or chance.
- **Items.** An item's win rate compares hero-games that bought it against those that did not. With `recommended`
  builds every hero follows a script, so item numbers mostly mirror which heroes buy them; for item balance use
  `--builds role` or `random`. Late items are bought by heroes who are ahead (more gold), which inflates their win rate.
- **Bots, not people.** These are bot matches: a hero whose kit the bots play badly (a diver without good engage
  logic, say) reads weak whatever its numbers. The damage profile and per-ability cast counts help to tell a kit
  problem from a bot problem.

## Statistics collected

Per hero and game (`src/stats/match-stats.js`, from the sim's event stream):
- kills, deaths, assists, level, minions killed, net gold earned and spent, items with purchase minute;
- damage to enemy heroes, split by type (physical, magic, true) and by cause (basic attack, ability, other: passives,
  item effects, summons); damage to minions and structures;
- damage taken, split by source (heroes, minions, structures);
- healing (self, allies, received), shields (self, allies);
- crowd control applied to enemy heroes in seconds (stun, root, airborne), displacements, slow seconds (plain and
  weighted by strength), CC and slows received;
- casts per ability, seconds dead, gold at each minute.

Per match: length, winner, kills per side, first blood and first tower (minute, side), towers per side, whale rolls,
the minute sudden death began.

Damage events carry their cause, and crowd-control, slow and shield events carry their source (`CAUSE`, `CC` and the
`c` field in `src/core/events.js`); heals over time are reported as quiet events that presentation ignores. A test
checks that the damage books balance: what one team dealt to enemy heroes equals what the other team took from heroes.

## Code

- `src/stats/match-stats.js`: the collector (plain JSON records; no DOM, so the game could show it too).
- `src/stats/simlab.js`: run config, match plans (seeds, rosters, sides, builds), `runMatch`, patches.
- `src/stats/aggregate.js`: hero, item, matchup and match tables; Wilson intervals; run comparison.
- `src/stats/report.js`: text and Markdown tables.
- `tools/simlab.mjs`: the CLI and the worker pool.
- `tests/simlab.test.js`: reproducibility, patches, statistics invariants.
