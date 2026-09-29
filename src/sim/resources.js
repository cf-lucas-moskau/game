// What each resource type spends. A hero's `resource` (or an ability's `costType`) names one of these.
//   pool: the entity field abilities pay from ('mana', 'gold', 'resource'), or null when abilities are free
//   (cooldown-only heroes; Saffi's flame is her health and is not spent by casts).
// New bar-style resources (a hero's own meter kept in e.resource / e.maxResource) only need an entry here.
export const RESOURCES = {
  mana: { pool: 'mana' },
  gold: { pool: 'gold' },
  ink: { pool: 'resource' },
  swarm: { pool: 'resource' },
  energy: { pool: 'resource' },
  flame: { pool: null },
  none: { pool: null },
};
/** The field a cost of this type is paid from, or null. Unknown types pay from nothing. */
export const poolField = (type) => (RESOURCES[type] ? RESOURCES[type].pool : null);
/** Current amount available for a cost of this type, or -1 when it costs nothing trackable. */
export function poolAmount(e, type) { const f = poolField(type); return f ? e[f] : -1; }
export function canPay(e, type, cost) { const f = poolField(type); return !f || e[f] >= cost; }
export function spend(e, type, cost) { const f = poolField(type); if (f) e[f] -= cost; }
