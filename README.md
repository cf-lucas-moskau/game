# Leviathan Lane

A 3v3 single-lane arena brawler for the browser, fought on the spine of a giant sky-whale.
Desktop (mouse + keyboard) and mobile (touch). Matches last 5 to 10 minutes.

```
npm install
npm run dev      # local dev server
npm run check    # merge gate: tests, build, benchmark
npm run bench    # performance benchmark only
```

`npm run build` produces a single self-contained `dist/index.html` (open it directly in a browser).

## How to play
The whale picks a hero for you (one reroll). Choose the bot difficulty and press **Fight**.
Push with your minion waves, destroy the two enemy towers in order, then shatter the enemy Heartstone.
After 10 minutes sudden death starts and both Heartstones crumble, so every match ends.

Desktop: right click to move or attack, Q W E R to cast at the cursor (Shift to preview), D / F for
Dash / Heal, A + click to attack-move, P for the shop (buy at your fountain or while dead), Tab for the
scoreboard, Esc for the menu (settings, surrender), F3 for performance numbers.
Touch: left thumb joystick, Attack button, tap abilities to auto-aim or drag to aim, drag onto ✕ to cancel.
See `docs/ARCHITECTURE.md` and `CONTRIBUTING.md`.
