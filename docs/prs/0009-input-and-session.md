# PR #9: Player input, game session, prediction

Branch: `input-and-session`

## Summary

## Checks

The game is now playable: `index.html` starts a match with the local player plus five bots
(`?hero=`, `?ping=`, `?jitter=`, `?loss=`, `?bots=easy|medium|hard`, `?spectate=1`).

- `app/session.js`: every local command goes through `LocalTransport`, exactly as it will to the
  Node server; issue/processed/presented timestamps feed the input-latency metric.
- `app/predictor.js` + `render/interp.js`: the local hero walks immediately while a move is in flight,
  then eases onto authority; snaps over 90 units after easing count as corrections. All views use one
  interpolation helper so hero, bar, ring and camera never disagree.
- `input/desktop.js`: right-click move/attack with hold-to-steer, QWER quick-cast, Shift preview,
  Vesper hold-to-draw (tap casts the default shape), D/F, S, A-click, 1-6 item actives, Tab/P/F3 hooks.
- `input/touch.js`: floating joystick, 88 px attack button with hold-to-repeat, 58 px ability arc,
  tap = auto-aim with target lead, drag = aim with range-scaled preview, drag onto the ✕ to cancel,
  drawn abilities traced on the ground (works while the other thumb steers), three-finger tap, haptics,
  live cooldown sweeps.
- `render/indicators.js`: range ring, line / cone / circle previews, drawn stroke (turns green when a
  loop is closed), hover ring, click markers.
- `tools/e2e.mjs` (now a gate step): real mouse, keyboard and CDP touch events; 13 checks.
  It caught a real bug: tapping a drawn ability (Vesper Q) cast nothing.
- Bench: `play-ping100` (desktop, 100 ms / 15 ms jitter / 1% loss) and the mobile scenario now play
  through the input path with an autopilot; corrections per 10 s are gated. Input latency is gated
  only on a real GPU (in the software-GPU container it is frame-bound, about 250 ms).
