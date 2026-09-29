# PR #25: Painted hero portraits

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Owner request: "paint hero portraits". Portraits are painted at runtime by `render/portraits.js` from the same model,
props and skin palette the game draws. New heroes and skins get portraits without any art files.

- **Studio.** A bust shot is lit like a studio portrait: a warm key light, a cool fill, a rim light in the hero's
  accent, and prop glows as point lights. Framing comes from a small front silhouette render of the posed figure;
  bone matrices and skinned bounds are not valid before a render.
- **Paint pass.** A 4-quadrant Kuwahara filter turns shading into flat brush strokes, with bristle variation,
  an ink edge from the alpha gradient and an accent halo. The backdrop is a tinted wash with directional
  strokes, finished with canvas grain and a vignette.
- **Lifecycle.** One WebGL context is created on first use and released after 3 s idle. Portraits are cached as
  data URLs and painted one at a time.
- **UI.** `identity.setPortraitSource` plus `emblem(hero, cls, skin)` show the painting as soon as it is ready and
  the emblem until then. This covers the HUD, scoreboard, inspect panel, end screen and menu. Skins travel via
  `session.skinOf`.
  Bot portraits paint on demand: painting a roster at match start stalled the first seconds on a software GPU.

Found while framing: heroes' heads were sunk into their torsos (fixed in PR #26).

## Checks

- e2e: the menu shows a painted portrait. All 16 heroes plus a skin paint, and all 17 are distinct PNGs over
  20 KB. In the container, 16 portraits take 5.4-7 s on SwiftShader.
- Visual: contact sheet of all 16 portraits; in-game HUD screenshot.
