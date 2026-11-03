import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, tires, vehicleGradients } from './vehicleKit';

/**
 * Back to school (la rentrée, September 1st to 7th): the pencil car of the target car (skin), the car carrying its
 * books (2 cells) and the school bus (3 cells) of the palette, the paper planes of its win effect, and the backdrop of
 * its board: a squared notebook page with its spiral and margin (light) or a chalkboard and its tray (dark), doodles in
 * the margins, colored pencils along the bottom.
 */

/** The pencil car (target car skin): eraser and ferrule behind, the six-sided body, the sharpened wood and lead in front */
function pencilCar(color: string): ArtShape[] {
  const outline = dark(color, 0.5);
  const scallops = 'M160 18 Q166 26 160 34 Q166 42 160 50 Q166 58 160 66 Q166 74 160 82';
  return [
    rect(10, 22, 186, 72, { rx: 10, fill: SHADOW, opacity: 0.3 }),
    ...tires([54, 140]),
    // The eraser and its metal ferrule
    rect(4, 22, 22, 56, { rx: 9, fill: '#F9A8D4', stroke: '#BE185D', strokeWidth: 1 }),
    ellipse(12, 34, 4, 6, { fill: '#FFFFFF', opacity: 0.35 }),
    rect(22, 18, 16, 64, { rx: 2, fill: 'url(#chrome)', stroke: '#6B7280', strokeWidth: 1 }),
    ...[26, 30, 34].map(x => line(x, 18, x, 82, { stroke: '#6B7280', strokeWidth: 0.8 })),
    // The body, its facets
    rect(38, 18, 124, 64, { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    line(38, 36, 162, 36, { stroke: outline, strokeWidth: 0.8, opacity: 0.5 }),
    line(38, 64, 162, 64, { stroke: outline, strokeWidth: 0.8, opacity: 0.5 }),
    // The cockpit set in the top facet
    ellipse(112, 50, 22, 12, { fill: 'url(#glass)', stroke: outline, strokeWidth: 1 }),
    ellipse(106, 46, 6, 3, { fill: '#FFFFFF', opacity: 0.3 }),
    rect(58, 46, 30, 8, { rx: 1, fill: dark(color, 0.3), opacity: 0.5 }),
    // The sharpened wood and the lead
    path('M160 18 L192 45 L192 55 L160 82 Z', { fill: '#F5D0A9', stroke: '#B45309', strokeWidth: 1 }),
    path(scallops, { fill: 'none', stroke: color, strokeWidth: 4 }),
    path('M186 40 L199 50 L186 60 Z', { fill: '#374151', stroke: '#111827', strokeWidth: 0.8 }),
    rect(150, 22, 6, 9, { rx: 2, fill: HEADLIGHT }), rect(150, 69, 6, 9, { rx: 2, fill: HEADLIGHT }),
    rect(40, 24, 3, 8, { rx: 1, fill: TAILLIGHT }), rect(40, 68, 3, 8, { rx: 1, fill: TAILLIGHT }),
  ];
}

/** A closed book seen from above, its pages on one side, turned by deg */
function book(x: number, y: number, w: number, h: number, color: string, deg: number): ArtShape[] {
  const t = { transform: `rotate(${deg} ${x + w / 2} ${y + h / 2})` };
  return [
    rect(x + 2, y + 2, w, h, { rx: 2, fill: SHADOW, opacity: 0.3, ...t }),
    rect(x, y, w, h, { rx: 2, fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 0.6, ...t }),
    rect(x, y, w - 3, h - 3, { rx: 2, fill: color, stroke: dark(color, 0.4), strokeWidth: 0.8, ...t }),
    rect(x, y, 5, h - 3, { fill: dark(color, 0.25), ...t }),
    rect(x + w * 0.3, y + h * 0.3, w * 0.45, h * 0.18, { rx: 1, fill: '#FFFFFF', opacity: 0.85, ...t }),
  ];
}

/** The car carrying its books and ruler on the roof (2 cells) */
function booksCar(color: string): ArtShape[] {
  return [
    ...car(color),
    ...book(52, 26, 44, 34, '#DC2626', -6),
    ...book(60, 42, 46, 32, '#2563EB', 8),
    ...book(84, 24, 36, 28, '#16A34A', 4),
    rect(46, 72, 82, 8, { rx: 1, fill: '#FDE68A', stroke: '#A16207', strokeWidth: 0.6 }),
    ...Array.from({ length: 16 }, (_, i) => line(48 + i * 5, 72, 48 + i * 5, i % 2 ? 75 : 77, { stroke: '#A16207', strokeWidth: 0.6 })),
    // An apple for the teacher on the hood
    circle(170, 50, 8, { fill: '#DC2626', stroke: '#7F1D1D', strokeWidth: 0.8 }),
    path('M170 42 L172 37', { stroke: '#78350F', strokeWidth: 1.6 }),
    path('M172 39 Q178 35 180 40 Q176 42 172 39 Z', { fill: '#16A34A' }),
    circle(167, 47, 2, { fill: '#FFFFFF', opacity: 0.5 }),
  ];
}

/** The school bus (3 cells): the long roof and its hatches, rows of windows, the hood and its stop sign */
function schoolBus(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  const windows = Array.from({ length: 9 }, (_, i) => [
    rect(24 + i * 24, 9, 18, 6, { rx: 1.5, fill: 'url(#glass)' }),
    rect(24 + i * 24, 85, 18, 6, { rx: 1.5, fill: 'url(#glass)' }),
  ]).flat();
  return [
    rect(10, 16, 290, 82, { rx: 12, fill: SHADOW, opacity: 0.3 }),
    ...tires([50, 214, 262]),
    rect(4, 6, 252, 88, { rx: 8, fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    rect(12, 18, 236, 64, { rx: 6, fill: 'url(#roof)', stroke: outline, strokeWidth: 0.8 }),
    line(12, 34, 248, 34, { stroke: light(color, 0.5), strokeWidth: 1.6, opacity: 0.7 }),
    line(12, 66, 248, 66, { stroke: light(color, 0.5), strokeWidth: 1.6, opacity: 0.7 }),
    rect(60, 40, 22, 20, { rx: 2, fill: dark(color, 0.3), stroke: outline, strokeWidth: 0.8 }),
    rect(160, 40, 22, 20, { rx: 2, fill: dark(color, 0.3), stroke: outline, strokeWidth: 0.8 }),
    ...windows,
    // The hood, the windshield, the grille
    path('M256 14 L276 14 Q296 18 296 50 Q296 82 276 86 L256 86 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    path('M244 16 L258 18 Q262 50 258 82 L244 84 Z', { fill: 'url(#glass)' }),
    line(266, 50, 292, 50, { stroke: dark(color, 0.35), strokeWidth: 1 }),
    // The folded stop sign on the left side
    path('M120 2 L126 2 L130 6 L130 10 L126 14 L120 14 L116 10 L116 6 Z', { fill: '#DC2626', stroke: '#FFFFFF', strokeWidth: 1 }),
    rect(286, 18, 8, 12, { rx: 3, fill: HEADLIGHT }), rect(286, 70, 8, 12, { rx: 3, fill: HEADLIGHT }),
    rect(4, 14, 4, 10, { rx: 2, fill: TAILLIGHT }), rect(4, 76, 4, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

const gradients = (color: string) => vehicleGradients(color);

/** The pencil car of the target car, front on the right (2 cells) */
export function pencilDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: pencilCar(color) };
}

/** A vehicle of the back to school palette: the car with its books for 2 cells, the school bus for 3 or more */
export function schoolVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? schoolBus(color) : booksCar(color) };
}

// ─── Win effect: paper planes ─────────────────────────────────────────────────

/** A paper plane flying up, folded from a sheet of that paper (lines: a notebook page) */
function paperPlane(paper: string, edge: string, lines: boolean): ArtDrawing {
  return {
    width: 40, height: 44, gradients: [],
    shapes: [
      path('M20 2 L36 40 L20 32 Z', { fill: paper, stroke: edge, strokeWidth: 1, strokeLinejoin: 'round' }),
      path('M20 2 L4 40 L20 32 Z', { fill: dark(paper, 0.08), stroke: edge, strokeWidth: 1, strokeLinejoin: 'round' }),
      ...(lines ? [14, 20, 26, 32].map(y => line(20 + (y - 2) * 0.2, y, 20 + (y - 2) * 0.5, y + 2, { stroke: '#60A5FA', strokeWidth: 0.7, opacity: 0.8 })) : []),
      path('M20 2 L20 42', { stroke: edge, strokeWidth: 1.2 }),
    ],
  };
}

/** The drawings of the paper planes effect */
export const PLANE_DRAWINGS: ArtDrawing[] = [
  paperPlane('#FFFFFF', '#64748B', true), paperPlane('#FDE68A', '#A16207', false), paperPlane('#BAE6FD', '#0369A1', false),
  paperPlane('#FBCFE8', '#BE185D', false), paperPlane('#FFFFFF', '#64748B', false),
];

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A colored pencil lying along the bottom, its tip toward dir */
function coloredPencil(x: number, y: number, len: number, k: number, color: string, dir: number): ArtShape[] {
  const tipStart = x + dir * len * 0.82;
  const end = x + dir * len;
  return [
    rect(Math.min(x, tipStart), y - 4 * k, Math.abs(tipStart - x), 8 * k, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.6 }),
    line(Math.min(x, tipStart), y, Math.max(x, tipStart), y, { stroke: light(color, 0.35), strokeWidth: 1.4 * k }),
    path(`M${tipStart} ${y - 4 * k} L${end} ${y} L${tipStart} ${y + 4 * k} Z`, { fill: '#F5D0A9', stroke: '#B45309', strokeWidth: 0.6 }),
    path(`M${tipStart + (end - tipStart) * 0.6} ${y - 1.6 * k} L${end} ${y} L${tipStart + (end - tipStart) * 0.6} ${y + 1.6 * k} Z`, { fill: color }),
  ];
}

/** A five-branch star doodle */
function starDoodle(cx: number, cy: number, r: number, attrs: Record<string, string | number>): ArtShape {
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = ((i * 2) / 5) * Math.PI * 2 - Math.PI / 2;
    return `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
  });
  return path(`M${pts.join(' L')} Z`, { fill: 'none', strokeLinejoin: 'round', ...attrs });
}

export function backToSchoolBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(901);
  const ink = darkScheme ? '#F8FAFC' : '#1D4ED8';
  const doodle = { stroke: ink, strokeWidth: 1.6 * u, opacity: darkScheme ? 0.7 : 0.75, strokeLinecap: 'round' };
  // The page: squares and its red margin (light), or the chalkboard and its smudges (dark)
  const cell = 12 * u;
  const page = darkScheme
    ? Array.from({ length: 8 }, () => ellipse(rand() * w, rand() * h, (30 + rand() * 60) * u, (10 + rand() * 20) * u, { fill: '#FFFFFF', opacity: 0.025 }))
    : [
      ...Array.from({ length: Math.ceil(w / cell) }, (_, i) => line(i * cell, 0, i * cell, h, { stroke: '#93C5FD', strokeWidth: 0.6, opacity: 0.5 })),
      ...Array.from({ length: Math.ceil(h / cell) }, (_, i) => line(0, i * cell, w, i * cell, { stroke: '#93C5FD', strokeWidth: 0.6, opacity: 0.5 })),
      line(30 * u, 0, 30 * u, h, { stroke: '#EF4444', strokeWidth: 1.4, opacity: 0.7 }),
    ];
  // The spiral of the notebook down the left edge
  const spiral = darkScheme ? [] : Array.from({ length: Math.floor(h / (18 * u)) }, (_, i) => [
    circle(10 * u, (i + 0.5) * 18 * u, 3 * u, { fill: '#E5E7EB', stroke: '#9CA3AF', strokeWidth: 0.8 }),
    path(`M${2 * u} ${(i + 0.5) * 18 * u - 2 * u} Q${-2 * u} ${(i + 0.5) * 18 * u} ${10 * u} ${(i + 0.5) * 18 * u + 2 * u}`, { fill: 'none', stroke: '#6B7280', strokeWidth: 1.6 * u }),
  ]).flat();
  // Doodles in the margins, under the texts
  const top = (CALM_TOP + 20) * u;
  const doodles = [
    starDoodle(w - 20 * u, top + 10 * u, 9 * u, doodle),
    // A smiling sun
    circle(w - 22 * u, h * 0.42, 8 * u, { fill: 'none', ...doodle }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return line(w - 22 * u + Math.cos(a) * 11 * u, h * 0.42 + Math.sin(a) * 11 * u, w - 22 * u + Math.cos(a) * 15 * u, h * 0.42 + Math.sin(a) * 15 * u, doodle);
    }),
    path(`M${w - 26 * u} ${h * 0.42 + 2 * u} Q${w - 22 * u} ${h * 0.42 + 6 * u} ${w - 18 * u} ${h * 0.42 + 2 * u}`, { fill: 'none', ...doodle }),
    // A heart, a spiral and a little car
    path(`M${w - 20 * u} ${h * 0.62} c${-8 * u} ${-8 * u} ${-12 * u} ${2 * u} 0 ${10 * u} c${12 * u} ${-8 * u} ${8 * u} ${-18 * u} 0 ${-10 * u} Z`, { fill: 'none', ...doodle }),
    path(`M${(darkScheme ? 18 : 46) * u} ${top + 30 * u} q${6 * u} ${-6 * u} ${10 * u} 0 q${2 * u} ${8 * u} ${-8 * u} ${8 * u} q${-10 * u} ${-2 * u} ${-8 * u} ${-12 * u}`, { fill: 'none', ...doodle }),
    path(`M${(darkScheme ? 6 : 36) * u} ${h * 0.56} l0 ${-6 * u} l${6 * u} 0 l${4 * u} ${-6 * u} l${10 * u} 0 l${4 * u} ${6 * u} l${4 * u} 0 l0 ${6 * u} Z`, { fill: 'none', ...doodle }),
    circle((darkScheme ? 13 : 43) * u, h * 0.56 + 1 * u, 3 * u, { fill: 'none', ...doodle }),
    circle((darkScheme ? 27 : 57) * u, h * 0.56 + 1 * u, 3 * u, { fill: 'none', ...doodle }),
    starDoodle(w - 14 * u, h * 0.78, 6 * u, doodle),
  ];
  // Along the bottom: colored pencils, an eraser and a sharpener (light), or the chalk tray (dark)
  const bottom = darkScheme
    ? [
      rect(0, h - 22 * u, w, 22 * u, { fill: 'url(#wood)' }),
      rect(0, h - 22 * u, w, 4 * u, { fill: '#5C3A1E' }),
      ...[0.12, 0.2, 0.34, 0.62, 0.7].map((f, i) => rect(w * f, h - 15 * u, 22 * u, 5 * u, { rx: 2 * u, fill: ['#F8FAFC', '#FDE68A', '#F9A8D4', '#BAE6FD', '#F8FAFC'][i] })),
      rect(w * 0.82, h - 18 * u, 36 * u, 12 * u, { rx: 2 * u, fill: '#1F2937' }),
      rect(w * 0.82, h - 12 * u, 36 * u, 6 * u, { rx: 1 * u, fill: '#D6D3D1' }),
    ]
    : [
      ...['#DC2626', '#F97316', '#FACC15', '#16A34A', '#2563EB', '#7C3AED', '#DB2777'].flatMap((c, i) =>
        coloredPencil((i % 2 ? w - 10 * u : 40 * u) + (i % 2 ? -1 : 1) * ((i * 13) % 30) * u, h - (10 + i * 9) * u, (100 + ((i * 37) % 60)) * u, u, c, i % 2 ? -1 : 1)),
      rect(w * 0.44, h - 30 * u, 30 * u, 14 * u, { rx: 3 * u, fill: '#F9A8D4', stroke: '#BE185D', strokeWidth: 0.8, transform: `rotate(-8 ${w * 0.44 + 15 * u} ${h - 23 * u})` }),
      rect(w * 0.44, h - 30 * u, 12 * u, 14 * u, { rx: 3 * u, fill: '#60A5FA', transform: `rotate(-8 ${w * 0.44 + 15 * u} ${h - 23 * u})` }),
    ];
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#1C3A2E' }, { offset: 0.6, color: '#1E3B30' }, { offset: 1, color: '#18322A' }]
        : [{ offset: 0, color: '#FCFCF8' }, { offset: 1, color: '#F7F6EE' }] },
      { id: 'wood', stops: [{ offset: 0, color: '#8B5E34' }, { offset: 1, color: '#6B4426' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...page,
      ...spiral,
      ...doodles,
      ...bottom,
    ],
  };
}
