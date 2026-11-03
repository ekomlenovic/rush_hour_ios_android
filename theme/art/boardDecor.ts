import type { ColorScheme } from '../ui';
import { type ArtDrawing, type ArtShape, circle, ellipse, line, path, rect } from './art';

/**
 * Decorations drawn on the edges of an event board, under the grid and the vehicles: cobwebs, moon and pumpkins
 * for Halloween, a garland, baubles and snow for Christmas. The board is a square of SIZE units, whatever its grid:
 * the drawing keeps to its edges so the middle stays a plain road.
 */

export const DECOR_SIZE = 600;
const S = DECOR_SIZE;

/** Deterministic pseudo-random numbers, so a decoration is the same every time */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

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
function spider(x: number, y: number, color: string, thread: string): ArtShape[] {
  const leg = (side: number, k: number) =>
    path(`M${x} ${y + 2 + k * 3} q${side * 9} ${-6 + k * 4} ${side * 13} ${4 + k * 4}`, { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' });
  return [
    line(x, 0, x, y - 8, { stroke: thread, strokeWidth: 1.2 }),
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
  return [
    path(`M${x} ${S} L${x} ${S - h + w / 2} Q${x} ${S - h} ${x + w / 2} ${S - h} Q${x + w} ${S - h} ${x + w} ${S - h + w / 2} L${x + w} ${S} Z`, { fill: stone, stroke: edge, strokeWidth: 1.5 }),
    line(x + w / 2, S - h + 12, x + w / 2, S - h + 30, { stroke: edge, strokeWidth: 3 }),
    line(x + w / 2 - 7, S - h + 18, x + w / 2 + 7, S - h + 18, { stroke: edge, strokeWidth: 3 }),
  ];
}

function halloweenDecor(scheme: ColorScheme): ArtDrawing {
  const dark = scheme === 'dark';
  const web = dark ? '#C4B5FD' : '#5B21B6';
  const ink = dark ? '#0B0614' : '#2E1065';
  const rand = rng(1031);
  const stars = dark
    ? Array.from({ length: 26 }, () => circle(rand() * S, rand() * S, 0.8 + rand() * 1.4, { fill: '#FDE68A', opacity: 0.25 + rand() * 0.3 }))
    : [];
  const grass = Array.from({ length: 40 }, (_, i) => {
    const x = 150 + i * 8 + rand() * 4;
    const h = 8 + rand() * 12;
    return path(`M${x} ${S} L${x + 2} ${S - h} L${x + 5} ${S}`, { fill: dark ? '#365314' : '#4D7C0F', opacity: 0.7 });
  });
  return {
    width: S,
    height: S,
    gradients: [
      { id: 'moon', radial: true, stops: [{ offset: 0, color: '#FEF9C3' }, { offset: 0.8, color: '#FDE68A' }, { offset: 1, color: '#F59E0B' }] },
      { id: 'halo', radial: true, stops: [{ offset: 0, color: '#FDE68A', opacity: dark ? 0.35 : 0.5 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
      { id: 'mist', stops: [{ offset: 0, color: dark ? '#7C3AED' : '#A78BFA', opacity: 0 }, { offset: 1, color: dark ? '#7C3AED' : '#A78BFA', opacity: dark ? 0.28 : 0.3 }] },
    ],
    shapes: [
      ...stars,
      // Mist rising from the bottom
      rect(0, S - 120, S, 120, { fill: 'url(#mist)' }),
      // The full moon in the top right corner, bats crossing it
      circle(S - 62, 62, 90, { fill: 'url(#halo)' }),
      circle(S - 62, 62, 42, { fill: 'url(#moon)', opacity: dark ? 0.85 : 0.95 }),
      circle(S - 76, 52, 8, { fill: '#F59E0B', opacity: 0.25 }),
      circle(S - 50, 78, 6, { fill: '#F59E0B', opacity: 0.25 }),
      circle(S - 48, 44, 4, { fill: '#F59E0B', opacity: 0.25 }),
      bat(S - 70, 66, 1.3, ink),
      bat(S - 140, 40, 0.9, ink),
      bat(S - 118, 112, 0.7, ink),
      ...cornerWeb(0, 0, 1, 1, 150, web, dark ? 0.45 : 0.4),
      ...cornerWeb(S, S, -1, -1, 90, web, dark ? 0.4 : 0.35),
      ...spider(200, 74, ink, web),
      // A graveyard along the bottom
      ...grass,
      ...tombstone(240, 44, 62, dark ? '#4B4560' : '#A8A2B8', dark ? '#2A2438' : '#6B6480'),
      ...tombstone(304, 34, 46, dark ? '#4B4560' : '#A8A2B8', dark ? '#2A2438' : '#6B6480'),
      ...jackOLantern(54, S - 46, 34, '#FDE047'),
      ...jackOLantern(114, S - 30, 22, '#FDE047'),
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

/** The little snowman of the bottom right corner */
function snowman(cx: number, ground: number): ArtShape[] {
  return [
    ellipse(cx, ground - 26, 28, 26, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1.5 }),
    circle(cx, ground - 66, 18, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1.5 }),
    rect(cx - 16, ground - 52, 32, 7, { rx: 3, fill: '#DC2626' }),
    rect(cx + 6, ground - 50, 7, 18, { rx: 2, fill: '#B91C1C' }),
    circle(cx - 6, ground - 70, 2.2, { fill: '#111111' }),
    circle(cx + 6, ground - 70, 2.2, { fill: '#111111' }),
    path(`M${cx} ${ground - 65} L${cx + 14} ${ground - 62} L${cx} ${ground - 61} Z`, { fill: '#F97316' }),
    ...[-30, -20, -10].map(dy => circle(cx, ground + dy, 2.4, { fill: '#111111' })),
    rect(cx - 14, ground - 90, 28, 6, { rx: 1, fill: '#1F2937' }),
    rect(cx - 9, ground - 106, 18, 18, { rx: 2, fill: '#1F2937' }),
    rect(cx - 9, ground - 92, 18, 3, { fill: '#DC2626' }),
  ];
}

/** A small fir tree with its star, in the bottom left corner */
function firTree(cx: number, ground: number): ArtShape[] {
  const tier = (top: number, half: number, bottom: number) =>
    path(`M${cx} ${top} L${cx + half} ${bottom} Q${cx} ${bottom + 6} ${cx - half} ${bottom} Z`, { fill: 'url(#fir)', stroke: '#14532D', strokeWidth: 1 });
  return [
    rect(cx - 6, ground - 16, 12, 16, { fill: '#7C4A26' }),
    tier(ground - 64, 34, ground - 14),
    tier(ground - 92, 27, ground - 46),
    tier(ground - 116, 20, ground - 76),
    ...[[-14, -26, '#DC2626'], [12, -40, '#FACC15'], [-6, -60, '#60A5FA'], [8, -84, '#DC2626'], [-10, -96, '#FACC15']].map(([dx, dy, c]) =>
      circle(cx + Number(dx), ground + Number(dy), 3.2, { fill: String(c) })),
    path(`M${cx} ${ground - 132} L${cx + 4} ${ground - 122} L${cx + 14} ${ground - 122} L${cx + 6} ${ground - 116} L${cx + 9} ${ground - 106} L${cx} ${ground - 112} L${cx - 9} ${ground - 106} L${cx - 6} ${ground - 116} L${cx - 14} ${ground - 122} L${cx - 4} ${ground - 122} Z`,
      { fill: '#FACC15', stroke: '#A16207', strokeWidth: 1 }),
  ];
}

function christmasDecor(scheme: ColorScheme): ArtDrawing {
  const dark = scheme === 'dark';
  const rand = rng(1225);
  const flakes = Array.from({ length: 16 }, () =>
    snowflake(60 + rand() * (S - 120), 90 + rand() * (S - 220), 5 + rand() * 7, dark ? '#F8FAFC' : '#7DD3FC', dark ? 0.16 : 0.45)).flat();
  // The garland: four swags along the top, a bauble hanging from the bottom of each, bows where they meet
  const swags = [0, 1, 2, 3].map(i => {
    const x = i * 150;
    return `M${x} 6 Q${x + 75} 64 ${x + 150} 6`;
  });
  const colors = ['#DC2626', '#EAB308', '#2563EB', '#E5E7EB'];
  // Snow piled along the bottom
  const drift = `M0 ${S} L0 ${S - 30} Q60 ${S - 48} 130 ${S - 34} Q210 ${S - 18} 290 ${S - 36} Q380 ${S - 52} 460 ${S - 32} Q530 ${S - 18} ${S} ${S - 40} L${S} ${S} Z`;
  return {
    width: S,
    height: S,
    gradients: [
      { id: 'fir', horizontal: true, stops: [{ offset: 0, color: '#14532D' }, { offset: 1, color: '#22C55E' }] },
      { id: 'snow', stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: dark ? '#CBD5E1' : '#DBEAFE' }] },
    ],
    shapes: [
      ...flakes,
      ...swags.map(d => path(d, { fill: 'none', stroke: '#14532D', strokeWidth: 16, strokeLinecap: 'round' })),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#16A34A', strokeWidth: 10, strokeDasharray: '3 5', strokeLinecap: 'round' })),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#4ADE80', strokeWidth: 3, strokeDasharray: '2 9', opacity: 0.8 })),
      ...[0, 1, 2, 3].flatMap(i => bauble(i * 150 + 75, 36, 62, 11, colors[i])),
      ...[0, 150, 300, 450, 600].flatMap(x => bow(x, 8)),
      path(drift, { fill: 'url(#snow)', stroke: dark ? '#E2E8F0' : '#BFDBFE', strokeWidth: 1.5, opacity: dark ? 0.92 : 1 }),
      ...firTree(56, S - 26),
      ...snowman(S - 56, S - 22),
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
