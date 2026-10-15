/** Colors of the home screen (to be replaced by the theme system, see #25) */
export interface HomeColors {
  bg: string;
  text: string;
  sub: string;
  accent: string;
  card: string;
  success: string;
  weekly: string;
}

export function getHomeColors(isDark: boolean): HomeColors {
  return isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: 'rgba(255,255,255,0.06)', success: '#10B981', weekly: '#F97316' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: 'rgba(0,0,0,0.04)', success: '#059669', weekly: '#EA580C' };
}
