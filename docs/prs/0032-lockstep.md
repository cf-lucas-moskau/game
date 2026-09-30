# PR #32: Lockstep online authority

Branch: `claude/goal-test-aotoyo` (commits for PR #32)

## Summary

The network model for client-hosted online play. The host's browser decides the match and every player's browser
runs the same deterministic sim (PR #31) from the host's command stream.

- `src/net/protocol.js`: message kinds (hello/welcome/refuse, lobby, pick, ready, start, commands, tick bundles,
  ping/pong, bye), protocol version and build id, `wireCommand` (only the fields the sim reads, plus the sender's
  `ts` for latency telemetry), `acceptCommand` (well-formed, and only for the sender's own hero).
- `src/net/authority.js`: `GameSession` asks its authority each tick which commands to apply.
  - `LocalAuthority`: single player (bots plus the player through `LocalTransport`), unchanged behaviour.
  - `HostAuthority`: bots, the host player and remote players' validated commands. It broadcasts each tick's
    commands, and every 30 ticks the state hash before the step. The host steps with exactly the objects it
    broadcasts. A player who disconnects is taken over by a bot (`BotDirector.addBot`) through the same stream.
  - `ClientAuthority`: sends the player's commands to the host and steps only on the host's bundles. It detects a
    desync by comparing hashes, measures round-trip time by ping, and reports `bye`/`lost`.
- `GameSession`: a roster and local player id can come from a lobby. Bots run only where the match is decided. A
  client catches up (up to 4 ticks per step) when bundles pile up. Prediction and input-latency telemetry work
  unchanged: the local player's commands come back in the bundles.

## Checks

`tests/lockstep.test.js`: a host and two clients over in-memory channels that serialize to JSON and deliver with
3-5 ticks of latency. The remote players are driven by bots running on the clients' own worlds.
- A whole match (about 8 min) ends with every world at the same tick, the same state hash and the same winner; the
  remote players reached level 6+.
- A client whose world is corrupted (gold + 50) reports a desync at the next hash; the other does not.
- A player who disconnects is taken over by a bot on the host, and the remaining client stays hash-identical.
- Commands a client forges for another player's hero never reach the host's command stream.

78 tests pass.
