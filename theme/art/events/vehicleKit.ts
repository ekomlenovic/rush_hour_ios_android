import { type ArtGradient, type ArtShape, dark, light, line, path, rect } from '../art';

/**
 * Shared pieces of the event vehicles seen from above (pseudo-3D, front on the right, 100 units per cell):
 * the gradients of a body in its color, the tires, a modern car (2 cells) and a van (3 cells) whose roof
 * or bed carries the props of each event.
 */

export const CELL = 100;
export const SHADOW = '#000000';
export const HEADLIGHT = '#FFF7D6';
export const TAILLIGHT = '#B91C1C';

/** Gradients of a vehicle in its color, plus the event's own */
export function vehicleGradients(color: string, extra: ArtGradient[] = []): ArtGradient[] {
  return [
    { id: 'body', stops: [
      { offset: 0, color: dark(color, 0.55) }, { offset: 0.2, color }, { offset: 0.47, color: light(color, 0.3) },
      { offset: 0.53, color: light(color, 0.3) }, { offset: 0.8, color }, { offset: 1, color: dark(color, 0.55) },
    ] },
    { id: 'roof', stops: [{ offset: 0, color: dark(color, 0.3) }, { offset: 0.5, color: light(color, 0.2) }, { offset: 1, color: dark(color, 0.3) }] },
    { id: 'glass', stops: [{ offset: 0, color: '#0F172A' }, { offset: 0.5, color: '#4B6B8A' }, { offset: 1, color: '#0F172A' }] },
    { id: 'chrome', stops: [{ offset: 0, color: '#6B7280' }, { offset: 0.5, color: '#F9FAFB' }, { offset: 1, color: '#6B7280' }] },
    { id: 'gold', stops: [{ offset: 0, color: '#92400E' }, { offset: 0.5, color: '#FDE68A' }, { offset: 1, color: '#92400E' }] },
    { id: 'tire', stops: [{ offset: 0, color: '#050505' }, { offset: 0.5, color: '#3A3A3A' }, { offset: 1, color: '#050505' }] },
    ...extra,
  ];
}

/** Tires sticking out of the body at the given centers along the vehicle */
export const tires = (centers: number[], width = 32): ArtShape[] =>
  centers.flatMap(cx => [
    rect(cx - width / 2, 6, width, 10, { rx: 4, fill: 'url(#tire)' }),
    rect(cx - width / 2, 84, width, 10, { rx: 4, fill: 'url(#tire)' }),
  ]);

/** A modern car (2 cells): body, windshield, roof (x 44 to 128), rear window and lights */
export function car(color: string, roof = 'url(#roof)'): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    rect(10, 16, 188, 82, { rx: 24, fill: SHADOW, opacity: 0.3 }),
    ...tires([48, 156]),
    path('M24 12 L170 12 Q196 14 197 50 Q196 86 170 88 L24 88 Q4 86 4 50 Q4 14 24 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    line(150, 30, 188, 34, { stroke: dark(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    line(150, 70, 188, 66, { stroke: dark(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    path('M126 18 L148 23 Q155 50 148 77 L126 82 Z', { fill: 'url(#glass)' }),
    rect(44, 18, 84, 64, { rx: 10, fill: roof, stroke: outline, strokeWidth: 1 }),
    path('M30 24 L44 21 L44 79 L30 76 Q25 50 30 24 Z', { fill: 'url(#glass)' }),
    rect(186, 17, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(186, 70, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(5, 17, 5, 13, { rx: 2, fill: TAILLIGHT }),
    rect(5, 70, 5, 13, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** A van (3 cells): the cab in front (x 214 to 296), a long box behind (x 8 to 212) carrying the props */
export function van(color: string, box = 'url(#roof)'): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    rect(10, 16, 290, 82, { rx: 16, fill: SHADOW, opacity: 0.3 }),
    ...tires([54, 140, 254]),
    rect(6, 8, 210, 84, { rx: 6, fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(12, 14, 198, 72, { rx: 4, fill: box, stroke: outline, strokeWidth: 0.8 }),
    path('M216 14 L266 14 Q294 18 296 50 Q294 82 266 86 L216 86 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(218, 20, 26, 60, { rx: 6, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M244 20 L262 24 Q268 50 262 76 L244 80 Z', { fill: 'url(#glass)' }),
    line(266, 50, 290, 50, { stroke: light(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    rect(286, 18, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(286, 69, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(3, 14, 5, 12, { rx: 2, fill: TAILLIGHT }),
    rect(3, 74, 5, 12, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** A heart centered on (cx, cy), r its half width, pointing toward `toward` (right: the front of a vehicle) */
export function heart(cx: number, cy: number, r: number, attrs: Record<string, string | number>, toward: 'right' | 'down' = 'down'): ArtShape {
  // Pointing down, then turned a quarter if it points to the front
  const pts = (x: number, y: number) => (toward === 'down' ? [cx + x * r, cy + y * r] : [cx + y * r, cy - x * r]);
  const p = (x: number, y: number) => pts(x, y).join(' ');
  return path(`M${p(0, -0.45)} C${p(0.15, -1.05)} ${p(1.05, -0.85)} ${p(1, -0.2)} C${p(0.95, 0.3)} ${p(0.4, 0.6)} ${p(0, 1)} C${p(-0.4, 0.6)} ${p(-0.95, 0.3)} ${p(-1, -0.2)} C${p(-1.05, -0.85)} ${p(-0.15, -1.05)} ${p(0, -0.45)} Z`, attrs);
}

/** A four-leaf clover centered on (cx, cy), each leaf a heart of radius r */
export function clover(cx: number, cy: number, r: number, fill: string, edge: string, leaves = 4): ArtShape[] {
  const shapes: ArtShape[] = [];
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r * 0.95;
    const y = cy + Math.sin(a) * r * 0.95;
    // A heart pointing to the middle: drawn pointing down, then turned
    const deg = (a * 180) / Math.PI - 90;
    const h = heart(0, 0, r, { fill, stroke: edge, strokeWidth: Math.max(0.6, r * 0.08) });
    shapes.push({ kind: 'path', attrs: { ...h.attrs, transform: `translate(${x} ${y}) rotate(${deg + 180})` } });
  }
  return shapes;
}
