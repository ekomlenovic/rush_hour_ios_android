import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, tires, vehicleGradients } from './vehicleKit';

/**
 * Summer holidays (les grands départs, August 1st to 15th): the camper van with its surfboard for the target car
 * (skin), the car loaded with luggage (2 cells) and the car towing its caravan (3 cells) of the palette, the
 * flip-flops, sunglasses and beach balls of its win effect, and the backdrop of its board: the sun, seagulls and a
 * kite in the margins, the sea and a palm tree, the motorway to the holidays jammed bumper to bumper.
 */

/** A suitcase seen from above, its handle and straps */
function suitcase(x: number, y: number, w: number, h: number, color: string): ArtShape[] {
  return [
    rect(x + 2, y + 2, w, h, { rx: 3, fill: SHADOW, opacity: 0.3 }),
    rect(x, y, w, h, { rx: 3, fill: color, stroke: dark(color, 0.4), strokeWidth: 0.8 }),
    rect(x + w * 0.3, y + h * 0.42, w * 0.4, h * 0.16, { rx: 2, fill: dark(color, 0.35) }),
    line(x + w * 0.15, y, x + w * 0.15, y + h, { stroke: dark(color, 0.25), strokeWidth: 1.2 }),
    line(x + w * 0.85, y, x + w * 0.85, y + h, { stroke: dark(color, 0.25), strokeWidth: 1.2 }),
  ];
}

/** The camper van (target car skin): two-tone, its pop-up roof, a surfboard on top, a flower on its nose */
function camperVan(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 16, 190, 82, { rx: 18, fill: SHADOW, opacity: 0.3 }),
    ...tires([44, 156]),
    path('M18 8 L176 8 Q198 10 198 50 Q198 90 176 92 L18 92 Q4 92 4 78 L4 22 Q4 8 18 8 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    // The white roof and its pop-up canvas
    rect(12, 14, 148, 72, { rx: 10, fill: 'url(#cream)', stroke: '#CBD5E1', strokeWidth: 1 }),
    rect(34, 22, 92, 56, { rx: 6, fill: '#FB923C', stroke: '#C2410C', strokeWidth: 1 }),
    ...[46, 58, 70, 82, 94, 106, 118].map(x => line(x, 23, x, 77, { stroke: '#C2410C', strokeWidth: 0.8, opacity: 0.45 })),
    // The surfboard strapped on top
    ellipse(92, 52, 78, 12, { fill: SHADOW, opacity: 0.25 }),
    path('M16 50 Q20 39 90 38 Q160 38 172 50 Q160 62 90 62 Q20 61 16 50 Z', { fill: '#FDE68A', stroke: '#B45309', strokeWidth: 1 }),
    path('M24 50 L164 50', { stroke: '#EF4444', strokeWidth: 2.4 }),
    path('M30 46 L150 46', { stroke: '#0EA5E9', strokeWidth: 1.2 }),
    rect(56, 34, 4, 32, { rx: 1, fill: '#1F2937' }), rect(128, 34, 4, 32, { rx: 1, fill: '#1F2937' }),
    // The split windshield and the nose with its flower
    path('M162 16 L180 20 Q186 34 182 48 L162 48 Z', { fill: 'url(#glass)' }),
    path('M162 52 L182 52 Q186 66 180 80 L162 84 Z', { fill: 'url(#glass)' }),
    path('M186 22 Q196 50 186 78', { fill: 'none', stroke: '#F8FAFC', strokeWidth: 3 }),
    ...[0, 1, 2, 3, 4].map(i => {
      const a = (i / 5) * Math.PI * 2;
      return circle(191 + Math.cos(a) * 3.4, 50 + Math.sin(a) * 3.4, 2.6, { fill: '#F472B6' });
    }),
    circle(191, 50, 2, { fill: '#FACC15' }),
    rect(190, 14, 6, 10, { rx: 3, fill: HEADLIGHT }), rect(190, 76, 6, 10, { rx: 3, fill: HEADLIGHT }),
    rect(4, 30, 4, 10, { rx: 2, fill: TAILLIGHT }), rect(4, 60, 4, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** The car loaded for the holidays (2 cells): suitcases and a sleeping bag strapped on the roof rack */
function luggageCar(color: string): ArtShape[] {
  return [
    ...car(color),
    rect(48, 20, 76, 60, { rx: 4, fill: 'none', stroke: 'url(#chrome)', strokeWidth: 2.4 }),
    ...suitcase(52, 24, 34, 26, '#F59E0B'),
    ...suitcase(52, 52, 34, 24, '#2563EB'),
    ...suitcase(90, 26, 28, 30, '#DC2626'),
    rect(90, 60, 30, 14, { rx: 7, fill: '#16A34A', stroke: '#14532D', strokeWidth: 0.8 }),
    ...[96, 104, 112].map(x => line(x, 60, x, 74, { stroke: '#14532D', strokeWidth: 0.7, opacity: 0.6 })),
    line(70, 20, 70, 80, { stroke: '#111827', strokeWidth: 1.6 }),
    line(106, 20, 106, 80, { stroke: '#111827', strokeWidth: 1.6 }),
  ];
}

/** The car towing its caravan (3 cells): the caravan behind, its stripe in the color, the car in front */
function caravanCar(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 16, 290, 82, { rx: 16, fill: SHADOW, opacity: 0.3 }),
    ...tires([90], 30),
    ...tires([214, 278], 28),
    // The caravan
    rect(4, 8, 172, 84, { rx: 16, fill: 'url(#cream)', stroke: '#94A3B8', strokeWidth: 1.2 }),
    rect(4, 12, 172, 8, { fill: color, opacity: 0.9 }),
    rect(4, 80, 172, 8, { fill: color, opacity: 0.9 }),
    rect(70, 34, 40, 32, { rx: 6, fill: 'url(#glass)', stroke: '#64748B', strokeWidth: 1 }),
    rect(24, 40, 20, 20, { rx: 3, fill: '#E2E8F0', stroke: '#94A3B8', strokeWidth: 1 }),
    rect(132, 40, 16, 20, { rx: 3, fill: '#E2E8F0', stroke: '#94A3B8', strokeWidth: 1 }),
    // The tow bar
    path('M176 44 L196 50 L176 56 Z', { fill: '#374151' }),
    // The car
    path('M206 14 L270 14 Q296 18 297 50 Q296 82 270 86 L206 86 Q192 84 192 50 Q192 16 206 14 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(208, 20, 40, 60, { rx: 8, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(214, 22, 28, 56, { rx: 3, fill: 'none', stroke: 'url(#chrome)', strokeWidth: 1.6 }),
    path('M248 20 L266 24 Q272 50 266 76 L248 80 Z', { fill: 'url(#glass)' }),
    path('M198 26 L208 22 L208 78 L198 74 Q194 50 198 26 Z', { fill: 'url(#glass)' }),
    rect(286, 18, 8, 12, { rx: 3, fill: HEADLIGHT }), rect(286, 70, 8, 12, { rx: 3, fill: HEADLIGHT }),
    rect(4, 26, 4, 10, { rx: 2, fill: TAILLIGHT }), rect(4, 64, 4, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

const gradients = (color: string) => vehicleGradients(color, [
  { id: 'cream', stops: [{ offset: 0, color: '#CBD5E1' }, { offset: 0.5, color: '#FFFFFF' }, { offset: 1, color: '#CBD5E1' }] },
]);

/** The camper van of the target car, front on the right (2 cells) */
export function camperDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: camperVan(color) };
}

/** A vehicle of the summer holidays palette: the loaded car for 2 cells, the car and its caravan for 3 or more */
export function roadtripVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? caravanCar(color) : luggageCar(color) };
}

// ─── Win effect: flip-flops ───────────────────────────────────────────────────

/** A flip-flop of a color, its strap */
const flipflop = (x: number, color: string): ArtShape[] => [
  path(`M${x} 4 Q${x + 9} 2 ${x + 10} 14 Q${x + 11} 26 ${x + 9} 34 Q${x + 5} 39 ${x + 1} 34 Q${x - 2} 24 ${x - 1} 14 Q${x - 1} 4 ${x} 4 Z`, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.8 }),
  path(`M${x + 4.5} 10 L${x} 19 M${x + 4.5} 10 L${x + 9} 19`, { stroke: '#1F2937', strokeWidth: 1.6, strokeLinecap: 'round' }),
];

/** The drawings of the flip-flops effect: pairs of flip-flops, sunglasses, a beach ball and an ice pop */
export const HOLIDAY_DRAWINGS: ArtDrawing[] = [
  { width: 30, height: 40, gradients: [], shapes: [...flipflop(4, '#F472B6'), ...flipflop(16, '#F472B6')] },
  {
    width: 40, height: 20, gradients: [],
    shapes: [
      path('M2 6 L38 6', { stroke: '#111827', strokeWidth: 2 }),
      ellipse(11, 11, 8, 6, { fill: '#1E293B', stroke: '#111827', strokeWidth: 1.2 }),
      ellipse(29, 11, 8, 6, { fill: '#1E293B', stroke: '#111827', strokeWidth: 1.2 }),
      ellipse(8, 9, 2.4, 1.4, { fill: '#FFFFFF', opacity: 0.6 }), ellipse(26, 9, 2.4, 1.4, { fill: '#FFFFFF', opacity: 0.6 }),
    ],
  },
  {
    width: 40, height: 40, gradients: [],
    shapes: [
      circle(20, 20, 17, { fill: '#FFFFFF', stroke: '#9CA3AF', strokeWidth: 1 }),
      path('M20 3 Q8 12 7 28 Q14 34 20 37 Z', { fill: '#EF4444' }),
      path('M20 3 Q32 12 33 28 Q26 34 20 37 Z', { fill: '#3B82F6' }),
      path('M20 3 Q22 20 20 37', { fill: 'none', stroke: '#FACC15', strokeWidth: 5 }),
      circle(20, 20, 17, { fill: 'none', stroke: '#9CA3AF', strokeWidth: 1 }),
      circle(14, 12, 3, { fill: '#FFFFFF', opacity: 0.7 }),
    ],
  },
  { width: 30, height: 40, gradients: [], shapes: [...flipflop(4, '#38BDF8'), ...flipflop(16, '#38BDF8')] },
  {
    width: 24, height: 40, gradients: [],
    shapes: [
      rect(10, 28, 4, 11, { rx: 1.5, fill: '#D6A86A' }),
      path('M4 10 Q4 2 12 2 Q20 2 20 10 L20 29 L4 29 Z', { fill: '#FB923C', stroke: '#C2410C', strokeWidth: 0.8 }),
      path('M4 16 L20 16 L20 22 L4 22 Z', { fill: '#FDE047' }),
      ellipse(8, 8, 2, 4, { fill: '#FFFFFF', opacity: 0.5 }),
    ],
  },
];

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A car seen from the side, small, stuck in the traffic jam */
function jammedCar(x: number, ground: number, k: number, color: string, roofBox: boolean): ArtShape[] {
  return [
    path(`M${x} ${ground - 6 * k} L${x} ${ground - 13 * k} Q${x + 2 * k} ${ground - 15 * k} ${x + 7 * k} ${ground - 15 * k} L${x + 10 * k} ${ground - 22 * k} L${x + 24 * k} ${ground - 22 * k} L${x + 29 * k} ${ground - 15 * k} L${x + 34 * k} ${ground - 14 * k} Q${x + 36 * k} ${ground - 13 * k} ${x + 36 * k} ${ground - 6 * k} Z`, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.6 }),
    path(`M${x + 11.5 * k} ${ground - 20.5 * k} L${x + 17 * k} ${ground - 20.5 * k} L${x + 17 * k} ${ground - 15.5 * k} L${x + 9.5 * k} ${ground - 15.5 * k} Z M${x + 18.5 * k} ${ground - 20.5 * k} L${x + 23.5 * k} ${ground - 20.5 * k} L${x + 27 * k} ${ground - 15.5 * k} L${x + 18.5 * k} ${ground - 15.5 * k} Z`, { fill: '#BAE6FD' }),
    ...(roofBox ? [rect(x + 9 * k, ground - 27 * k, 16 * k, 5 * k, { rx: 2 * k, fill: '#1F2937' })] : [rect(x + 11 * k, ground - 26 * k, 12 * k, 4 * k, { rx: 1, fill: '#F59E0B' })]),
    circle(x + 8 * k, ground - 5 * k, 4 * k, { fill: '#111827' }),
    circle(x + 28 * k, ground - 5 * k, 4 * k, { fill: '#111827' }),
    circle(x + 1 * k, ground - 10 * k, 1.4 * k, { fill: '#EF4444' }),
  ];
}

/** A seagull in flight */
const seagull = (x: number, y: number, s: number, color: string): ArtShape =>
  path(`M${x - 10 * s} ${y} Q${x - 5 * s} ${y - 6 * s} ${x} ${y} Q${x + 5 * s} ${y - 6 * s} ${x + 10 * s} ${y}`, { fill: 'none', stroke: color, strokeWidth: 1.6 * s, strokeLinecap: 'round' });

/** A palm tree, its foot at (x, ground) */
function palmTree(x: number, ground: number, k: number, trunk: string, leaves: string): ArtShape[] {
  const at = (dx: number, dy: number) => `${x + dx * k} ${ground - dy * k}`;
  const frond = (dx: number, dy: number) =>
    path(`M${at(4, 70)} Q${at(dx / 2, 70 + dy + 10)} ${at(dx, 70 + dy)} Q${at(dx / 2, 70 + dy / 2)} ${at(4, 70)} Z`, { fill: leaves });
  return [
    path(`M${at(-4, 0)} Q${at(-2, 40)} ${at(2, 70)} L${at(7, 70)} Q${at(4, 40)} ${at(4, 0)} Z`, { fill: trunk }),
    frond(-34, -14), frond(-26, 8), frond(40, -12), frond(34, 10), frond(4, 22),
    circle(x + 4 * k, ground - 68 * k, 3 * k, { fill: '#78350F' }), circle(x + 8 * k, ground - 67 * k, 3 * k, { fill: '#78350F' }),
  ];
}

export function summerHolidayBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(815);
  const road = h - 34 * u;
  const sea = road - 26 * u;
  const gull = darkScheme ? '#E2E8F0' : '#334155';
  const colors = ['#F472B6', '#FB923C', '#FACC15', '#60A5FA', '#A3E635', '#F87171', '#C084FC', '#2DD4BF'];
  const jam: ArtShape[] = [];
  for (let x = -10 * u, i = 0; x < w; i++) {
    jam.push(...jammedCar(x, road + 14 * u, 0.9 * u, colors[i % colors.length], i % 3 === 0));
    x += (36 + 4 + rand() * 4) * u;
  }
  const sunX = w - 38 * u;
  const sunY = 58 * u;
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#141A3A' }, { offset: 0.6, color: '#2E1F4F' }, { offset: 1, color: '#5B2A3E' }]
        : [{ offset: 0, color: '#BAE6FD' }, { offset: 0.6, color: '#E0F2FE' }, { offset: 1, color: '#FEF3C7' }] },
      { id: 'glow', radial: true, stops: [{ offset: 0, color: '#FDBA74', opacity: darkScheme ? 0.4 : 0.55 }, { offset: 1, color: '#FDBA74', opacity: 0 }] },
      { id: 'sea', stops: [{ offset: 0, color: darkScheme ? '#1E3A8A' : '#38BDF8' }, { offset: 1, color: darkScheme ? '#172554' : '#0EA5E9' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      // The sun in the top right corner, beside the texts
      circle(sunX, sunY, 72 * u, { fill: 'url(#glow)' }),
      circle(sunX, sunY, 24 * u, { fill: darkScheme ? '#FB923C' : '#FDE047', stroke: darkScheme ? '#EA580C' : '#F59E0B', strokeWidth: 1.5 }),
      // Seagulls and a kite in the margins
      seagull(18 * u, (CALM_TOP + 30) * u, 0.9 * u, gull),
      seagull(30 * u, (CALM_TOP + 44) * u, 0.6 * u, gull),
      seagull(w - 20 * u, h * 0.46, 0.8 * u, gull),
      seagull(w - 12 * u, h * 0.5, 0.55 * u, gull),
      path(`M${16 * u} ${h * 0.58} L${28 * u} ${h * 0.58 + 12 * u} L${16 * u} ${h * 0.58 + 30 * u} L${4 * u} ${h * 0.58 + 12 * u} Z`, { fill: '#F43F5E', stroke: '#9F1239', strokeWidth: 1 }),
      path(`M${16 * u} ${h * 0.58} L${16 * u} ${h * 0.58 + 30 * u} M${4 * u} ${h * 0.58 + 12 * u} L${28 * u} ${h * 0.58 + 12 * u}`, { stroke: '#FFFFFF', strokeWidth: 1, opacity: 0.7 }),
      path(`M${16 * u} ${h * 0.58 + 30 * u} q${6 * u} ${10 * u} 0 ${20 * u} q${-6 * u} ${10 * u} 0 ${20 * u}`, { fill: 'none', stroke: '#9F1239', strokeWidth: 1 }),
      ...[0, 1, 2].map(i => path(`M${16 * u} ${h * 0.58 + (38 + i * 12) * u} l${-4 * u} ${-3 * u} l0 ${6 * u} Z M${16 * u} ${h * 0.58 + (38 + i * 12) * u} l${4 * u} ${-3 * u} l0 ${6 * u} Z`, { fill: ['#FACC15', '#38BDF8', '#A3E635'][i] })),
      // The sea on the horizon, a palm tree, the beach, then the motorway
      rect(0, sea - 14 * u, w, 30 * u, { fill: 'url(#sea)' }),
      ...[0.1, 0.3, 0.52, 0.74].map(f => path(`M${w * f} ${sea - 6 * u} q${5 * u} ${-3 * u} ${10 * u} 0 t${10 * u} 0`, { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.2, opacity: 0.7 })),
      rect(0, sea + 10 * u, w, 10 * u, { fill: darkScheme ? '#8A7A50' : '#FDE68A' }),
      ...palmTree(w * 0.9, sea + 14 * u, 0.85 * u, darkScheme ? '#5C3A1E' : '#92400E', darkScheme ? '#166534' : '#22C55E'),
      rect(0, road - 12 * u, w, h - road + 12 * u, { fill: darkScheme ? '#27272A' : '#6B7280' }),
      rect(0, road - 12 * u, w, 2 * u, { fill: '#F8FAFC', opacity: 0.8 }),
      ...Array.from({ length: Math.ceil(w / (24 * u)) }, (_, i) => rect(i * 24 * u, road + 18 * u, 12 * u, 2 * u, { fill: '#F8FAFC', opacity: 0.8 })),
      ...jam,
      // A motorway sign in the left margin: white arrow on blue
      rect(10 * u, h * 0.74, 3 * u, road - 12 * u - h * 0.74, { fill: '#9CA3AF' }),
      rect(2 * u, h * 0.74 - 18 * u, 26 * u, 18 * u, { rx: 2 * u, fill: '#1D4ED8', stroke: '#F8FAFC', strokeWidth: 1.2 }),
      path(`M${8 * u} ${h * 0.74 - 9 * u} L${18 * u} ${h * 0.74 - 9 * u} L${18 * u} ${h * 0.74 - 13 * u} L${24 * u} ${h * 0.74 - 8 * u} L${18 * u} ${h * 0.74 - 3 * u} L${18 * u} ${h * 0.74 - 7 * u} L${8 * u} ${h * 0.74 - 7 * u} Z`, { fill: '#F8FAFC' }),
    ],
  };
}
