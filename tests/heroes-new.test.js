import { describe, it, expect } from 'vitest';
import { createMatch } from '../src/sim/match.js';
import { castCmd, attackCmd } from '../src/sim/commands.js';
import { HEROES } from '../src/sim/heroes/index.js';
import { KIND, sec } from '../src/sim/constants.js';
import { chillOf } from '../src/sim/heroes/rime.js';
import { starsOf } from '../src/sim/heroes/lumen.js';
import { onBeat, BEAT } from '../src/sim/heroes/cantor.js';

// Signature mechanics of the ten heroes added with PR #26, one duel each.
const content = { heroes: HEROES, items: {} };
const duel = (a, b, seed = 1) => createMatch({ seed, content, roster: [{ playerId: 0, heroKey: a, team: 0 }, { playerId: 1, heroKey: b, team: 1 }] });
const trio = (a, b, c) => createMatch({ seed: 2, content, roster: [{ playerId: 0, heroKey: a, team: 0 }, { playerId: 1, heroKey: b, team: 1 }, { playerId: 2, heroKey: c, team: 1 }] });
const steps = (w, n, cmds = () => []) => { for (let i = 0; i < n; i++) w.step(cmds(i)); };
const place = (e, x, y) => { e.x = e.px = x; e.y = e.py = y; };
const once = (cmd) => (i) => (i === 0 ? [cmd] : []);
const full = (e) => { e.mana = e.maxMana = 9999; e.cds.fill(0); };

describe('new heroes', () => {
  it('Nimbus: three ability hits on heroes charge static; the next attack chains lightning', () => {
    const w = trio('nimbus', 'morrow', 'saffi'); const n = w.heroes[0], a = w.heroes[1], b = w.heroes[2];
    place(n, 1500, 450); place(a, 1850, 450); place(b, 1950, 520);
    for (let k = 0; k < 3; k++) { full(n); steps(w, sec(0.7), once(castCmd(0, 0, a.x, a.y))); }
    expect(n.heroState.static).toBe(3);
    const hpB = b.hp; steps(w, sec(2.5), () => [attackCmd(0, a.id)]);
    expect(n.heroState.static).toBe(0);
    expect(b.hp).toBeLessThan(hpB); // chained to the second hero
  });
  it('Coralie: hero hits grow reef, which adds armor; Brine Bulwark bursts when it ends', () => {
    const w = duel('coralie', 'kestrel'); const c = w.heroes[0], k = w.heroes[1];
    place(c, 1600, 450); place(k, 1900, 450);
    const armor0 = c.armor; steps(w, sec(4), () => [attackCmd(1, c.id)]);
    expect(c.heroState.reef).toBeGreaterThan(0); expect(c.armor).toBeGreaterThan(armor0);
    const hpK = k.hp; place(k, 1750, 450); full(c); steps(w, sec(3.3), once(castCmd(0, 1, c.x, c.y)));
    expect(k.hp).toBeLessThan(hpK);
  });
  it('Kestrel: every fourth attack is a Deadeye shot that slows', () => {
    const w = duel('kestrel', 'dredge'); const k = w.heroes[0], d = w.heroes[1];
    place(k, 1500, 450); place(d, 1900, 450); d.speed = 0;
    let slowed = false; steps(w, sec(8), () => { if (d.slowUntil > w.tick) slowed = true; return [attackCmd(0, d.id)]; });
    expect(slowed).toBe(true); expect(k.attackCount).toBeGreaterThanOrEqual(4);
  });
  it('Mistral: Carried Aloft shields and speeds an ally; Tailwind hastes her team', () => {
    const w = createMatch({ seed: 3, content, roster: [{ playerId: 0, heroKey: 'mistral', team: 0 }, { playerId: 1, heroKey: 'dredge', team: 0 }, { playerId: 2, heroKey: 'morrow', team: 1 }] });
    const m = w.heroes[0], ally = w.heroes[1]; place(m, 1200, 450); place(ally, 1400, 450); place(w.heroes[2], 3700, 450);
    full(m); steps(w, 2, once(castCmd(0, 2, ally.x, ally.y, null, ally.id)));
    expect(ally.shield).toBeGreaterThan(0); expect(ally.hasteUntil).toBeGreaterThan(w.tick);
  });
  it('Rime: three chills freeze (stun), then the target is immune; Shatter consumes chills', () => {
    const w = duel('rime', 'saffi'); const r = w.heroes[0], s = w.heroes[1];
    place(r, 1500, 450); place(s, 1900, 450); s.speed = 0;
    for (let k = 0; k < 2; k++) { full(r); steps(w, sec(0.5), once(castCmd(0, 0, s.x, s.y))); }
    expect(chillOf(w, r, s)).toBe(2);
    full(r); steps(w, sec(0.3), once(castCmd(0, 2, r.x, r.y))); // Shatter
    expect(chillOf(w, r, s)).toBe(0);
    for (let k = 0; k < 3; k++) { full(r); steps(w, sec(0.5), once(castCmd(0, 0, s.x, s.y))); }
    expect(s.stunUntil).toBeGreaterThan(w.tick - sec(0.5)); // frozen by the third
    expect(w.heroes[0].heroState.chill.get(s.id).immuneUntil).toBeGreaterThan(w.tick);
  });
  it('Thorne: a sown seed sprouts into a thornbush that shoots the nearest enemy; three at most', () => {
    const w = duel('thorne', 'morrow'); const t = w.heroes[0], m = w.heroes[1];
    place(t, 1400, 450); place(m, 1900, 450);
    full(t); const hp0 = m.hp; steps(w, sec(3.5), once(castCmd(0, 0, 1700, 450)));
    expect(m.hp).toBeLessThan(hp0);
    for (let k = 0; k < 4; k++) { full(t); steps(w, 2, once(castCmd(0, 0, 1500 + k * 50, 400))); }
    expect(w.zones.filter((z) => z.kind === 'thorne-bush' && z.until > w.tick).length).toBe(3);
  });
  it('Cantor: the beat comes once a second and spells on it are stronger', () => {
    const w = duel('cantor', 'dredge'); const c = w.heroes[0], d = w.heroes[1];
    place(c, 1500, 450); place(d, 1800, 450); d.speed = 0; d.armor = d.mr = 0;
    let beats = 0; for (let i = 0; i < BEAT * 3; i++) { if ((w.tick - c.heroState.beat0) % BEAT === 0) beats++; w.step([]); }
    expect(beats).toBe(3);
    while (onBeat(w, c)) w.step([]); // off the beat
    full(c); let hp = d.hp; steps(w, 1, once(castCmd(0, 0, d.x, d.y))); const off = hp - d.hp;
    while (!onBeat(w, c) || (w.tick - c.heroState.beat0) % BEAT > 2) w.step([]);
    full(c); d.hp = d.maxHp; hp = d.hp; steps(w, 1, once(castCmd(0, 0, d.x, d.y))); const on = hp - d.hp;
    expect(on).toBeGreaterThan(off * 1.3);
  });
  it('Lumen: the third star completes a constellation that bursts; Wayfinder makes the next spell free', () => {
    const w = duel('lumen', 'morrow'); const l = w.heroes[0], m = w.heroes[1];
    place(l, 1500, 450); place(m, 1850, 450); m.speed = 0;
    for (let k = 0; k < 2; k++) { full(l); steps(w, sec(0.8), once(castCmd(0, 0, m.x, m.y))); }
    expect(starsOf(w, l, m)).toBe(2);
    const hp = m.hp; full(l); steps(w, sec(0.8), once(castCmd(0, 0, m.x, m.y)));
    expect(starsOf(w, l, m)).toBe(0); expect(hp - m.hp).toBeGreaterThan(100);
    full(l); l.mana = 60; steps(w, 2, once(castCmd(0, 2, 1400, 450)));
    const mana = l.mana; steps(w, 2, once(castCmd(0, 0, m.x, m.y)));
    expect(l.mana).toBeCloseTo(mana, 0);
  });
  it('Dredge: takes less damage when hurt; Hull Breach stuns on the next attack', () => {
    const def = HEROES.dredge; const w = duel('dredge', 'morrow'); const d = w.heroes[0], m = w.heroes[1];
    d.hp = d.maxHp; const fullIn = def.modifyDamageIn(w, d, 100); d.hp = d.maxHp * 0.2; const lowIn = def.modifyDamageIn(w, d, 100);
    expect(fullIn).toBe(100); expect(lowIn).toBeCloseTo(100 * (1 - def.tuning.drCap), 6); // at 80% missing the reduction is capped
    d.hp = d.maxHp; place(d, 1600, 450); place(m, 1750, 450); m.speed = 0;
    steps(w, 1, once(castCmd(0, 2, d.x, d.y)));
    let stunned = false; steps(w, sec(3), () => { if (m.stunUntil > w.tick) stunned = true; return [attackCmd(0, m.id)]; });
    expect(stunned).toBe(true);
  });
  it('Wisp: Shadow Swap places a shade and swaps on recast; takedowns reset her spells', () => {
    const w = duel('wisp', 'morrow'); const s = w.heroes[0], m = w.heroes[1];
    place(s, 1500, 450); place(m, 3600, 450);
    steps(w, 2, once(castCmd(0, 1, 1900, 450)));
    expect(s.heroState.shadeUntil).toBeGreaterThan(w.tick); expect(s.cds[1]).toBeLessThan(sec(1));
    steps(w, sec(0.5)); steps(w, 2, once(castCmd(0, 1, 0, 0)));
    expect(Math.abs(s.x - 1900)).toBeLessThan(5);
    s.cds[0] = sec(5); s.cds[2] = sec(5); HEROES.wisp.onTakedown(w, s, m);
    expect(s.cds[0]).toBe(0); expect(s.cds[2]).toBe(0);
  });
});
