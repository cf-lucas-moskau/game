// Visual tokens shared by renderer and UI.
export const PALETTE = {
  abyss: '#1c1f4a', dusk: '#f7b267', plum: '#6b4e8c', slate: '#3e5c6b', bone: '#e8dcc4',
  tide: '#45c4e6', coral: '#f0476e', gold: '#f2c14e', ink: '#8b7bff', mist: '#cfd8ff',
};
export const TEAM_COLORS = ['#45c4e6', '#f0476e'];
export const S = 0.01; // sim units -> render units

import { Color } from 'three';
/** Pre-parsed colours for per-frame use (Color.set(string) parses and allocates). */
export const TEAM_RGB = TEAM_COLORS.map((c) => new Color(c));
export const SELF_RGB = new Color('#7ee07a');
export const WHITE_RGB = new Color('#ffffff');
