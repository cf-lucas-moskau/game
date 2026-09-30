// Runs all bots for a match and returns their commands for the current tick.
import { Bot } from './bot.js';
export class BotDirector {
  /**
   * @param difficulty 'easy' | 'medium' | 'hard', or (playerId) => one of those (e.g. a harder red team)
   * @param opts       { builds: { [playerId]: itemKey[] } } item builds replacing the heroes' recommended ones
   */
  constructor(world, difficulty = 'medium', opts = {}) {
    const diff = typeof difficulty === 'function' ? difficulty : () => difficulty;
    const builds = opts.builds || {};
    this.bots = world.heroes.filter((h) => h.isBot).map((h) => new Bot(h.playerId, diff(h.playerId), world.seed, { build: builds[h.playerId] }));
  }
  /** A human left an online match: a bot plays their hero from now on (host only). */
  addBot(world, playerId, difficulty = 'medium') {
    if (this.bots.some((b) => b.p === playerId)) return;
    this.bots.push(new Bot(playerId, difficulty, world.seed + world.tick));
  }
  commands(world, out = []) {
    out.length = 0;
    for (const b of this.bots) for (const c of b.think(world)) if (c) out.push(c);
    return out;
  }
}
