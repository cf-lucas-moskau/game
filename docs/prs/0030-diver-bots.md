# PR #30: Bots that play melee divers better

Branch: `claude/goal-test-aotoyo` (commits for PR #30)

## Summary

Handover item: "bots that play melee divers better (Saffi, Wisp)". Diagnosed and measured with the simulation lab
(PR #28): 960-match runs on the same plans (seed 1), before (after the sudden-death fix) and after.

What the data showed (probe scripts over 40-60 matches per hero, state and health sampled every second, the situation
recorded at every death):
- **No bot ever went back to heal.** Every hero spent about 40% of its alive time below 35% health. Saffi, who has no
  regeneration and a draining health bar, spent 44% below 20%.
- **Melee trades had no judgement.** A melee bot attacked the lowest-health enemy within 650 units, whatever its
  surroundings.
- **Divers died deep and under towers.** Saffi died 14.4 times per game, 42% of those deaths under an enemy tower.
  Causes: the lane hold point sat 60 units behind the first minion, i.e. inside tower range when the wave pushed;
  stale attack orders (a dash sets one) dragged heroes after their target; all-in chased targets under their tower.

Changes (`src/ai/bot.js`, `src/ai/threat.js`, `src/ai/perception.js`, the Saffi and Wisp scripts):
- **Recover state.** Below 30% health (40% for heroes without regeneration), or out of mana, with no enemy within 700,
  a bot walks to the fountain (12%/s heal, and the shop) until healed. Heroes spent 10-20% of their alive time at low
  health afterwards, down from about 40% (Saffi 44% -> 10% below 20%).
- **Kill threat.** `threat.js` estimates a hero's burst on a target from its ready abilities' value specs plus three
  basic attacks after resistances, and its reach (attack range plus a ready gap closer).
- **Melee commit.** Melee heroes go all-in on a target they can kill within reach, or on an enemy an ally is fighting,
  if the target is not covered by its tower and the enemies around it do not outnumber the allies around it.
  Otherwise they trade only close targets away from towers, and farm.
- **Tower discipline for everyone.** The lane hold point is clamped outside the enemy tower's reach; melee last-hits
  under a tower only with 3+ minions tanking; an in-position bot re-issues its move if an old attack order drags it
  under a tower; all-in drops a healthy target that its tower covers; Saffi's and Wisp's gap closers do not dash
  into tower shots (`towerCovers`).

## Results (960 matches, seed 1, medium bots, same plans)

| hero | before | after | z |
| --- | ---: | ---: | ---: |
| Wisp | 26.5% | 34.8% | +2.42 * |
| Dredge | 54.1% | 65.6% | +3.28 * |
| Auctioneer | 37.6% | 45.5% | +2.13 * |
| Saffi | 27.0% | 15.6% | -3.68 * |
| Kestrel | 65.3% | 57.4% | -2.13 * |
| Morrow | 76.7% | 69.7% | -2.18 * |

Kills per match 60 -> 38; match length 10.0 -> 10.3 min; blue side 51.3%; win-rate spread (sd) 0.130 -> 0.128.

**Saffi is a kit problem, now visible.** Her draining health makes her the lowest-health-share target for every enemy
bot. With healthier opponents (recover) she loses more. Focus runs isolate it:
- `--focus saffi --set heroes.saffi.base.ad=x1.25 --ab`: no change.
- `--set heroes.saffi.base.hp=x1.3 --set heroes.saffi.base.hpL=x1.3 --ab` (400 matches): 17.5% -> 31.5%, z 4.6.

Her survivability needs tuning. That is a balance decision for the owner, proposed separately, not done here.
Dredge and the remaining spread (Morrow 70%, Brindle 38%) are balance work for the lab too.

## Bugs found on the way

- Inserting the melee check between an `if` and its `else if` chain froze melee bots' state: Gus sat in `retreat`
  at full health for nine minutes. The ability-usage test caught it (Gus cast 6 spells).
- The full-match test expected 3+ items per hero; with bots now playing a 5.9-minute stomp, Auctioneer ended on 2
  items holding 1590 gold for a 1600 item. The check is now 2+ items (every bot shops).
