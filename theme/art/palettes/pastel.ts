import { type ArtDrawing, type ArtShape, circle, dark, light, line, path, rect } from '../art';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, tires, vehicleGradients } from '../events/vehicleKit';

/** Pastel palette: a round little retro city car (2 cells) and a two-tone retro bus with its skylights (3 cells) */

/** The retro city car: round body, cream roof, chrome bumpers, round headlights */
function cityCar(color: string): ArtShape[] {
  const outline = dark(color, 0.45);
  return [
    rect(14, 18, 180, 80, { rx: 36, fill: SHADOW, opacity: 0.25 }),
    ...tires([50, 150], 28),
    path('M40 10 L150 10 Q196 12 196 50 Q196 88 150 90 L40 90 Q6 88 6 50 Q6 12 40 10 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    path('M124 20 L146 24 Q154 50 146 76 L124 80 Z', { fill: 'url(#glass)' }),
    rect(50, 18, 76, 64, { rx: 22, fill: '#FFFBEB', stroke: outline, strokeWidth: 1 }),
    path('M34 26 L50 22 L50 78 L34 74 Q28 50 34 26 Z', { fill: 'url(#glass)' }),
    path('M190 24 Q200 50 190 76', { fill: 'none', stroke: 'url(#chrome)', strokeWidth: 4, strokeLinecap: 'round' }),
    path('M10 26 Q2 50 10 74', { fill: 'none', stroke: 'url(#chrome)', strokeWidth: 4, strokeLinecap: 'round' }),
    circle(182, 22, 7, { fill: HEADLIGHT, stroke: '#9CA3AF', strokeWidth: 1.2 }),
    circle(182, 78, 7, { fill: HEADLIGHT, stroke: '#9CA3AF', strokeWidth: 1.2 }),
    circle(124, 8, 4, { fill: 'url(#chrome)' }), circle(124, 92, 4, { fill: 'url(#chrome)' }),
    rect(10, 20, 5, 10, { rx: 2, fill: TAILLIGHT }), rect(10, 70, 5, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** The retro bus: its cream roof and rows of skylights, the split windshield, the painted V on its nose */
function retroBus(color: string): ArtShape[] {
  const outline = dark(color, 0.45);
  const skylights = Array.from({ length: 7 }, (_, i) => [
    rect(36 + i * 26, 22, 18, 9, { rx: 3, fill: 'url(#glass)' }),
    rect(36 + i * 26, 69, 18, 9, { rx: 3, fill: 'url(#glass)' }),
  ]).flat();
  return [
    rect(12, 16, 288, 82, { rx: 24, fill: SHADOW, opacity: 0.25 }),
    ...tires([54, 250], 30),
    path('M28 8 L262 8 Q298 12 298 50 Q298 88 262 92 L28 92 Q4 90 4 50 Q4 10 28 8 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    rect(16, 14, 230, 72, { rx: 18, fill: '#FFFBEB', stroke: outline, strokeWidth: 1 }),
    ...skylights,
    line(30, 50, 232, 50, { stroke: light(color, 0.2), strokeWidth: 3, opacity: 0.6 }),
    path('M246 18 L268 24 Q276 50 268 76 L246 82 Z', { fill: 'url(#glass)' }),
    line(272, 50, 260, 50, { stroke: outline, strokeWidth: 1 }),
    path('M276 14 L292 50 L276 86', { fill: 'none', stroke: '#FFFBEB', strokeWidth: 7, strokeLinejoin: 'round' }),
    circle(292, 50, 5, { fill: 'url(#chrome)' }),
    circle(286, 18, 6, { fill: HEADLIGHT, stroke: '#9CA3AF', strokeWidth: 1 }),
    circle(286, 82, 6, { fill: HEADLIGHT, stroke: '#9CA3AF', strokeWidth: 1 }),
    rect(4, 20, 5, 12, { rx: 2, fill: TAILLIGHT }), rect(4, 68, 5, 12, { rx: 2, fill: TAILLIGHT }),
  ];
}

export function pastelVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: vehicleGradients(color), shapes: long ? retroBus(color) : cityCar(color) };
}
