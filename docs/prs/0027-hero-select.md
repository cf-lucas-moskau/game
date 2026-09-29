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
