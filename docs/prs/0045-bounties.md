# PR #45: Comeback bounties

Branch: `claude/goal-test-aotoyo` (commits for PR #45)

## Summary

- **Streaks.** Heroes count kills since their last death (`streak`).
- **Shutdowns.** From 2 kills on, ending the streak pays a shutdown on top of the kill gold: 100, then +75 per further
  kill, at most 500 (`shutdownGold`). The KILL event carries `s = 'shutdown'`.
- **Announcements.** Streaks of 3, 5 and 7 are announced: "End it" for the enemy, "Stay alive" for allies.
- **Wanted marker.** A gold star turns over every hero worth a shutdown and grows with the bounty.
- **Feed and scoreboard.** The scoreboard shows the bounty; the kill feed tags shutdowns.
- **Killer feedback.** The killer gets a "Shutdown!" banner and sound.

## Measured

4.7 shutdowns per match (960 bot matches).
