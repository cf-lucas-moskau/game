# PR #21: Architecture document

Branch: `claude/goal-test-aotoyo` (GitHub)

## Summary

`README.md` linked `docs/ARCHITECTURE.md`, which did not exist. It now describes the layers and their one-way
dependencies, the rules that keep parts replaceable (sim imports nothing from presentation, every action is a
command through the transport, presentation never writes to the sim, assets named only in the manifest, content
as data + hooks), the tick and frame order, every module folder, the transport interface a Node server will
implement, and the performance tooling. README: hero rerolls are unlimited (it still said one reroll).

## Checks

Every claim was checked against the code (system order, item hook names, audio behaviour, resolution guard).
