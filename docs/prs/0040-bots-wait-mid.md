# PR #40: Bots wait in the middle between waves

Branch: `claude/goal-test-aotoyo` (commits for PR #40)

## Summary

The owner noted that bots "immediately go back to the base and then wait for the NPCs to spawn". With no allied minion
out (after a respawn, or after their wave died), the lane hold in `src/ai/bot.js` fell back to the inner tower, right
next to the base. Bots now wait 250 units short of the lane's centre (`WAIT_BEFORE_MID`), where the next waves meet.
Trades and pickoffs happen there, in the new neutral middle.

Trips to the fountain at low health (the `recover` state) are unchanged. They are real decisions; going back to heal
at 30% health is what players do too.

## What was measured

Hero positions sampled once a second over 40 bot matches, as a share of alive time:

| zone | before (4000 lane, inner-tower hold) | after (4800 lane, mid hold) |
| --- | --- | --- |
| next to the own inner tower (where bots used to wait) | 14.4% | 7.7% |
| at the own fountain (healing, shopping) | 14.7% | 16.6% (longer walk) |
| the middle bin | 29.9% | 35.2% |

The balance effect of the hold change alone is small. With the old hold on the new lane the hero spread was the same
(Gus 74%, Wisp 28%), so the rebalance in PR #39 is about the lane, not about this change.

## Checks

- `tests/bots.test.js`: before the first wave, every bot heads past its own towers and stops short of the centre.
