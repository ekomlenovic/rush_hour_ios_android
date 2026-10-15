/** Colors of the game screen (to be replaced by the theme system, see #25) */
export interface GameColors {
  bg: string;
  text: string;
  sub: string;
  card: string;
  accent: string;
  hint: string;
}

export function getGameColors(isDark: boolean): GameColors {
  return isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', card: 'rgba(255,255,255,0.06)', accent: '#6C63FF', hint: '#F59E0B' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', card: 'rgba(0,0,0,0.04)', accent: '#5A4FE0', hint: '#D97706' };
}
