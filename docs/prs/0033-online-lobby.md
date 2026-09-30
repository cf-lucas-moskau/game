# PR #33: Online lobbies over WebRTC

Branch: `claude/goal-test-aotoyo` (commits for PR #33)

## Summary

Owner request: "client-hosted online play: somebody creates a lobby, others join and play against each other; no
hosting required, as easy as possible". Built on PR #31 (deterministic math) and PR #32 (lockstep authorities).
The guide is in `docs/ONLINE.md`.

- `src/net/peer.js`: WebRTC data channels through the public PeerJS broker (no server of ours). Five-letter lobby
  codes (no 0/O/1/I), public STUN plus the PeerJS public TURN relay, readable errors, `?broker=host:port` override,
  `?netdebug=1` logging. Uses the official `peerjs` client (MIT, about 108 KB in the build), battle-tested against
  that broker.
- `src/net/lobby.js`: `LobbyHost` and `LobbyClient` (seats, team balance, picks, skins, readiness, team switch,
  refusals for a full lobby, a started match or a different build, bots for open seats, start with one roster and
  seed for everyone, `reopen`/`rebind` for back to lobby). Messages arriving between start and match creation are
  held (`holdMessages`/`attach`). The host waits for every client to load before the first tick.
- `src/ui/online.js` and styles: Online button on hero select; Create or Join (name remembered); the lobby with a big
  code, copy and invite-link buttons, both teams' seats with portraits and ready state, a hero and skin picker, bot
  difficulty and Start for the host, Ready and team switch for joiners. Desktop and phone layouts.
- `src/app/app.js`: online matches, host waiting banner, toasts when a player leaves (a bot takes over), end states
  when the host leaves or the connection drops or desyncs, Back to lobby for rematches, invite links (`?join=CODE`).
- `FixedLoop` background mode: online sessions keep simulating in hidden tabs.
- End screen and pause menu take configurable actions.
- `BUILD` id: a hash of sim, core and net, injected by vite.

## Checks

- `tests/lobby.test.js` (5): seating, picks, readiness, team switch, a new pick un-readies, full and wrong-version
  refusals, leaving frees the seat, and start hands over to a lockstep match that stays hash-identical.
- `tools/e2e-online.mjs` (12 checks, added to the gate's e2e step): a local PeerJS broker (`peer`, dev dependency) and
  two Chromium pages over real WebRTC. The host opens a lobby (code), the guest joins by invite link, the pick reaches
  the host, start waits for ready, both play their own heroes, the guest's command moves its hero on the host, the
  worlds are identical at a frozen tick (hash `a90b844f` on both, round trip 4 ms), and the guest leaving hands its
  hero to a bot. No page errors.
- Visual: host lobby at 1100x700 and guest lobby at 390x844 checked.

## Bugs found on the way

- The join timeout started before the broker socket opened; a page busy painting portraits (software GPU) timed out
  before signaling began. There are now two clocks: broker (30 s), then the direct connection (15 s).
- The local broker defaulted to IPv6, which the container lacks; it binds to 127.0.0.1 in the test.
- The container's network proxy does not pass WebSocket upgrades, so the public broker cannot be exercised from
  here. The local broker runs the same PeerJS protocol and client code.
