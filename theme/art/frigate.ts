import { type ArtDrawing, type ArtShape, circle, line, path, rect } from './art';

/**
 * The frigate of the Broadside win effect (Anno 1800 style), side view, sailing right with the wind behind:
 * three masts under square sails, a row of gunports, and the sea it sails on.
 * Points are in units of the drawing (FRIGATE.width × FRIGATE.height).
 */

const WOOD = '#3B2412';
const ROPE = '#4A3520';
const SAIL_EDGE = '#9C927B';

/** A square sail bellied by the wind, its yard on top */
function sail(x: number, top: number, width: number, height: number): ArtShape[] {
  const l = x - width / 2;
  const r = x + width / 2;
  return [
    path(`M${l} ${top} L${r} ${top} Q${r + 7} ${top + height / 2} ${r} ${top + height} L${l} ${top + height} Q${l + 7} ${top + height / 2} ${l} ${top} Z`,
      { fill: 'url(#sail)', stroke: SAIL_EDGE, strokeWidth: 0.8 }),
    line(l - 3, top, r + 3, top, { stroke: WOOD, strokeWidth: 2 }),
  ];
}

/** A mast at x, from the deck up to `top`, with its sails and a pennant */
function mast(x: number, top: number, width: number, flag: string): ArtShape[] {
  const tiers = [[top + 10, 22], [top + 34, 26], [top + 62, 30]];
  return [
    line(x, 118, x, top, { stroke: WOOD, strokeWidth: 3.5 }),
    ...tiers.flatMap(([y, h], i) => sail(x, y, width - (2 - i) * 8, h)),
    path(`M${x} ${top} L${x + 16} ${top + 3} L${x} ${top + 6} Z`, { fill: flag }),
  ];
}

/** Centers of the gunports along the hull, stern to bow, and their height */
export const GUNPORT_X = [44, 66, 88, 110, 132, 154, 176, 198];
export const GUNPORT_Y = 126.5;
/** Height of the waterline in the drawing */
export const FRIGATE_WATERLINE = 148;

export const FRIGATE: ArtDrawing = {
  width: 240,
  height: 180,
  gradients: [
    { id: 'hull', stops: [{ offset: 0, color: '#6B4423' }, { offset: 0.5, color: '#4A2E17' }, { offset: 1, color: '#24150A' }] },
    { id: 'sail', horizontal: true, stops: [{ offset: 0, color: '#D9CFB6' }, { offset: 0.65, color: '#FBF7EC' }, { offset: 1, color: '#E6DDC7' }] },
  ],
  shapes: [
    // Rigging and bowsprit, behind the sails
    line(210, 114, 238, 96, { stroke: WOOD, strokeWidth: 3 }),
    line(236, 97, 180, 12, { stroke: ROPE, strokeWidth: 0.8 }),
    line(180, 12, 125, 4, { stroke: ROPE, strokeWidth: 0.8 }),
    line(125, 4, 70, 16, { stroke: ROPE, strokeWidth: 0.8 }),
    line(70, 16, 22, 100, { stroke: ROPE, strokeWidth: 0.8 }),
    path('M184 30 L232 98 L190 92 Z', { fill: 'url(#sail)', stroke: SAIL_EDGE, strokeWidth: 0.8 }),
    ...mast(70, 16, 50, '#1D4ED8'),
    ...mast(125, 4, 58, '#B91C1C'),
    ...mast(180, 12, 50, '#1D4ED8'),
    // Hull with the raised stern, the ochre gun deck and its gunports
    path('M8 98 L52 100 L52 118 L8 118 Z', { fill: 'url(#hull)', stroke: '#1A0F06', strokeWidth: 1 }),
    path('M8 116 L232 110 Q228 138 206 152 L40 152 Q16 144 8 116 Z', { fill: 'url(#hull)', stroke: '#1A0F06', strokeWidth: 1 }),
    rect(24, 121, 192, 11, { fill: '#C99A2E' }),
    ...GUNPORT_X.map(x => rect(x - 4, 123.5, 8, 6, { fill: '#0B0705' })),
    rect(12, 104, 4, 6, { fill: '#FDE68A' }),
    rect(22, 104, 4, 6, { fill: '#FDE68A' }),
    line(10, 116, 230, 110, { stroke: '#8B5A2B', strokeWidth: 1.2 }),
    circle(226, 114, 3, { fill: '#C99A2E' }),
  ],
};

/** The sea, drawn as rolling waves with foam on the crests; `front` is the lighter row passing in front of the hull */
export function waves(front: boolean): ArtDrawing {
  const crest = Array.from({ length: 8 }, (_, i) => `Q${i * 50 + 25} ${front ? 4 : 0} ${i * 50 + 50} 14`).join(' ');
  return {
    width: 400,
    height: 60,
    gradients: [{ id: 'sea', stops: front
      ? [{ offset: 0, color: '#2B83B5' }, { offset: 1, color: '#0E3B5C' }]
      : [{ offset: 0, color: '#1D6A96' }, { offset: 1, color: '#0B2F4A' }] }],
    shapes: [
      path(`M0 14 ${crest} L400 60 L0 60 Z`, { fill: 'url(#sea)' }),
      path(`M0 14 ${crest}`, { fill: 'none', stroke: '#FFFFFF', strokeWidth: 2.5, opacity: front ? 0.8 : 0.45 }),
    ],
  };
}

/** Smoke of the cannons, a cannonball, the flash at a gunport and the burst where a ball lands */
export const BROADSIDE_COLORS = {
  smoke: '#E5E7EB',
  ball: '#1A1A1A',
  ballEdge: '#6B6B6B',
  flash: '#FFB020',
  flashCore: '#FFF3C4',
  burst: '#F97316',
};
