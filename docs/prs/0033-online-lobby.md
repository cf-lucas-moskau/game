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

## GC pause A/B for the PR #28-#33 merge

bench-eval fails only on `gcPauseMaxMs`: play-ping100 5.46 ms (budget 5), mobile-low 43.36 ms. All other gated
metrics pass. Draw calls peak at 36 (desktop), 35 (play) and 32 (phone), down from 44-45. Interleaved same-container
runs, `main` (b9470aa) against this branch (key 7a3a1c13f26caaa0), traces kept:

| scenario | side | worst pause per run (ms) | pauses > 5 ms | GC total (ms) | GCs |
| --- | --- | --- | --- | --- | --- |
| mobile-low | main | 23.95 / 36.09 / 7.90 | 12 / 5 / 4 | 274 / 248 / 170 | 118-130 |
| mobile-low | branch | 26.81 / 8.77 / 21.20 | 11 / 6 / 16 | 301 / 208 / 357 | 123-145 |
| play-ping100 | main | 6.08 / 11.34 / 4.96 | 1 / 3 / 0 | 40 / 71 / 39 | 94-96 |
| play-ping100 | branch | 15.57 / 4.60 / 3.53 | 2 / 0 / 0 | 67 / 46 / 35 | 105 |

- The worst pauses overlap between the two sides.
- Per-scavenge work is the same: median MinorGC CPU is 1.0-1.45 ms on the phone and 0.22-0.31 ms in play on both
  sides, and each scavenge frees a median of 0.83 MB on both.
- The outliers are the contention case in docs/PERF.md.
- The branch runs about 10% more scavenges in play (105 against 90-96): more short-lived allocation per second,
  probably the new SLOW and quiet-heal events and the bots' threat estimates. That is small, but it is a follow-up:
  profile and pool it.
- Heap on the phone is +1 MB (the PeerJS client and the online UI).

bench-eval is recorded as failing on this metric only (log below); `.gate/<key>/bench-eval.ok` points here.

## Gate results for PRs 28-33 (gate key 7a3a1c13f26caaa0, commit 43ce5a8)
```
--- tests
 Test Files  15 passed (15)
      Tests  83 passed (83)
--- build
   dist/index.html: 5481 KB
--- e2e
   PASS  audio unlocks on the first click and plays music and effects  (running, 21 voices played, 0 dropped)
   PASS  shop buys an item at the fountain  (gold 1404 -> 307)
   PASS  shop cards show what an item does for your hero  (For you: +2 Q · +18 W · +28 E)
   PASS  Escape closes the shop
   PASS  Tab opens the scoreboard with six heroes
   PASS  clicking a scoreboard row shows that hero's details and items
   PASS  left-clicking a unit on the battlefield inspects it  (clicked Lumen Vey, panel Lumen Vey)
   PASS  surrender ends the match in defeat
   PASS  Play again returns to hero select
   PASS  a second match starts cleanly  (2 canvases)
   PASS  audio voices are released (no leak across matches)  ({"sfx":0,"music":2})
   PASS  no page errors (loop)
   PASS  menu shows a painted portrait
   PASS  portraits paint for every hero and skins, all distinct  (17 portraits, 17 distinct)
   PASS  lab: every hero plays every clip and casts every ability  (16 heroes)
   PASS  lab: every skin loads and palette skins use their own atlas cell  (27 hero/skin looks)
   E2E: all input and game-loop checks passed
   PASS  host opens a lobby and gets a five-letter code  (AXLS8)
   PASS  the guest joins by code over WebRTC and appears in the host's lobby
   PASS  the guest sees the same lobby
   PASS  a hero pick reaches the host
   PASS  start waits until the guest is ready
   PASS  the guest's ready enables start
   PASS  both players are in the match and it runs
   PASS  host and guest play their own heroes  ([{"online":"host","player":0,"hero":"nimbus"},{"online":"client","player":3,"hero":"kestrel"}])
   PASS  the guest's command moves its hero on the host
   PASS  the guest's world is identical to the host's  (tick 171/171, hash e7090d65/e7090d65, rtt 2 ms)
   PASS  when the guest leaves, the host keeps playing with a bot in its seat
   PASS  no page errors
   E2E ONLINE: lobby, WebRTC and lockstep checks passed
--- bench-desktop
   desktop-medium: frames 3194, sim p95 0.1 ms, render update p95 0.2 ms, GC max 2.45 ms, draws 36
--- bench-play
   play-ping100: frames 2208, sim p95 0.1 ms, render update p95 0.3 ms, GC max 5.46 ms, draws 35
--- bench-mobile
   mobile-low: frames 3575, sim p95 0.7 ms, render update p95 1.2 ms, GC max 43.36 ms, draws 32
--- bench-eval
   PASS  simTickP95Ms                 0.7  / 2 (baseline 0.2, +370% throttle-normalized)
   PASS  renderUpdateP95Ms            1.2  / 3 (baseline 2.6, -38% throttle-normalized)
   PASS  uiUpdateMeanMs             0.436  / 0.6
   PASS  audioUpdateMeanMs          0.035  / 0.3
   FAIL  gcPauseMaxMs               43.36  / 5 (baseline 3.46, +1582% throttle-normalized)
   PASS  drawCallsMax                  32  / 50 (baseline 45, -29%)
   PASS  loadMs                       658  / 4000 (baseline 803, +10% throttle-normalized)
   PASS  correctionsPer10s           0.08  / 1
   info  renderCpuP95Ms                 5  / 6
   info  renderSubmitP95Ms            4.2  / 4
   info  frameP95Ms                  87.4  / 16.7
   info  frameP99Ms                 136.3  / 20
   info  inputLatencyP95Ms          148.5  / 136.7
   info  gcPausesOver5Ms                3
   info  gcContendedMaxMs           43.36
   info  gcContendedCount              76
   info  uiUpdateP95Ms                1.2
   info  audioUpdateP95Ms             0.1
   info  heapGrowthMbPer10Min        2.77  / 5
   info  gcWallMaxMs                43.52
   info  gcCount                      130
   info  memoryReducerMaxMs             0
   info  throttleFactor               3.8
   info  fps                         29.8
   info  onePercentLowFps             5.9  / 55
   info  trianglesMax               55381
   info  postPasses                     0
   info  longTasks                      8
   info  frames sampled              3575  (min 200)
   PERF GATE: 4 failure(s)
--- soak
   retained-heap slope: 3.43 MB per 10 min over 2.5 min (budget 5)
   SOAK: retained heap within budget
```
