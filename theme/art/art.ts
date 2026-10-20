/**
 * Vector drawings kept as plain data (no React Native), drawn by components/art/ArtSvg with react-native-svg:
 * the Mafia vehicles and the Tommy gun of the win effect.
 */

export type ShapeKind = 'rect' | 'circle' | 'ellipse' | 'path' | 'line';

export interface ArtShape {
  kind: ShapeKind;
  /** SVG attributes; a fill or stroke `url(#id)` refers to a gradient of the drawing */
  attrs: Record<string, string | number>;
}

export interface ArtGradient {
  id: string;
  /** Vertical (top to bottom) unless set */
  horizontal?: boolean;
  /** From the center to the edge, instead of along a line */
  radial?: boolean;
  stops: { offset: number; color: string; opacity?: number }[];
}

export interface ArtDrawing {
  width: number;
  height: number;
  gradients: ArtGradient[];
  shapes: ArtShape[];
}

/** The color mixed toward `target` (0: unchanged, 1: target) */
export function mixColor(color: string, target: string, amount: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  };
  const a = parse(color);
  const b = parse(target);
  if ([...a, ...b].some(Number.isNaN)) return color;
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

export const dark = (c: string, amount: number) => mixColor(c, '#000000', amount);
export const light = (c: string, amount: number) => mixColor(c, '#FFFFFF', amount);

type Attrs = Record<string, string | number>;

export const rect = (x: number, y: number, width: number, height: number, extra: Attrs = {}): ArtShape =>
  ({ kind: 'rect', attrs: { x, y, width, height, ...extra } });
export const circle = (cx: number, cy: number, r: number, extra: Attrs = {}): ArtShape =>
  ({ kind: 'circle', attrs: { cx, cy, r, ...extra } });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, extra: Attrs = {}): ArtShape =>
  ({ kind: 'ellipse', attrs: { cx, cy, rx, ry, ...extra } });
export const path = (d: string, extra: Attrs = {}): ArtShape => ({ kind: 'path', attrs: { d, ...extra } });
export const line = (x1: number, y1: number, x2: number, y2: number, extra: Attrs = {}): ArtShape =>
  ({ kind: 'line', attrs: { x1, y1, x2, y2, ...extra } });
