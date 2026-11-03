import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, tires, van, vehicleGradients } from './vehicleKit';

/**
 * Fête de la musique (June 21): the electric guitar car of the target car (skin), the car with loudspeakers on its
 * roof (2 cells) and the stage truck with its drum kit (3 cells) of the palette, the music notes of its win effect and
 * the backdrop of its board: spotlights, staves with notes in the margins and an equalizer along the bottom.
 */

const STAGE_LIGHTS = ['#F472B6', '#22D3EE', '#FACC15', '#A78BFA', '#4ADE80'];

/** A music note: a quarter (0), an eighth (1) or two beamed eighths (2), its head at (x, y), s times its size */
export function note(x: number, y: number, s: number, kind: number, color: string, opacity = 1): ArtShape[] {
  const head = (hx: number, hy: number) => ellipse(hx, hy, 5 * s, 3.6 * s, { fill: color, opacity, transform: `rotate(-20 ${hx} ${hy})` });
  const stem = (hx: number, hy: number, top: number) => line(hx + 4.4 * s, hy - 1 * s, hx + 4.4 * s, top, { stroke: color, strokeWidth: 1.6 * s, opacity });
  if (kind === 2) {
    return [
      head(x, y), head(x + 14 * s, y - 4 * s),
      stem(x, y, y - 22 * s), stem(x + 14 * s, y - 4 * s, y - 26 * s),
      path(`M${x + 3.6 * s} ${y - 22 * s} L${x + 19.2 * s} ${y - 26 * s} L${x + 19.2 * s} ${y - 21 * s} L${x + 3.6 * s} ${y - 17 * s} Z`, { fill: color, opacity }),
    ];
  }
  return [
    head(x, y), stem(x, y, y - 22 * s),
    ...(kind === 1 ? [path(`M${x + 4.4 * s} ${y - 22 * s} q${2 * s} ${6 * s} ${8 * s} ${9 * s} q${2 * s} ${3 * s} ${-1 * s} ${8 * s} q${1 * s} ${-5 * s} ${-7 * s} ${-9 * s} Z`, { fill: color, opacity })] : []),
  ];
}

/** A loudspeaker cone seen from above */
const speaker = (cx: number, cy: number, r: number): ArtShape[] => [
  circle(cx + 2, cy + 2, r, { fill: SHADOW, opacity: 0.3 }),
  circle(cx, cy, r, { fill: '#111827', stroke: '#9CA3AF', strokeWidth: 1.2 }),
  circle(cx, cy, r * 0.78, { fill: 'url(#cone)' }),
  circle(cx, cy, r * 0.5, { fill: 'none', stroke: '#111827', strokeWidth: 0.8, opacity: 0.5 }),
  circle(cx, cy, r * 0.24, { fill: '#374151', stroke: '#6B7280', strokeWidth: 0.8 }),
  circle(cx - r * 0.08, cy - r * 0.08, r * 0.08, { fill: '#FFFFFF', opacity: 0.6 }),
];

/** The electric guitar car (target car skin): a double cutaway body on wheels, its neck and headstock as the hood */
function guitarCar(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  const body = 'M16 50 C4 18 30 6 52 14 C66 20 76 20 88 12 C106 2 124 14 120 30 C118 40 112 44 124 50 C112 56 118 60 120 70 C124 86 106 98 88 88 C76 80 66 80 52 86 C30 94 4 82 16 50 Z';
  return [
    path(body, { fill: SHADOW, opacity: 0.3, transform: 'translate(4 6)' }),
    rect(152, 8, 30, 88, { rx: 8, fill: SHADOW, opacity: 0.2 }),
    ...tires([40, 96]),
    // The front axle under the neck
    rect(162, 10, 6, 80, { rx: 3, fill: '#1F2937' }),
    ...tires([165], 26),
    path(body, { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    // The pickguard, the pickups, the bridge and the knobs
    path('M54 22 C70 24 84 22 100 18 C110 22 108 36 102 44 L102 56 C108 64 110 78 100 82 C84 78 70 76 54 78 C46 70 46 30 54 22 Z', { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 0.8 }),
    ...[62, 76, 90].map(x => rect(x - 3, 37, 6, 26, { rx: 2, fill: '#111827' })),
    ...[62, 76, 90].flatMap(x => [41, 45, 49, 53, 57].map(y => circle(x, y + 0.5, 0.9, { fill: '#9CA3AF' }))),
    rect(34, 38, 10, 24, { rx: 2, fill: 'url(#chrome)', stroke: '#4B5563', strokeWidth: 0.6 }),
    ...[[40, 24], [50, 18], [36, 76]].map(([x, y]) => circle(x, y, 3.6, { fill: 'url(#chrome)', stroke: '#4B5563', strokeWidth: 0.6 })),
    // The neck, its frets and dots
    rect(118, 41, 62, 18, { rx: 2, fill: 'url(#wood)', stroke: '#3B1F0E', strokeWidth: 0.8 }),
    ...[128, 137, 145, 152, 158, 164, 170, 175].map(x => line(x, 41, x, 59, { stroke: '#D1D5DB', strokeWidth: 1 })),
    ...[141, 155, 167].map(x => circle(x, 50, 1.6, { fill: '#F8FAFC' })),
    // The headstock and its tuning pegs
    path('M178 40 L196 34 Q200 50 196 66 L178 60 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    ...[184, 190].flatMap(x => [circle(x, 33, 3, { fill: 'url(#chrome)' }), circle(x, 67, 3, { fill: 'url(#chrome)' })]),
    // The six strings
    ...[0, 1, 2, 3, 4, 5].map(i => line(38, 43 + i * 2.8, 194, 45 + i * 2, { stroke: '#E5E7EB', strokeWidth: 0.6, opacity: 0.9 })),
    rect(116, 16, 7, 10, { rx: 3, fill: HEADLIGHT }), rect(116, 74, 7, 10, { rx: 3, fill: HEADLIGHT }),
    rect(10, 36, 4, 10, { rx: 2, fill: TAILLIGHT }), rect(10, 54, 4, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** The car with loudspeakers on its roof (2 cells), sound waves off its hood */
function speakerCar(color: string): ArtShape[] {
  return [
    ...car(color),
    rect(48, 22, 76, 56, { rx: 6, fill: '#1F2937', stroke: '#4B5563', strokeWidth: 1 }),
    ...speaker(68, 50, 18),
    ...speaker(104, 50, 18),
    ...[0, 1, 2].map(i => path(`M${160 + i * 8} 34 Q${170 + i * 8} 50 ${160 + i * 8} 66`, { fill: 'none', stroke: light(color, 0.6), strokeWidth: 2, strokeLinecap: 'round', opacity: 0.8 - i * 0.2 })),
  ];
}

/** A drum seen from above, its skin and rim */
const drum = (cx: number, cy: number, r: number, shell: string): ArtShape[] => [
  circle(cx + 2, cy + 2, r, { fill: SHADOW, opacity: 0.3 }),
  circle(cx, cy, r, { fill: shell, stroke: '#111827', strokeWidth: 1 }),
  circle(cx, cy, r * 0.84, { fill: '#F5F5F4', stroke: 'url(#chrome)', strokeWidth: 1.4 }),
];

/** A cymbal of radius r */
const cymbal = (cx: number, cy: number, r: number): ArtShape[] => [
  circle(cx, cy, r, { fill: 'url(#brass)', stroke: '#92400E', strokeWidth: 0.6 }),
  circle(cx, cy, r * 0.55, { fill: 'none', stroke: '#92400E', strokeWidth: 0.5, opacity: 0.5 }),
  circle(cx, cy, r * 0.15, { fill: '#78350F' }),
];

/** The stage truck (3 cells): a stage with its drum kit, amps, a microphone and a spotlight */
function stageTruck(color: string): ArtShape[] {
  const boards = Array.from({ length: 6 }, (_, i) => line(12, 26 + i * 12, 210, 26 + i * 12, { stroke: '#000000', strokeWidth: 0.6, opacity: 0.3 }));
  return [
    ...van(color, 'url(#stage)'),
    ...boards,
    // A spot of light on the stage
    ellipse(140, 50, 52, 30, { fill: '#FDE68A', opacity: 0.22 }),
    // Amps at the back
    ...[18, 62].flatMap(y => [rect(16, y, 22, 22, { rx: 2, fill: '#111827', stroke: '#4B5563', strokeWidth: 0.8 }), rect(19, y + 3, 16, 16, { fill: '#374151' }), ...speaker(27, y + 11, 6)]),
    // The drum kit
    ...cymbal(54, 22, 10), ...cymbal(54, 78, 11),
    ...drum(70, 50, 18, '#7C3AED'),
    ...drum(92, 34, 9, '#7C3AED'), ...drum(92, 66, 10, '#7C3AED'),
    ...cymbal(108, 22, 7),
    rect(112, 46, 14, 8, { rx: 3, fill: '#1F2937' }),
    // The microphone stand
    line(178, 50, 192, 50, { stroke: '#9CA3AF', strokeWidth: 2 }),
    circle(178, 50, 5, { fill: '#374151', stroke: '#9CA3AF', strokeWidth: 0.8 }),
    ellipse(194, 50, 4, 3, { fill: '#6B7280' }),
    // String of stage lights along the sides
    ...Array.from({ length: 13 }, (_, i) => [circle(18 + i * 15, 11, 2.6, { fill: STAGE_LIGHTS[i % 5] }), circle(24 + i * 15, 89, 2.6, { fill: STAGE_LIGHTS[(i + 2) % 5] })]).flat(),
    ...note(226, 54, 0.7, 1, '#FACC15'),
  ];
}

const gradients = (color: string) => vehicleGradients(color, [
  { id: 'wood', horizontal: true, stops: [{ offset: 0, color: '#7C4A26' }, { offset: 1, color: '#B07A48' }] },
  { id: 'cone', radial: true, stops: [{ offset: 0, color: '#6B7280' }, { offset: 1, color: '#1F2937' }] },
  { id: 'brass', radial: true, stops: [{ offset: 0, color: '#FEF3C7' }, { offset: 0.6, color: '#EAB308' }, { offset: 1, color: '#A16207' }] },
  { id: 'stage', stops: [{ offset: 0, color: '#3F2A1E' }, { offset: 0.5, color: '#5B3B28' }, { offset: 1, color: '#3F2A1E' }] },
]);

/** The electric guitar car of the target car, front on the right (2 cells) */
export function guitarDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: guitarCar(color) };
}

/** A vehicle of the Fête de la musique palette: the loudspeaker car for 2 cells, the stage truck for 3 or more */
export function concertVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? stageTruck(color) : speakerCar(color) };
}

// ─── Win effect: music notes ──────────────────────────────────────────────────

/** The drawings of the notes effect: quarters, eighths and beamed eighths, in stage light colors */
export const NOTE_DRAWINGS: ArtDrawing[] = [
  [0, '#EC4899'], [1, '#0EA5E9'], [2, '#8B5CF6'], [1, '#F59E0B'], [0, '#10B981'], [2, '#EF4444'],
].map(([kind, color]) => ({
  width: 40, height: 40, gradients: [],
  shapes: [...note(kind === 2 ? 11 : 16, 32, 1.25, kind as number, '#000000', 0.25).map(s => ({ ...s, attrs: { ...s.attrs, transform: `translate(1.5 1.5) ${s.attrs.transform ?? ''}`.trim() } })), ...note(kind === 2 ? 11 : 16, 32, 1.25, kind as number, color as string)],
}));

// ─── Backdrop ─────────────────────────────────────────────────────────────────

export function musicDayBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(621);
  const ink = darkScheme ? '#E9D5FF' : '#4C1D95';
  // Staves waving across the screen, notes on them in the margins
  const stave = (y0: number, amp: number) => [0, 1, 2, 3, 4].map(i => {
    const y = y0 + i * 5 * u;
    return path(`M0 ${y} C${w * 0.3} ${y - amp} ${w * 0.7} ${y + amp} ${w} ${y}`, { fill: 'none', stroke: ink, strokeWidth: 0.9, opacity: darkScheme ? 0.3 : 0.25 });
  });
  const staves = [...stave(h * 0.36, 30 * u), ...stave(h * 0.64, -26 * u)];
  const notes = [
    note(10 * u, h * 0.36 + 14 * u, 0.9 * u, 0, ink, 0.8), note(w - 30 * u, h * 0.36 + 6 * u, 0.9 * u, 2, ink, 0.8),
    note(12 * u, h * 0.64 + 10 * u, 0.9 * u, 1, ink, 0.8), note(w - 24 * u, h * 0.64 + 16 * u, 0.9 * u, 0, ink, 0.8),
    note(18 * u, h * 0.5, 0.8 * u, 1, '#F472B6'), note(w - 18 * u, h * 0.52, 0.8 * u, 0, '#22D3EE'),
    note(14 * u, (CALM_TOP + 40) * u, 0.7 * u, 2, '#FACC15'), note(w - 30 * u, h * 0.76, 0.7 * u, 1, '#A78BFA'),
  ].flat();
  // Spotlights from the bottom corners, their beams up the sides
  const beam = (x: number, toX: number, color: string) =>
    path(`M${x - 6 * u} ${h - 40 * u} L${x + 6 * u} ${h - 40 * u} L${toX + 40 * u} ${(CALM_TOP + 20) * u} L${toX - 40 * u} ${(CALM_TOP + 20) * u} Z`, { fill: color, opacity: darkScheme ? 0.12 : 0.1 });
  const beams = [beam(30 * u, 10 * u, '#F472B6'), beam(w - 30 * u, w - 10 * u, '#22D3EE'), beam(w * 0.35, 0, '#FACC15'), beam(w * 0.65, w, '#A78BFA')];
  // The equalizer along the bottom: bars of lit blocks, green, then yellow, then red on top
  const cols = Math.round(w / (14 * u));
  const colW = w / cols;
  const eq = Array.from({ length: cols }, (_, i) => {
    const level = Math.max(2, Math.round(3 + 4 * Math.abs(Math.sin(i * 0.55)) + rand() * 3));
    return Array.from({ length: level }, (_, j) => {
      const c = j >= 8 ? '#EF4444' : j >= 5 ? '#FACC15' : '#22C55E';
      return rect(i * colW + 1.5 * u, h - (j + 1) * 7 * u, colW - 3 * u, 5 * u, { rx: 1, fill: c, opacity: darkScheme ? 0.85 : 0.75 });
    });
  }).flat();
  // A thin truss along the very top, its cans of light
  const cans = Math.max(3, Math.round(w / (60 * u)));
  const truss = [
    rect(0, 2 * u, w, 3 * u, { fill: darkScheme ? '#6B7280' : '#9CA3AF' }),
    ...Array.from({ length: cans }, (_, i) => {
      const x = ((i + 0.5) / cans) * w;
      const c = STAGE_LIGHTS[i % STAGE_LIGHTS.length];
      return [rect(x - 4 * u, 4 * u, 8 * u, 7 * u, { rx: 1.5 * u, fill: '#1F2937' }), circle(x, 12 * u, 3 * u, { fill: c }), circle(x, 12 * u, 7 * u, { fill: c, opacity: 0.25 })];
    }).flat(),
  ];
  const stars = darkScheme
    ? Array.from({ length: Math.round((w * h) / 5000) }, () => ({ x: rand() * w, y: rand() * h * 0.8 }))
      .filter(p => p.y > (CALM_TOP + 40) * u || p.x < 18 * u || p.x > w - 18 * u)
      .map(p => circle(p.x, p.y, (0.6 + rand()) * u, { fill: '#FFFFFF', opacity: 0.3 + rand() * 0.3 }))
    : [];
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#160E2E' }, { offset: 0.6, color: '#1E1145' }, { offset: 1, color: '#0F0A1F' }]
        : [{ offset: 0, color: '#F3E8FF' }, { offset: 0.6, color: '#FDF2F8' }, { offset: 1, color: '#FEF3C7' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...stars,
      ...beams,
      ...staves,
      ...notes,
      ...eq,
      ...truss,
    ],
  };
}
