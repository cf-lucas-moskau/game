// Leviathan Lab: an isolated stage for looking at heroes, animations and effects up close, without
// playing a match. One hero, training dummies that never die, no minions, towers that hold fire.
// Time is frame-exact when paused (step), so tooling gets identical frames every run.
//   URL:  index.html?lab=1&hero=saffi&cam=front
//   JS:   window.__lab  (setHero, camera, anim, cast, attack, walk, step, play, pause, info)
//   CLI:  node tools/lab.mjs ...   (drives the same API and writes PNGs)
import { createMatch } from '../sim/match.js';
import { CONTENT } from '../sim/content.js';
import { HEROES, HERO_KEYS } from '../sim/heroes/index.js';
import { TICK_HZ } from '../sim/constants.js';
import { castCmd, attackCmd, moveCmd, stopCmd } from '../sim/commands.js';
import { GameRenderer } from '../render/renderer.js';
import { S } from '../render/palette.js';
import { h, clear } from '../ui/dom.js';

const STAGE = { x: 1900, y: 450, gap: 300 };
// camera presets around the hero (render units); the hero faces +x, towards the dummies
export const CAMERAS = {
  front: { off: [2.6, 1.15, 0], look: 0.75 }, side: { off: [0, 1.15, 2.6], look: 0.75 }, back: { off: [-2.6, 1.3, 0.2], look: 0.8 },
  three: { off: [1.9, 1.5, 1.9], look: 0.7 }, close: { off: [1.25, 1.0, 0.35], look: 0.85 }, top: { off: [0.01, 4.5, 0], look: 0 },
  wide: { off: [3.2, 3.2, 3.2], look: 0.5 }, game: null,
};

export class Lab {
  constructor({ root, lib, quality = 'high', hero = 'vesper', dummy = 'morrow', dummies = 2 }) {
    this.root = root; this.lib = lib; this.quality = quality; this.dummy = dummy; this.dummies = dummies;
    this.camName = 'three'; this.zoom = 1; this.now = 0; this.running = false; this.frameDt = 1 / 60; this.acc = 0; this.cmds = [];
    this.setHero(hero);
  }
  // --------------------------------------------------------------- scene
  setHero(key, { dummy = this.dummy, dummies = this.dummies } = {}) {
    if (!HEROES[key]) throw new Error(`unknown hero ${key}; one of ${HERO_KEYS.join(', ')}`);
    this.dispose();
    this.heroKey = key; this.dummy = dummy; this.dummies = dummies;
    const roster = [{ playerId: 0, heroKey: key, team: 0, isBot: false }];
    for (let i = 0; i < dummies; i++) roster.push({ playerId: 1 + i, heroKey: dummy, team: 1, isBot: true });
    const w = this.world = createMatch({ seed: 7, roster, content: CONTENT });
    w.state.nextWave = Infinity; w.state.nextRelic = Infinity; w.state.whale.next = Infinity; // a quiet stage
    for (const s of w.structures) { s.range = 0; s.baseAd = 0; }                               // towers hold fire
    const me = this.me = w.heroes[0];
    me.x = me.px = STAGE.x; me.y = me.py = STAGE.y; me.facing = 0;
    this.targets = w.heroes.slice(1);
    this.targets.forEach((d, i) => { d.x = d.px = STAGE.x + STAGE.gap; d.y = d.py = STAGE.y + (i - (dummies - 1) / 2) * 140; d.facing = Math.PI; });
    this.maxOut();
    this.canvas = h('canvas', { style: { position: 'fixed', inset: '0', width: '100vw', height: '100vh', display: 'block' } });
    this.root.prepend(this.canvas);
    this.renderer = new GameRenderer(this.canvas, this.lib, w, { quality: this.quality });
    this.renderer.focusId = me.id; this.renderer.myTeam = 0;
    this.camera(this.camName, this.zoom);
    this.step(0.05); // settle views
    return this.info();
  }
  /** Level 18, every rank, full resources and gold; dummies at full health. */
  maxOut() {
    const me = this.me, def = HEROES[this.heroKey];
    me.level = 18; me.ranks = { Q: 5, W: 5, E: 5, R: 3 }; me.gold = 99999; me.statsDirty = true;
    me.mana = me.maxMana || 9999; me.resource = me.maxResource || 0; me.hp = me.maxHp;
    if (def.resource === 'swarm') me.resource = Math.max(me.resource, 20);
    for (const d of this.targets) { d.hp = d.maxHp; d.dead = false; }
  }
  // --------------------------------------------------------------- controls
  camera(name = 'three', zoom = 1) {
    this.camName = name; this.zoom = zoom;
    const c = typeof name === 'object' ? name : CAMERAS[name];
    if (c === undefined) throw new Error(`unknown camera ${name}; one of ${Object.keys(CAMERAS).join(', ')}`);
    if (!c) { this.renderer.cameraOverride = null; this.renderer.cam.zoom = zoom; this.follow = null; return; }
    this.follow = c; this.aimCamera();
  }
  aimCamera() {
    const c = this.follow; if (!c || !this.renderer) return;
    const x = this.me.x * S, z = this.me.y * S, k = this.zoom;
    if (c.pos) { this.renderer.cameraOverride = c; return; }
    this.renderer.cameraOverride = { pos: [x + c.off[0] * k, c.off[1] * k, z + c.off[2] * k], target: [x, c.look, z] };
  }
  /** Force an animation clip (looping, or frozen at `time` seconds); null returns to automatic. */
  anim(clip, time = null) {
    const v = this.heroView(); if (!v) return [];
    if (clip && !v.actions[clip]) throw new Error(`no clip ${clip}; clips: ${Object.keys(v.actions).join(', ')}`);
    v.force(clip, time); this.render(0);
    return Object.keys(v.actions);
  }
  heroView() { return this.renderer.units.heroViews.get(this.me.id); }
  /** Cast Q/W/E/R (0-3 or a letter) at a dummy, yourself or a point { x, y } in sim units. */
  cast(slot, target = 'dummy') {
    const s = typeof slot === 'string' ? 'QWER'.indexOf(slot.toUpperCase()) : slot;
    this.maxOut(); this.me.cds[s] = 0;
    const d = this.targets[0], a = HEROES[this.heroKey].abilities['QWER'[s]];
    let x = d.x, y = d.y, id = d.id, pts = null;
    if (target === 'self') { x = this.me.x; y = this.me.y; id = this.me.id; }
    else if (target && typeof target === 'object') { x = target.x; y = target.y; id = -1; }
    if (a.drawn === 'loop') pts = Array.from({ length: 16 }, (_, i) => [x + Math.cos(i / 15 * 6.283) * 150, y + Math.sin(i / 15 * 6.283) * 150]).flat();
    else if (a.drawn === 'stroke' || a.drawn === 'line') pts = [this.me.x + 80, this.me.y - 120, x, y + 120];
    this.cmds.push(castCmd(0, s, x, y, pts, id));
    return a.name;
  }
  attack() { this.maxOut(); this.cmds.push(attackCmd(0, this.targets[0].id)); }
  walk(on = true) { this.cmds.push(on ? moveCmd(0, this.me.x, this.me.y - 400) : stopCmd(0)); }
  /** Advance time by `seconds` at a fixed frame rate: identical frames on every run. */
  step(seconds, fps = 60) {
    const dt = 1 / fps, frames = Math.max(1, Math.round(seconds * fps));
    for (let i = 0; i < frames; i++) this.tickFrame(dt);
    return this.world.tick;
  }
  tickFrame(dt) {
    this.acc += dt;
    while (this.acc >= 1 / TICK_HZ) {
      this.acc -= 1 / TICK_HZ;
      this.world.step(this.cmds); this.cmds.length = 0;
      // dummies never die, and walk home only when knocked far away (yanks and knockbacks stay visible)
      this.targets.forEach((d, i) => { d.dead = false; d.hp = Math.max(d.hp, d.maxHp * 0.5); if (Math.hypot(d.x - STAGE.x - STAGE.gap, d.y - STAGE.y) > 900) { d.x = d.px = STAGE.x + STAGE.gap; d.y = d.py = STAGE.y + (i - (this.dummies - 1) / 2) * 140; } });
    }
    this.render(dt);
  }
  render(dt) { this.now += dt; this.aimCamera(); this.renderer.render(Math.min(1, this.acc * TICK_HZ), dt); }
  play() { if (this.running) return; this.running = true; let last = performance.now(); const f = (t) => { if (!this.running) return; const dt = Math.min(0.1, (t - last) / 1000); last = t; this.tickFrame(dt); requestAnimationFrame(f); }; requestAnimationFrame(f); }
  pause() { this.running = false; }
  info() {
    const v = this.heroView(), def = HEROES[this.heroKey];
    return { hero: this.heroKey, heroes: HERO_KEYS, clips: v ? Object.keys(v.actions) : [], abilities: ['Q', 'W', 'E', 'R'].map((k) => `${k} ${def.abilities[k].name}`), cameras: Object.keys(CAMERAS), tick: this.world.tick };
  }
  dispose() { this.pause(); if (this.renderer) { this.renderer.dispose(); this.canvas.remove(); this.renderer = null; } }
}

/** A compact control panel for people (the CLI drives the same API without it). */
export function labPanel(root, lab) {
  const el = h('div', { class: 'lab-panel' }); root.append(el);
  const row = (label, ...kids) => h('div', { class: 'lab-row' }, h('span', {}, label), ...kids);
  const btn = (t, f, on = false) => h('button', { class: on ? 'on' : '', onclick: () => { f(); render(); } }, t);
  let clip = null, scrub = null;
  function render() {
    const info = lab.info();
    clear(el).append(...[
      h('b', {}, 'Leviathan Lab'),
      row('Hero', ...info.heroes.map((k) => btn(k, () => { lab.setHero(k); clip = null; }, k === info.hero))),
      row('Camera', ...info.cameras.map((c) => btn(c, () => lab.camera(c, lab.zoom), c === lab.camName)), btn('−', () => lab.camera(lab.camName, lab.zoom * 1.25)), btn('+', () => lab.camera(lab.camName, lab.zoom / 1.25))),
      row('Clip', btn('auto', () => { clip = null; lab.anim(null); }, !clip), ...info.clips.map((c) => btn(c, () => { clip = c; scrub = null; lab.anim(c); }, c === clip))),
      clip ? row('Scrub', h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(scrub ?? 0), oninput: (e) => { scrub = +e.target.value; const v = lab.heroView(); const d = v.actions[clip].getClip().duration; lab.anim(clip, scrub * d); } })) : null,
      row('Act', ...['Q', 'W', 'E', 'R'].map((k, i) => btn(info.abilities[i], () => lab.cast(k))), btn('Attack', () => lab.attack()), btn('Walk', () => lab.walk(true)), btn('Stop', () => lab.walk(false))),
      row('Time', btn(lab.running ? 'Pause' : 'Play', () => (lab.running ? lab.pause() : lab.play()), lab.running), btn('Step 1/30 s', () => lab.step(1 / 30)), btn('Step 0.5 s', () => lab.step(0.5)))].filter(Boolean));
  }
  render();
  return el;
}
