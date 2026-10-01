// Neutral camps: a Barnacle Crab on each flank of the neutral middle. A crab fights whoever hit it last and walks home
// (healing, untouchable) when pulled past its leash. The hero who lands the killing blow gets gold, experience and
// Barnacle Fury; allies nearby share some gold. Camps come back CAMP_RESPAWN seconds after they fall.
import { EV } from '../core/events.js';
import { KIND, TEAM, MAP, RULES, NEUTRAL, sec, TICK_HZ } from './constants.js';
import { ORDER } from './entity.js';
import { giveGold, giveXp, heal } from './damage.js';
import { addBuff } from './buffs.js';
import { sq } from '../core/dmath.js';

export function setupCamps(w) {
  w.state.camps = MAP.CAMPS.map(([x, y], i) => ({ i, x, y, kind: KIND.CRAB, crabId: -1, respawnAt: sec(RULES.CAMP_FIRST), kills: 0 }));
  w.onNeutralDown = (victim, killer) => onCampDown(w, victim, killer);
}

function spawnCrab(w, camp) {
  const spec = NEUTRAL[camp.kind], minutes = w.tick / TICK_HZ / 60;
  const e = w.spawn(camp.kind, TEAM.NEUTRAL, camp.x, camp.y);
  e.maxHp = e.hp = Math.round(spec.hp + spec.hpPerMin * minutes); e.baseHp = e.maxHp;
  e.baseAd = spec.ad + spec.adPerMin * minutes; e.armor = e.baseArmor = spec.armor; e.mr = spec.mr;
  e.baseAs = spec.as; e.range = spec.range; e.baseSpeed = spec.speed; e.radius = spec.radius; e.projectileSpeed = 0;
  e.homeX = camp.x; e.homeY = camp.y; e.aggroId = -1; e.order = ORDER.IDLE; e.facing = camp.y < 450 ? Math.PI / 2 : -Math.PI / 2;
  camp.crabId = e.id;
  w.events.push(EV.OBJECTIVE, w.tick, -1, -1, camp.x, camp.y, camp.i, 'camp-up');
}

/** Spawn due camps and steer every crab (before movement and combat in the system order). */
export function campSystem(w) {
  const t = w.tick;
  for (const camp of w.state.camps) {
    if (camp.crabId < 0) { if (t >= camp.respawnAt) spawnCrab(w, camp); continue; }
    const e = w.entities[camp.crabId];
    if (!e || !e.alive || e.kind !== camp.kind) { camp.crabId = -1; continue; }
    crabThink(w, e);
  }
}

function crabThink(w, e) {
  const t = w.tick, leash = RULES.CAMP_LEASH;
  const fromHome = sq(e.x - e.homeX) + sq(e.y - e.homeY);
  const tg = e.aggroId >= 0 ? w.get(e.aggroId) : null;
  const chase = tg && !tg.dead && tg.untargetableUntil <= t && fromHome <= sq(leash) && sq(tg.x - e.homeX) + sq(tg.y - e.homeY) <= sq(leash + 150);
  if (chase) { e.targetId = tg.id; e.order = ORDER.ATTACK; return; }
  // nothing to fight (or pulled too far): forget the attacker and walk home, untouchable until back
  e.aggroId = -1; e.targetId = -1;
  if (fromHome > sq(40)) { e.order = ORDER.MOVE; e.moveX = e.homeX; e.moveY = e.homeY; e.invulnUntil = t + 2; }
  else if (e.order === ORDER.MOVE) e.order = ORDER.IDLE;
  // out of combat: the shell knits back together quickly
  if (t - e.lastCombatTick > sec(2) && t % 3 === 0 && e.hp < e.maxHp) heal(w, null, e, e.maxHp * 0.12 / 10, true);
}

function onCampDown(w, victim, killer) {
  const camp = w.state.camps.find((c) => c.crabId === victim.id); if (!camp) return;
  camp.crabId = -1; camp.respawnAt = w.tick + sec(RULES.CAMP_RESPAWN); camp.kills++;
  const spec = NEUTRAL[camp.kind];
  if (killer) {
    giveGold(w, killer, RULES.CAMP_GOLD); giveXp(w, killer, RULES.CAMP_XP);
    for (const h of w.heroes) if (h !== killer && h.team === killer.team && !h.dead && sq(h.x - victim.x) + sq(h.y - victim.y) < sq(RULES.XP_SHARE_RADIUS)) { giveGold(w, h, RULES.CAMP_SHARE_GOLD); giveXp(w, h, RULES.CAMP_XP * 0.5); }
    addBuff(w, killer, spec.buff);
  }
  w.events.push(EV.OBJECTIVE, w.tick, killer ? killer.id : -1, killer ? killer.team : -1, victim.x, victim.y, camp.i, 'camp-slain');
}
