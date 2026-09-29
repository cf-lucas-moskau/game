# PR #26: Heads back on (skinned merge fix) and screen-space picking

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

Two bugs found while building the portrait studio (PR #25):

1. **Sunk heads.** `mergeSkinned` (PR #13) merges each rig's body and head into one skinned mesh (one draw per
   hero). Its re-binding formula assumed every part's world matrix equals its bind matrix. That stops being true
   once the rig is scaled to its look height, and every head that sits under its own node sank into the torso.
   Ten of the sixteen heroes showed no face, including Vesper and the Auctioneer since PR #13, and every hero was
   drawn at about 0.95 units instead of its look height (1.45 for most). The formula now uses the full chains on
   both parts (`p' = B_k^-1 * A_k * p` with mesh world, bind and bone matrices). Verified against the unmerged model
   (identical renders) and by a front silhouette: heights now match the manifest. Still one draw per hero.
2. **Picking what you see.** Hover, right-click targets, left-click inspection, targeted casts and tap-to-inspect
   projected the cursor onto the ground and took the nearest unit there. A click on a hero's body or head landed
   behind the hero. That was marginal before (49 of 55 units of slack in the e2e case) and missed once heroes had
   their heads back. `input/intent.js#screenPick` now picks in screen space: each unit is a feet-to-head segment
   as wide as it looks. When a click is inside several silhouettes, the more specific unit wins (hero over minion
   over structure).

## Checks

- Visual: Lab contact sheet of all sixteen heroes before and after; merged vs unmerged Vesper close-ups identical.
- Picking: a stress harness clicked random visible heroes in a live match with time frozen at each click: 17 of 17
  correct. With time running, clicks sometimes landed beside a moving bot, and once on a tower behind a hero. That
  exposed the missing overlap rule, now fixed. The e2e inspect test now freezes time around its click and aims at
  the ally's head.
