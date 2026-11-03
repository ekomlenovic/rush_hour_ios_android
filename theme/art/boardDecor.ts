import type { ColorScheme } from '../ui';
import { type ArtDrawing, type ArtShape, circle, ellipse, line, path, rect } from './art';

/**
 * Decorations around an event board, outside its frame: cobwebs, moon, bats and a graveyard for Halloween,
 * a garland, string lights and snow for Christmas. Drawn behind the board, in a square of DECOR_SIZE units:
 * the board takes its middle (BOARD units), the decorations the band of DECOR_BAND units around it, so they
 * never cover a cell. Whatever the grid of the board.
 */

/** Width of the board inside the decoration */
const S = 600;
/** Band around the board */
const B = 40;
export const DECOR_SIZE = S + 2 * B;
const T = DECOR_SIZE;
/** How far the decoration goes out of the board, as a share of the board's width */
export const DECOR_OUTSET = B / S;

/** Deterministic pseudo-random numbers, so a decoration is the same every time */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Whether a point is in the band around the board (not under it) */
const inBand = (x: number, y: number, margin = 0) => x < B - margin || x > B + S + margin || y < B - margin || y > B + S + margin;

// ─── Halloween ────────────────────────────────────────────────────────────────

/** A cobweb in the corner (x, y), its threads toward dx, dy */
function cornerWeb(x: number, y: number, dx: number, dy: number, size: number, color: string, opacity: number): ArtShape[] {
  const thread = { fill: 'none', stroke: color, strokeWidth: 1.6, opacity };
  const rays = [0, 0.2, 0.42, 0.62, 0.82, 1].map(f => {
    const a = (Math.PI / 2) * f;
    return { x: x + dx * size * Math.cos(a), y: y + dy * size * Math.sin(a) };
  });
  const rings = [0.28, 0.5, 0.72, 0.94].flatMap(k => rays.slice(1).map((end, i) => {
    const start = rays[i];
    const a = { x: x + (start.x - x) * k, y: y + (start.y - y) * k };
    const b = { x: x + (end.x - x) * k, y: y + (end.y - y) * k };
    const c = { x: x + ((a.x + b.x) / 2 - x) * 0.86, y: y + ((a.y + b.y) / 2 - y) * 0.86 };
    return path(`M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, thread);
  }));
  return [...rays.map(r => line(x, y, r.x, r.y, thread)), ...rings];
}

/** A spider hanging from its thread */
function spider(x: number, top: number, y: number, color: string, thread: string): ArtShape[] {
  const leg = (side: number, k: number) =>
    path(`M${x} ${y + 2 + k * 3} q${side * 9} ${-6 + k * 4} ${side * 13} ${4 + k * 4}`, { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' });
  return [
    line(x, top, x, y - 8, { stroke: thread, strokeWidth: 1.2 }),
    ...[0, 1, 2, 3].flatMap(k => [leg(-1, k), leg(1, k)]),
    ellipse(x, y + 6, 7, 9, { fill: color }),
    circle(x, y - 4, 5, { fill: color }),
    circle(x - 2, y - 5, 1.2, { fill: '#F87171' }),
    circle(x + 2, y - 5, 1.2, { fill: '#F87171' }),
  ];
}

/** A small carved pumpkin, lit from inside */
function jackOLantern(cx: number, cy: number, r: number, face: string): ArtShape[] {
  return [
    ellipse(cx + 3, cy + r * 0.9, r * 1.1, r * 0.25, { fill: '#000000', opacity: 0.25 }),
    path(`M${cx - 2} ${cy - r * 0.85} Q${cx - 3} ${cy - r * 1.3} ${cx + 3} ${cy - r * 1.4} L${cx + 5} ${cy - r * 1.2} Q${cx + 2} ${cy - r} ${cx + 3} ${cy - r * 0.85} Z`, { fill: '#4D7C0F' }),
    ellipse(cx - r * 0.45, cy, r * 0.55, r * 0.9, { fill: '#C2410C' }),
    ellipse(cx + r * 0.45, cy, r * 0.55, r * 0.9, { fill: '#C2410C' }),
    ellipse(cx, cy, r * 0.62, r * 0.95, { fill: '#F97316' }),
    ellipse(cx - r * 0.2, cy - r * 0.5, r * 0.2, r * 0.12, { fill: '#FED7AA', opacity: 0.6 }),
    path(`M${cx - r * 0.5} ${cy - r * 0.1} L${cx - r * 0.25} ${cy - r * 0.4} L${cx - r * 0.12} ${cy - r * 0.05} Z`, { fill: face }),
    path(`M${cx + r * 0.5} ${cy - r * 0.1} L${cx + r * 0.25} ${cy - r * 0.4} L${cx + r * 0.12} ${cy - r * 0.05} Z`, { fill: face }),
    path(`M${cx - r * 0.55} ${cy + r * 0.2} L${cx - r * 0.3} ${cy + r * 0.35} L${cx - r * 0.12} ${cy + r * 0.2} L${cx} ${cy + r * 0.38} L${cx + r * 0.12} ${cy + r * 0.2} L${cx + r * 0.3} ${cy + r * 0.35} L${cx + r * 0.55} ${cy + r * 0.2} Q${cx} ${cy + r * 0.85} ${cx - r * 0.55} ${cy + r * 0.2} Z`, { fill: face }),
  ];
}

/** A small bat in flight */
const bat = (x: number, y: number, s: number, color: string): ArtShape =>
  path(`M${x} ${y} q${-6 * s} ${-8 * s} ${-16 * s} ${-6 * s} q${4 * s} ${3 * s} ${3 * s} ${7 * s} q${-4 * s} ${-2 * s} ${-8 * s} ${1 * s} q${7 * s} ${0} ${10 * s} ${6 * s} L${x} ${y + 4 * s} L${x + 4 * s} ${y - 2 * s} q${3 * s} ${-6 * s} ${10 * s} ${-6 * s} q${-4 * s} ${-3 * s} ${-8 * s} ${-1 * s} q${1 * s} ${-4 * s} ${-3 * s} ${-7 * s} q${10 * s} ${-2 * s} ${16 * s} ${6 * s} Z`, { fill: color });

/** A tombstone sticking out of the grass at the bottom of the board */
function tombstone(x: number, w: number, h: number, stone: string, edge: string): ArtShape[] {
  const top = T - h;
  return [
    path(`M${x} ${T} L${x} ${top + w / 2} Q${x} ${top} ${x + w / 2} ${top} Q${x + w} ${top} ${x + w} ${top + w / 2} L${x + w} ${T} Z`, { fill: stone, stroke: edge, strokeWidth: 1.5 }),
    line(x + w / 2, top + w * 0.3, x + w / 2, top + w * 0.95, { stroke: edge, strokeWidth: 2.5 }),
    line(x + w * 0.28, top + w * 0.52, x + w * 0.72, top + w * 0.52, { stroke: edge, strokeWidth: 2.5 }),
  ];
}

function halloweenDecor(scheme: ColorScheme): ArtDrawing {
  const dark = scheme === 'dark';
  const web = dark ? '#C4B5FD' : '#5B21B6';
  const ink = dark ? '#E9D5FF' : '#2E1065';
  const stone = dark ? '#4B4560' : '#A8A2B8';
  const stoneEdge = dark ? '#2A2438' : '#6B6480';
  const rand = rng(1031);
  const stars = dark
    ? Array.from({ length: 70 }, () => ({ x: rand() * T, y: rand() * T, r: 0.8 + rand() * 1.4, o: 0.3 + rand() * 0.4 }))
      .filter(p => inBand(p.x, p.y, 3))
      .map(p => circle(p.x, p.y, p.r, { fill: '#FDE68A', opacity: p.o }))
    : [];
  const grass = Array.from({ length: 80 }, (_, i) => {
    const x = 150 + i * 6.5 + rand() * 3;
    const h = 5 + rand() * 9;
    return path(`M${x} ${T} L${x + 2} ${T - h} L${x + 4} ${T}`, { fill: dark ? '#4D7C0F' : '#4D7C0F', opacity: 0.8 });
  });
  return {
    width: T,
    height: T,
    gradients: [
      { id: 'moon', radial: true, stops: [{ offset: 0, color: '#FEF9C3' }, { offset: 0.8, color: '#FDE68A' }, { offset: 1, color: '#F59E0B' }] },
      { id: 'halo', radial: true, stops: [{ offset: 0, color: '#FDE68A', opacity: dark ? 0.45 : 0.55 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
      { id: 'mist', stops: [{ offset: 0, color: '#A78BFA', opacity: 0 }, { offset: 1, color: '#A78BFA', opacity: dark ? 0.35 : 0.4 }] },
    ],
    shapes: [
      ...stars,
      rect(0, T - B, T, B, { fill: 'url(#mist)' }),
      // Cobwebs in two corners, behind the board
      ...cornerWeb(0, 0, 1, 1, 120, web, dark ? 0.6 : 0.5),
      ...cornerWeb(T, T, -1, -1, 80, web, dark ? 0.55 : 0.45),
      // A spider coming down the left side
      ...spider(20, 50, 190, ink, web),
      // The full moon peeking from behind the top right corner, bats flying around
      circle(T - 30, 30, 56, { fill: 'url(#halo)' }),
      circle(T - 30, 30, 27, { fill: 'url(#moon)' }),
      circle(T - 38, 24, 5, { fill: '#F59E0B', opacity: 0.25 }),
      circle(T - 22, 40, 4, { fill: '#F59E0B', opacity: 0.25 }),
      bat(T - 110, 24, 0.9, ink),
      bat(T - 170, 14, 0.6, ink),
      bat(T - 18, 120, 0.7, ink),
      bat(T - 22, 300, 0.55, ink),
      // A graveyard along the bottom
      ...grass,
      ...tombstone(250, 26, 36, stone, stoneEdge),
      ...tombstone(290, 20, 28, stone, stoneEdge),
      ...tombstone(470, 22, 30, stone, stoneEdge),
      ...jackOLantern(64, T - 19, 15, '#FDE047'),
      ...jackOLantern(98, T - 13, 10, '#FDE047'),
      ...jackOLantern(20, T - 90, 12, '#FDE047'),
    ],
  };
}

// ─── Christmas ────────────────────────────────────────────────────────────────

/** A six-branch snowflake */
function snowflake(cx: number, cy: number, r: number, color: string, opacity: number): ArtShape[] {
  return [0, 1, 2].flatMap(i => {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    return [line(cx - dx, cy - dy, cx + dx, cy + dy, { stroke: color, strokeWidth: 2, strokeLinecap: 'round', opacity })];
  });
}

/** A Christmas bauble hanging from (x, top) */
function bauble(x: number, top: number, y: number, r: number, color: string): ArtShape[] {
  return [
    line(x, top, x, y - r, { stroke: '#CA8A04', strokeWidth: 1.4 }),
    circle(x + 2, y + 3, r, { fill: '#000000', opacity: 0.2 }),
    circle(x, y, r, { fill: color, stroke: '#000000', strokeOpacity: 0.2, strokeWidth: 1 }),
    rect(x - r * 0.35, y - r - 4, r * 0.7, 6, { rx: 1.5, fill: '#EAB308' }),
    ellipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.2, { fill: '#FFFFFF', opacity: 0.6 }),
  ];
}

/** A red bow tying the garland */
const bow = (x: number, y: number): ArtShape[] => [
  path(`M${x} ${y} C${x - 16} ${y - 14} ${x - 22} ${y + 8} ${x} ${y} Z`, { fill: '#DC2626', stroke: '#7F1D1D', strokeWidth: 1 }),
  path(`M${x} ${y} C${x + 16} ${y - 14} ${x + 22} ${y + 8} ${x} ${y} Z`, { fill: '#DC2626', stroke: '#7F1D1D', strokeWidth: 1 }),
  path(`M${x - 2} ${y} L${x - 8} ${y + 18} L${x - 3} ${y + 15} Z`, { fill: '#B91C1C' }),
  path(`M${x + 2} ${y} L${x + 8} ${y + 18} L${x + 3} ${y + 15} Z`, { fill: '#B91C1C' }),
  circle(x, y, 4, { fill: '#991B1B' }),
];

/** The little snowman of the bottom right corner, k times its size */
function snowman(cx: number, ground: number, k: number): ArtShape[] {
  const at = (dy: number) => ground - dy * k;
  return [
    ellipse(cx, at(26), 28 * k, 26 * k, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1.5 }),
    circle(cx, at(66), 18 * k, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1.5 }),
    rect(cx - 16 * k, at(52), 32 * k, 7 * k, { rx: 3 * k, fill: '#DC2626' }),
    rect(cx + 6 * k, at(50), 7 * k, 18 * k, { rx: 2 * k, fill: '#B91C1C' }),
    circle(cx - 6 * k, at(70), 2.2 * k, { fill: '#111111' }),
    circle(cx + 6 * k, at(70), 2.2 * k, { fill: '#111111' }),
    path(`M${cx} ${at(65)} L${cx + 14 * k} ${at(62)} L${cx} ${at(61)} Z`, { fill: '#F97316' }),
    ...[30, 20, 10].map(dy => circle(cx, at(dy), 2.4 * k, { fill: '#111111' })),
    rect(cx - 14 * k, at(90), 28 * k, 6 * k, { rx: 1, fill: '#1F2937' }),
    rect(cx - 9 * k, at(106), 18 * k, 18 * k, { rx: 2, fill: '#1F2937' }),
    rect(cx - 9 * k, at(92), 18 * k, 3 * k, { fill: '#DC2626' }),
  ];
}

/** A small fir tree with its star, k times its size */
function firTree(cx: number, ground: number, k: number): ArtShape[] {
  const at = (dy: number) => ground - dy * k;
  const tier = (top: number, half: number, bottom: number) =>
    path(`M${cx} ${at(top)} L${cx + half * k} ${at(bottom)} Q${cx} ${at(bottom - 6)} ${cx - half * k} ${at(bottom)} Z`, { fill: 'url(#fir)', stroke: '#14532D', strokeWidth: 1 });
  const balls: [number, number, string][] = [[-14, 26, '#DC2626'], [12, 40, '#FACC15'], [-6, 60, '#60A5FA'], [8, 84, '#DC2626'], [-10, 96, '#FACC15']];
  const star = [[0, 132], [4, 122], [14, 122], [6, 116], [9, 106], [0, 112], [-9, 106], [-6, 116], [-14, 122], [-4, 122]];
  return [
    rect(cx - 6 * k, at(16), 12 * k, 16 * k, { fill: '#7C4A26' }),
    tier(64, 34, 14),
    tier(92, 27, 46),
    tier(116, 20, 76),
    ...balls.map(([dx, dy, c]) => circle(cx + dx * k, at(dy), 3.2 * k, { fill: c })),
    path(`M${star.map(([dx, dy]) => `${cx + dx * k} ${at(dy)}`).join(' L')} Z`, { fill: '#FACC15', stroke: '#A16207', strokeWidth: 1 }),
  ];
}

function christmasDecor(scheme: ColorScheme): ArtDrawing {
  const dark = scheme === 'dark';
  const rand = rng(1225);
  const flakes = Array.from({ length: 60 }, () => ({ x: rand() * T, y: 50 + rand() * (T - 110), r: 4 + rand() * 4 }))
    .filter(f => inBand(f.x, f.y, f.r))
    .flatMap(f => snowflake(f.x, f.y, f.r, dark ? '#F8FAFC' : '#7DD3FC', dark ? 0.45 : 0.7));
  // The garland along the top: five swags, a bauble under each, bows where they meet
  const SWAG = T / 5;
  const swags = Array.from({ length: 5 }, (_, i) => `M${i * SWAG} 8 Q${(i + 0.5) * SWAG} 32 ${(i + 1) * SWAG} 8`);
  const colors = ['#DC2626', '#EAB308', '#2563EB', '#E5E7EB', '#DC2626'];
  // String lights down both sides
  const lights = [B / 2, T - B / 2].flatMap((x, side) => {
    const wire = Array.from({ length: 14 }, (_, i) => {
      const y = 48 + i * 40;
      return `Q${x + (i % 2 ? 9 : -9)} ${y + 20} ${x} ${y + 40}`;
    }).join(' ');
    const bulbs = Array.from({ length: 14 }, (_, i) => {
      const y = 68 + i * 40;
      const bx = x + (i % 2 ? 5 : -5);
      const c = ['#FDE047', '#F87171', '#60A5FA', '#4ADE80', '#F472B6'][(i + side * 2) % 5];
      return [circle(bx, y, 9, { fill: c, opacity: dark ? 0.3 : 0.2 }), ellipse(bx, y, 4, 5.5, { fill: c, stroke: '#000000', strokeOpacity: 0.35, strokeWidth: 0.6 }), rect(bx - 2, y - 8, 4, 3, { fill: '#4B5563' })];
    }).flat();
    return [path(`M${x} 48 ${wire}`, { fill: 'none', stroke: '#14532D', strokeWidth: 1.6 }), ...bulbs];
  });
  // Snow piled along the bottom
  const drift = `M0 ${T} L0 ${T - 30} Q70 ${T - 42} 150 ${T - 30} Q240 ${T - 18} 330 ${T - 32} Q420 ${T - 44} 510 ${T - 30} Q590 ${T - 18} ${T} ${T - 34} L${T} ${T} Z`;
  return {
    width: T,
    height: T,
    gradients: [
      { id: 'fir', horizontal: true, stops: [{ offset: 0, color: '#14532D' }, { offset: 1, color: '#22C55E' }] },
      { id: 'snow', stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: dark ? '#CBD5E1' : '#DBEAFE' }] },
    ],
    shapes: [
      ...flakes,
      ...lights,
      path(drift, { fill: 'url(#snow)', stroke: dark ? '#E2E8F0' : '#BFDBFE', strokeWidth: 1.5 }),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#14532D', strokeWidth: 13, strokeLinecap: 'round' })),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#16A34A', strokeWidth: 8, strokeDasharray: '3 5', strokeLinecap: 'round' })),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#4ADE80', strokeWidth: 2.5, strokeDasharray: '2 9', opacity: 0.8 })),
      ...swags.flatMap((_, i) => bauble((i + 0.5) * SWAG, 20, 29, 6.5, colors[i])),
      ...Array.from({ length: 6 }, (_, i) => bow(i * SWAG, 9)).flat(),
      ...firTree(B / 2, T - 6, 0.52),
      ...snowman(T - B / 2, T - 8, 0.62),
    ],
  };
}

const DECORS: Record<string, (scheme: ColorScheme) => ArtDrawing> = {
  pumpkin: halloweenDecor,
  christmas: christmasDecor,
};

const cache = new Map<string, ArtDrawing>();

/** The decoration of a board theme in a scheme, if it has one (the same object every time) */
export function boardDecor(board: string, scheme: ColorScheme): ArtDrawing | undefined {
  const draw = DECORS[board];
  if (!draw) return undefined;
  const key = `${board}:${scheme}`;
  let drawing = cache.get(key);
  if (!drawing) {
    drawing = draw(scheme);
    cache.set(key, drawing);
  }
  return drawing;
}

/** Board themes with a decoration */
export const DECORATED_BOARDS = Object.keys(DECORS);
