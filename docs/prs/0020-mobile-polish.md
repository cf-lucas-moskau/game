# PR #20: Mobile polish

Branch: `claude/goal-test-aotoyo` (GitHub), commit 3f26b94

## Summary

Walked the whole loop (menu, settings, shop, inspect, tower lock, pause, end screen) on an emulated phone in
landscape (844x390) and portrait (390x844) and fixed what was broken:

- Portrait: the HUD dock covered the lane strip, the clock and the Score button, and the "Tower is targeting you"
  label sat under the dock. The strip and clock now drop below the dock, the dock narrows to clear the buttons, and
  the kill feed, tower-lock label and inspect panel move down with them.
- The inspect panel on touch ran off the bottom of a landscape phone. It is now compact and scrolls; K/D/A never
  splits across lines.
- The end-screen scoreboard was unreadable in portrait (columns overlapped, K/D/A wrapped to three lines). Narrow
  screens hide the minion column and show items as icons. In short landscape the end screen is compacted.
- Settings opened behind the menu: UI stacking layers are now explicit (menu/HUD < inspect/perf < modal < settings).
- "1 kills" now reads "1 kill".
- The renderer applies a resize requested by the resolution guard at the start of the next frame, before drawing.

## Checks

New e2e check: the phone HUD parts (dock, lane strip, clock, Score, Attack, D, R) must not overlap each other or
leave the screen, at 844x390 and 390x844. It fails on the old layout (`overlaps dock/strip dock/clock dock/score`
at 390x844) and passes now. CSS-only changes apart from the renderer ordering; gate results in PR #21's write-up.
