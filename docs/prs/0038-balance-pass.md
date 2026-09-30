# PR #38: Balance pass with the simulation lab

Branch: `claude/goal-test-aotoyo` (commits for PR #38)

## Summary

The owner approved a balance pass ("yes do a balance pass"). Before it, hero win rates ranged from 17% to 68%, with a
standard deviation of 12.3 points. After it, every hero is between 41% and 58% on two independent seeds, the
standard deviation is about 5 points, and blue wins 50% of matches.

- **Passive numbers are patchable.** Saffi (Wick), Dredge (Heavy Chain) and Coralie (Living Reef) keep their passive
  numbers in a `tuning` block on the hero definition.
  - The simulation lab patches them as `heroes.<hero>.tuning.<name>`; `paths <hero>` lists them.
  - The passive tooltips are getters over the same numbers, so text and rules cannot drift apart.
  - Tests read the tuning values instead of hard-coding them.
- **Hero changes:**

| hero | change | why (lever found by the sweep) |
| --- | --- | --- |
| Saffi | hp 640 → 860, hp/level 100 → 128, armor 30 → 38, mr 32 → 36, wick burn 1.5% → 1.0% of max hp per second | survivability (she died 11.7 times per game); her damage and relight numbers did not matter |
| Dredge | Heavy Chain cap 20% → 4%, hp 650 → 580, hp/level 104 → 98, Hull Breach damage −15% | the passive (removing it: −11 points); his spell damage barely mattered |
| Morrow | Cog Toss damage −38% (65–205 → 40–127), Wind-Up shield −20% | Cog Toss (×0.6: −12 points); R cooldown, E cooldown and range: no effect |
| Lumen | Falling Star damage −38% (70–230 → 43–143), Starlight Thread −15% | Falling Star (×0.6: −8 points); R damage and range: no effect |
| Coralie | Coral Spike damage −50%, cooldown 10–8 → 12.5–10 s, reef 6×2 → 4×1.5 armor/mr, hp 640 → 600 | Coral Spike (×0.5: −9) and reef (off: −7); shield, armor and R: no effect |
| Vesper | Loop damage +35% (60–180 → 81–243) | Q damage (×1.3: +8); range and health: no effect |
| Wisp | hp 630 → 780, hp/level 102 → 112 | health (+7); spell damage: not significant |
| Brindle | Sting costs 2 bees (was 3), Buzz Shield 3 (was 5) with 1 s less cooldown; Sting, Buzz Shield and Hive Dome values +15%, +30%, +80% | bee supply: every value change alone gave only +1 to +5 points; cheaper spells gave +4 to +5 each |

## Method

All numbers come from the simulation lab (`tools/simlab.mjs`, medium bots, recommended builds, side-swapped pairs).

1. **Baseline.** 960 matches, seed 1: dredge 68.1, morrow 66.7, lumen 64.2, coralie 61.0 … vesper 37.9, wisp 37.6,
   saffi 17.3.
2. **Two blind rounds with moderate changes** (10–15% on obvious numbers). Only Saffi moved. Most win rates did not
   respond to the numbers I had guessed.
3. **Sensitivity sweep.** 34 single-lever A/B runs (`--focus <hero> --set … --ab`, 480 matches, seed 3), each lever
   pushed hard (×0.5–0.6, ×1.3, or the passive switched off). Significant levers (z > 2):

   | hero | lever | result |
   | --- | --- | --- |
   | Morrow | Cog Toss ×0.6 | 69.6 → 57.5 (z −3.9) |
   | Lumen | Falling Star ×0.6 | 63.3 → 55.0 (z −2.6) |
   | Dredge | no Heavy Chain | 72.1 → 60.8 (z −3.7) |
   | Coralie | Coral Spike ×0.5 | 68.8 → 59.4 (z −3.0) |
   | Coralie | no reef | 68.8 → 61.5 (z −2.4) |
   | Vesper | Loop ×1.3 | 40.0 → 47.9 (z +2.5) |
   | Wisp | hp 760 | 35.8 → 42.5 (z +2.1) |

   Levers with no effect (|z| < 1.6):
   - Morrow: R and E cooldowns, attack range.
   - Lumen: R damage, attack range.
   - Dredge: Q, E and R damage.
   - Coralie: W shield, armor, R cooldown, health.
   - Vesper: range, health.
   - Wisp: Q and R damage.
   - Saffi: relight, E damage.
   - Brindle: speed, R heal, health, E and W cooldowns, Q ratio, each alone.

4. **Four combined rounds** on the whole roster (960 matches, seed 1), scaling the levers found in step 3.
5. **Verification on a fresh seed** with twice the matches (1920 matches, seed 2) to avoid fitting one seed's noise.
   A hero's win rate over ~700 games has a standard error of about 1.9 points.

## Results (final code, no patches)

| run | spread (sd) | range | blue wins |
| --- | --- | --- | --- |
| before, seed 1, 960 matches | 12.3 | 17.3–68.1 | 52.8% |
| after, seed 1, 960 matches | 5.1 | 42.7–57.3 | 50.1% |
| after, seed 2, 1920 matches | 4.9 | 41.0–57.7 | 49.7% |

After, seed 2: dredge 57.7, brindle 56.7, gus 55.7, morrow 54.6, kestrel 54.6, coralie 52.6, lumen 51.0, rime 50.1,
cantor 49.6, thorne 49.2, nimbus 48.9, wisp 46.7, mistral 44.5, vesper 44.0, saffi 43.6, auctioneer 41.0.

Matches got slightly longer (10.0 → 10.5 min on average), because Saffi, Wisp and Coralie's allies die less.

## Findings

- **Numbers rarely matter.** Most numbers in a kit have no measurable effect on bot win rates. The heroes that were
  too strong were carried by one thing each: the spammable Q for the mages (Morrow, Lumen), the Q and passive for
  Coralie, and the passive for Dredge. Balancing by feel would have nerfed the wrong numbers; the sweep found the
  right ones in about 25 minutes.
- **Saffi was a survivability problem**, as the earlier diagnosis suggested: only health moved her (17 → 44%).
- **Brindle is limited by her resource, not her values.** Cheaper spells moved her, stronger spells did not.
- **Still slightly low: Auctioneer** (41–43% on both seeds). Next round.
- **Bot-based.** These are win rates between medium bots. Human play rewards other things (for example Saffi's
  mechanics), so a review with human players is still worth doing.

## Checks

- `npm test`: 91 passed (the Saffi and Dredge tests now read the tuning values).
- Gate: see below.
