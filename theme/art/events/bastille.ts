import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, tires, van, vehicleGradients } from './vehicleKit';

/**
 * Bastille Day (14 juillet): the fire engine of the firemen's ball for the target car (skin), the car with its
 * cockade and flags (2 cells) and the parade float of blue, white and red flowers (3 cells) of the palette, the jets
 * of the Patrouille de France trailing the three colors for its win effect, and the backdrop of its board: a summer
 * evening, paper lanterns of the street ball along the sides, the roofs of Paris and the Eiffel Tower.
 */

const BLUE = '#1D4ED8';
const WHITE = '#F8FAFC';
const RED = '#DC2626';
const TRICOLOR = [BLUE, WHITE, RED];

/** A tricolor cockade of radius r */
const cockade = (cx: number, cy: number, r: number): ArtShape[] => [
  circle(cx + r * 0.1, cy + r * 0.12, r, { fill: SHADOW, opacity: 0.3 }),
  circle(cx, cy, r, { fill: RED, stroke: '#7F1D1D', strokeWidth: Math.max(0.6, r * 0.06) }),
  circle(cx, cy, r * 0.66, { fill: WHITE }),
  circle(cx, cy, r * 0.34, { fill: BLUE }),
];

/** A small flag on its pole, flying toward the back (dir -1) */
function flag(x: number, y: number, s: number, dir = -1): ArtShape[] {
  const w = 9 * s;
  return [
    ...TRICOLOR.map((c, i) => rect(dir < 0 ? x - (i + 1) * w : x + i * w, y - 4 * s, w, 8 * s, { fill: c })),
    rect(dir < 0 ? x - 3 * w : x, y - 4 * s, 3 * w, 8 * s, { fill: 'none', stroke: '#000000', strokeOpacity: 0.25, strokeWidth: 0.6 }),
    circle(x, y - 4 * s, 1.6 * s, { fill: '#CA8A04' }),
  ];
}

/** The fire engine (target car skin): its cab and blue lights in front, the ladder along the roof, hose reels */
function fireEngine(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  const rungs = Array.from({ length: 11 }, (_, i) => line(26 + i * 11, 36, 26 + i * 11, 64, { stroke: '#D1D5DB', strokeWidth: 2 }));
  return [
    rect(10, 16, 190, 82, { rx: 14, fill: SHADOW, opacity: 0.3 }),
    ...tires([40, 70, 160]),
    // The body and its lockers
    rect(4, 8, 150, 84, { rx: 6, fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    ...[20, 56, 92].flatMap(x => [rect(x, 10, 30, 5, { rx: 1, fill: 'url(#chrome)' }), rect(x, 85, 30, 5, { rx: 1, fill: 'url(#chrome)' })]),
    // The ladder along the roof
    rect(16, 30, 126, 40, { rx: 4, fill: dark(color, 0.25) }),
    line(20, 36, 140, 36, { stroke: 'url(#chrome)', strokeWidth: 3 }),
    line(20, 64, 140, 64, { stroke: 'url(#chrome)', strokeWidth: 3 }),
    ...rungs,
    // Hose reels at the back
    circle(14, 22, 7, { fill: '#1F2937', stroke: '#9CA3AF', strokeWidth: 1 }), circle(14, 22, 3, { fill: '#FBBF24' }),
    circle(14, 78, 7, { fill: '#1F2937', stroke: '#9CA3AF', strokeWidth: 1 }), circle(14, 78, 3, { fill: '#FBBF24' }),
    // The cab
    path('M154 10 L178 10 Q198 14 198 50 Q198 86 178 90 L154 90 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(156, 18, 20, 64, { rx: 5, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M176 18 L188 22 Q193 50 188 78 L176 82 Z', { fill: 'url(#glass)' }),
    // The blue light bar on the cab, and its glow
    circle(165, 50, 13, { fill: '#60A5FA', opacity: 0.25 }),
    rect(160, 30, 10, 40, { rx: 3, fill: '#1E3A8A' }),
    rect(161, 32, 8, 14, { rx: 2, fill: '#60A5FA' }), rect(161, 54, 8, 14, { rx: 2, fill: '#60A5FA' }),
    // A tricolor stripe along the sides, small flags on the front
    rect(4, 46, 4, 8, { fill: WHITE }),
    ...flag(196, 18, 0.6, -1), ...flag(196, 88, 0.6, -1),
    rect(190, 20, 7, 10, { rx: 3, fill: HEADLIGHT }), rect(190, 70, 7, 10, { rx: 3, fill: HEADLIGHT }),
    rect(4, 36, 4, 9, { rx: 2, fill: TAILLIGHT }), rect(4, 55, 4, 9, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** The car with its cockade on the roof and flags on the front (2 cells) */
function cockadeCar(color: string): ArtShape[] {
  return [
    ...car(color),
    ...cockade(86, 50, 22),
    ...flag(192, 16, 0.55, -1), ...flag(192, 90, 0.55, -1),
  ];
}

/** A flower seen from above, for the float */
const bloom = (cx: number, cy: number, r: number, color: string): ArtShape[] => [
  ...[0, 1, 2, 3, 4].map(i => {
    const a = (i / 5) * Math.PI * 2;
    return circle(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.5, { fill: color, stroke: dark(color, 0.25), strokeWidth: 0.5 });
  }),
  circle(cx, cy, r * 0.3, { fill: '#FACC15' }),
];

/** The parade float (3 cells): three bands of flowers, blue, white and red, a cockade in the middle */
function paradeFloat(color: string): ArtShape[] {
  const flowers = [0, 1, 2].flatMap(band => Array.from({ length: 9 }, (_, i) => {
    const x = 20 + i * 22 + (band % 2 ? 8 : 0);
    const y = 26 + band * 24;
    return x > 206 ? [] : bloom(x, y, 8, TRICOLOR[band]);
  }).flat());
  return [
    ...van(color, '#166534'),
    ...flowers,
    ...cockade(110, 50, 15),
    ...flag(14, 12, 0.7, 1), ...flag(14, 88, 0.7, 1),
    ...cockade(231, 50, 8),
  ];
}

const gradients = (color: string) => vehicleGradients(color);

/** The fire engine of the target car, front on the right (2 cells) */
export function fireEngineDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: fireEngine(color) };
}

/** A vehicle of the Bastille Day palette: the cockade car for 2 cells, the flower float for 3 or more */
export function paradeVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? paradeFloat(color) : cockadeCar(color) };
}

// ─── Win effect: the Patrouille de France ─────────────────────────────────────

/** A jet climbing, nose up, its trail of smoke in one of the three colors below it */
function jet(trail: string): ArtDrawing {
  return {
    width: 30, height: 110,
    gradients: [{ id: 'smoke', stops: [{ offset: 0, color: trail, opacity: 0.95 }, { offset: 1, color: trail, opacity: 0 }] }],
    shapes: [
      path('M11 34 Q15 110 15 110 Q15 110 19 34 Z', { fill: 'url(#smoke)' }),
      rect(9, 36, 12, 74, { rx: 6, fill: 'url(#smoke)', opacity: 0.6 }),
      // The jet: fuselage, wings, tail, cockpit
      path('M15 2 Q19 8 19 18 L19 32 L15 36 L11 32 L11 18 Q11 8 15 2 Z', { fill: '#E5E7EB', stroke: '#4B5563', strokeWidth: 0.8 }),
      path('M11 16 L1 26 L1 29 L11 25 Z M19 16 L29 26 L29 29 L19 25 Z', { fill: BLUE, stroke: '#1E3A8A', strokeWidth: 0.6 }),
      path('M11 30 L6 35 L11 34 Z M19 30 L24 35 L19 34 Z', { fill: RED }),
      ellipse(15, 11, 2.2, 4, { fill: '#1E293B' }),
    ],
  };
}

/** The drawings of the jets effect: one trail of each color */
export const JET_DRAWINGS: ArtDrawing[] = [jet(BLUE), jet('#E5E7EB'), jet(RED)];

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A paper lantern of the street ball, hanging at (x, y) */
function lantern(x: number, y: number, r: number, color: string, opacity: number): ArtShape[] {
  return [
    circle(x, y, r * 2.2, { fill: '#FDE68A', opacity: opacity * 0.18 }),
    ellipse(x, y, r, r * 1.15, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8, opacity }),
    ...[-0.5, 0, 0.5].map(f => path(`M${x + f * r} ${y - r * 1.1} Q${x + f * r * 1.4} ${y} ${x + f * r} ${y + r * 1.1}`, { fill: 'none', stroke: dark(color, 0.25), strokeWidth: 0.6, opacity: opacity * 0.6 })),
    rect(x - r * 0.4, y - r * 1.3, r * 0.8, r * 0.25, { fill: '#1F2937', opacity }),
    rect(x - r * 0.4, y + r * 1.08, r * 0.8, r * 0.25, { fill: '#1F2937', opacity }),
  ];
}

/** The Eiffel Tower, its foot at (x, ground), k times its size */
function eiffelTower(x: number, ground: number, k: number, color: string): ArtShape[] {
  const at = (dx: number, dy: number) => `${x + dx * k} ${ground - dy * k}`;
  return [
    path(`M${at(-30, 0)} Q${at(-12, 40)} ${at(-6, 90)} L${at(-3, 150)} L${at(0, 168)} L${at(3, 150)} L${at(6, 90)} Q${at(12, 40)} ${at(30, 0)} L${at(18, 0)} Q${at(0, 26)} ${at(-18, 0)} Z`, { fill: color }),
    rect(x - 16 * k, ground - 44 * k, 32 * k, 4 * k, { fill: color }),
    rect(x - 9 * k, ground - 92 * k, 18 * k, 3.5 * k, { fill: color }),
    line(x, ground - 168 * k, x, ground - 180 * k, { stroke: color, strokeWidth: 1.5 * k }),
  ];
}

export function bastilleBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(714);
  // Tricolor bunting along the very top: blue, white and red pennants
  const count = Math.max(2, Math.round(w / (110 * u)));
  const swag = w / count;
  const sag = 8 * u;
  const bunting = Array.from({ length: count }, (_, i) => {
    const x0 = i * swag;
    const n = Math.max(3, Math.round(swag / (16 * u)));
    const y = (f: number) => sag * 4 * f * (1 - f);
    return [
      path(`M${x0} 0 Q${x0 + swag / 2} ${sag * 2} ${x0 + swag} 0`, { fill: 'none', stroke: darkScheme ? '#CBD5E1' : '#1E3A8A', strokeWidth: 1.2 }),
      ...Array.from({ length: n }, (_, j) => {
        const f0 = (j + 0.15) / n;
        const f1 = (j + 0.85) / n;
        const fm = (f0 + f1) / 2;
        return path(`M${x0 + f0 * swag} ${y(f0)} L${x0 + f1 * swag} ${y(f1)} L${x0 + fm * swag} ${y(fm) + 12 * u} Z`, { fill: TRICOLOR[(i * n + j) % 3], stroke: '#000000', strokeOpacity: 0.2, strokeWidth: 0.6 });
      }),
    ];
  }).flat();
  // Strings of paper lanterns down both sides, under the texts
  const top = (CALM_TOP + 10) * u;
  const step = 44 * u;
  const lanternCount = Math.max(0, Math.floor((h - 150 * u - top) / step));
  const lanterns = [10 * u, w - 10 * u].flatMap((x, side) => {
    const wire = Array.from({ length: lanternCount }, (_, i) => `Q${x + (i % 2 ? 9 : -9) * u} ${top + (i + 0.5) * step} ${x} ${top + (i + 1) * step}`).join(' ');
    return lanternCount ? [
      path(`M${x} ${top} ${wire}`, { fill: 'none', stroke: darkScheme ? '#94A3B8' : '#475569', strokeWidth: 1 }),
      ...Array.from({ length: lanternCount }, (_, i) => lantern(x + (i % 2 ? 5 : -5) * u, top + (i + 0.5) * step + 9 * u, 7 * u, TRICOLOR[(i + side) % 3], darkScheme ? 0.9 : 1)).flat(),
    ] : [];
  });
  // The roofs of Paris along the bottom, the Eiffel Tower over them
  const ground = h - 24 * u;
  const roof = darkScheme ? '#16213F' : '#94A3C8';
  const roofs: ArtShape[] = [];
  const windows: ArtShape[] = [];
  for (let x = -6 * u; x < w;) {
    const bw = (30 + rand() * 30) * u;
    const bh = (22 + rand() * 28) * u;
    roofs.push(
      rect(x, ground - bh, bw - 2 * u, bh + 30 * u, { fill: roof }),
      path(`M${x - 2 * u} ${ground - bh} L${x + 6 * u} ${ground - bh - 12 * u} L${x + bw - 10 * u} ${ground - bh - 12 * u} L${x + bw} ${ground - bh} Z`, { fill: darkScheme ? '#0F172A' : '#64748B' }),
      rect(x + bw * 0.6, ground - bh - 20 * u, 5 * u, 10 * u, { fill: darkScheme ? '#0F172A' : '#64748B' }),
    );
    for (let wx = x + 5 * u; wx < x + bw - 10 * u; wx += 10 * u) {
      if (rand() < 0.6) windows.push(rect(wx, ground - bh + 8 * u, 4 * u, 6 * u, { fill: darkScheme ? '#FDE68A' : '#F8FAFC', opacity: darkScheme ? 0.8 : 0.9 }));
    }
    x += bw;
  }
  const stars = darkScheme
    ? Array.from({ length: Math.round((w * h) / 4500) }, () => ({ x: rand() * w, y: rand() * h * 0.75 }))
      .filter(p => p.y > (CALM_TOP + 40) * u || p.x < 18 * u || p.x > w - 18 * u)
      .map(p => circle(p.x, p.y, (0.6 + rand()) * u, { fill: '#FFFFFF', opacity: 0.25 + rand() * 0.35 }))
    : [];
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#0B1430' }, { offset: 0.6, color: '#16204A' }, { offset: 1, color: '#2A2350' }]
        : [{ offset: 0, color: '#DBEAFE' }, { offset: 0.6, color: '#EFF6FF' }, { offset: 1, color: '#FDE7E7' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...stars,
      ...lanterns,
      ...roofs,
      ...windows,
      ...eiffelTower(w * 0.78, ground + 2 * u, 0.62 * u, darkScheme ? '#2E3B70' : '#475569'),
      circle(w * 0.78, ground - 113 * u, 2 * u, { fill: '#F87171' }),
      ...bunting,
    ],
  };
}
