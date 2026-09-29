# PR #17: A distinct ability style per hero

Branch: `claude/goal-test-aotoyo` (GitHub), commit 625185a

## Summary

Owner feedback: each character needs a unique, easy to see, more sophisticated ability style. ability-fx.js draws each hero's visual language as ground decals in one instanced draw (Morrow clockwork, Saffi wax and flame, Vesper ink, Gus stone cracks, Brindle honeycomb, Auctioneer gilded filigree) in circle, ring, cone and line shapes, plus lasting-state rings (blaze, masterpiece, shields, marks, appraised targets). GC work was brought back to the previous level by pooling records, sweeping a Map with a stored callback and writing ribbon vertices directly (docs/PERF.md).
