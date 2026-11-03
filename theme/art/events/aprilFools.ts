import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, SHADOW, car, tires, van, vehicleGradients } from './vehicleKit';

/**
 * April Fools' Day (poisson d'avril): the goldfish car of the target car (skin), the car with a paper fish taped on
 * its roof (2 cells) and the aquarium van (3 cells) of the palette, the paper fish of its win effect and the
 * backdrop of its board: under the sea, bubbles and fish in the margins, a fishing hook coming down, seaweed and coral.
 */

/** A small fish swimming toward dir (1: right, -1: left), len long */
export function fish(cx: number, cy: number, len: number, color: string, dir = 1, opacity = 1): ArtShape[] {
  const h = len * 0.32;
  const x = (f: number) => cx + dir * f * len;
  return [
    path(`M${x(-0.32)} ${cy} L${x(-0.58)} ${cy - h * 0.9} Q${x(-0.5)} ${cy} ${x(-0.58)} ${cy + h * 0.9} Z`, { fill: dark(color, 0.15), opacity }),
    path(`M${x(-0.36)} ${cy} Q${x(-0.1)} ${cy - h * 1.3} ${x(0.42)} ${cy} Q${x(-0.1)} ${cy + h * 1.3} ${x(-0.36)} ${cy} Z`, { fill: color, stroke: dark(color, 0.35), strokeWidth: Math.max(0.5, len * 0.03), opacity }),
    path(`M${x(0.02)} ${cy - h * 0.62} Q${x(0.08)} ${cy} ${x(0.02)} ${cy + h * 0.62}`, { fill: 'none', stroke: dark(color, 0.3), strokeWidth: Math.max(0.5, len * 0.025), opacity }),
    circle(x(0.24), cy - h * 0.12, len * 0.05, { fill: '#0F172A', opacity }),
  ];
}

/** A paper fish, cut out by a child: white paper, a blue outline, its eye and fold */
function paperFish(cx: number, cy: number, len: number, paper: string, ink: string): ArtShape[] {
  const h = len * 0.36;
  return [
    path(`M${cx - len * 0.5} ${cy - h * 0.8} L${cx - len * 0.3} ${cy} L${cx - len * 0.5} ${cy + h * 0.8} Z M${cx - len * 0.34} ${cy} Q${cx - len * 0.05} ${cy - h * 1.3} ${cx + len * 0.48} ${cy} Q${cx - len * 0.05} ${cy + h * 1.3} ${cx - len * 0.34} ${cy} Z`,
      { fill: paper, stroke: ink, strokeWidth: Math.max(0.8, len * 0.035), strokeLinejoin: 'round' }),
    path(`M${cx - len * 0.02} ${cy - h * 0.7} Q${cx + len * 0.05} ${cy} ${cx - len * 0.02} ${cy + h * 0.7}`, { fill: 'none', stroke: ink, strokeWidth: Math.max(0.6, len * 0.025) }),
    ...[-0.15, -0.25].map(f => path(`M${cx + f * len} ${cy - h * 0.35} q${len * 0.05} ${h * 0.35} 0 ${h * 0.7}`, { fill: 'none', stroke: ink, strokeWidth: Math.max(0.5, len * 0.02), opacity: 0.6 })),
    circle(cx + len * 0.26, cy - h * 0.15, Math.max(1, len * 0.045), { fill: ink }),
  ];
}

/** A strip of tape */
const tape = (x: number, y: number, w: number, h: number, deg: number): ArtShape =>
  rect(x, y, w, h, { fill: '#FEF3C7', opacity: 0.75, stroke: '#D6C9A0', strokeWidth: 0.5, transform: `rotate(${deg} ${x + w / 2} ${y + h / 2})` });

/** The goldfish car (target car skin): a fish body with its scales, a glass bubble, its eyes and fins, the tail behind */
function goldfishCar(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  const fin = light(color, 0.35);
  const scales = [64, 80, 96, 112, 128].flatMap((x, i) => [24, 37, 50, 63, 76].map(y =>
    path(`M${x} ${y + (i % 2 ? 0 : -6)} q8 6 0 12`, { fill: 'none', stroke: outline, strokeWidth: 1, opacity: 0.35 })));
  return [
    ellipse(110, 56, 92, 40, { fill: SHADOW, opacity: 0.3 }),
    ...tires([70, 150]),
    // The tail, its rays
    path('M54 50 L8 12 Q24 50 8 88 Z', { fill: fin, stroke: outline, strokeWidth: 1 }),
    ...[-26, -13, 0, 13, 26].map(dy => line(48, 50, 16, 50 + dy * 1.3, { stroke: outline, strokeWidth: 0.8, opacity: 0.4 })),
    // Side fins
    path('M138 14 Q150 2 162 10 Q152 12 146 18 Z', { fill: fin, stroke: outline, strokeWidth: 0.8 }),
    path('M138 86 Q150 98 162 90 Q152 88 146 82 Z', { fill: fin, stroke: outline, strokeWidth: 0.8 }),
    // The body
    path('M46 50 Q58 10 128 11 Q188 15 198 50 Q188 85 128 89 Q58 90 46 50 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1.2 }),
    ...scales,
    // The fin along the back
    path('M62 50 Q92 38 124 50 Q92 62 62 50 Z', { fill: fin, stroke: outline, strokeWidth: 0.8, opacity: 0.9 }),
    // Glass bubble of the driver
    ellipse(150, 50, 18, 24, { fill: 'url(#glass)', stroke: outline, strokeWidth: 1 }),
    ellipse(144, 40, 5, 7, { fill: '#FFFFFF', opacity: 0.35 }),
    // Eyes on both sides, the mouth in front
    circle(178, 26, 7, { fill: '#FFFFFF', stroke: outline, strokeWidth: 1 }), circle(180, 25, 3.6, { fill: '#0F172A' }), circle(181, 23.6, 1.2, { fill: '#FFFFFF' }),
    circle(178, 74, 7, { fill: '#FFFFFF', stroke: outline, strokeWidth: 1 }), circle(180, 75, 3.6, { fill: '#0F172A' }), circle(181, 73.6, 1.2, { fill: '#FFFFFF' }),
    ellipse(196, 50, 3, 6, { fill: dark(color, 0.45) }),
    // A few bubbles on the back
    circle(30, 30, 3, { fill: 'none', stroke: '#E0F2FE', strokeWidth: 1 }), circle(24, 22, 2, { fill: 'none', stroke: '#E0F2FE', strokeWidth: 1 }),
  ];
}

/** The car with a paper fish taped on its roof (2 cells) */
function prankCar(color: string): ArtShape[] {
  return [
    ...car(color),
    ...paperFish(86, 50, 64, '#FFFFFF', '#2563EB'),
    tape(60, 28, 8, 20, -20),
    tape(104, 54, 8, 20, 15),
  ];
}

/** The aquarium van (3 cells): water, seaweed, pebbles, fish and bubbles in its box */
function aquariumVan(color: string): ArtShape[] {
  const rand = rng(401);
  const pebbles = Array.from({ length: 16 }, (_, i) =>
    ellipse(18 + rand() * 186, 20 + rand() * 60, 3 + rand() * 3, 2 + rand() * 2, { fill: ['#E7E5E4', '#A8A29E', '#FDE68A', '#D6D3D1'][i % 4], opacity: 0.85 }));
  const weed = (x: number, y: number, k: number) =>
    path(`M${x} ${y} q${8 * k} ${-6 * k} ${4 * k} ${-14 * k} q${-6 * k} ${-6 * k} ${2 * k} ${-14 * k}`, { fill: 'none', stroke: '#16A34A', strokeWidth: 3, strokeLinecap: 'round' });
  return [
    ...van(color, 'url(#water)'),
    ...pebbles,
    weed(30, 78, 1.2), weed(36, 80, 0.9), weed(170, 82, 1.1), weed(120, 46, 0.9), weed(80, 30, 0.8),
    ...fish(64, 56, 34, '#F97316', 1),
    ...fish(138, 30, 28, '#FACC15', -1),
    ...fish(176, 58, 24, '#F472B6', 1),
    ...fish(104, 72, 22, '#38BDF8', -1),
    ...[[96, 28, 2.4], [100, 20, 1.8], [44, 34, 2], [190, 30, 2.2]].map(([x, y, r]) => circle(x, y, r, { fill: 'none', stroke: '#FFFFFF', strokeWidth: 0.8 })),
    rect(12, 14, 198, 6, { fill: '#FFFFFF', opacity: 0.18 }),
    ...paperFish(231, 50, 26, '#FFFFFF', '#2563EB'),
  ];
}

const gradients = (color: string) => vehicleGradients(color, [
  { id: 'water', stops: [{ offset: 0, color: '#0369A1' }, { offset: 0.5, color: '#38BDF8' }, { offset: 1, color: '#0369A1' }] },
]);

/** The goldfish car of the target car, front on the right (2 cells) */
export function goldfishDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: goldfishCar(color) };
}

/** A vehicle of the April Fools' palette: the paper fish car for 2 cells, the aquarium van for 3 or more */
export function prankVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? aquariumVan(color) : prankCar(color) };
}

// ─── Win effect: paper fish ───────────────────────────────────────────────────

/** The drawings of the paper fish effect: paper fish of every color */
export const PAPER_FISH_DRAWINGS: ArtDrawing[] = [
  ['#FFFFFF', '#2563EB'], ['#FDE68A', '#C2410C'], ['#BAE6FD', '#0369A1'], ['#FBCFE8', '#BE185D'], ['#BBF7D0', '#15803D'],
].map(([paper, ink]) => ({ width: 40, height: 26, gradients: [], shapes: paperFish(20, 13, 36, paper, ink) }));

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A branching coral, its foot at (x, ground) */
function coral(x: number, ground: number, k: number, color: string): ArtShape[] {
  const branch = (d: string, wdt: number) => path(d, { fill: 'none', stroke: color, strokeWidth: wdt * k, strokeLinecap: 'round' });
  const at = (dx: number, dy: number) => `${x + dx * k} ${ground - dy * k}`;
  return [
    branch(`M${at(0, 0)} Q${at(-2, 18)} ${at(-12, 30)}`, 5),
    branch(`M${at(0, 0)} Q${at(3, 22)} ${at(10, 38)}`, 5),
    branch(`M${at(-6, 20)} Q${at(-16, 22)} ${at(-20, 18)}`, 3.5),
    branch(`M${at(4, 22)} Q${at(14, 24)} ${at(18, 30)}`, 3.5),
    branch(`M${at(-10, 27)} Q${at(-8, 36)} ${at(-4, 40)}`, 3),
  ];
}

/** A starfish of radius r */
function starfish(cx: number, cy: number, r: number, color: string): ArtShape {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr}`;
  });
  return path(`M${pts.join(' L')} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 1, strokeLinejoin: 'round' });
}

export function aprilFoolsBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(401);
  // Bubbles rising along both sides, under the texts
  const bubbles = Array.from({ length: Math.round(h / (16 * u)) }, (_, i) => {
    const y = (CALM_TOP + 10) * u + rand() * (h - (CALM_TOP + 60) * u);
    const x = i % 2 ? w - (6 + rand() * 22) * u : (6 + rand() * 22) * u;
    const r = (1.5 + rand() * 4) * u;
    return [
      circle(x, y, r, { fill: '#FFFFFF', opacity: darkScheme ? 0.08 : 0.25, stroke: '#FFFFFF', strokeOpacity: darkScheme ? 0.4 : 0.8, strokeWidth: Math.max(0.8, r * 0.2) }),
      circle(x - r * 0.35, y - r * 0.35, r * 0.25, { fill: '#FFFFFF', opacity: 0.7 }),
    ];
  }).flat();
  // Fish swimming in the margins
  const swimmers = [
    fish(20 * u, h * 0.4, 26 * u, '#F97316', 1),
    fish(w - 20 * u, h * 0.52, 22 * u, '#FACC15', -1),
    fish(16 * u, h * 0.66, 18 * u, '#F472B6', 1),
    fish(w - 18 * u, h * 0.3, 18 * u, '#38BDF8', -1),
  ].flat();
  // A paper fish taped on the side, the joke of the day
  const joke = [...paperFish(w - 20 * u, h * 0.74, 30 * u, '#FFFFFF', '#2563EB'), tape(w - 28 * u, h * 0.74 - 9 * u, 5 * u, 12 * u, -15)];
  // The fishing hook coming down in the top right corner, beside the texts
  const hx = w - 26 * u;
  const hy = 104 * u;
  const hook = [
    line(hx, 0, hx, hy, { stroke: darkScheme ? '#CBD5E1' : '#475569', strokeWidth: 1, opacity: 0.8 }),
    ellipse(hx, hy - 30 * u, 4 * u, 6 * u, { fill: '#EF4444', stroke: '#7F1D1D', strokeWidth: 0.8 }),
    rect(hx - 4 * u, hy - 31 * u, 8 * u, 2 * u, { fill: '#FFFFFF' }),
    path(`M${hx} ${hy} l0 ${12 * u} q0 ${8 * u} ${-7 * u} ${8 * u} q${-6 * u} 0 ${-6 * u} ${-7 * u}`, { fill: 'none', stroke: '#94A3B8', strokeWidth: 2 * u, strokeLinecap: 'round' }),
    path(`M${hx - 13 * u} ${hy + 13 * u} l${-2 * u} ${-4 * u} l${4 * u} ${1 * u} Z`, { fill: '#94A3B8' }),
  ];
  // Light coming down from the surface
  const rays = [0.15, 0.4, 0.62, 0.85].map((f, i) =>
    path(`M${w * f - 14 * u} 0 L${w * f + 14 * u} 0 L${w * f + (50 + i * 10) * u} ${h * 0.75} L${w * f + (10 + i * 10) * u} ${h * 0.75} Z`, { fill: '#FFFFFF', opacity: darkScheme ? 0.035 : 0.12 }));
  // The sea floor: sand, seaweed, coral, a starfish and shells
  const ground = h - 28 * u;
  const sand = `M0 ${h} L0 ${ground - 4 * u} Q${w * 0.3} ${ground - 18 * u} ${w * 0.55} ${ground - 2 * u} Q${w * 0.8} ${ground + 10 * u} ${w} ${ground - 12 * u} L${w} ${h} Z`;
  const weeds = [0.04, 0.09, 0.36, 0.62, 0.95].map((f, i) => {
    const x = w * f;
    const k = (0.8 + (i % 3) * 0.25) * u;
    return path(`M${x} ${ground + 6 * u} q${10 * k} ${-14 * k} 0 ${-28 * k} q${-10 * k} ${-14 * k} 0 ${-28 * k} q${10 * k} ${-14 * k} 0 ${-28 * k}`,
      { fill: 'none', stroke: darkScheme ? '#15803D' : '#16A34A', strokeWidth: 5 * u, strokeLinecap: 'round' });
  });
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#0A3550' }, { offset: 0.55, color: '#06283F' }, { offset: 1, color: '#041A2B' }]
        : [{ offset: 0, color: '#D5F3FA' }, { offset: 0.55, color: '#A9E2EF' }, { offset: 1, color: '#86D0E2' }] },
      { id: 'sand', stops: [{ offset: 0, color: darkScheme ? '#8A7A50' : '#F6E3B4' }, { offset: 1, color: darkScheme ? '#5E5236' : '#E5C989' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...rays,
      // The surface, a thin wave at the very top
      path(`M0 ${6 * u} ${Array.from({ length: Math.ceil(w / (24 * u)) }, (_, i) => `q${6 * u} ${-4 * u} ${12 * u} 0 t${12 * u} 0`).join(' ')}`, { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.6 * u, opacity: darkScheme ? 0.25 : 0.7 }),
      ...hook,
      ...bubbles,
      ...swimmers,
      ...joke,
      ...weeds,
      ...coral(w * 0.22, ground + 2 * u, 1.1 * u, '#FB7185'),
      ...coral(w * 0.78, ground + 4 * u, 0.9 * u, '#F97316'),
      path(sand, { fill: 'url(#sand)' }),
      starfish(w * 0.12, ground + 12 * u, 9 * u, '#F97316'),
      starfish(w * 0.66, ground + 16 * u, 7 * u, '#F472B6'),
      ...[[0.44, 14], [0.86, 18], [0.3, 20]].map(([f, dy]) => ellipse(w * f, ground + dy * u, 5 * u, 3.5 * u, { fill: '#FFF7ED', stroke: '#D6A86A', strokeWidth: 0.8 })),
    ],
  };
}
