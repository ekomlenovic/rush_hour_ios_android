import { type ArtDrawing, type ArtShape, circle, dark, light, line, path, rect } from '../art';
import { CELL, HEADLIGHT, SHADOW, vehicleGradients } from '../events/vehicleKit';

/** Lava palette: a site dumper and its skip (2 cells) and a bulldozer on its tracks, blade in front (3 cells) */

/** A track seen from above, its treads across */
function track(x: number, y: number, len: number, w: number): ArtShape[] {
  return [
    rect(x, y, len, w, { rx: w / 2, fill: '#1C1917', stroke: '#0C0A09', strokeWidth: 1 }),
    ...Array.from({ length: Math.floor((len - 8) / 9) }, (_, i) => line(x + 6 + i * 9, y + 2, x + 6 + i * 9, y + w - 2, { stroke: '#57534E', strokeWidth: 3 })),
  ];
}

/** The dumper: big wheels, the driver's seat and roll bar behind, the skip in front */
function dumper(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 16, 188, 82, { rx: 10, fill: SHADOW, opacity: 0.3 }),
    ...[40, 150].flatMap(cx => [rect(cx - 22, 2, 44, 16, { rx: 6, fill: 'url(#tire)' }), rect(cx - 22, 82, 44, 16, { rx: 6, fill: 'url(#tire)' })]),
    rect(10, 16, 90, 68, { rx: 8, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    rect(22, 34, 30, 32, { rx: 6, fill: '#292524' }),
    circle(64, 50, 10, { fill: 'none', stroke: '#292524', strokeWidth: 4 }),
    line(80, 16, 80, 84, { stroke: '#FACC15', strokeWidth: 5 }),
    rect(8, 40, 6, 20, { rx: 2, fill: '#44403C' }),
    path('M104 10 L196 16 L196 84 L104 90 Z', { fill: 'url(#roof)', stroke: outline, strokeWidth: 1.2 }),
    path('M114 20 L186 24 L186 76 L114 80 Z', { fill: dark(color, 0.35) }),
    ...[130, 150, 170].map(x => line(x, 22, x, 78, { stroke: dark(color, 0.55), strokeWidth: 1.2 })),
    rect(98, 18, 6, 10, { rx: 2, fill: HEADLIGHT }), rect(98, 72, 6, 10, { rx: 2, fill: HEADLIGHT }),
  ];
}

/** The bulldozer: two tracks, the body and its cab, the exhaust, the ripper behind and the wide blade in front */
function bulldozer(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 14, 290, 84, { rx: 10, fill: SHADOW, opacity: 0.3 }),
    ...track(26, 4, 226, 20),
    ...track(26, 76, 226, 20),
    rect(34, 22, 210, 56, { rx: 6, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    ...[60, 76, 92].map(x => line(x, 28, x, 72, { stroke: dark(color, 0.4), strokeWidth: 2 })),
    rect(110, 26, 64, 48, { rx: 6, fill: 'url(#roof)', stroke: outline, strokeWidth: 1.2 }),
    rect(116, 32, 52, 36, { rx: 4, fill: 'url(#glass)', opacity: 0.85 }),
    circle(196, 36, 5, { fill: '#292524', stroke: '#57534E', strokeWidth: 1.5 }),
    // The ripper behind
    rect(8, 40, 26, 20, { rx: 3, fill: '#44403C' }),
    path('M6 44 L0 50 L6 56 Z', { fill: '#57534E' }),
    // The arms and the blade
    line(240, 30, 272, 26, { stroke: '#44403C', strokeWidth: 6 }),
    line(240, 70, 272, 74, { stroke: '#44403C', strokeWidth: 6 }),
    path('M272 2 Q292 50 272 98 L284 98 Q300 50 284 2 Z', { fill: dark(color, 0.25), stroke: outline, strokeWidth: 1.2 }),
    path('M284 4 Q298 50 284 96', { fill: 'none', stroke: light(color, 0.4), strokeWidth: 1.5 }),
    rect(236, 40, 6, 8, { rx: 2, fill: HEADLIGHT }), rect(236, 52, 6, 8, { rx: 2, fill: HEADLIGHT }),
  ];
}

export function lavaVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: vehicleGradients(color), shapes: long ? bulldozer(color) : dumper(color) };
}
