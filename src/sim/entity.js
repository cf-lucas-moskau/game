import { KIND } from './constants.js';

// One record shape for every unit (heroes, minions, structures). Fixed fields keep V8
// hidden classes stable; records are pooled and recycled by the world.
export function createEntity() {
  return {
    id: 0, alive: false, kind: 0, team: 0, heroKey: '', ownerId: -1, playerId: -1,
    x: 0, y: 0, px: 0, py: 0, facing: 0, radius: 30, mass: 1,
    hp: 0, maxHp: 0, mana: 0, maxMana: 0, resource: 0, maxResource: 0,
    // derived stats (recomputed by stats.js)
    ad: 0, ap: 0, armor: 0, mr: 0, as: 0, range: 0, speed: 0, hpRegen: 0, manaRegen: 0,
    cdr: 0, lifesteal: 0, dmgAmp: 0,
    // base (unit-type) stats for non-heroes
    baseAd: 0, baseArmor: 0, baseMr: 0, baseAs: 0, baseRange: 0, baseSpeed: 0, baseHp: 0,
    // orders + combat
    order: 0, moveX: 0, moveY: 0, targetId: -1, attackCd: 0, windup: 0, windupTarget: -1,
    projectileSpeed: 0, attackCount: 0, lastCombatTick: -9999, lastHeroDamageTick: -9999,
    // statuses (ticks = until)
    stunUntil: 0, rootUntil: 0, silenceUntil: 0, slowPct: 0, slowUntil: 0, hasteUntil: 0, hastePct: 0,
    shield: 0, shieldUntil: 0, invulnUntil: 0, untargetableUntil: 0, markUntil: 0, markBy: -1, ampUntil: 0, ampPct: 0,
    dashUntil: 0, dashVx: 0, dashVy: 0, dashHitMask: 0, dashFx: '',
    knockVx: 0, knockVy: 0, knockUntil: 0, airborneUntil: 0,
    // hero progression
    level: 1, xp: 0, gold: 0, kills: 0, deaths: 0, assists: 0, cs: 0, respawnAt: 0, dead: false,
    items: null, itemState: null, cds: null, ranks: null, abil: null, spells: null, spellCds: null,
    damagers: null, // [id, tick] pairs for assists
    bornTick: 0, statsDirty: true, idleTicks: 0, isBot: false, channelUntil: 0, channelSlot: -1, castLockUntil: 0,
    heroState: null,
  };
}
export function resetEntity(e) {
  const fresh = createEntity();
  for (const k in fresh) e[k] = fresh[k];
  return e;
}
export const isTargetable = (e, tick) => e.alive && !e.dead && e.untargetableUntil <= tick;
export const ORDER = { IDLE: 0, MOVE: 1, ATTACK: 2, ATTACK_MOVE: 3 };
export const labelOf = (e) => (e.kind === KIND.HERO ? e.heroKey : String(e.kind));
