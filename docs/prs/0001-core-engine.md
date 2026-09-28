# PR #1: Core engine primitives

Branch: `core-engine`

## Summary

## Checks

Adds the engine primitives every other module builds on: a serializable seeded PRNG
(sfc32), object pools for zero-allocation hot paths, a uniform-grid spatial hash with
allocation-free queries, a ring-buffer event stream for sim-to-presentation messages,
an FNV state hasher for determinism checks, and the fixed-timestep client loop.
Unit tests cover each module.
