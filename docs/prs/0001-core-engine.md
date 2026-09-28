# PR #1: Core engine primitives

Branch: `core-engine`

## Summary

## Checks

Adds the engine primitives every other module builds on: a serializable seeded PRNG
(sfc32), object pools for zero-allocation hot paths, a uniform-grid spatial hash with
allocation-free queries, a ring-buffer event stream for sim-to-presentation messages,
an FNV state hasher for determinism checks, and the fixed-timestep client loop.
Unit tests cover each module.

```
== 1/3 unit + determinism tests
      Tests  6 passed (6)
   Start at  12:19:04
   Duration  420ms (transform 79ms, setup 0ms, collect 67ms, tests 27ms, environment 0ms, prepare 107ms)
== 2/3 production build
   dist/index.html: 1 KB
== 3/3 performance benchmark vs budgets
   (bench harness not present yet)
ALL CHECKS PASSED
```
