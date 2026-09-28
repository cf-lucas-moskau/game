// Minimal hero used to exercise the core simulation before real heroes exist.
export const testHero = {
  key: 'dummy', name: 'Dummy', resource: 'mana', rankOrder: ['Q', 'E', 'W'],
  base: { hp: 620, hpL: 95, ad: 60, adL: 3.5, armor: 30, armorL: 4, mr: 32, mrL: 1.5, as: 0.66, asL: 0.025, range: 450, speed: 340, mana: 400, manaL: 40, projectile: 1500 },
  abilities: {
    Q: { cd: 5, cost: 40, range: 800, cast: () => true },
    W: { cd: 5, cost: 40, cast: () => true },
    E: { cd: 5, cost: 40, cast: () => true },
    R: { cd: 60, cost: 100, cast: () => true },
  },
};
export const testContent = { heroes: { dummy: testHero }, items: {} };
export const roster3v3 = (key = 'dummy') => [0, 1, 2, 3, 4, 5].map((i) => ({ playerId: i, heroKey: key, team: i < 3 ? 0 : 1, isBot: true }));
