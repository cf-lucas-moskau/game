# Online play

Client-hosted, no servers to run: one player's browser hosts the match, friends join with a five-letter code.

## For players

1. Hero select -> **Online** -> **Create lobby**. Share the code (or the invite link when the game is served over
   http(s): `...?join=CODE`).
2. Friends: **Online** -> enter the code -> **Join**. Everyone picks a hero and a skin, joiners press **Ready**.
3. The host picks the bot difficulty (bots play the open seats) and presses **Start match**.
4. After the match the host can bring everyone **Back to lobby** for another one.

If a player leaves, a bot takes over their hero. If the host leaves, the match ends for everyone.

## How it works

- **Connection** (`src/net/peer.js`): WebRTC data channels, ordered and reliable, directly between the browsers. The
  introduction (offer, answer, ICE candidates) goes through the free public PeerJS broker (`0.peerjs.com`). The host
  registers `leviathan-lane-<CODE>`; joiners connect to it. Public STUN servers find each player's address, and the
  PeerJS project's public TURN relay carries traffic when both players sit behind strict NATs. The broker never sees
  game traffic.
- **Lobby** (`src/net/lobby.js`): six seats (0-2 blue, 3-5 red, the host in seat 0). Joiners take the team with fewer
  humans and are refused if the lobby is full, the match has started, or their build differs (`BUILD` is a hash of the
  sim, core and net code set at build time, `vite.config.js`).
- **Match** (`src/net/authority.js`): lockstep with the host as authority. The host runs the bots, validates each
  player's commands (well-formed, own hero only) and broadcasts every tick's commands. Every browser runs the same
  deterministic sim from that stream (`src/core/dmath.js` keeps the math bit-identical across engines). Every 30
  ticks the host adds its state hash so clients detect a desync. Clients buffer a few ticks and catch up after a
  hitch. The host waits (up to 15 s) until every client has loaded the match.
- **Background tabs**: browsers stop animation frames in hidden tabs, so an online session keeps simulating on a
  timer while hidden (`FixedLoop` with `background`), and nobody freezes when a player switches tabs.
- **Latency**: a client sees its own commands after one round trip to the host. Movement is predicted locally
  (`src/app/predictor.js`), as in single player with simulated ping.

## Limits and next steps

- The public broker and TURN relay are free community services without guarantees. `?broker=host:port` points the game
  at any PeerJS-compatible server (`npx peerjs --port 9000`), for a self-hosted broker later.
- No mid-match joining or host migration.
- Desync handling: detected and reported; a resync (replaying the command log) is future work.

## Testing

- `tests/lockstep.test.js`: host and clients over lossy-latency in-memory channels: a full match stays hash-identical;
  desync detection; bot takeover; forged commands rejected.
- `tests/lobby.test.js`: seats, picks, readiness, team switches, refusals, handoff to a lockstep match.
- `tools/e2e-online.mjs` (part of the gate's e2e step): a local PeerJS broker, two Chromium pages, real WebRTC: lobby,
  invite link, picks, ready, start, a command across the wire, identical world hashes, bot takeover on leave.
  `NETDEBUG=1` prints the negotiation; `?netdebug=1` does the same in the game.
