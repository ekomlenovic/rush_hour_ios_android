import { type ArtGradient, type ArtShape, type ArtDrawing, circle, ellipse, line, path, rect, dark, light } from './art';

/**
 * Ships of the industrial age (Anno 1800 style) seen from above, in pseudo-3D, afloat on a patch of sea:
 * a schooner under sail for 2 cells, a paddle steamer for 3.
 * Drawn horizontally, the bow on the right, in a box of 100 units per cell.
 */

const CELL = 100;
const DECK = '#B98A55';
const DECK_LINE = '#7A5A2E';
const MAST = '#3B2412';
const ROPE = '#4A3520';
const FOAM = '#FFFFFF';
const SMOKE = '#D1D5DB';

function gradients(color: string): ArtGradient[] {
  return [
    { id: 'hull', stops: [
      { offset: 0, color: dark(color, 0.55) }, { offset: 0.15, color }, { offset: 0.5, color: light(color, 0.2) },
      { offset: 0.85, color }, { offset: 1, color: dark(color, 0.55) },
    ] },
    { id: 'sea', stops: [{ offset: 0, color: '#0E3B5C', opacity: 0 }, { offset: 0.5, color: '#1D6A96', opacity: 0.55 }, { offset: 1, color: '#0E3B5C', opacity: 0 }] },
    { id: 'sail', horizontal: true, stops: [{ offset: 0, color: '#CFC6B0' }, { offset: 0.6, color: '#FBF7EC' }, { offset: 1, color: '#E6DDC7' }] },
    { id: 'brass', stops: [{ offset: 0, color: '#8A6A1F' }, { offset: 0.5, color: '#F2D27A' }, { offset: 1, color: '#8A6A1F' }] },
    { id: 'funnel', stops: [{ offset: 0, color: '#0E0E0E' }, { offset: 0.5, color: '#4A4A4A' }, { offset: 1, color: '#0E0E0E' }] },
    { id: 'cabin', stops: [{ offset: 0, color: '#BDB6A6' }, { offset: 0.5, color: '#F5F1E6' }, { offset: 1, color: '#BDB6A6' }] },
  ];
}

/** The sea around the hull, the wake behind and the foam at the bow */
function water(length: number): ArtShape[] {
  const end = length - 4;
  return [
    ellipse(length / 2, 50, length / 2 - 2, 47, { fill: 'url(#sea)' }),
    path(`M${end - 14} 30 Q${end - 2} 50 ${end - 14} 70`, { fill: 'none', stroke: FOAM, strokeWidth: 2, opacity: 0.6 }),
    path('M14 38 Q4 36 0 30', { fill: 'none', stroke: FOAM, strokeWidth: 1.5, opacity: 0.45 }),
    path('M14 62 Q4 64 0 70', { fill: 'none', stroke: FOAM, strokeWidth: 1.5, opacity: 0.45 }),
  ];
}

/** A pointed hull from x = 10 (stern) to x = bow, with its deck and a pale stripe along the gunwale */
function hull(bow: number, color: string): ArtShape[] {
  const mid = bow * 0.72;
  const outline = `M10 50 Q10 18 40 15 L${mid} 15 Q${bow - 12} 22 ${bow} 50 Q${bow - 12} 78 ${mid} 85 L40 85 Q10 82 10 50 Z`;
  const deck = `M24 50 Q24 29 46 28 L${mid} 28 Q${bow - 28} 33 ${bow - 20} 50 Q${bow - 28} 67 ${mid} 72 L46 72 Q24 71 24 50 Z`;
  return [
    path(outline, { fill: '#000000', opacity: 0.3, transform: 'translate(3 5)' }),
    path(outline, { fill: 'url(#hull)', stroke: dark(color, 0.65), strokeWidth: 1 }),
    path(deck, { fill: 'none', stroke: light(color, 0.6), strokeWidth: 2, opacity: 0.8 }),
    path(deck, { fill: DECK }),
    ...[36, 43, 50, 57, 64].map(y => line(28, y, mid, y, { stroke: DECK_LINE, strokeWidth: 0.8, opacity: 0.5 })),
  ];
}

/** A mast at x with its sail filled by the wind, bellying toward the bow */
function mast(x: number, span: number): ArtShape[] {
  const top = 50 - span / 2;
  const bottom = 50 + span / 2;
  return [
    path(`M${x - 4} ${top} Q${x + 26} 50 ${x - 4} ${bottom} L${x - 12} ${bottom} Q${x + 8} 50 ${x - 12} ${top} Z`, { fill: 'url(#sail)', stroke: '#9C927B', strokeWidth: 0.8 }),
    line(x - 9, top, x - 9, bottom, { stroke: MAST, strokeWidth: 2 }),
    circle(x, 50, 3.2, { fill: MAST }),
  ];
}

/** A schooner (2 cells): two masts under sail, a jib, the bowsprit and the helmsman's cabin */
function schooner(color: string): ArtShape[] {
  return [
    ...water(200),
    line(176, 50, 199, 50, { stroke: MAST, strokeWidth: 2.5 }),
    ...hull(186, color),
    rect(26, 38, 22, 24, { rx: 4, fill: 'url(#hull)', stroke: DECK_LINE, strokeWidth: 1 }),
    circle(52, 50, 4, { fill: 'none', stroke: MAST, strokeWidth: 1.6 }),
    line(58, 22, 170, 50, { stroke: ROPE, strokeWidth: 0.7, opacity: 0.7 }),
    line(58, 78, 170, 50, { stroke: ROPE, strokeWidth: 0.7, opacity: 0.7 }),
    path('M150 50 L184 50 L164 34 Z', { fill: 'url(#sail)', stroke: '#9C927B', strokeWidth: 0.8 }),
    ...mast(78, 74),
    ...mast(130, 64),
  ];
}

/** A paddle wheel box on one side, at x, with its blades */
function paddleBox(x: number, side: 'top' | 'bottom'): ArtShape[] {
  const y = side === 'top' ? 3 : 81;
  return [
    rect(x - 22, y, 44, 16, { rx: 8, fill: 'url(#funnel)', stroke: '#000000', strokeWidth: 1 }),
    ...[-14, -7, 0, 7, 14].map(dx => line(x + dx, y + 2, x + dx, y + 14, { stroke: '#8A6A1F', strokeWidth: 1.4 })),
  ];
}

/** A funnel with a colored band, seen from above, and its smoke blown back */
function funnel(x: number, color: string, puffs: boolean): ArtShape[] {
  return [
    ...(puffs ? [
      circle(x - 18, 47, 9, { fill: SMOKE, opacity: 0.55 }),
      circle(x - 36, 53, 12, { fill: SMOKE, opacity: 0.38 }),
      circle(x - 58, 47, 14, { fill: SMOKE, opacity: 0.22 }),
    ] : []),
    circle(x, 50, 10, { fill: 'url(#funnel)' }),
    circle(x, 50, 10, { fill: 'none', stroke: color, strokeWidth: 3 }),
    circle(x, 50, 5.5, { fill: '#050505' }),
  ];
}

/** A paddle steamer (3 cells): paddle wheels on the sides, two funnels, deckhouses, lifeboats and a foremast */
function paddleSteamer(color: string): ArtShape[] {
  const band = light(color, 0.35);
  return [
    ...water(300),
    line(270, 50, 299, 50, { stroke: MAST, strokeWidth: 2.5 }),
    ...hull(284, color),
    ...paddleBox(150, 'top'), ...paddleBox(150, 'bottom'),
    rect(32, 34, 48, 32, { rx: 5, fill: 'url(#hull)', stroke: DECK_LINE, strokeWidth: 1 }),
    rect(100, 30, 96, 40, { rx: 5, fill: 'url(#cabin)', stroke: DECK_LINE, strokeWidth: 1 }),
    ...[110, 122, 134, 166, 178].map(x => rect(x, 33, 6, 4, { fill: '#5B6B7A' })),
    ...[110, 122, 134, 166, 178].map(x => rect(x, 63, 6, 4, { fill: '#5B6B7A' })),
    ellipse(56, 26, 16, 4.5, { fill: '#F5F1E6', stroke: DECK_LINE, strokeWidth: 0.8 }),
    ellipse(56, 74, 16, 4.5, { fill: '#F5F1E6', stroke: DECK_LINE, strokeWidth: 0.8 }),
    ...funnel(168, band, false),
    ...funnel(132, band, true),
    circle(210, 50, 3, { fill: 'url(#brass)' }),
    path('M236 50 L272 50 L252 36 Z', { fill: 'url(#sail)', stroke: '#9C927B', strokeWidth: 0.8 }),
    ...mast(226, 56),
  ];
}

/** The drawing of a ship of `length` cells (a schooner for 2, a paddle steamer for 3), bow on the right */
export function annoShip(length: number, color: string): ArtDrawing {
  const isSteamer = length >= 3;
  return {
    width: (isSteamer ? 3 : 2) * CELL,
    height: CELL,
    gradients: gradients(color),
    shapes: isSteamer ? paddleSteamer(color) : schooner(color),
  };
}
