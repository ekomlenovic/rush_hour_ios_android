/** Colors of the map screen (to be replaced by the theme system, see #25) */
export interface MapColors {
  bg: string;
  text: string;
  sub: string;
  accent: string;
  locked: string;
  line: string;
}

export function getMapColors(isDark: boolean): MapColors {
  return isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', locked: '#2A2A35', line: 'rgba(255,255,255,0.1)' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', locked: '#E0E0E8', line: 'rgba(0,0,0,0.1)' };
}
