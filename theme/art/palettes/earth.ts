import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, tires, vehicleGradients } from '../events/vehicleKit';

/** Earth palette: an off-road 4x4 with its roof rack (2 cells) and a log truck (3 cells) */

/** The 4x4: boxy body, roof rack and jerrycans, spare wheel on the tailgate, bull bar */
function offroad(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 16, 190, 82, { rx: 10, fill: SHADOW, opacity: 0.3 }),
    ...tires([50, 156], 36),
    rect(10, 10, 178, 80, { rx: 8, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    path('M140 18 L156 20 Q160 50 156 80 L140 82 Z', { fill: 'url(#glass)' }),
    rect(36, 16, 104, 68, { rx: 5, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(42, 20, 92, 60, { rx: 3, fill: 'none', stroke: '#1F2937', strokeWidth: 2 }),
    ...[56, 72, 88, 104, 120].map(x => line(x, 20, x, 80, { stroke: '#1F2937', strokeWidth: 1.4 })),
    rect(50, 26, 26, 18, { rx: 2, fill: '#4D7C0F', stroke: '#1A2E05', strokeWidth: 0.8 }),
    rect(50, 56, 26, 18, { rx: 2, fill: '#B91C1C', stroke: '#450A0A', strokeWidth: 0.8 }),
    rect(90, 30, 36, 40, { rx: 6, fill: '#A16207', stroke: '#713F12', strokeWidth: 0.8 }),
    line(108, 30, 108, 70, { stroke: '#713F12', strokeWidth: 1.4 }),
    path('M22 22 L36 20 L36 80 L22 78 Z', { fill: 'url(#glass)' }),
    ellipse(8, 50, 7, 18, { fill: '#111827', stroke: '#374151', strokeWidth: 2 }),
    path('M190 16 L198 18 L198 82 L190 84', { fill: 'none', stroke: 'url(#chrome)', strokeWidth: 3.5 }),
    rect(182, 18, 8, 12, { rx: 2, fill: HEADLIGHT }), rect(182, 70, 8, 12, { rx: 2, fill: HEADLIGHT }),
    rect(12, 14, 4, 10, { rx: 1, fill: TAILLIGHT }), rect(12, 76, 4, 10, { rx: 1, fill: TAILLIGHT }),
  ];
}

/** A log seen from above, its bark and the rings at its cut end */
function log(x: number, y: number, len: number, r: number): ArtShape[] {
  return [
    rect(x, y - r, len, r * 2, { rx: r * 0.6, fill: 'url(#bark)', stroke: '#422006', strokeWidth: 0.8 }),
    line(x + 10, y - r * 0.3, x + len - 20, y - r * 0.4, { stroke: '#422006', strokeWidth: 0.8, opacity: 0.5 }),
    ellipse(x + 3, y, 3.5, r * 0.95, { fill: '#E7C9A0', stroke: '#92400E', strokeWidth: 0.8 }),
  ];
}

/** The log truck: the cab in front, the trailer loaded with logs and their straps */
function logTruck(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 16, 290, 82, { rx: 10, fill: SHADOW, opacity: 0.3 }),
    ...tires([30, 64, 168, 270], 30),
    rect(6, 12, 206, 76, { rx: 3, fill: '#44403C', stroke: '#1C1917', strokeWidth: 1 }),
    ...[30, 110, 190].flatMap(x => [rect(x, 8, 5, 84, { rx: 1, fill: '#57534E' })]),
    ...log(8, 26, 200, 13),
    ...log(14, 50, 196, 12),
    ...log(10, 74, 200, 13),
    ...log(30, 38, 170, 10),
    ...log(26, 62, 176, 10),
    ...[70, 150].map(x => rect(x, 10, 5, 80, { fill: '#F59E0B', opacity: 0.9 })),
    rect(214, 12, 82, 76, { rx: 10, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    rect(218, 18, 40, 64, { rx: 5, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    circle(232, 24, 3.5, { fill: '#374151' }), circle(232, 76, 3.5, { fill: '#374151' }),
    path('M258 20 L276 24 Q282 50 276 76 L258 80 Z', { fill: 'url(#glass)' }),
    line(282, 50, 294, 50, { stroke: light(color, 0.3), strokeWidth: 1 }),
    rect(286, 16, 8, 12, { rx: 2, fill: HEADLIGHT }), rect(286, 72, 8, 12, { rx: 2, fill: HEADLIGHT }),
    rect(4, 14, 4, 10, { rx: 1, fill: TAILLIGHT }), rect(4, 76, 4, 10, { rx: 1, fill: TAILLIGHT }),
  ];
}

export function earthVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return {
    width: (long ? 3 : 2) * CELL,
    height: CELL,
    gradients: vehicleGradients(color, [{ id: 'bark', stops: [{ offset: 0, color: '#5C3A1E' }, { offset: 0.5, color: '#A16207' }, { offset: 1, color: '#5C3A1E' }] }]),
    shapes: long ? logTruck(color) : offroad(color),
  };
}
