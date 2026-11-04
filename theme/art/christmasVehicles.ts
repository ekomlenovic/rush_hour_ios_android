import { type ArtDrawing, type ArtGradient, type ArtShape, circle, dark, ellipse, light, line, path, rect } from './art';

/**
 * Christmas vehicles seen from above, in pseudo-3D (shaded bodies, shadow on the board): Santa's sleigh of the
 * target car (skin), the car bringing home its Christmas tree (2 cells) and the truck of presents (3 cells) of the palette.
 * Drawn horizontally, the front on the right, in a box of 100 units per cell.
 */

const CELL = 100;
const SHADOW = '#000000';
const HEADLIGHT = '#FFF7D6';
const TAILLIGHT = '#B91C1C';
const FIR = '#166534';
/** Wrapping and ribbon of the presents, in turn */
const PRESENTS: [string, string][] = [
  ['#DC2626', '#FACC15'], ['#2563EB', '#F8FAFC'], ['#16A34A', '#FACC15'], ['#F8FAFC', '#DC2626'],
  ['#9333EA', '#FACC15'], ['#CA8A04', '#B91C1C'], ['#DB2777', '#F8FAFC'], ['#0D9488', '#FACC15'],
];
/** Bulbs of the string lights */
const BULBS = ['#FDE047', '#F87171', '#60A5FA', '#4ADE80', '#F472B6'];

function gradients(color: string): ArtGradient[] {
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
    { id: 'velvet', stops: [{ offset: 0, color: '#450A0A' }, { offset: 0.5, color: '#991B1B' }, { offset: 1, color: '#450A0A' }] },
    { id: 'sack', radial: true, stops: [{ offset: 0, color: '#D6B58A' }, { offset: 0.7, color: '#A47A4C' }, { offset: 1, color: '#6B4A2A' }] },
    { id: 'fir', horizontal: true, stops: [{ offset: 0, color: '#14532D' }, { offset: 1, color: '#22C55E' }] },
    { id: 'wood', stops: [{ offset: 0, color: '#5C3A1E' }, { offset: 0.5, color: '#9A6A3A' }, { offset: 1, color: '#5C3A1E' }] },
  ];
}

const tires = (centers: number[]): ArtShape[] =>
  centers.flatMap(cx => [
    rect(cx - 16, 6, 32, 10, { rx: 4, fill: 'url(#tire)' }),
    rect(cx - 16, 84, 32, 10, { rx: 4, fill: 'url(#tire)' }),
  ]);

/** A present seen from above: its ribbon crossing on top and the bow */
function present(x: number, y: number, size: number, index: number): ArtShape[] {
  const [wrap, ribbon] = PRESENTS[index % PRESENTS.length];
  const half = size / 2;
  const band = Math.max(2, size * 0.16);
  return [
    rect(x + 2, y + 2, size, size, { rx: 2, fill: SHADOW, opacity: 0.3 }),
    rect(x, y, size, size, { rx: 2, fill: wrap, stroke: dark(wrap, 0.4), strokeWidth: 0.8 }),
    rect(x, y, size, size * 0.3, { rx: 2, fill: '#FFFFFF', opacity: 0.18 }),
    rect(x + half - band / 2, y, band, size, { fill: ribbon }),
    rect(x, y + half - band / 2, size, band, { fill: ribbon }),
    ellipse(x + half - size * 0.16, y + half, size * 0.17, size * 0.11, { fill: ribbon, stroke: dark(ribbon, 0.3), strokeWidth: 0.7 }),
    ellipse(x + half + size * 0.16, y + half, size * 0.17, size * 0.11, { fill: ribbon, stroke: dark(ribbon, 0.3), strokeWidth: 0.7 }),
    circle(x + half, y + half, size * 0.08, { fill: dark(ribbon, 0.2) }),
  ];
}

/** Santa's sleigh (target car skin): curled golden runners, the red body, a velvet seat and a sack of presents */
function sleigh(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  const runner = (y: number, side: number) =>
    path(`M10 ${y} L176 ${y} Q194 ${y} 194 ${y + 10 * side} Q194 ${y + 20 * side} 182 ${y + 18 * side} Q176 ${y + 14 * side} 182 ${y + 10 * side}`,
      { fill: 'none', stroke: 'url(#gold)', strokeWidth: 4, strokeLinecap: 'round' });
  return [
    rect(16, 18, 174, 80, { rx: 30, fill: SHADOW, opacity: 0.3 }),
    runner(8, 1), runner(92, -1),
    // Struts from the runners to the body
    ...[40, 90, 140].flatMap(x => [rect(x - 2, 8, 4, 12, { fill: 'url(#gold)' }), rect(x - 2, 80, 4, 12, { fill: 'url(#gold)' })]),
    // The body, its front curled up like a scroll
    path('M26 16 L150 16 Q186 16 186 50 Q186 84 150 84 L26 84 Q12 84 12 70 L12 30 Q12 16 26 16 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    path('M30 22 L148 22 Q178 22 178 50 Q178 78 148 78 L30 78 Q18 78 18 66 L18 34 Q18 22 30 22 Z', { fill: 'none', stroke: 'url(#gold)', strokeWidth: 2.5 }),
    path('M160 32 Q172 40 166 50 Q160 60 172 68', { fill: 'none', stroke: 'url(#gold)', strokeWidth: 2.2, strokeLinecap: 'round' }),
    circle(172, 32, 3, { fill: '#FDE68A' }), circle(172, 68, 3, { fill: '#FDE68A' }),
    // The seat and its back
    rect(104, 28, 38, 44, { rx: 8, fill: 'url(#velvet)', stroke: '#FDE68A', strokeWidth: 1.4 }),
    rect(96, 26, 10, 48, { rx: 4, fill: dark(color, 0.25), stroke: outline, strokeWidth: 1 }),
    line(110, 50, 138, 50, { stroke: '#FDE68A', strokeWidth: 0.8, opacity: 0.6 }),
    // The sack, overflowing with presents
    ellipse(54, 50, 38, 30, { fill: 'url(#sack)', stroke: '#5C3A1E', strokeWidth: 1.2 }),
    path('M30 38 Q40 44 34 56 M74 30 Q66 40 72 48', { fill: 'none', stroke: '#6B4A2A', strokeWidth: 1.2, opacity: 0.7 }),
    ...present(36, 32, 18, 1), ...present(56, 40, 20, 2), ...present(40, 54, 15, 4), ...present(64, 26, 13, 5),
    rect(88, 44, 8, 12, { rx: 3, fill: '#A16207' }),
    ellipse(130, 26, 34, 4, { fill: '#FFFFFF', opacity: 0.2 }),
    // Bells on the front
    circle(186, 40, 3.4, { fill: 'url(#gold)' }), circle(186, 60, 3.4, { fill: 'url(#gold)' }),
  ];
}

/** A Christmas tree lying on the roof, its tip toward the front, tied with two ropes */
function lyingTree(from: number, to: number, cy: number, half: number): ArtShape[] {
  const length = to - from;
  // Three tiers of branches, each one a little narrower toward the tip
  const tiers = [0, 0.3, 0.58].map(f => {
    const x0 = from + length * f;
    const w = half * (1 - f * 0.8);
    const tip = Math.min(to, x0 + length * 0.48);
    const teeth = 4;
    const top = Array.from({ length: teeth }, (_, i) => {
      const x = x0 + ((tip - x0) * (i + 1)) / (teeth + 1);
      const y = cy - w * (1 - (i + 1) / (teeth + 1));
      return `L${x} ${y - 3} L${x - 4} ${y + 2}`;
    }).join(' ');
    const bottom = Array.from({ length: teeth }, (_, i) => {
      const k = teeth - 1 - i;
      const x = x0 + ((tip - x0) * (k + 1)) / (teeth + 1);
      const y = cy + w * (1 - (k + 1) / (teeth + 1));
      return `L${x - 4} ${y - 2} L${x} ${y + 3}`;
    }).join(' ');
    return path(`M${x0} ${cy - w} ${top} L${tip} ${cy} ${bottom} L${x0} ${cy + w} Q${x0 - 5} ${cy} ${x0} ${cy - w} Z`,
      { fill: 'url(#fir)', stroke: '#14532D', strokeWidth: 1 });
  });
  const baubles = [[0.22, -0.35, '#DC2626'], [0.4, 0.3, '#FACC15'], [0.62, -0.18, '#60A5FA'], [0.16, 0.42, '#F8FAFC']] as const;
  return [
    ellipse((from + to) / 2 + 3, cy + 4, length / 2, half * 0.9, { fill: SHADOW, opacity: 0.25 }),
    rect(from - 12, cy - 4, 14, 8, { rx: 2, fill: 'url(#wood)' }),
    ...tiers,
    ...baubles.map(([fx, fy, c]) => circle(from + length * fx, cy + half * fy * (1 - fx * 0.8), 3, { fill: c })),
    path(`M${from + length * 0.2} ${cy - half - 2} L${from + length * 0.2} ${cy + half + 2}`, { stroke: '#D4B483', strokeWidth: 2 }),
    path(`M${from + length * 0.5} ${cy - half * 0.7} L${from + length * 0.5} ${cy + half * 0.7}`, { stroke: '#D4B483', strokeWidth: 2 }),
  ];
}

/** A modern car seen from above: body, windshield, roof, rear window and lights */
function carBody(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    rect(10, 16, 188, 82, { rx: 24, fill: SHADOW, opacity: 0.3 }),
    ...tires([48, 156]),
    path('M24 12 L170 12 Q196 14 197 50 Q196 86 170 88 L24 88 Q4 86 4 50 Q4 14 24 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    path('M126 18 L148 23 Q155 50 148 77 L126 82 Z', { fill: 'url(#glass)' }),
    rect(44, 18, 84, 64, { rx: 10, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M30 24 L44 21 L44 79 L30 76 Q25 50 30 24 Z', { fill: 'url(#glass)' }),
    rect(186, 17, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(186, 70, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(5, 17, 5, 13, { rx: 2, fill: TAILLIGHT }),
    rect(5, 70, 5, 13, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** Car bringing home its tree (2 cells): the tree tied on the roof rack, a wreath on the hood */
function treeCar(color: string): ArtShape[] {
  return [
    ...carBody(color),
    // Roof rack
    rect(52, 20, 3, 60, { rx: 1.5, fill: 'url(#chrome)' }),
    rect(118, 20, 3, 60, { rx: 1.5, fill: 'url(#chrome)' }),
    ...lyingTree(40, 150, 50, 30),
    // The wreath on the hood
    circle(172, 50, 10, { fill: 'none', stroke: FIR, strokeWidth: 5 }),
    ...[0, 1, 2, 3, 4, 5].map(i => circle(172 + Math.cos(i * 1.05) * 10, 50 + Math.sin(i * 1.05) * 10, 1.6, { fill: '#DC2626' })),
    path('M172 60 L168 68 L172 65 L176 68 Z', { fill: '#DC2626' }),
  ];
}

/** Truck of presents (3 cells): a cab and an open bed full of presents, string lights along its sides */
function presentsTruck(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  const lights = Array.from({ length: 12 }, (_, i) => {
    const x = 18 + i * 15;
    return [circle(x, 11, 3, { fill: BULBS[i % BULBS.length] }), circle(x + 7, 89, 3, { fill: BULBS[(i + 2) % BULBS.length] })];
  }).flat();
  const presents = [
    [22, 22, 26], [22, 52, 26], [52, 18, 22], [54, 44, 18], [52, 64, 20], [80, 22, 28], [80, 54, 26],
    [112, 18, 20], [112, 42, 22], [114, 66, 16], [140, 22, 24], [140, 50, 30],
  ];
  return [
    rect(10, 16, 290, 82, { rx: 16, fill: SHADOW, opacity: 0.3 }),
    ...tires([56, 140, 258]),
    // The bed: its floor, then its sides
    rect(10, 8, 172, 84, { rx: 4, fill: 'url(#wood)' }),
    rect(10, 8, 172, 6, { rx: 2, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(10, 86, 172, 6, { rx: 2, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(10, 8, 6, 84, { rx: 2, fill: color, stroke: outline, strokeWidth: 1 }),
    ...presents.flatMap(([x, y, s], i) => present(x, y, s, i)),
    path('M14 11 Q60 16 100 11 T182 11', { fill: 'none', stroke: '#14532D', strokeWidth: 1 }),
    ...lights,
    // The cab
    path('M190 14 L262 14 Q294 18 296 50 Q294 82 262 86 L190 86 Q184 86 184 80 L184 20 Q184 14 190 14 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(190, 20, 40, 60, { rx: 8, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M230 20 L250 24 Q256 50 250 76 L230 80 Z', { fill: 'url(#glass)' }),
    line(254, 50, 290, 50, { stroke: light(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    // A star on the roof of the cab
    path('M210 38 L213 46 L221 46 L215 51 L217 59 L210 54 L203 59 L205 51 L199 46 L207 46 Z', { fill: '#FACC15', stroke: '#A16207', strokeWidth: 1 }),
    rect(286, 18, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(286, 69, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(4, 14, 5, 12, { rx: 2, fill: TAILLIGHT }),
    rect(4, 74, 5, 12, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** Santa's sleigh of the target car, front on the right (2 cells) */
export function sleighDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: sleigh(color) };
}

/** A vehicle of the Christmas palette: the car with its tree for 2 cells, the truck of presents for 3 or more */
export function festiveVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? presentsTruck(color) : treeCar(color) };
}
