import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from './backdropKit';
import { CELL, HEADLIGHT, SHADOW, TAILLIGHT, car, tires, van, vehicleGradients } from './vehicleKit';

/**
 * New Year's Eve: the champagne limousine of the target car (skin), the confetti car (2 cells) and the party bus
 * with its disco ball (3 cells) of the palette, the drawings of its win effect (corks, stars, streamers) and the
 * backdrop of its board: a night of fireworks over the city, the clock about to strike midnight.
 */

/** Streamers and confetti, in turn */
const CONFETTI = ['#F472B6', '#22D3EE', '#FACC15', '#A78BFA', '#4ADE80', '#FB923C'];

/** A curly streamer from (x, y), `turns` loops along dx */
function streamer(x: number, y: number, dx: number, amp: number, turns: number, color: string, width = 2.2): ArtShape {
  const step = dx / turns;
  const loops = Array.from({ length: turns }, (_, i) => `q${step / 2} ${(i % 2 ? 1 : -1) * amp} ${step} 0`).join(' ');
  return path(`M${x} ${y} ${loops}`, { fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round' });
}

/** Confetti scattered in the box x, y, w × h */
function confetti(x: number, y: number, w: number, h: number, count: number, seed: number, size = 4): ArtShape[] {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const c = CONFETTI[i % CONFETTI.length];
    return i % 3 === 0
      ? circle(cx, cy, size * 0.45, { fill: c })
      : rect(cx, cy, size * (i % 2 ? 1 : 0.5), size * (i % 2 ? 0.5 : 1), { rx: 0.6, fill: c });
  });
}

/** A balloon of radius r at (cx, cy), its string down to (sx, sy) */
const balloon = (cx: number, cy: number, r: number, color: string, sx: number, sy: number): ArtShape[] => [
  path(`M${cx} ${cy + r} Q${(cx + sx) / 2 + 6} ${(cy + sy) / 2} ${sx} ${sy}`, { fill: 'none', stroke: '#E5E7EB', strokeWidth: 0.8 }),
  ellipse(cx + 3, cy + 3, r, r * 1.1, { fill: SHADOW, opacity: 0.25 }),
  ellipse(cx, cy, r, r * 1.1, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.8 }),
  path(`M${cx - 2} ${cy + r * 1.1} L${cx + 2} ${cy + r * 1.1} L${cx} ${cy + r * 1.1 - 3} Z`, { fill: dark(color, 0.2) }),
  ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.18, { fill: '#FFFFFF', opacity: 0.6 }),
];

/** A champagne flute seen from above, its glass catching the light */
const flute = (cx: number, cy: number, r: number): ArtShape[] => [
  circle(cx, cy, r, { fill: '#F8FAFC', opacity: 0.55, stroke: '#E5E7EB', strokeWidth: 0.8 }),
  circle(cx, cy, r * 0.72, { fill: '#FDE68A' }),
  circle(cx - r * 0.2, cy - r * 0.2, r * 0.18, { fill: '#FFFFFF', opacity: 0.8 }),
  circle(cx + r * 0.25, cy + r * 0.15, r * 0.08, { fill: '#FFFFFF', opacity: 0.8 }),
];

/** The champagne limousine (target car skin): its bottle popping out of the sunroof, two flutes, balloons tied behind */
function limo(color: string): ArtShape[] {
  const outline = dark(color, 0.55);
  return [
    rect(10, 16, 188, 82, { rx: 22, fill: SHADOW, opacity: 0.3 }),
    ...tires([40, 162]),
    path('M22 12 L172 12 Q196 14 197 50 Q196 86 172 88 L22 88 Q4 86 4 50 Q4 14 22 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    // Chrome lines along the sides
    line(20, 15, 176, 15, { stroke: 'url(#chrome)', strokeWidth: 1.6 }),
    line(20, 85, 176, 85, { stroke: 'url(#chrome)', strokeWidth: 1.6 }),
    path('M134 18 L154 23 Q161 50 154 77 L134 82 Z', { fill: 'url(#glass)' }),
    // The long roof and its open sunroof
    rect(34, 18, 102, 64, { rx: 10, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M22 24 L34 21 L34 79 L22 76 Q18 50 22 24 Z', { fill: 'url(#glass)' }),
    rect(56, 27, 64, 46, { rx: 8, fill: '#1E1B2E', stroke: outline, strokeWidth: 1.2 }),
    rect(58, 29, 60, 6, { rx: 3, fill: '#FFFFFF', opacity: 0.08 }),
    // The bottle, its gold foil toward the front, foam bursting out
    path('M66 58 L94 42 Q100 39 103 44 Q105 49 99 52 L71 68 Q65 71 63 66 Q61 61 66 58 Z', { fill: '#14532D', stroke: '#052E16', strokeWidth: 0.8 }),
    path('M94 42 L104 36 L108 43 L99 52 Q105 49 103 44 Q100 39 94 42 Z', { fill: 'url(#gold)' }),
    path('M70 60 L90 49', { stroke: '#FFFFFF', strokeWidth: 1.4, opacity: 0.35, strokeLinecap: 'round' }),
    rect(74, 55, 12, 8, { rx: 1, fill: '#FEF3C7', transform: 'rotate(-30 80 59)' }),
    ...[[112, 32, 5], [118, 38, 4], [123, 30, 3.4], [128, 36, 2.6], [116, 27, 2.4], [126, 44, 2]].map(([x, y, r]) =>
      circle(x, y, r, { fill: '#FFFBEB', stroke: '#FDE68A', strokeWidth: 0.6 })),
    ...flute(78, 36, 6), ...flute(108, 63, 6),
    // Streamers over the hood
    streamer(150, 30, 34, 5, 4, '#F472B6'),
    streamer(150, 70, 34, 5, 4, '#22D3EE'),
    streamer(156, 50, 26, 4, 3, '#FFFFFF', 1.6),
    // Balloons tied to the trunk
    ...balloon(14, 22, 9, '#F472B6', 24, 44),
    ...balloon(12, 78, 9, '#38BDF8', 24, 56),
    ...balloon(30, 50, 8, '#FACC15', 26, 50),
    rect(186, 17, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(186, 70, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(5, 30, 4, 10, { rx: 2, fill: TAILLIGHT }),
    rect(5, 60, 4, 10, { rx: 2, fill: TAILLIGHT }),
  ];
}

/** A party hat seen from above: a striped cone and its pompom */
function partyHat(cx: number, cy: number, r: number, color: string): ArtShape[] {
  const stripes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const b = a + 0.45;
    return path(`M${cx} ${cy} L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} A${r} ${r} 0 0 1 ${cx + Math.cos(b) * r} ${cy + Math.sin(b) * r} Z`, { fill: '#FFFFFF', opacity: 0.85 });
  });
  return [
    circle(cx + 3, cy + 3, r, { fill: SHADOW, opacity: 0.3 }),
    circle(cx, cy, r, { fill: color, stroke: dark(color, 0.4), strokeWidth: 1 }),
    ...stripes,
    circle(cx, cy, r * 0.32, { fill: '#FACC15', stroke: '#CA8A04', strokeWidth: 0.8 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => line(cx, cy, cx + Math.cos(i * 0.785) * r * 0.42, cy + Math.sin(i * 0.785) * r * 0.42, { stroke: '#FDE68A', strokeWidth: 1 })),
  ];
}

/** Confetti car (2 cells): a party hat on the roof among the confetti, streamers over the hood */
function confettiCar(color: string): ArtShape[] {
  return [
    ...car(color),
    ...confetti(48, 22, 76, 56, 22, 77),
    ...partyHat(86, 50, 16, '#EC4899'),
    streamer(150, 32, 36, 5, 4, '#FACC15'),
    streamer(150, 68, 36, 5, 4, '#22D3EE'),
  ];
}

/** A disco ball of radius r: its facets and their glints */
function discoBall(cx: number, cy: number, r: number): ArtShape[] {
  const rows = [-0.66, -0.33, 0, 0.33, 0.66];
  const chords = rows.flatMap(f => {
    const half = r * Math.sqrt(1 - f * f);
    return [
      line(cx - half, cy + f * r, cx + half, cy + f * r, { stroke: '#475569', strokeWidth: 0.8, opacity: 0.7 }),
      line(cx + f * r, cy - half, cx + f * r, cy + half, { stroke: '#475569', strokeWidth: 0.8, opacity: 0.7 }),
    ];
  });
  return [
    circle(cx + 3, cy + 3, r, { fill: SHADOW, opacity: 0.35 }),
    circle(cx, cy, r, { fill: 'url(#mirror)', stroke: '#334155', strokeWidth: 1 }),
    ...chords,
    ...[[-0.4, -0.45, '#FFFFFF'], [0.2, -0.2, '#F0ABFC'], [-0.15, 0.35, '#67E8F9'], [0.45, 0.3, '#FDE68A']].map(([fx, fy, c]) =>
      rect(cx + (fx as number) * r - 2.5, cy + (fy as number) * r - 2.5, 5, 5, { fill: c as string, opacity: 0.9 })),
  ];
}

/** Party bus (3 cells): a dance floor of lit tiles, the disco ball and its beams, lights along the edges */
function partyBus(color: string): ArtShape[] {
  const tiles = Array.from({ length: 8 * 3 }, (_, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const c = ['#EC4899', '#22D3EE', '#FACC15', '#A78BFA'][(col + row * 3) % 4];
    return rect(14 + col * 24.5, 16 + row * 23, 23, 21.5, { rx: 2, fill: c, opacity: (col + row) % 2 ? 0.55 : 0.25 });
  });
  const beam = (x: number, y: number, c: string) => path(`M110 50 L${x} ${y - 9} L${x} ${y + 9} Z`, { fill: c, opacity: 0.3 });
  const bulbs = Array.from({ length: 13 }, (_, i) => [
    circle(18 + i * 15, 11, 2.6, { fill: CONFETTI[i % CONFETTI.length] }),
    circle(24 + i * 15, 89, 2.6, { fill: CONFETTI[(i + 3) % CONFETTI.length] }),
  ]).flat();
  return [
    ...van(color, '#1E1B2E'),
    ...tiles,
    beam(18, 24, '#F0ABFC'), beam(20, 76, '#67E8F9'), beam(200, 22, '#FDE68A'), beam(200, 78, '#F0ABFC'), beam(60, 84, '#FDE68A'), beam(160, 16, '#67E8F9'),
    ...discoBall(110, 50, 20),
    ...bulbs,
    ...partyHat(231, 50, 9, '#A78BFA'),
  ];
}

const gradients = (color: string) => vehicleGradients(color, [
  { id: 'mirror', radial: true, stops: [{ offset: 0, color: '#F8FAFC' }, { offset: 0.6, color: '#CBD5E1' }, { offset: 1, color: '#64748B' }] },
]);

/** The champagne limousine of the target car, front on the right (2 cells) */
export function limoDrawing(color: string): ArtDrawing {
  return { width: 2 * CELL, height: CELL, gradients: gradients(color), shapes: limo(color) };
}

/** A vehicle of the New Year palette: the confetti car for 2 cells, the party bus for 3 or more */
export function partyVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: gradients(color), shapes: long ? partyBus(color) : confettiCar(color) };
}

// ─── Win effect: champagne ────────────────────────────────────────────────────

/** A five-branch star of radius r centered in a box of 40 */
function star(fill: string, edge: string): ArtDrawing {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 7.5 : 18;
    return `${20 + Math.cos(a) * r} ${20 + Math.sin(a) * r}`;
  });
  return {
    width: 40, height: 40, gradients: [],
    shapes: [path(`M${points.join(' L')} Z`, { fill, stroke: edge, strokeWidth: 1.4, strokeLinejoin: 'round' }), circle(16, 15, 3, { fill: '#FFFFFF', opacity: 0.7 })],
  };
}

const CORK: ArtDrawing = {
  width: 40, height: 40,
  gradients: [{ id: 'cork', horizontal: true, stops: [{ offset: 0, color: '#92643A' }, { offset: 0.5, color: '#D6A86A' }, { offset: 1, color: '#92643A' }] }],
  shapes: [
    path('M12 4 L28 4 Q30 4 30 6 L28 24 L12 24 L10 6 Q10 4 12 4 Z', { fill: 'url(#cork)', stroke: '#5C3A1E', strokeWidth: 1 }),
    rect(11, 24, 18, 12, { rx: 2, fill: '#E7C873', stroke: '#A16207', strokeWidth: 1 }),
    line(13, 10, 27, 10, { stroke: '#5C3A1E', strokeWidth: 0.8, opacity: 0.5 }),
    line(12, 16, 28, 16, { stroke: '#5C3A1E', strokeWidth: 0.8, opacity: 0.5 }),
    path('M14 24 L20 30 L26 24 M14 36 L20 30 L26 36', { fill: 'none', stroke: '#9CA3AF', strokeWidth: 1.2 }),
  ],
};

const STREAMER = (color: string): ArtDrawing => ({
  width: 40, height: 40, gradients: [],
  shapes: [path('M6 32 C10 18 20 30 22 18 C24 8 32 14 34 6', { fill: 'none', stroke: color, strokeWidth: 4, strokeLinecap: 'round' })],
});

/** The drawings of the champagne effect: corks, gold and silver stars, streamers */
export const CHAMPAGNE_DRAWINGS: ArtDrawing[] = [
  CORK, star('#FACC15', '#A16207'), STREAMER('#F472B6'), star('#E5E7EB', '#6B7280'), STREAMER('#22D3EE'), star('#FDE68A', '#CA8A04'),
];

// ─── Backdrop ─────────────────────────────────────────────────────────────────

/** A firework burst: rays and their sparks */
function burst(cx: number, cy: number, r: number, color: string, opacity: number): ArtShape[] {
  return [
    circle(cx, cy, r * 1.1, { fill: color, opacity: opacity * 0.12 }),
    ...Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const k = i % 2 ? 0.8 : 1;
      return [
        line(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25, cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k, { stroke: color, strokeWidth: Math.max(1, r / 14), strokeLinecap: 'round', opacity }),
        circle(cx + Math.cos(a) * r * (k + 0.12), cy + Math.sin(a) * r * (k + 0.12), Math.max(1, r / 12), { fill: color, opacity }),
      ];
    }).flat(),
  ];
}

/** The clock about to strike midnight: its face, gold rim and hands at 11:58 */
function clock(cx: number, cy: number, r: number, darkScheme: boolean): ArtShape[] {
  const hand = (turn: number, length: number, width: number) =>
    line(cx, cy, cx + Math.sin(turn * Math.PI * 2) * length, cy - Math.cos(turn * Math.PI * 2) * length, { stroke: '#1E1B4B', strokeWidth: width, strokeLinecap: 'round' });
  return [
    circle(cx, cy, r * 2.4, { fill: 'url(#halo)' }),
    circle(cx + r * 0.08, cy + r * 0.1, r * 1.08, { fill: '#000000', opacity: darkScheme ? 0.3 : 0.12 }),
    circle(cx, cy, r * 1.08, { fill: 'url(#rim)' }),
    circle(cx, cy, r * 0.92, { fill: '#FFFBEB', stroke: '#A16207', strokeWidth: 1 }),
    ...Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const inner = i % 3 ? 0.78 : 0.68;
      return line(cx + Math.sin(a) * r * inner, cy - Math.cos(a) * r * inner, cx + Math.sin(a) * r * 0.86, cy - Math.cos(a) * r * 0.86, { stroke: '#1E1B4B', strokeWidth: i % 3 ? 1 : 2 });
    }),
    hand(11.97 / 12, r * 0.5, Math.max(2, r * 0.09)),
    hand(58 / 60, r * 0.74, Math.max(1.4, r * 0.06)),
    circle(cx, cy, r * 0.08, { fill: '#B45309' }),
  ];
}

export function newYearBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(1231);
  const stars = Array.from({ length: Math.round((w * h) / 3200) }, () => ({ x: rand() * w, y: rand() * h * 0.8, r: (0.6 + rand() * 1.2) * u, o: 0.25 + rand() * 0.5 }))
    .filter(p => p.y > (CALM_TOP + 40) * u || p.x < 18 * u || p.x > w - 18 * u)
    .map(p => circle(p.x, p.y, p.r, { fill: darkScheme ? '#FDE68A' : '#A78BFA', opacity: darkScheme ? p.o : p.o * 0.6 }));
  // The city along the bottom, its windows lit
  const ground = h - 26 * u;
  const buildings: ArtShape[] = [];
  const windows: ArtShape[] = [];
  const city = darkScheme ? '#14123A' : '#B8B4E0';
  const lit = darkScheme ? '#FDE68A' : '#FFFBEB';
  for (let x = -4 * u; x < w;) {
    const bw = (22 + rand() * 26) * u;
    const bh = (24 + rand() * 46) * u;
    buildings.push(rect(x, ground - bh, bw - 2 * u, bh + 30 * u, { fill: city }));
    for (let wy = ground - bh + 6 * u; wy < ground - 4 * u; wy += 9 * u) {
      for (let wx = x + 4 * u; wx < x + bw - 8 * u; wx += 8 * u) {
        if (rand() < 0.45) windows.push(rect(wx, wy, 3.4 * u, 4.4 * u, { fill: lit, opacity: 0.5 + rand() * 0.4 }));
      }
    }
    x += bw;
  }
  // A tower with its spire, toward the right
  const tx = w * 0.7;
  buildings.push(rect(tx - 10 * u, ground - 92 * u, 20 * u, 120 * u, { fill: city }), path(`M${tx - 6 * u} ${ground - 92 * u} L${tx} ${ground - 122 * u} L${tx + 6 * u} ${ground - 92 * u} Z`, { fill: city }));
  windows.push(circle(tx, ground - 122 * u, 2 * u, { fill: '#F87171' }));
  const glow = darkScheme ? 0.9 : 0.75;
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#0B1033' }, { offset: 0.6, color: '#16134A' }, { offset: 1, color: '#2A1650' }]
        : [{ offset: 0, color: '#E6E9FB' }, { offset: 0.6, color: '#F0ECFB' }, { offset: 1, color: '#FCE7F1' }] },
      { id: 'halo', radial: true, stops: [{ offset: 0, color: '#FDE68A', opacity: darkScheme ? 0.4 : 0.5 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
      { id: 'rim', stops: [{ offset: 0, color: '#FDE68A' }, { offset: 0.5, color: '#CA8A04' }, { offset: 1, color: '#854D0E' }] },
      { id: 'glow', stops: [{ offset: 0, color: '#F472B6', opacity: 0 }, { offset: 1, color: '#F472B6', opacity: darkScheme ? 0.22 : 0.18 }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...stars,
      // The clock in the top right corner, beside the texts
      ...clock(w - 36 * u, 58 * u, 26 * u, darkScheme),
      // Streamers hanging in the top left corner, out of the way of the back button
      path(`M${6 * u} ${0} q${8 * u} ${14 * u} 0 ${28 * u} q${-8 * u} ${14 * u} 0 ${28 * u} q${8 * u} ${14 * u} 0 ${28 * u}`, { fill: 'none', stroke: '#F472B6', strokeWidth: 2.4 * u, strokeLinecap: 'round' }),
      path(`M${w - 6 * u} ${100 * u} q${-8 * u} ${14 * u} 0 ${28 * u} q${8 * u} ${14 * u} 0 ${28 * u}`, { fill: 'none', stroke: '#22D3EE', strokeWidth: 2.2 * u, strokeLinecap: 'round' }),
      // Fireworks in the margins, then over the city
      ...burst(16 * u, h * 0.36, 20 * u, '#F472B6', glow),
      ...burst(w - 18 * u, h * 0.5, 24 * u, '#FACC15', glow),
      ...burst(18 * u, h * 0.62, 16 * u, '#22D3EE', glow),
      ...burst(w - 14 * u, h * 0.72, 14 * u, '#A78BFA', glow),
      ...burst(w * 0.22, ground - 70 * u, 22 * u, '#FACC15', glow * 0.8),
      ...burst(w * 0.48, ground - 86 * u, 16 * u, '#4ADE80', glow * 0.7),
      ...burst(w * 0.86, ground - 76 * u, 20 * u, '#F472B6', glow * 0.8),
      rect(0, ground - 120 * u, w, 120 * u, { fill: 'url(#glow)' }),
      ...buildings,
      ...windows,
      ...confetti(0, ground + 4 * u, w, 20 * u, Math.round(w / (8 * u)), 2027, 4 * u),
    ],
  };
}
