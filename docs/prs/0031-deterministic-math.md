# PR #31: Deterministic simulation math

Branch: `claude/goal-test-aotoyo` (commits for PR #31)

## Summary

Groundwork for online play (owner request: client-hosted lobbies, no hosting, no setup). Every player's machine runs
the same simulation from one command stream stamped by the host, so the sim must produce bit-identical results in
every browser. JavaScript guarantees that only for `+ - * /` and `sqrt`. `Math.sin`, `cos`, `atan2`, `hypot` and `**`
are implementation-approximated and differ between V8 (Chrome, Edge), SpiderMonkey (Firefox) and JavaScriptCore
(Safari, every iOS browser).

- `src/core/dmath.js`: `sin`, `cos` (Cody-Waite range reduction plus the fdlibm kernels), `atan`, `atan2` (fdlibm
  `s_atan`), `hypot` (sqrt of the sum of squares), `sq`. Built from basic operations only.
- The whole sim and core use them (about 110 call sites in 25 files, rewritten mechanically; `x ** 2` became
  `sq(x)`). The render side keeps `Math`, since it never feeds back into the sim.
- `tests/determinism.test.js`:
  - fails if the sim or core use engine-approximated math, `Math.random`, `Date.now` or `performance.now` (the
    frame loop is exempt: it reads the clock and never touches sim state);
  - checks accuracy against the engine over 20k random inputs (within 1e-15);
  - pins exact bit patterns for fixed inputs, since a change there would split online players on different versions.

## Checks

- Accuracy over 1M random inputs: `sin`/`cos` max error 1.1e-16, `atan2` 4.4e-16, `hypot` 4.1e-16 relative, i.e.
  within an ulp or two.
- 960 simulation-lab matches (seed 1) play the same game: 10.3 min, blue 50.4%, kills 38.0, win-rate sd 0.128,
  the same hero order within noise as before the change.
- 74 tests pass.
