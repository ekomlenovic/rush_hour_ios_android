import type { ColorScheme } from '../ui';
import { type ArtDrawing, type ArtShape, circle, ellipse, line, path, rect } from './art';
import { type Backdrop, type BackdropOptions, CALM_TOP, rng } from './events/backdropKit';
import { newYearBackdrop } from './events/newYear';
import { valentineBackdrop } from './events/valentine';
import { stPatrickBackdrop } from './events/stPatrick';

/**
 * Backdrops of the event boards: the whole screen of the game takes the theme, from top to bottom, behind
 * the board and the buttons (half the screen for each player of a duel). Halloween: a night sky, the moon
 * and its bats, cobwebs, a spider, ghosts and a misty graveyard on a hill; Christmas: a garland of fir,
 * string lights down the sides, snowflakes and a snowy hill with fir trees and a snowman.
 * The other events draw theirs in theme/art/events (New Year, Valentine's Day, Saint Patrick's Day…).
 * Drawn for the size of the area, in its pixels: nothing is stretched, whatever the screen.
 * The texts of the screen stay readable: the top (title, back, the stats card) keeps calm, only the moon or a thin
 * garland there; the busy parts go along the sides, in the margins of the board, and at the bottom, under the buttons.
 */

export { CALM_TOP, type BackdropOptions } from './events/backdropKit';

// ─── Halloween ────────────────────────────────────────────────────────────────

/** A cobweb in the corner (x, y), its threads toward dx, dy */
function cornerWeb(x: number, y: number, dx: number, dy: number, size: number, color: string, opacity: number): ArtShape[] {
  const thread = { fill: 'none', stroke: color, strokeWidth: Math.max(1, size / 90), opacity };
  const rays = [0, 0.2, 0.42, 0.62, 0.82, 1].map(f => {
    const a = (Math.PI / 2) * f;
    return { x: x + dx * size * Math.cos(a), y: y + dy * size * Math.sin(a) };
  });
  const rings = [0.24, 0.44, 0.64, 0.84, 1].flatMap(k => rays.slice(1).map((end, i) => {
    const start = rays[i];
    const a = { x: x + (start.x - x) * k, y: y + (start.y - y) * k };
    const b = { x: x + (end.x - x) * k, y: y + (end.y - y) * k };
    const c = { x: x + ((a.x + b.x) / 2 - x) * 0.86, y: y + ((a.y + b.y) / 2 - y) * 0.86 };
    return path(`M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, thread);
  }));
  return [...rays.map(r => line(x, y, r.x, r.y, thread)), ...rings];
}

/** A spider at (x, y) hanging from its thread, k times its size */
function spider(x: number, top: number, y: number, k: number, color: string, thread: string): ArtShape[] {
  const leg = (side: number, i: number) =>
    path(`M${x} ${y + (2 + i * 3) * k} q${side * 9 * k} ${(-6 + i * 4) * k} ${side * 13 * k} ${(4 + i * 4) * k}`,
      { fill: 'none', stroke: color, strokeWidth: 1.8 * k, strokeLinecap: 'round' });
  return [
    line(x, top, x, y - 8 * k, { stroke: thread, strokeWidth: 1.2 }),
    ...[0, 1, 2, 3].flatMap(i => [leg(-1, i), leg(1, i)]),
    ellipse(x, y + 6 * k, 7 * k, 9 * k, { fill: color }),
    circle(x, y - 4 * k, 5 * k, { fill: color }),
    circle(x - 2 * k, y - 5 * k, 1.2 * k, { fill: '#F87171' }),
    circle(x + 2 * k, y - 5 * k, 1.2 * k, { fill: '#F87171' }),
  ];
}

/** A carved pumpkin of radius r, lit from inside */
function jackOLantern(cx: number, cy: number, r: number): ArtShape[] {
  const face = '#FDE047';
  return [
    ellipse(cx + r * 0.1, cy + r * 0.9, r * 1.1, r * 0.25, { fill: '#000000', opacity: 0.25 }),
    path(`M${cx - r * 0.1} ${cy - r * 0.85} Q${cx - r * 0.15} ${cy - r * 1.3} ${cx + r * 0.15} ${cy - r * 1.4} L${cx + r * 0.25} ${cy - r * 1.2} Q${cx + r * 0.1} ${cy - r} ${cx + r * 0.15} ${cy - r * 0.85} Z`, { fill: '#4D7C0F' }),
    ellipse(cx - r * 0.45, cy, r * 0.55, r * 0.9, { fill: '#C2410C' }),
    ellipse(cx + r * 0.45, cy, r * 0.55, r * 0.9, { fill: '#C2410C' }),
    ellipse(cx, cy, r * 0.62, r * 0.95, { fill: '#F97316' }),
    ellipse(cx - r * 0.2, cy - r * 0.5, r * 0.2, r * 0.12, { fill: '#FED7AA', opacity: 0.6 }),
    path(`M${cx - r * 0.5} ${cy - r * 0.1} L${cx - r * 0.25} ${cy - r * 0.4} L${cx - r * 0.12} ${cy - r * 0.05} Z`, { fill: face }),
    path(`M${cx + r * 0.5} ${cy - r * 0.1} L${cx + r * 0.25} ${cy - r * 0.4} L${cx + r * 0.12} ${cy - r * 0.05} Z`, { fill: face }),
    path(`M${cx - r * 0.55} ${cy + r * 0.2} L${cx - r * 0.3} ${cy + r * 0.35} L${cx - r * 0.12} ${cy + r * 0.2} L${cx} ${cy + r * 0.38} L${cx + r * 0.12} ${cy + r * 0.2} L${cx + r * 0.3} ${cy + r * 0.35} L${cx + r * 0.55} ${cy + r * 0.2} Q${cx} ${cy + r * 0.85} ${cx - r * 0.55} ${cy + r * 0.2} Z`, { fill: face }),
  ];
}

/** A bat in flight, s times its size */
const bat = (x: number, y: number, s: number, color: string): ArtShape =>
  path(`M${x} ${y} q${-6 * s} ${-8 * s} ${-16 * s} ${-6 * s} q${4 * s} ${3 * s} ${3 * s} ${7 * s} q${-4 * s} ${-2 * s} ${-8 * s} ${1 * s} q${7 * s} ${0} ${10 * s} ${6 * s} L${x} ${y + 4 * s} L${x + 4 * s} ${y - 2 * s} q${3 * s} ${-6 * s} ${10 * s} ${-6 * s} q${-4 * s} ${-3 * s} ${-8 * s} ${-1 * s} q${1 * s} ${-4 * s} ${-3 * s} ${-7 * s} q${10 * s} ${-2 * s} ${16 * s} ${6 * s} Z`, { fill: color });

/** A tombstone of width w and height h standing on the ground at y */
function tombstone(x: number, ground: number, w: number, h: number, stone: string, edge: string): ArtShape[] {
  const top = ground - h;
  return [
    path(`M${x} ${ground} L${x} ${top + w / 2} Q${x} ${top} ${x + w / 2} ${top} Q${x + w} ${top} ${x + w} ${top + w / 2} L${x + w} ${ground} Z`, { fill: stone, stroke: edge, strokeWidth: 1.5 }),
    line(x + w / 2, top + w * 0.3, x + w / 2, top + w * 0.95, { stroke: edge, strokeWidth: w * 0.1 }),
    line(x + w * 0.28, top + w * 0.52, x + w * 0.72, top + w * 0.52, { stroke: edge, strokeWidth: w * 0.1 }),
  ];
}

/** A small floating ghost, k times its size */
function ghost(x: number, y: number, k: number, opacity: number): ArtShape[] {
  return [
    path(`M${x - 14 * k} ${y + 18 * k} L${x - 14 * k} ${y} Q${x - 14 * k} ${y - 18 * k} ${x} ${y - 18 * k} Q${x + 14 * k} ${y - 18 * k} ${x + 14 * k} ${y} L${x + 14 * k} ${y + 18 * k} L${x + 9 * k} ${y + 13 * k} L${x + 4 * k} ${y + 19 * k} L${x - 1 * k} ${y + 13 * k} L${x - 5 * k} ${y + 19 * k} L${x - 9 * k} ${y + 13 * k} Z`,
      { fill: '#F8FAFC', opacity }),
    ellipse(x - 5 * k, y - 4 * k, 2.4 * k, 3.4 * k, { fill: '#1E1B2E', opacity }),
    ellipse(x + 5 * k, y - 4 * k, 2.4 * k, 3.4 * k, { fill: '#1E1B2E', opacity }),
    ellipse(x, y + 5 * k, 3 * k, 4 * k, { fill: '#1E1B2E', opacity: opacity * 0.8 }),
  ];
}

/** A bare tree, its branches bent by the wind, k times its size, its foot at (x, ground) */
function deadTree(x: number, ground: number, k: number, color: string): ArtShape[] {
  const branch = (d: string, w: number) => path(d, { fill: 'none', stroke: color, strokeWidth: w * k, strokeLinecap: 'round' });
  const at = (dx: number, dy: number) => `${x + dx * k} ${ground - dy * k}`;
  return [
    path(`M${at(-7, 0)} Q${at(-3, 40)} ${at(-4, 80)} L${at(4, 80)} Q${at(3, 40)} ${at(9, 0)} Z`, { fill: color }),
    branch(`M${at(0, 70)} Q${at(-20, 90)} ${at(-38, 100)}`, 4),
    branch(`M${at(-24, 93)} Q${at(-30, 108)} ${at(-26, 118)}`, 2.5),
    branch(`M${at(0, 78)} Q${at(18, 100)} ${at(34, 108)}`, 4),
    branch(`M${at(22, 102)} Q${at(30, 116)} ${at(26, 128)}`, 2.5),
    branch(`M${at(0, 80)} Q${at(2, 104)} ${at(-4, 124)}`, 3),
  ];
}

function halloweenBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const dark = scheme === 'dark';
  // Unit: 1 on a phone 400 wide, never so big that the top and the bottom meet
  const u = Math.min(1.6, w / 400, h / 420);
  const web = dark ? '#C4B5FD' : '#5B21B6';
  const ink = dark ? '#E9D5FF' : '#2E1065';
  const hill = dark ? '#140B22' : '#C9B8EA';
  const stone = dark ? '#4B4560' : '#A8A2B8';
  const stoneEdge = dark ? '#2A2438' : '#6B6480';
  const rand = rng(1031);
  const stars = dark
    ? Array.from({ length: Math.round((w * h) / 3500) }, () => ({ x: rand() * w, y: rand() * h * 0.85, r: (0.6 + rand() * 1.3) * u, o: 0.25 + rand() * 0.45 }))
      // None among the texts of the top
      .filter(p => p.y > (CALM_TOP + 40) * u || p.x < 18 * u || p.x > w - 18 * u)
      .map(p => circle(p.x, p.y, p.r, { fill: '#FDE68A', opacity: p.o }))
    : [];
  // A hill along the bottom, the graveyard on it
  const ground = h - 46 * u;
  const hillPath = `M0 ${h} L0 ${ground + 10 * u} Q${w * 0.25} ${ground - 26 * u} ${w * 0.5} ${ground - 6 * u} Q${w * 0.75} ${ground + 12 * u} ${w} ${ground - 18 * u} L${w} ${h} Z`;
  const grass = Array.from({ length: Math.round(w / (6 * u)) }, (_, i) => {
    const x = i * 6 * u + rand() * 3 * u;
    const top = ground - 8 * u + 18 * u * Math.abs(Math.sin((x / w) * Math.PI * 1.6)) * 0.3;
    return path(`M${x} ${top + 12 * u} L${x + 2 * u} ${top - (3 + rand() * 7) * u} L${x + 4 * u} ${top + 12 * u}`, { fill: dark ? '#365314' : '#65A30D', opacity: 0.8 });
  });
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: dark
        ? [{ offset: 0, color: '#1E1036' }, { offset: 0.6, color: '#140B24' }, { offset: 1, color: '#0B0614' }]
        : [{ offset: 0, color: '#EDE4FA' }, { offset: 0.6, color: '#F6EEFB' }, { offset: 1, color: '#FCE7D4' }] },
      { id: 'moon', radial: true, stops: [{ offset: 0, color: '#FEF9C3' }, { offset: 0.8, color: '#FDE68A' }, { offset: 1, color: '#F59E0B' }] },
      { id: 'halo', radial: true, stops: [{ offset: 0, color: '#FDE68A', opacity: dark ? 0.4 : 0.55 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
      { id: 'mist', stops: [{ offset: 0, color: '#A78BFA', opacity: 0 }, { offset: 1, color: '#A78BFA', opacity: dark ? 0.3 : 0.35 }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...stars,
      // The full moon in the top right corner, beside the texts, bats flying around it
      circle(w - 34 * u, 62 * u, 80 * u, { fill: 'url(#halo)' }),
      circle(w - 34 * u, 62 * u, 34 * u, { fill: 'url(#moon)' }),
      circle(w - 46 * u, 54 * u, 6 * u, { fill: '#F59E0B', opacity: 0.22 }),
      circle(w - 24 * u, 76 * u, 5 * u, { fill: '#F59E0B', opacity: 0.22 }),
      circle(w - 22 * u, 46 * u, 4 * u, { fill: '#F59E0B', opacity: 0.22 }),
      // Bats around the moon only, on the right edge: none over the title
      bat(w - 36 * u, 66 * u, 1.2 * u, ink),
      bat(w - 16 * u, 160 * u, 0.6 * u, ink),
      bat(w - 104 * u, 24 * u, 0.55 * u, ink),
      // The spider coming down the left margin, from the top
      ...spider(12 * u, 0, h * 0.32, 0.9 * u, ink, web),
      // A cobweb low on the left, under the buttons
      ...cornerWeb(0, ground + 8 * u, 1, -1, 120 * u, web, dark ? 0.5 : 0.4),
      // Ghosts drifting along the sides
      ...ghost(w - 26 * u, h * 0.42, 0.9 * u, dark ? 0.35 : 0.6),
      ...ghost(22 * u, h * 0.6, 0.75 * u, dark ? 0.3 : 0.55),
      // The hill and its graveyard, mist over it
      rect(0, h * 0.7, w, h * 0.3, { fill: 'url(#mist)' }),
      ...deadTree(w * 0.84, ground - 6 * u, 0.9 * u, hill),
      path(hillPath, { fill: hill }),
      ...grass,
      ...tombstone(w * 0.3, ground + 4 * u, 26 * u, 38 * u, stone, stoneEdge),
      ...tombstone(w * 0.38, ground + 2 * u, 20 * u, 28 * u, stone, stoneEdge),
      ...tombstone(w * 0.62, ground + 6 * u, 24 * u, 32 * u, stone, stoneEdge),
      ...jackOLantern(44 * u, ground + 18 * u, 20 * u),
      ...jackOLantern(84 * u, ground + 26 * u, 13 * u),
      ...jackOLantern(w - 40 * u, ground + 22 * u, 16 * u),
      ...cornerWeb(w, h, -1, -1, 90 * u, web, dark ? 0.45 : 0.35),
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
    return [line(cx - dx, cy - dy, cx + dx, cy + dy, { stroke: color, strokeWidth: Math.max(1, r / 4), strokeLinecap: 'round', opacity })];
  });
}

/** A Christmas bauble hanging from (x, top) */
function bauble(x: number, top: number, y: number, r: number, color: string): ArtShape[] {
  return [
    line(x, top, x, y - r, { stroke: '#CA8A04', strokeWidth: 1.2 }),
    circle(x + r * 0.2, y + r * 0.3, r, { fill: '#000000', opacity: 0.2 }),
    circle(x, y, r, { fill: color, stroke: '#000000', strokeOpacity: 0.2, strokeWidth: 1 }),
    rect(x - r * 0.35, y - r * 1.4, r * 0.7, r * 0.6, { rx: r * 0.15, fill: '#EAB308' }),
    ellipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.2, { fill: '#FFFFFF', opacity: 0.6 }),
  ];
}

/** A red bow tying the garland, k times its size */
const bow = (x: number, y: number, k: number): ArtShape[] => [
  path(`M${x} ${y} C${x - 16 * k} ${y - 14 * k} ${x - 22 * k} ${y + 8 * k} ${x} ${y} Z`, { fill: '#DC2626', stroke: '#7F1D1D', strokeWidth: 1 }),
  path(`M${x} ${y} C${x + 16 * k} ${y - 14 * k} ${x + 22 * k} ${y + 8 * k} ${x} ${y} Z`, { fill: '#DC2626', stroke: '#7F1D1D', strokeWidth: 1 }),
  path(`M${x - 2 * k} ${y} L${x - 8 * k} ${y + 18 * k} L${x - 3 * k} ${y + 15 * k} Z`, { fill: '#B91C1C' }),
  path(`M${x + 2 * k} ${y} L${x + 8 * k} ${y + 18 * k} L${x + 3 * k} ${y + 15 * k} Z`, { fill: '#B91C1C' }),
  circle(x, y, 4 * k, { fill: '#991B1B' }),
];

/** A snowman, k times its size, standing at (cx, ground) */
function snowman(cx: number, ground: number, k: number): ArtShape[] {
  const at = (dy: number) => ground - dy * k;
  return [
    ellipse(cx, ground, 32 * k, 6 * k, { fill: '#000000', opacity: 0.12 }),
    ellipse(cx, at(26), 28 * k, 26 * k, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1.5 }),
    circle(cx, at(66), 18 * k, { fill: '#F8FAFC', stroke: '#CBD5E1', strokeWidth: 1.5 }),
    rect(cx - 16 * k, at(52), 32 * k, 7 * k, { rx: 3 * k, fill: '#DC2626' }),
    rect(cx + 6 * k, at(50), 7 * k, 18 * k, { rx: 2 * k, fill: '#B91C1C' }),
    circle(cx - 6 * k, at(70), 2.2 * k, { fill: '#111111' }),
    circle(cx + 6 * k, at(70), 2.2 * k, { fill: '#111111' }),
    path(`M${cx} ${at(65)} L${cx + 14 * k} ${at(62)} L${cx} ${at(61)} Z`, { fill: '#F97316' }),
    ...[30, 20, 10].map(dy => circle(cx, at(dy), 2.4 * k, { fill: '#111111' })),
    line(cx - 24 * k, at(36), cx - 40 * k, at(52), { stroke: '#78350F', strokeWidth: 2.4 * k, strokeLinecap: 'round' }),
    line(cx + 24 * k, at(36), cx + 40 * k, at(50), { stroke: '#78350F', strokeWidth: 2.4 * k, strokeLinecap: 'round' }),
    rect(cx - 14 * k, at(90), 28 * k, 6 * k, { rx: 1, fill: '#1F2937' }),
    rect(cx - 9 * k, at(106), 18 * k, 18 * k, { rx: 2, fill: '#1F2937' }),
    rect(cx - 9 * k, at(92), 18 * k, 3 * k, { fill: '#DC2626' }),
  ];
}

/** A fir tree, k times its size, its foot at (cx, ground); with baubles and a star when decorated */
function firTree(cx: number, ground: number, k: number, decorated: boolean): ArtShape[] {
  const at = (dy: number) => ground - dy * k;
  const tier = (top: number, half: number, bottom: number) =>
    path(`M${cx} ${at(top)} L${cx + half * k} ${at(bottom)} Q${cx} ${at(bottom - 6)} ${cx - half * k} ${at(bottom)} Z`, { fill: 'url(#fir)', stroke: '#14532D', strokeWidth: 1 });
  const snowCap = (top: number, half: number) =>
    path(`M${cx} ${at(top)} L${cx + half * k} ${at(top - half * 1.1)} Q${cx} ${at(top - half * 0.8)} ${cx - half * k} ${at(top - half * 1.1)} Z`, { fill: '#F8FAFC', opacity: 0.9 });
  const balls: [number, number, string][] = [[-14, 26, '#DC2626'], [12, 40, '#FACC15'], [-6, 60, '#60A5FA'], [8, 84, '#DC2626'], [-10, 96, '#FACC15']];
  const star = [[0, 132], [4, 122], [14, 122], [6, 116], [9, 106], [0, 112], [-9, 106], [-6, 116], [-14, 122], [-4, 122]];
  return [
    rect(cx - 6 * k, at(16), 12 * k, 16 * k, { fill: '#7C4A26' }),
    tier(64, 34, 14),
    tier(92, 27, 46),
    tier(116, 20, 76),
    ...(decorated
      ? [
        ...balls.map(([dx, dy, c]) => circle(cx + dx * k, at(dy), 3.2 * k, { fill: c })),
        path(`M${star.map(([dx, dy]) => `${cx + dx * k} ${at(dy)}`).join(' L')} Z`, { fill: '#FACC15', stroke: '#A16207', strokeWidth: 1 }),
      ]
      : [snowCap(116, 10), snowCap(92, 12)]),
  ];
}

function christmasBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const dark = scheme === 'dark';
  const u = Math.min(1.6, w / 400, h / 420);
  const rand = rng(1225);
  const flakes = Array.from({ length: Math.round((w * h) / 6000) }, () =>
    snowflake(rand() * w, CALM_TOP * u + rand() * (h - (CALM_TOP + 80) * u), (3 + rand() * 6) * u, dark ? '#F8FAFC' : '#7DD3FC', dark ? 0.2 + rand() * 0.3 : 0.4 + rand() * 0.4)).flat();
  // A thin garland along the very top, above the texts: swags of about 120, bows where they meet;
  // its baubles hang in the corners only, out of the way of the title
  const count = Math.max(2, Math.round(w / (120 * u)));
  const swag = w / count;
  const sag = 7 * u;
  const swags = Array.from({ length: count }, (_, i) => `M${i * swag} 0 Q${(i + 0.5) * swag} ${sag * 2} ${(i + 1) * swag} 0`);
  const ballColors = ['#DC2626', '#EAB308', '#2563EB', '#E5E7EB', '#16A34A'];
  // String lights down both sides
  const step = 46 * u;
  const lightsTop = 80 * u;
  const lightsCount = Math.max(0, Math.floor((h - 160 * u - lightsTop) / step));
  const lights = [12 * u, w - 12 * u].flatMap((x, side) => {
    const wire = Array.from({ length: lightsCount }, (_, i) => `Q${x + (i % 2 ? 10 : -10) * u} ${lightsTop + (i + 0.5) * step} ${x} ${lightsTop + (i + 1) * step}`).join(' ');
    const bulbs = Array.from({ length: lightsCount }, (_, i) => {
      const y = lightsTop + (i + 0.5) * step;
      const bx = x + (i % 2 ? 5 : -5) * u;
      const c = ['#FDE047', '#F87171', '#60A5FA', '#4ADE80', '#F472B6'][(i + side * 2) % 5];
      return [
        circle(bx, y, 11 * u, { fill: c, opacity: dark ? 0.28 : 0.18 }),
        ellipse(bx, y, 4.5 * u, 6.5 * u, { fill: c, stroke: '#000000', strokeOpacity: 0.3, strokeWidth: 0.6 }),
        rect(bx - 2.5 * u, y - 9.5 * u, 5 * u, 4 * u, { fill: '#4B5563' }),
      ];
    }).flat();
    return lightsCount ? [path(`M${x} ${lightsTop} ${wire}`, { fill: 'none', stroke: '#14532D', strokeWidth: 1.6 }), ...bulbs] : [];
  });
  // A snowy hill along the bottom, fir trees and a snowman on it
  const ground = h - 40 * u;
  const hill = `M0 ${h} L0 ${ground - 14 * u} Q${w * 0.22} ${ground - 40 * u} ${w * 0.45} ${ground - 12 * u} Q${w * 0.7} ${ground + 14 * u} ${w} ${ground - 26 * u} L${w} ${h} Z`;
  const back = `M0 ${h} L0 ${ground - 46 * u} Q${w * 0.3} ${ground - 80 * u} ${w * 0.6} ${ground - 42 * u} Q${w * 0.85} ${ground - 20 * u} ${w} ${ground - 58 * u} L${w} ${h} Z`;
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: dark
        ? [{ offset: 0, color: '#0B1A2E' }, { offset: 0.65, color: '#0E2235' }, { offset: 1, color: '#123024' }]
        : [{ offset: 0, color: '#DBEEFC' }, { offset: 0.65, color: '#EEF6FC' }, { offset: 1, color: '#F8FAFC' }] },
      { id: 'fir', horizontal: true, stops: [{ offset: 0, color: '#14532D' }, { offset: 1, color: '#22C55E' }] },
      { id: 'snow', stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: dark ? '#CBD5E1' : '#DBEAFE' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...flakes,
      ...lights,
      // Far hill with small fir trees, then the near one
      path(back, { fill: dark ? '#9FB3C8' : '#E2E8F0', opacity: dark ? 0.35 : 0.9 }),
      ...[0.12, 0.2, 0.52, 0.66, 0.92].map((f, i) => firTree(w * f, ground - (52 + (i % 2) * 14) * u, (0.32 + (i % 3) * 0.05) * u, false)).flat(),
      path(hill, { fill: 'url(#snow)', stroke: dark ? '#E2E8F0' : '#BFDBFE', strokeWidth: 1.5 }),
      ...firTree(w * 0.1, ground + 8 * u, 0.62 * u, true),
      ...firTree(w * 0.27, ground + 14 * u, 0.45 * u, false),
      ...snowman(w - 64 * u, ground + 22 * u, 0.62 * u),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#14532D', strokeWidth: 10 * u, strokeLinecap: 'round' })),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#16A34A', strokeWidth: 6 * u, strokeDasharray: `${3 * u} ${5 * u}`, strokeLinecap: 'round' })),
      ...swags.map(d => path(d, { fill: 'none', stroke: '#4ADE80', strokeWidth: 2.5 * u, strokeDasharray: `${2 * u} ${9 * u}`, opacity: 0.8 })),
      ...bauble(9 * u, 4 * u, 34 * u, 6 * u, ballColors[0]),
      ...bauble(22 * u, 6 * u, 22 * u, 5 * u, ballColors[1]),
      ...bauble(w - 9 * u, 4 * u, 34 * u, 6 * u, ballColors[2]),
      ...bauble(w - 22 * u, 6 * u, 22 * u, 5 * u, ballColors[4]),
      ...Array.from({ length: count + 1 }, (_, i) => bow(i * swag, 3 * u, 0.6 * u)).flat(),
    ],
  };
}

const BACKDROPS: Record<string, Backdrop> = {
  pumpkin: halloweenBackdrop,
  christmas: christmasBackdrop,
  newyear: newYearBackdrop,
  valentine: valentineBackdrop,
  shamrock: stPatrickBackdrop,
};

/** Board themes with a backdrop */
export const BACKDROP_BOARDS = Object.keys(BACKDROPS);

export const hasBackdrop = (board: string) => Object.hasOwn(BACKDROPS, board);

const cache = new Map<string, ArtDrawing>();

/** The backdrop of a board theme for an area of width × height, if it has one (the same object for the same size) */
export function boardBackdrop(board: string, scheme: ColorScheme, width: number, height: number, options: BackdropOptions = {}): ArtDrawing | undefined {
  const draw = BACKDROPS[board];
  if (!draw || width <= 0 || height <= 0) return undefined;
  const w = Math.round(width);
  const h = Math.round(height);
  const key = `${board}:${scheme}:${w}x${h}:${options.noSky ? 'clear' : 'sky'}`;
  let drawing = cache.get(key);
  if (!drawing) {
    // A few sizes at most (rotation, split screen): keep the cache small anyway
    if (cache.size > 24) cache.clear();
    drawing = draw(scheme, w, h, options);
    cache.set(key, drawing);
  }
  return drawing;
}
