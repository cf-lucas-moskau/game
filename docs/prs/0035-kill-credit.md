# PR #35: Kill credit and kill gold

Branch: `claude/goal-test-aotoyo` (commits for PR #35)

## Summary

Owner report: "I am not sure if killing someone gives me gold. And if I damage someone and then they die to a turret
it doesn't count as my kill; it should always be last damage dealt, with like a 15 second window."

What the code did:
- Kill gold existed: 300, plus 20 per level the victim is above the killer.
- The kill banner always said "+300 gold", even when the level bonus paid more.
- A tower, minion or whale-edge finish credited nobody. Recent damagers got assists (150), and without any, the gold
  was shared.

Now:
- **Kill credit (`RULES.KILL_CREDIT_WINDOW = 15`).** An enemy hero's killing blow credits that hero. Otherwise the kill
  goes to the last enemy hero who damaged the victim within 15 s, with full kill gold and XP and takedown hooks such
  as Wisp's resets. Other damagers within the 10 s assist window assist. With nobody in the window, the gold is
  shared as before.
- **`EV.KILL` carries the bounty** (`c`). The HUD banner shows the real amount, and the kill feed names the credited
  hero even when a tower struck.
- **New `EV.ASSIST` event** (one per helper, with its gold) and an "Assist on X, +150 gold" banner, so assist gold
  is visible too.

## Checks

3 new tests:
- a tower finish 12 s after a hit credits the hitter (kill, 300 gold, `KILL.b` and `KILL.c`);
- after 16 s nobody gets the kill and the gold is shared;
- with two damagers the latest gets the kill and the earlier one the assist.
