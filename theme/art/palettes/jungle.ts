import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, tires, vehicleGradients } from '../events/vehicleKit';

/** Jungle palette: an open safari jeep with zebra stripes (2 cells) and an expedition truck under its canvas (3 cells) */

/** The safari jeep: open top and its seats, zebra stripes, roll bar, spare wheel and bull bar */
function safariJeep(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  const stripe = { fill: dark(color, 0.65), opacity: 0.85 };
  return [
    rect(10, 16, 190, 82, { rx: 12, fill: SHADOW, opacity: 0.3 }),
    ...tires([48, 156], 36),
    rect(12, 10, 176, 80, { rx: 10, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    path('M30 10 Q36 20 28 30 L22 30 Q30 20 24 10 Z', stripe), path('M30 90 Q36 80 28 70 L22 70 Q30 80 24 90 Z', stripe),
    path('M160 10 Q168 22 158 32 L150 32 Q160 22 152 10 Z', stripe), path('M160 90 Q168 78 158 68 L150 68 Q160 78 152 90 Z', stripe),
    path('M176 14 Q184 30 176 44 L170 42 Q176 30 170 14 Z', stripe), path('M176 86 Q184 70 176 56 L170 58 Q176 70 170 86 Z', stripe),
    // The open top: the floor, two rows of seats, the roll bar and the windshield
    rect(34, 18, 104, 64, { rx: 6, fill: '#3F2A14', stroke: outline, strokeWidth: 1 }),
    ...[[44, 22], [44, 54], [92, 22], [92, 54]].map(([x, y]) => rect(x, y, 26, 24, { rx: 5, fill: '#D6C7A1', stroke: '#78716C', strokeWidth: 0.8 })),
    circle(112, 34, 7, { fill: 'none', stroke: '#1F2937', strokeWidth: 2.5 }),
    line(80, 16, 80, 84, { stroke: '#1F2937', strokeWidth: 4 }),
    rect(138, 16, 7, 68, { rx: 2, fill: 'url(#glass)' }),
    ellipse(8, 50, 7, 18, { fill: '#111827', stroke: '#374151', strokeWidth: 2 }),
    path('M190 16 L198 18 L198 82 L190 84', { fill: 'none', stroke: '#1F2937', strokeWidth: 3.5 }),
    rect(182, 18, 8, 12, { rx: 2, fill: HEADLIGHT }), rect(182, 70, 8, 12, { rx: 2, fill: HEADLIGHT }),
    rect(13, 14, 4, 10, { rx: 1, fill: TAILLIGHT }), rect(13, 76, 4, 10, { rx: 1, fill: TAILLIGHT }),
  ];
}

/** The expedition truck: canvas over its ribs behind, the cab and its roof rack with gear, jerrycans */
function expeditionTruck(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    rect(10, 16, 290, 82, { rx: 12, fill: SHADOW, opacity: 0.3 }),
    ...tires([50, 120, 254], 34),
    rect(6, 10, 202, 80, { rx: 10, fill: 'url(#canvas)', stroke: '#57534E', strokeWidth: 1.2 }),
    ...[36, 70, 104, 138, 172].map(x => path(`M${x} 11 Q${x + 4} 50 ${x} 89`, { fill: 'none', stroke: '#78716C', strokeWidth: 2, opacity: 0.7 })),
    rect(10, 10, 6, 80, { rx: 2, fill: '#78716C' }),
    rect(208, 12, 88, 76, { rx: 10, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    rect(212, 18, 46, 64, { rx: 5, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(216, 22, 38, 56, { rx: 2, fill: 'none', stroke: '#1F2937', strokeWidth: 2 }),
    rect(220, 26, 14, 20, { rx: 2, fill: '#B91C1C' }), rect(220, 54, 14, 20, { rx: 2, fill: '#B91C1C' }),
    rect(238, 28, 12, 44, { rx: 6, fill: light(color, 0.3), stroke: outline, strokeWidth: 0.8 }),
    path('M258 20 L276 24 Q282 50 276 76 L258 80 Z', { fill: 'url(#glass)' }),
    path('M292 16 L298 18 L298 82 L292 84', { fill: 'none', stroke: '#1F2937', strokeWidth: 3.5 }),
    rect(286, 18, 7, 12, { rx: 2, fill: HEADLIGHT }), rect(286, 70, 7, 12, { rx: 2, fill: HEADLIGHT }),
    rect(4, 14, 4, 10, { rx: 1, fill: TAILLIGHT }), rect(4, 76, 4, 10, { rx: 1, fill: TAILLIGHT }),
  ];
}

export function jungleVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return {
    width: (long ? 3 : 2) * CELL,
    height: CELL,
    gradients: vehicleGradients(color, [{ id: 'canvas', stops: [{ offset: 0, color: '#A8A07A' }, { offset: 0.5, color: '#E7DFBE' }, { offset: 1, color: '#A8A07A' }] }]),
    shapes: long ? expeditionTruck(color) : safariJeep(color),
  };
}
