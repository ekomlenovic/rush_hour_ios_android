import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { CELL, HEADLIGHT, SHADOW, vehicleGradients } from '../events/vehicleKit';

/** Ocean palette: a speedboat (2 cells) and a ferry with its decks and funnel (3 cells), seen from above, bow on the right */

/** The speedboat: pointed hull, white deck, windshield, seats and the outboard engine, foam along its sides */
function speedboat(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    path('M14 26 L128 20 Q186 30 198 50 Q186 70 128 80 L14 74 Z', { fill: SHADOW, opacity: 0.25, transform: 'translate(4 6)' }),
    ellipse(30, 22, 22, 4, { fill: '#FFFFFF', opacity: 0.55 }), ellipse(30, 78, 22, 4, { fill: '#FFFFFF', opacity: 0.55 }),
    path('M12 20 L128 14 Q186 26 198 50 Q186 74 128 86 L12 80 Q6 50 12 20 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    path('M20 28 L124 23 Q170 32 182 50 Q170 68 124 77 L20 72 Q16 50 20 28 Z', { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1 }),
    line(130, 50, 188, 50, { stroke: '#CBD5E1', strokeWidth: 1.2 }),
    path('M112 26 Q132 50 112 74', { fill: 'none', stroke: 'url(#glass)', strokeWidth: 7, strokeLinecap: 'round' }),
    rect(78, 32, 22, 15, { rx: 4, fill: color }), rect(78, 53, 22, 15, { rx: 4, fill: color }),
    rect(32, 30, 32, 40, { rx: 6, fill: light(color, 0.3), stroke: outline, strokeWidth: 0.8 }),
    rect(2, 38, 14, 24, { rx: 4, fill: '#1F2937', stroke: '#111827', strokeWidth: 0.8 }),
    rect(6, 42, 6, 16, { rx: 2, fill: '#475569' }),
    circle(182, 34, 2.5, { fill: HEADLIGHT }), circle(182, 66, 2.5, { fill: HEADLIGHT }),
  ];
}

/** The ferry: a long hull, its white decks and rows of windows, the funnel, lifeboats and the bridge in front */
function ferry(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  const windows = Array.from({ length: 12 }, (_, i) => [
    rect(50 + i * 13, 24, 8, 5, { rx: 1.5, fill: 'url(#glass)' }),
    rect(50 + i * 13, 71, 8, 5, { rx: 1.5, fill: 'url(#glass)' }),
  ]).flat();
  return [
    rect(10, 16, 290, 82, { rx: 20, fill: SHADOW, opacity: 0.25 }),
    path('M16 10 L236 10 Q288 18 298 50 Q288 82 236 90 L16 90 Q4 88 4 50 Q4 12 16 10 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    // The car ramp at the stern
    rect(4, 30, 12, 40, { rx: 2, fill: dark(color, 0.35) }),
    ...[36, 44, 52, 60].map(y => line(6, y, 14, y, { stroke: dark(color, 0.6), strokeWidth: 1 })),
    // The white decks, their windows, the lifeboats along the sides
    rect(30, 18, 200, 64, { rx: 10, fill: '#F8FAFC', stroke: '#94A3B8', strokeWidth: 1 }),
    ...windows,
    rect(44, 34, 168, 32, { rx: 6, fill: '#E2E8F0', stroke: '#CBD5E1', strokeWidth: 0.8 }),
    ...[70, 120, 170].flatMap(x => [rect(x, 11, 22, 6, { rx: 3, fill: '#F97316' }), rect(x, 83, 22, 6, { rx: 3, fill: '#F97316' })]),
    // The funnel, in the color of the line
    rect(96, 38, 30, 24, { rx: 10, fill: color, stroke: outline, strokeWidth: 1 }),
    rect(96, 46, 30, 8, { fill: '#F8FAFC', opacity: 0.85 }),
    rect(100, 41, 14, 18, { rx: 6, fill: '#1F2937' }),
    ellipse(92, 50, 6, 5, { fill: '#94A3B8', opacity: 0.6 }), ellipse(82, 48, 8, 6, { fill: '#CBD5E1', opacity: 0.45 }),
    // The bridge and its wide windows
    rect(214, 22, 26, 56, { rx: 6, fill: '#F8FAFC', stroke: '#94A3B8', strokeWidth: 1 }),
    path('M240 24 Q250 50 240 76', { fill: 'none', stroke: 'url(#glass)', strokeWidth: 6 }),
    circle(268, 50, 5, { fill: 'none', stroke: light(color, 0.4), strokeWidth: 1.5 }),
    line(258, 50, 292, 50, { stroke: light(color, 0.4), strokeWidth: 1 }),
  ];
}

export function oceanVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: vehicleGradients(color), shapes: long ? ferry(color) : speedboat(color) };
}
