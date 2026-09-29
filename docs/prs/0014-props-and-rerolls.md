# PR #14: Props in the hands, unlimited rerolls

Branch: `claude/goal-test-aotoyo` (GitHub), commit 03f7f5c

## Summary

Owner feedback: every hero seemed to carry something in the middle of the stomach, and one reroll was too few. Held props used fixed bone-local offsets that put them across the belly (arm bones sit at the shoulder on these rigs); the grip is now found on the mesh (the arm's farthest vertices) and props are oriented upright in the hero's frame. Rerolls are unlimited and always change the hero. (PR #18 fixed a follow-up: the idle pose was not applied when fitting.)
