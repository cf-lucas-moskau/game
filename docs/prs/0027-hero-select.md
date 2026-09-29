# PR #27: Hero select screen

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Owner request: "create a hero selection screen at the beginning, not only a roll mechanism". The menu is now a real
hero select:

- **Roster.** All 16 heroes as painted-portrait tiles (PR #25) with short names, accent-coloured selection, and role
  filters (All, Mages, Frontline, Marksmen, Supports, Assassins, derived from each hero's role). A Random tile and a
  Random button keep the unlimited reroll (always a different hero).
- **Detail card.** Portrait in the chosen skin, name, title, role, difficulty and resource; the passive (the six
  original heroes got written passives) and all four abilities; skin swatches with each skin's own portrait, name and
  blurb (PR #22); bot difficulty; Fight.
- **Memory.** The last chosen hero and skin are remembered (settings); a random pick is not.
- **Layout.** Desktop grid next to the card; Controls collapse into a disclosure next to Settings. Landscape phones
  keep the grid and the card side by side, and portrait phones stack them. Role filters scroll sideways when narrow.

## Checks

- e2e: clicking a roster tile selects that hero; the chosen hero and skin reach the match (`session.roster[0].skin`);
  unlimited reroll still passes; the menu shows painted portraits.
- Visual: screenshots at 1280x720, 844x390 and 390x844.
- e2e battlefield inspect: the test used to click the first allied bot. It failed intermittently in the gate
  ("(Saffi Blinkwick)" was the stale scoreboard panel, so nothing was picked). The debug runs showed every passing
  click landing on the canvas near the centre. The failures came from the ally having walked off-screen or under the HUD
  by the time the test reached this step (once every bot was down the lane). The test now clicks the first unit whose body is
  on the canvas: heroes first (allies before enemies), then Pebble, minions, towers and the Heartstone
  (`elementFromPoint` must be the canvas). It reports which unit was clicked and which one the panel shows.
