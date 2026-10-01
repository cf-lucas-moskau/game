// All gameplay tuning numbers in one place. Units: world units (1 unit = 1 cm in render),
// seconds converted to ticks through TICK_HZ.
export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const sec = (s) => Math.round(s * TICK_HZ);

// W: the outer towers (1350 from each end, range 680) leave a neutral middle about 700 units wide.
export const LANE = { W: 4800, H: 900, MIN_Y: 110, MAX_Y: 790, EDGE_MIN: 150, EDGE_MAX: 750 };
export const TEAM = { BLUE: 0, RED: 1, NEUTRAL: 2 }; // neutral: camp monsters, enemies of both teams
export const KIND = { HERO: 1, MELEE: 2, RANGED: 3, SIEGE: 4, TOWER: 5, HEART: 6, PEBBLE: 7, CRAB: 8 };
export const isNeutral = (e) => e.team === TEAM.NEUTRAL;
export const isMinion = (k) => k === KIND.MELEE || k === KIND.RANGED || k === KIND.SIEGE;
export const isStructure = (k) => k === KIND.TOWER || k === KIND.HEART;
export const isUnitHero = (k) => k === KIND.HERO || k === KIND.PEBBLE;

/** mirror an x coordinate for the red side */
export const sideX = (team, x) => (team === TEAM.BLUE ? x : LANE.W - x);

export const MAP = {
  FOUNTAIN_X: 170, FOUNTAIN_R: 260, SHOP_X: 330,
  HEART_X: 420, TOWER_INNER_X: 800, TOWER_OUTER_X: 1350,
  SPAWN_X: 640,
  RELIC_X: 1500, RELIC_Y: [300, 600], // per side: measured from the own end, mirrored for red
};
/** Neutral middle features. Everything sits on the centre point or in pairs symmetric through it (fairness: PR #41). */
MAP.CAMPS = [[LANE.W / 2 - 200, 200], [LANE.W / 2 + 200, LANE.H - 200]]; // Barnacle Crab nests: blue's nearer one top, red's bottom
MAP.PEARL = [LANE.W / 2, 450]; // the Sky Pearl surfaces at the exact centre
/** Relic spots, mirrored for both sides (absolute x broke the symmetry when the lane grew). */
MAP.RELICS = [TEAM.BLUE, TEAM.RED].flatMap((t) => MAP.RELIC_Y.map((y) => [sideX(t, MAP.RELIC_X), y]));

export const RULES = {
  START_LEVEL: 3, MAX_LEVEL: 18, START_GOLD: 1400, PASSIVE_GOLD_PER_SEC: 10,
  RESPAWN_BASE: 4, RESPAWN_PER_LEVEL: 1.5,
  WAVE_INTERVAL: 25, FIRST_WAVE: 3, SIEGE_EVERY: 3,
  RELIC_INTERVAL: 40, RELIC_HEAL: 0.22, RELIC_RADIUS: 70,
  WHALE_FIRST: 120, WHALE_INTERVAL: 90, WHALE_WARN: 3, WHALE_DURATION: 4, WHALE_SLIDE: 120, WHALE_EDGE_DPS: 90,
  SUDDEN_DEATH: 600, SUDDEN_DEATH_DMG_BONUS: 0.5, SUDDEN_DEATH_HEART_DECAY: 0.012,
  KILL_GOLD: 300, ASSIST_GOLD: 150, KILL_XP: 280, ASSIST_WINDOW: 10,
  // comeback bounties: a hero on a kill streak of SHUTDOWN_FROM or more is worth extra gold (shutdown) to whoever ends it
  SHUTDOWN_FROM: 2, SHUTDOWN_BASE: 100, SHUTDOWN_PER: 75, SHUTDOWN_MAX: 500, STREAK_CALLS: [3, 5, 7],
  KILL_CREDIT_WINDOW: 15, // a tower, minion or the whale finishing a hero credits the last enemy hero who hit them within this
  XP_SHARE_RADIUS: 1200, TOWER_GOLD: 150,
  // basic-attack multipliers of minions against towers and hearts: waves that reach a tower threaten it
  MINION_VS_STRUCTURE: 2, SIEGE_VS_STRUCTURE: 4.5,
  FOUNTAIN_HEAL_PCT: 0.12, FOUNTAIN_DPS: 1200,
  MAX_ITEMS: 6, SELL_RATIO: 0.7,
  // neutral camps
  CAMP_FIRST: 75, CAMP_RESPAWN: 70, CAMP_LEASH: 520, CAMP_GOLD: 90, CAMP_SHARE_GOLD: 40, CAMP_XP: 220,
  // Sky Pearl: surfaces at PEARL_FIRST, then PEARL_INTERVAL after it was taken or sank; held alone for PEARL_CAPTURE
  // seconds it is captured: Pearl's Blessing for the team, gold for the holders, a Pearl Golem in the next waves
  PEARL_FIRST: 180, PEARL_INTERVAL: 180, PEARL_WARN: 15, PEARL_RADIUS: 200, PEARL_CAPTURE: 5, PEARL_LIFETIME: 75,
  PEARL_GOLD: 100, PEARL_WAVES: 2, PEARL_GOLEM_HP: 2.2, PEARL_GOLEM_AD: 1.8,
  // whale-roll loot: treasure washes up in the endangered edge band when the whale rolls (mirrored x pairs)
  LOOT_X: [250, 750, 1250], LOOT_GOLD: 45, LOOT_XP: 50, LOOT_LINGER: 3, LOOT_RADIUS: 60,
};
/** xp needed to go from level L to L+1: cheap up to level 6 (the ultimate arrives in about a minute and a half), then
 *  the old curve (3 -> 6 costs 780 xp instead of 1440) */
export const xpToNext = (lvl) => (lvl < 6 ? 100 + 40 * lvl : 180 + 100 * (lvl - 1));

export const MINION = {
  [KIND.MELEE]:  { hp: 480, ad: 30, armor: 10, mr: 0, as: 1.0, range: 110, speed: 330, radius: 34, gold: 21, xp: 60, projectile: 0, growth: 0.05 },
  [KIND.RANGED]: { hp: 300, ad: 42, armor: 0, mr: 0, as: 0.7, range: 450, speed: 330, radius: 30, gold: 16, xp: 32, projectile: 900, growth: 0.05 },
  [KIND.SIEGE]:  { hp: 950, ad: 72, armor: 20, mr: 20, as: 0.5, range: 380, speed: 320, radius: 46, gold: 55, xp: 95, projectile: 750, growth: 0.06 },
};
/** Neutral monsters: stats grow per minute of match time like minions (hpPerMin, adPerMin). */
export const NEUTRAL = {
  [KIND.CRAB]: { name: 'Barnacle Crab', hp: 1500, hpPerMin: 140, ad: 48, adPerMin: 5, armor: 30, mr: 30, as: 0.8, range: 150, speed: 290, radius: 50, buff: 'barnacle-fury' },
};
export const STRUCT = {
  TOWER: { hp: 2300, ad: 170, adPerMin: 12, armor: 60, mr: 60, as: 0.85, range: 680, radius: 90, projectile: 1300 },
  HEART: { hp: 3000, armor: 40, mr: 40, radius: 120 },
};
