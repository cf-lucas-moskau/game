# PR #29: Draw-call headroom

Branch: `claude/goal-test-aotoyo` (commits for PR #29)

## Summary

Handover item: draw calls peaked at 44-45 of the 50 budget (gate for PRs 22-27); the note suggested batching pack
props and domes. I measured first, attributing every scene draw call by patching `renderBufferDirect` in a live match
(autoplay, 60 s, 1964 frames) and labelling calls by object, material and geometry.

- **Pack props and domes were not the cost.** Each prop type (Thorne's bushes and the like) is already a single
  instanced draw, and domes appear in about 3% of frames.
- **Empty layers were.** three.js issues (and counts) a draw call for an instanced mesh even when its instance count is
  zero: minion kinds not on screen, unused prop slots, overlay layers with nothing to show, zone discs, and the
  GPU-particle mesh, which always drew its whole ring buffer. On average 2-3 such draws per frame, plus their shadow
  passes.

Change: every instanced layer hides itself when it has nothing to draw.
- Overlays (3 layers), zone discs, hero-fx props, minion batches, Pebble crystals: `visible = count > 0`.
- GPU particles track the moment their last spawned particle fades (`aliveUntil`) and hide after it.
- ability-fx and combat-fx already did this.

## Measurements (headless Chromium, SwiftShader; the draws probe script is in the PR notes, attribution per label)

| | scene draws p50 | p95 | max |
| --- | ---: | ---: | ---: |
| before | 33 | 36 | 39 |
| after | 26 | 32 | 36 |
| after, zone-heavy roster (Thorne, Brindle, Mistral, Rime, Cantor, Nimbus) | 30 | 34 | 35 |

Scene draws plus shadow passes (the gated `drawCallsMax`) peak at 43-44 in the probe, including the post passes the
gate counts separately. Remaining costs per frame: six skinned heroes, about eight instanced quad layers while active
(decals, particles, bars, projectiles, zone discs, rings, tethers), environment and structures, minion kinds per team
(blue and red minions are different models, so they cannot share a batch). The next lever, if needed, is one shared
quad engine for the effect layers.

Visual check: a zone-heavy match at 3:26 shows health bars, minions, bees, zones and tower rings as before.
