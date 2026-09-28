# Contributing and merge rules

Every change lands through a pull request on its own branch (`scripts/pr.sh open`).
A PR is merged (`scripts/pr.sh merge`) only when **all** of these hold:

1. **Gate passes** (`npm run check`): unit tests, determinism tests, production build
   under 16 MB, and the performance benchmark within budget.
2. **Performance budgets** (see `src/perf/budgets.js`) are met on CPU-side metrics:
   simulation tick p95, render CPU p95, no GC pause over budget, heap growth, draw calls.
   A regression of more than 10% against the previous baseline blocks the merge
   unless the PR description justifies it.
3. **Determinism**: the same seed and command log must produce identical state hashes.
   Simulation code (`src/sim`, `src/core`) never reads wall-clock time, `Math.random`,
   the DOM, or rendering state.
4. **Modularity**: the simulation never imports from `render/`, `ui/`, `audio/` or `input/`.
   Assets are only referenced through `src/assets/manifest.js`.
5. **One concern per PR**, with a description in `docs/prs/` stating what changed and why.
   Commits follow Conventional Commits (`feat:`, `fix:`, `perf:`, `test:`, `docs:`, `chore:`).
