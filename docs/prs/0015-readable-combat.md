# PR #15: Readable combat

Branch: `claude/goal-test-aotoyo` (GitHub), commit f91b0e8

## Summary

Owner feedback: auto-attacks looked alike and tower range/targeting was unreadable although towers hit hard. Every attacker now has its own projectile shape, trail, launch and impact (attack-styles.js, projectile shader: lance, gear, ink blot, bee, coin, rock, shard); melee units swipe crescents timed to the hit. Towers show their range ring when you approach (red and pulsing when they target you), a lock-on beam to the hero they shoot, a heavier impact, a HUD warning ('Tower is targeting you') and an alarm; per-hero auto-attack sounds.
