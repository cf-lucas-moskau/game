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

## Online e2e flake found in the gate

The gate's online e2e failed on this PR: the guest page did not reach the local broker in time ("Could not reach the
matchmaking service"). Debugging runs with errors-only logging (`?netdebug=1`; `=3` is verbose) showed that the join
timeout itself fired. That was 1 run in 4 before any fix. Both test pages were rendering the menu backdrop at full
resolution on the one software GPU, starving the pages' event loops. Two fixes:
- **CPU measurement mode.** `?cpu=1` now also puts the menu backdrop into the 160x90 buffer, as it already did for
  matches and spectate.
- **Patient timeouts.** The join timeouts notice when they fire late because the page was blocked, and grant up to
  two more periods instead of failing. A slow phone could hit the same.

After: 5 of 5 online e2e runs pass.
