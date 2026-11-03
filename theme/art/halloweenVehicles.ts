import { type ArtDrawing, type ArtGradient, type ArtShape, circle, dark, ellipse, light, line, path, rect } from './art';

/**
 * Halloween vehicles seen from above, in pseudo-3D (shaded bodies, shadow on the board):
 * the pumpkin coach of the target car (skin), the haunted car (2 cells) and the hearse (3 cells) of the palette.
 * Drawn horizontally, the front on the right, in a box of 100 units per cell.
 */

const CELL = 100;
const SHADOW = '#000000';
const TIRE = '#151515';
const GHOST = '#F8FAFC';
const EYE = '#111111';
/** Will-o'-the-wisp green of the lamps */
const WISP = '#BEF264';
const GOLD = '#EAB308';

function gradients(color: string): ArtGradient[] {
  return [
    { id: 'body', stops: [
      { offset: 0, color: dark(color, 0.6) }, { offset: 0.2, color }, { offset: 0.47, color: light(color, 0.28) },
      { offset: 0.53, color: light(color, 0.28) }, { offset: 0.8, color }, { offset: 1, color: dark(color, 0.6) },
    ] },
    { id: 'roof', stops: [{ offset: 0, color: dark(color, 0.45) }, { offset: 0.5, color: light(color, 0.15) }, { offset: 1, color: dark(color, 0.45) }] },
    { id: 'glass', stops: [{ offset: 0, color: '#0B0614' }, { offset: 0.5, color: '#4C3A6B' }, { offset: 1, color: '#0B0614' }] },
    { id: 'chrome', stops: [{ offset: 0, color: '#6B7280' }, { offset: 0.5, color: '#F1F5F9' }, { offset: 1, color: '#6B7280' }] },
    { id: 'gold', stops: [{ offset: 0, color: '#92400E' }, { offset: 0.5, color: '#FDE68A' }, { offset: 1, color: '#92400E' }] },
    { id: 'tire', stops: [{ offset: 0, color: '#050505' }, { offset: 0.5, color: '#3A3A3A' }, { offset: 1, color: '#050505' }] },
    { id: 'pumpkin', radial: true, stops: [
      { offset: 0, color: light(color, 0.45) }, { offset: 0.55, color }, { offset: 1, color: dark(color, 0.45) },
    ] },
    { id: 'ghost', radial: true, stops: [{ offset: 0, color: GHOST }, { offset: 0.75, color: '#E2E8F0' }, { offset: 1, color: '#A5B4C8' }] },
    { id: 'wisp', radial: true, stops: [{ offset: 0, color: WISP, opacity: 0.9 }, { offset: 1, color: WISP, opacity: 0 }] },
    { id: 'wood', horizontal: true, stops: [{ offset: 0, color: '#3B2414' }, { offset: 0.5, color: '#7C4A26' }, { offset: 1, color: '#3B2414' }] },
  ];
}

/** Tires sticking out of the body at the given centers along the vehicle */
const tires = (centers: number[], width = 30): ArtShape[] =>
  centers.flatMap(cx => [
    rect(cx - width / 2, 4, width, 10, { rx: 4, fill: 'url(#tire)' }),
    rect(cx - width / 2, 86, width, 10, { rx: 4, fill: 'url(#tire)' }),
  ]);

/** A cobweb in a corner of the hood: threads from the corner (x, y), toward dx, dy */
function cobweb(x: number, y: number, dx: number, dy: number, size: number): ArtShape[] {
  const thread = { fill: 'none', stroke: '#E5E7EB', strokeWidth: 0.7, opacity: 0.75 };
  const rays = [0, 0.33, 0.66, 1].map(f => {
    const angle = (Math.PI / 2) * f;
    return { x: x + dx * size * Math.cos(angle), y: y + dy * size * Math.sin(angle) };
  });
  const ring = (k: number) => rays.slice(1).map((end, i) => {
    const start = rays[i];
    const a = { x: x + (start.x - x) * k, y: y + (start.y - y) * k };
    const b = { x: x + (end.x - x) * k, y: y + (end.y - y) * k };
    // Sagging toward the corner
    const c = { x: x + ((a.x + b.x) / 2 - x) * 0.82, y: y + ((a.y + b.y) / 2 - y) * 0.82 };
    return path(`M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, thread);
  });
  return [...rays.map(r => line(x, y, r.x, r.y, thread)), ...ring(0.4), ...ring(0.7), ...ring(1)];
}

/** A sheet ghost sitting on the roof, seen from above: the sheet spreads out, the eyes look up */
function ghost(cx: number, cy: number, r: number): ArtShape[] {
  const waves = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const b = ((i + 0.5) / 10) * Math.PI * 2;
    return `Q${cx + Math.cos(b) * r * 1.22} ${cy + Math.sin(b) * r * 1.22} ${cx + Math.cos(a + Math.PI / 5) * r} ${cy + Math.sin(a + Math.PI / 5) * r}`;
  }).join(' ');
  return [
    ellipse(cx + 4, cy + 5, r * 1.15, r * 1.1, { fill: SHADOW, opacity: 0.25 }),
    path(`M${cx + r} ${cy} ${waves} Z`, { fill: 'url(#ghost)', stroke: '#94A3B8', strokeWidth: 0.8 }),
    ellipse(cx - r * 0.15, cy - r * 0.3, r * 0.55, r * 0.35, { fill: '#FFFFFF', opacity: 0.7 }),
    ellipse(cx + r * 0.32, cy - r * 0.28, r * 0.13, r * 0.2, { fill: EYE }),
    ellipse(cx + r * 0.32, cy + r * 0.28, r * 0.13, r * 0.2, { fill: EYE }),
    ellipse(cx + r * 0.55, cy, r * 0.09, r * 0.14, { fill: EYE, opacity: 0.8 }),
  ];
}

/** The pumpkin coach (target car skin): a pumpkin with its ribs from the stem, golden wheels and two lanterns */
function pumpkinCoach(color: string): ArtShape[] {
  const cx = 100;
  const cy = 50;
  const rx = 84;
  const ry = 43;
  const rib = dark(color, 0.42);
  // Ribs curving from the stem to the edge, like a pumpkin seen from above
  const ribs = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const end = { x: cx + Math.cos(a) * rx * 0.98, y: cy + Math.sin(a) * ry * 0.98 };
    const bend = { x: cx + Math.cos(a + 0.28) * rx * 0.55, y: cy + Math.sin(a + 0.28) * ry * 0.55 };
    return path(`M${cx} ${cy} Q${bend.x} ${bend.y} ${end.x} ${end.y}`, { fill: 'none', stroke: rib, strokeWidth: 2.2, opacity: 0.75 });
  });
  const goldWheel = (x: number, y: number) => [
    rect(x - 18, y - 6, 36, 12, { rx: 5, fill: 'url(#tire)' }),
    ...[-12, -4, 4, 12].map(dx => line(x + dx, y - 5, x + dx, y + 5, { stroke: 'url(#gold)', strokeWidth: 2 })),
    rect(x - 18, y - 1, 36, 2, { fill: GOLD }),
  ];
  const lantern = (x: number, y: number) => [
    circle(x, y, 10, { fill: 'url(#wisp)' }),
    rect(x - 4, y - 4, 8, 8, { rx: 1.5, fill: '#FEF9C3', stroke: 'url(#gold)', strokeWidth: 1.6 }),
  ];
  return [
    ellipse(106, 58, 88, 42, { fill: SHADOW, opacity: 0.3 }),
    ...goldWheel(46, 8), ...goldWheel(46, 92), ...goldWheel(150, 8), ...goldWheel(150, 92),
    // Golden scrolls of the carriage, front and back
    path('M176 30 Q198 30 196 50 Q198 70 176 70', { fill: 'none', stroke: 'url(#gold)', strokeWidth: 3.5, strokeLinecap: 'round' }),
    path('M24 32 Q4 34 6 50 Q4 66 24 68', { fill: 'none', stroke: 'url(#gold)', strokeWidth: 3, strokeLinecap: 'round' }),
    circle(193, 42, 2.5, { fill: GOLD }), circle(193, 58, 2.5, { fill: GOLD }),
    ellipse(cx, cy, rx, ry, { fill: 'url(#pumpkin)', stroke: dark(color, 0.55), strokeWidth: 1.2 }),
    ...ribs,
    ellipse(78, 32, 34, 8, { fill: '#FFFFFF', opacity: 0.2 }),
    // Curly vine and a leaf around the stem
    path('M100 50 Q120 30 136 38 Q148 46 140 54 Q132 58 130 50', { fill: 'none', stroke: '#4D7C0F', strokeWidth: 2.2, strokeLinecap: 'round' }),
    path('M96 52 Q74 70 62 60 Q54 52 62 46', { fill: 'none', stroke: '#4D7C0F', strokeWidth: 2, strokeLinecap: 'round' }),
    path('M104 54 Q118 72 136 66 Q124 54 104 54 Z', { fill: '#65A30D', stroke: '#365314', strokeWidth: 1 }),
    line(108, 56, 128, 64, { stroke: '#365314', strokeWidth: 0.8 }),
    circle(cx, cy, 9, { fill: '#5B3A1E', stroke: '#3B2414', strokeWidth: 1 }),
    circle(cx - 2, cy - 2, 4, { fill: '#7C5530' }),
    ...lantern(182, 22), ...lantern(182, 78),
  ];
}

/** Haunted car (2 cells): a dark old car with a ghost sitting on the roof, a cobweb on the hood and green lamps */
function hauntedCar(color: string): ArtShape[] {
  const outline = dark(color, 0.65);
  return [
    rect(12, 16, 186, 82, { rx: 24, fill: SHADOW, opacity: 0.3 }),
    ...tires([46, 156]),
    path('M24 12 L168 12 Q194 16 196 50 Q194 84 168 88 L24 88 Q6 86 6 50 Q6 14 24 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    // Hood crease and louvers
    line(146, 50, 190, 50, { stroke: light(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    ...[0, 6, 12].flatMap(dx => [
      line(156 + dx, 26, 158 + dx, 33, { stroke: outline, strokeWidth: 1.4 }),
      line(156 + dx, 67, 158 + dx, 74, { stroke: outline, strokeWidth: 1.4 }),
    ]),
    path('M118 18 L140 22 Q147 50 140 78 L118 82 Z', { fill: 'url(#glass)' }),
    rect(46, 18, 74, 64, { rx: 12, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M32 24 L46 21 L46 79 L32 76 Q27 50 32 24 Z', { fill: 'url(#glass)' }),
    ...cobweb(194, 14, -1, 1, 30),
    ...ghost(84, 50, 24),
    circle(188, 22, 9, { fill: 'url(#wisp)' }), circle(188, 78, 9, { fill: 'url(#wisp)' }),
    rect(186, 17, 7, 11, { rx: 3, fill: WISP }),
    rect(186, 72, 7, 11, { rx: 3, fill: WISP }),
    rect(7, 18, 5, 12, { rx: 2, fill: '#7E22CE' }),
    rect(7, 70, 5, 12, { rx: 2, fill: '#7E22CE' }),
  ];
}

/** A coffin seen from above, its head toward the right */
function coffin(x: number, y: number, length: number, width: number): ArtShape[] {
  const l = length;
  const w = width;
  const d = `M${x} ${y + w * 0.3} L${x + l * 0.7} ${y} L${x + l} ${y + w * 0.2} L${x + l} ${y + w * 0.8} L${x + l * 0.7} ${y + w} L${x} ${y + w * 0.7} Z`;
  return [
    path(d, { fill: 'url(#wood)', stroke: '#1C1009', strokeWidth: 1.2 }),
    line(x + l * 0.45, y + w * 0.5, x + l * 0.85, y + w * 0.5, { stroke: '#D4B483', strokeWidth: 2.2 }),
    line(x + l * 0.72, y + w * 0.32, x + l * 0.72, y + w * 0.68, { stroke: '#D4B483', strokeWidth: 2.2 }),
  ];
}

/** Hearse (3 cells): a long black car, a glass back with a coffin and candles, silver scrolls along the sides */
function hearse(color: string): ArtShape[] {
  const outline = dark(color, 0.65);
  const scroll = (x: number, y: number, flip: number) =>
    path(`M${x} ${y} q8 ${-6 * flip} 16 0 t16 0 t16 0`, { fill: 'none', stroke: 'url(#chrome)', strokeWidth: 1.6 });
  const candle = (x: number, y: number) => [
    circle(x, y, 6, { fill: 'url(#wisp)' }),
    circle(x, y, 2.6, { fill: '#FEF3C7' }),
  ];
  return [
    rect(12, 16, 288, 82, { rx: 20, fill: SHADOW, opacity: 0.3 }),
    ...tires([54, 140, 252]),
    path('M18 12 L262 12 Q294 16 296 50 Q294 84 262 88 L18 88 Q6 86 6 50 Q6 14 18 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    // Hood, windshield and the roof of the cab
    line(240, 50, 290, 50, { stroke: light(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    rect(286, 34, 6, 32, { rx: 2, fill: 'url(#chrome)' }),
    path('M214 18 L236 22 Q243 50 236 78 L214 82 Z', { fill: 'url(#glass)' }),
    rect(186, 18, 30, 64, { rx: 8, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    // The glass back, the coffin on its flowers, the candles in the corners
    rect(20, 20, 160, 60, { rx: 6, fill: 'url(#glass)', stroke: 'url(#chrome)', strokeWidth: 2 }),
    rect(28, 40, 144, 20, { rx: 4, fill: '#2E1A3E', opacity: 0.8 }),
    ...coffin(36, 31, 130, 38),
    ...[60, 84, 108].flatMap(x => [circle(x, 26, 3.4, { fill: '#C084FC' }), circle(x + 4, 74, 3.4, { fill: '#F5F5F4' })]),
    ...candle(28, 27), ...candle(28, 73), ...candle(172, 27), ...candle(172, 73),
    ...[30, 78, 126].flatMap(x => [scroll(x, 15.5, 1), scroll(x, 84.5, -1)]),
    ellipse(110, 30, 70, 4, { fill: '#FFFFFF', opacity: 0.12 }),
    circle(288, 22, 9, { fill: 'url(#wisp)' }), circle(288, 78, 9, { fill: 'url(#wisp)' }),
    rect(287, 17, 6, 11, { rx: 3, fill: WISP }),
    rect(287, 72, 6, 11, { rx: 3, fill: WISP }),
    rect(7, 18, 5, 12, { rx: 2, fill: '#7E22CE' }),
    rect(7, 70, 5, 12, { rx: 2, fill: '#7E22CE' }),
  ];
}

/** The pumpkin coach of the target car, front on the right (2 cells) */
export function pumpkinCoachDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: pumpkinCoach(color) };
}

/** A vehicle of the Halloween palette: the haunted car for 2 cells, the hearse for 3 or more */
export function hauntedVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? hearse(color) : hauntedCar(color) };
}
