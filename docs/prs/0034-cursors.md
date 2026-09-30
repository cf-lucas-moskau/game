# PR #34: Game cursors

Branch: `claude/goal-test-aotoyo` (commits for PR #34)

## Summary

Owner request: "I want a custom cursor in game please".

- `src/ui/cursors.js`: five cursors drawn as SVG in the game palette, with a dark rim so they read on the bright sky
  and the dark whale:
  - an arrow (default);
  - a lit arrow (buttons and other clickable UI);
  - a sword (an enemy you can attack is under the cursor);
  - an arrow with a tide ring (an ally or yourself);
  - a reticle (aiming an ability, drawing, attack-move armed; hot spot in the centre).
- They are native CSS cursors, moved by the operating system: no frame of latency and no render cost. Each is
  rasterized once at start-up at 1x and 2x and published as `--cur-<name>` with `image-set()` (crisp on high-DPI
  screens), falling back to a 1x image, then to the system cursor.
- `src/input/desktop.js`: the unit under the mouse decides the canvas cursor. Invulnerable structures and
  untargetable heroes do not show the sword. It is refreshed every frame while the mouse is over the canvas (units move
  under a still cursor), and the DOM is touched only when the cursor changes. The hover pick costs 5 µs per frame
  (1000 calls, 26 units, measured in a match).
- Styles use the game cursors everywhere (`cursor: var(--cur-pointer, pointer)` and so on); text fields keep the
  text cursor.
- Setting "Cursor: Game / System" (accessibility and personal preference), applied live. The Lab and spectate modes
  use the game cursors too.

## Checks

- e2e: the cursors are installed as `image-set` cursors; over an ally the canvas shows `ally`, over an enemy
  `attack`, with attack-move armed `target`.
- Visual: a contact sheet of the rasterized cursors (1x and 2x) on sky, whale-dark and bone backgrounds.
  Headless screenshots do not capture the OS cursor, so the sheet renders the same raster images the browser uses.
