import { type ArtDrawing, type ArtShape, dark, ellipse, light, line, path, rect } from '../art';
import { CELL, HEADLIGHT, SHADOW, tires, vehicleGradients } from '../events/vehicleKit';

/** Candy palette: a wrapped sweet on wheels (2 cells) and a chocolate bar half out of its wrapper (3 cells) */

/** The wrapped sweet: a round candy with its stripes, the wrapper twisted at both ends */
function sweet(color: string): ArtShape[] {
  const wrapper = light(color, 0.45);
  const edge = dark(color, 0.35);
  return [
    ellipse(104, 58, 92, 38, { fill: SHADOW, opacity: 0.25 }),
    ...tires([62, 142], 26),
    path('M48 50 L6 14 Q14 50 6 86 Z', { fill: wrapper, stroke: edge, strokeWidth: 1, strokeLinejoin: 'round' }),
    path('M152 50 L194 14 Q186 50 194 86 Z', { fill: wrapper, stroke: edge, strokeWidth: 1, strokeLinejoin: 'round' }),
    ...[30, 50, 70].map(y => line(10, y, 46, 50, { stroke: edge, strokeWidth: 0.8, opacity: 0.5 })),
    ...[30, 50, 70].map(y => line(190, y, 154, 50, { stroke: edge, strokeWidth: 0.8, opacity: 0.5 })),
    ellipse(100, 50, 58, 40, { fill: 'url(#body)', stroke: edge, strokeWidth: 1.2 }),
    ...[-30, -10, 10, 30].map(dx => path(`M${100 + dx - 10} 12 Q${100 + dx + 14} 50 ${100 + dx - 10} 88`, { fill: 'none', stroke: '#FFFFFF', strokeWidth: 5, opacity: 0.75 })),
    ellipse(84, 30, 18, 6, { fill: '#FFFFFF', opacity: 0.45 }),
    rect(150, 26, 6, 8, { rx: 2, fill: HEADLIGHT }), rect(150, 66, 6, 8, { rx: 2, fill: HEADLIGHT }),
  ];
}

/** The chocolate bar: the wrapper in the palette color behind, the foil and the chocolate squares in front */
function chocolateBar(color: string): ArtShape[] {
  const edge = dark(color, 0.4);
  const squares = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) =>
    rect(178 + i * 38, 14 + j * 24, 34, 20, { rx: 3, fill: '#7C3F1D', stroke: '#4A2511', strokeWidth: 1 }))).flat();
  return [
    rect(10, 16, 290, 82, { rx: 8, fill: SHADOW, opacity: 0.25 }),
    ...tires([54, 250], 28),
    rect(170, 8, 126, 84, { rx: 6, fill: '#5C2E12', stroke: '#3B1D0B', strokeWidth: 1 }),
    ...squares,
    ...squares.map(s => rect(Number(s.attrs.x) + 4, Number(s.attrs.y) + 3, 18, 4, { rx: 2, fill: '#A0603A', opacity: 0.6 })),
    path('M150 8 L176 8 L170 20 L178 32 L170 44 L178 56 L170 68 L178 80 L172 92 L150 92 Z', { fill: 'url(#chrome)', stroke: '#9CA3AF', strokeWidth: 0.8 }),
    rect(6, 6, 152, 88, { rx: 6, fill: 'url(#body)', stroke: edge, strokeWidth: 1.2 }),
    rect(30, 30, 100, 40, { rx: 20, fill: '#FFFFFF', opacity: 0.9 }),
    path('M46 50 Q58 38 70 50 T94 50 T118 50', { fill: 'none', stroke: color, strokeWidth: 5, strokeLinecap: 'round' }),
    ...[14, 86].map(y => line(10, y, 154, y, { stroke: '#FFFFFF', strokeWidth: 2, opacity: 0.5, strokeDasharray: '6 6' })),
  ];
}

export function candyVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: vehicleGradients(color), shapes: long ? chocolateBar(color) : sweet(color) };
}
