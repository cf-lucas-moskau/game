// Runs all bots for a match and returns their commands for the current tick.
import { Bot } from './bot.js';
export class BotDirector {
  constructor(world, difficulty = 'medium') {
    this.bots = world.heroes.filter((h) => h.isBot).map((h) => new Bot(h.playerId, difficulty, world.seed));
  }
  commands(world, out = []) {
    out.length = 0;
    for (const b of this.bots) for (const c of b.think(world)) if (c) out.push(c);
    return out;
  }
}
