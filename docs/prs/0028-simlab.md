# PR #28: Simulation lab

Branch: `claude/goal-test-aotoyo` (commits for PR #28)

## Summary

Owner request: "similar to the lab where you can inspect characters closer, create a simulation lab: easily and
reproducibly, through a CLI, start bot matches so that we can balance the whole thing more reliably. Speedrun games
between bots and give statistics about which items they bought, how much damage they dealt, how much they took".

- `tools/simlab.mjs` with `run`, `report`, `compare` and `paths`, on worker threads (about 22 matches/s on 4 cores:
  960 matches in 43 s). The guide is `docs/SIMLAB.md`.
- **Reproducible.** Match i of a run is determined by the run seed, i and the code. Verified: 40 matches with 1 worker
  and with 4 workers give identical records.
- **Match designs.** Random rosters from a pool (no duplicates by default), fixed sides, focus heroes, side-swapped
  pairs (default), per-side bot difficulty, and four build modes (`recommended`, `shuffled`, `role`, `random`), so
  items can be judged outside the scripted builds.
- **Statistics** (`src/stats/match-stats.js`, events only): K/D/A, level, CS, gold, items with minutes, damage to
  heroes by type and cause, damage to minions and structures, damage taken by source, healing and shields (self,
  allies), CC applied and received, slows, casts per ability, time dead, gold per minute; per match: length, first
  blood, first tower, towers, kills, sudden death.
- **Aggregation** (`src/stats/aggregate.js`): hero table with Wilson 95% intervals and ▲/▼ significance flags,
  damage profiles, builds, item table (buy rate, minute, slot, win rate with/without), matchups and partners, run
  comparison with two-proportion z. Text, Markdown and CSV output.
- **Balance patches.** `--set path=value` or `--patch file.json` set, scale (`x0.9`) or add (`+5`) any hero, item,
  rules, minion or structure number for a run. `--ab` plays the same plans with and without the patch and compares.
  `paths <hero>` lists what can be patched.

## Sim changes (presentation-neutral)

- Event records gained a numeric field `c`. `EV.DAMAGE` carries the cause (`CAUSE.BASIC/ABILITY/OTHER` from the
  damage options). `EV.STUN` carries the source unit, and its kinds are named (`CC.STUN/ROOT/AIRBORNE/DISPLACE`;
  non-airborne knockbacks now report `DISPLACE`). `EV.SHIELD` carries the source in `b`. New `EV.SLOW` event.
- `stun`, `root`, `knockUp`, `knock`, `slow` and `addShield` take an optional source. All 45 call sites in hero modules
  and items pass the caster.
- Silent heals (lifesteal, heal-over-time) are reported as quiet heal events (`c = 1`) that floaters and particles
  skip. Regeneration now passes no source and is not reported, like the fountain.
- Bots accept a build override, and the director a per-player difficulty (defaults unchanged).
- `tools/simulate.mjs` is replaced by the lab.

## Checks

- Tests: 6 new (`tests/simlab.test.js`): reproducible plans and replays, mirrored pairs, fixed sides, focus and
  difficulty, build modes, patches (set, scale, add, bad paths), and statistics invariants: damage one team dealt to
  enemy heroes equals the hero damage the other team took (exact); damage type and cause splits sum to the total;
  gold spent equals item costs. 69 tests pass.
- Patch reaches play: Saffi's AD at spawn 71.6 -> 88.1 with `heroes.saffi.base.ad=x1.25`.

## Findings from the first runs (960 matches, seed 1, recommended builds, medium bots)

- Win rates range from 27.8% (Saffi) and 28.7% (Wisp) to 75.6% (Morrow). Significant (▲/▼) are Morrow, Kestrel, Gus
  and Lumen above; Vesper, Auctioneer, Brindle, Wisp and Saffi below.
- **Side bias.** Blue wins 42.8% (95% CI 40-46), although every roster plays both sides. This needs investigating
  (map or processing-order asymmetry).
- In 319 of 480 swapped pairs the same roster won on both sides, so hero strength decides more than side or chance.
- First blood falls at 0.3 min on average (level-3 heroes meet at the first wave); its team wins 61%. First tower
  at 4.4 min, 79%.
- `--focus saffi --set heroes.saffi.base.ad=x1.25 --ab` (200 matches): Saffi 35.0% -> 33.5%, damage to heroes +2%.
  Her numbers are not what holds her back; the bots' diving is (PR #30).
