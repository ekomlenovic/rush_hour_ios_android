import { type ArtGradient, type ArtShape, type ArtDrawing, circle, ellipse, line, path, rect, dark, light } from './art';

/**
 * Drawings of 1930s vehicles seen from above (Mafia skin and palette), in pseudo-3D:
 * shaded bodies, fenders, chrome and a shadow on the board.
 * Drawn horizontally, the front on the right, in a box of 100 units per cell.
 */

const CELL = 100;

/** Gradients shared by the vehicles: a rounded body lit from above, glass, chrome */
function gradients(color: string): ArtGradient[] {
  return [
    { id: 'body', stops: [
      { offset: 0, color: dark(color, 0.55) }, { offset: 0.18, color }, { offset: 0.45, color: light(color, 0.3) },
      { offset: 0.55, color: light(color, 0.3) }, { offset: 0.82, color }, { offset: 1, color: dark(color, 0.55) },
    ] },
    { id: 'roof', stops: [
      { offset: 0, color: dark(color, 0.4) }, { offset: 0.5, color: light(color, 0.18) }, { offset: 1, color: dark(color, 0.4) },
    ] },
    { id: 'fender', stops: [
      { offset: 0, color: dark(color, 0.75) }, { offset: 0.5, color: dark(color, 0.35) }, { offset: 1, color: dark(color, 0.75) },
    ] },
    { id: 'glass', stops: [
      { offset: 0, color: '#0F172A' }, { offset: 0.5, color: '#4B6B8A' }, { offset: 1, color: '#0F172A' },
    ] },
    { id: 'chrome', stops: [
      { offset: 0, color: '#6B7280' }, { offset: 0.5, color: '#F9FAFB' }, { offset: 1, color: '#6B7280' },
    ] },
  ];
}

/** Headlights, grille and front bumper of a vehicle whose nose ends at x = front */
function front(x: number): ArtShape[] {
  return [
    rect(x - 10, 36, 6, 28, { rx: 2, fill: 'url(#chrome)' }),
    ...[24, 76].flatMap(cy => [circle(x - 14, cy, 6, { fill: 'url(#chrome)' }), circle(x - 14, cy, 3.6, { fill: '#FFF7D6' })]),
    rect(x - 4, 12, 4, 76, { rx: 2, fill: 'url(#chrome)' }),
  ];
}

/** Hood louvers and the crease along the middle of the hood */
function hood(from: number, to: number, color: string): ArtShape[] {
  return [
    line(from, 50, to, 50, { stroke: light(color, 0.45), strokeWidth: 1.2, opacity: 0.7 }),
    ...[0, 6, 12, 18].flatMap(dx => [
      line(from + 12 + dx, 30, from + 14 + dx, 37, { stroke: dark(color, 0.55), strokeWidth: 1.6 }),
      line(from + 12 + dx, 63, from + 14 + dx, 70, { stroke: dark(color, 0.55), strokeWidth: 1.6 }),
    ]),
  ];
}

/** Tires sticking out under the fenders, at the given centers along the vehicle */
const tires = (centers: number[]): ArtShape[] =>
  centers.flatMap(cx => [rect(cx - 15, 2, 30, 10, { rx: 3, fill: '#151515' }), rect(cx - 15, 88, 30, 10, { rx: 3, fill: '#151515' })]);

const fenders = (centers: number[]): ArtShape[] =>
  centers.flatMap(cx => [ellipse(cx, 16, 27, 12, { fill: 'url(#fender)' }), ellipse(cx, 84, 27, 12, { fill: 'url(#fender)' })]);

/** A 1930s sedan (2 cells): long hood, separate fenders, running boards, spare tire at the back */
function sedan(color: string): ArtShape[] {
  const outline = dark(color, 0.65);
  return [
    rect(13, 17, 186, 84, { rx: 22, fill: '#000000', opacity: 0.3 }),
    ...tires([44, 162]),
    ...fenders([44, 162]),
    rect(66, 9, 76, 8, { rx: 2, fill: '#2A2A2A' }),
    rect(66, 83, 76, 8, { rx: 2, fill: '#2A2A2A' }),
    path('M22 20 L116 18 L176 26 Q194 30 194 50 Q194 70 176 74 L116 82 L22 80 Q12 80 12 70 L12 30 Q12 20 22 20 Z',
      { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    ...hood(122, 188, color),
    ...front(200),
    path('M110 24 L122 26 L122 74 L110 76 Z', { fill: 'url(#glass)' }),
    rect(38, 22, 74, 56, { rx: 12, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(44, 18.5, 62, 4, { rx: 2, fill: 'url(#glass)' }),
    rect(44, 77.5, 62, 4, { rx: 2, fill: 'url(#glass)' }),
    rect(30, 34, 8, 32, { rx: 3, fill: 'url(#glass)' }),
    ellipse(72, 38, 26, 6, { fill: '#FFFFFF', opacity: 0.12 }),
    rect(13, 22, 4, 7, { rx: 1, fill: '#B91C1C' }),
    rect(13, 71, 4, 7, { rx: 1, fill: '#B91C1C' }),
    rect(3, 36, 9, 28, { rx: 4, fill: '#111111' }),
    rect(5.5, 44, 4, 12, { rx: 2, fill: 'url(#chrome)' }),
    rect(0, 16, 3, 68, { rx: 1.5, fill: 'url(#chrome)' }),
  ];
}

/** A 1930s flatbed truck (3 cells) carrying whiskey barrels and crates */
function truck(color: string): ArtShape[] {
  const outline = dark(color, 0.65);
  const wood = '#7A4E2A';
  const woodDark = '#4A2F17';
  const barrel = (cx: number, cy: number) => [
    circle(cx, cy, 14, { fill: '#8B5A2B', stroke: woodDark, strokeWidth: 2 }),
    circle(cx, cy, 9, { fill: 'none', stroke: woodDark, strokeWidth: 1.5 }),
    circle(cx, cy, 2.5, { fill: woodDark }),
  ];
  const crate = (x: number, y: number, w: number, h: number) => [
    rect(x, y, w, h, { fill: '#C8A165', stroke: '#7A5A2E', strokeWidth: 2 }),
    line(x, y, x + w, y + h, { stroke: '#7A5A2E', strokeWidth: 1.5 }),
    line(x + w, y, x, y + h, { stroke: '#7A5A2E', strokeWidth: 1.5 }),
  ];
  return [
    rect(11, 15, 290, 86, { rx: 14, fill: '#000000', opacity: 0.3 }),
    ...tires([60, 130, 264]),
    ...fenders([264]),
    rect(10, 8, 182, 84, { rx: 4, fill: wood }),
    ...[20, 32, 44, 56, 68, 80].map(y => line(12, y, 190, y, { stroke: woodDark, strokeWidth: 1, opacity: 0.6 })),
    rect(10, 8, 182, 7, { rx: 2, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(10, 85, 182, 7, { rx: 2, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(10, 8, 6, 84, { rx: 2, fill: color, stroke: outline, strokeWidth: 1 }),
    ...barrel(44, 33), ...barrel(44, 67), ...barrel(78, 33), ...barrel(78, 67),
    ...crate(100, 20, 36, 28), ...crate(100, 52, 36, 28), ...crate(142, 30, 40, 40),
    path('M194 16 L236 18 L236 82 L194 84 Q190 84 190 80 L190 20 Q190 16 194 16 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(196, 22, 32, 56, { rx: 8, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    ellipse(212, 36, 12, 5, { fill: '#FFFFFF', opacity: 0.12 }),
    path('M226 24 L236 26 L236 74 L226 76 Z', { fill: 'url(#glass)' }),
    path('M236 24 L280 28 Q294 32 294 50 Q294 68 280 72 L236 76 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    ...hood(238, 288, color),
    ...front(300),
    rect(6, 12, 4, 8, { rx: 1, fill: '#B91C1C' }),
    rect(6, 80, 4, 8, { rx: 1, fill: '#B91C1C' }),
  ];
}

/** The drawing of a vehicle of `length` cells (a sedan for 2, a truck for 3 or more), front on the right */
export function vintageVehicle(length: number, color: string): ArtDrawing {
  const isTruck = length >= 3;
  return {
    width: (isTruck ? 3 : 2) * CELL,
    height: CELL,
    gradients: gradients(color),
    shapes: isTruck ? truck(color) : sedan(color),
  };
}
