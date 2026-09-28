import { describe, it, expect } from 'vitest';
import { createMatch } from '../src/sim/match.js';
import { CONTENT } from '../src/sim/content.js';
import { moveCmd } from '../src/sim/commands.js';
import { LocalTransport } from '../src/net/transport.js';
import { Predictor } from '../src/app/predictor.js';

function setup(ping) {
  const w = createMatch({ seed: 1, content: CONTENT, roster: [{ playerId: 0, heroKey: 'morrow', team: 0 }, { playerId: 1, heroKey: 'saffi', team: 1 }] });
  const me = w.heroes[0]; me.x = me.px = 1000; me.y = me.py = 450;
  const tel = { corrections: 0 };
  return { w, me, tel, pred: new Predictor(w, me, tel), tr: new LocalTransport({ ping, redundancy: 1 }) };
}
// drive: 60 fps frames, 30 Hz ticks, transport delivering by wall time
function run({ w, me, pred, tr }, ms, onFrame) {
  const inbox = [];
  for (let t = 0; t <= ms; t += 1000 / 60) {
    if (Math.round(t / (1000 / 60)) % 2 === 0) { tr.receive(t, inbox); for (const c of inbox) pred.onAck(c); w.step(inbox.slice()); }
    pred.frame(1, t + 1); onFrame && onFrame(t);
  }
}
describe('prediction', () => {
  it('moves the rendered hero immediately while the command is in flight at 100 ms ping', () => {
    const s = setup(100); const cmd = moveCmd(0, 1800, 450);
    s.tr.send(cmd, 0); s.pred.onLocalCommand(cmd, 0);
    let renderedAt40 = 0, authAt40 = 0;
    run(s, 40, (t) => { renderedAt40 = s.me.x + s.pred.ox; authAt40 = s.me.x; });
    expect(authAt40).toBe(1000);            // the server has not seen the command yet
    expect(renderedAt40).toBeGreaterThan(1005); // but the player already sees the hero moving
  });
  it('converges without a visible correction on a normal move', () => {
    const s = setup(100); const cmd = moveCmd(0, 1600, 450);
    s.tr.send(cmd, 0); s.pred.onLocalCommand(cmd, 0);
    run(s, 3000);
    expect(s.tel.corrections).toBe(0);
    expect(Math.abs(s.pred.ox)).toBeLessThan(5);
  });
  it('counts a correction when the prediction was wrong (hero stunned mid-flight)', () => {
    const s = setup(200); const cmd = moveCmd(0, 1800, 450);
    s.tr.send(cmd, 0); s.pred.onLocalCommand(cmd, 0);
    s.me.stunUntil = s.w.tick + 90; // server-side stun the client did not know about when predicting
    run(s, 60); s.pred.inflight = 0; s.pred.px += 200; // client had run ahead
    run(s, 200);
    expect(s.tel.corrections).toBeGreaterThanOrEqual(1);
  });
});
