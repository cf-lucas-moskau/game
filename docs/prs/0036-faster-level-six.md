# PR #36: Level 6 sooner

Branch: `claude/goal-test-aotoyo` (commits for PR #36)

## Summary

Owner request: "It takes forever to get level 6, make that shorter please".

Heroes start at level 3. Levels 3 -> 6 now cost 220 + 260 + 300 = 780 xp (before: 380 + 480 + 580 = 1440);
from level 6 on, the curve is unchanged (`xpToNext` in `src/sim/constants.js`).

## Measured (60 bot matches, 359 hero-games, seed 3)

| | before | after |
| --- | ---: | ---: |
| median minute reaching level 6 (ultimate) | 2.63 | 1.49 |
| level 9 | 6.19 | 5.33 |
| level 11 | 8.49 | 7.97 |
| median match length | 11.20 | 10.86 |
