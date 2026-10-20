import { type ArtDrawing, circle, line, path, rect } from './art';

/**
 * The Thompson with its drum magazine (the "Tommy gun" of the 1930s gangsters), side view, firing to the right:
 * the Tommy gun win effect. Points of the drawing are in its own units (TOMMY_GUN.width × TOMMY_GUN.height).
 */

const WOOD = '#3B2412';

export const TOMMY_GUN: ArtDrawing = {
  width: 200,
  height: 70,
  gradients: [
    { id: 'wood', stops: [{ offset: 0, color: '#A0652F' }, { offset: 0.5, color: '#7C4A1E' }, { offset: 1, color: '#4E2D10' }] },
    { id: 'steel', stops: [{ offset: 0, color: '#6B6B6B' }, { offset: 0.45, color: '#2E2E2E' }, { offset: 1, color: '#111111' }] },
    { id: 'drum', stops: [{ offset: 0, color: '#4A4A4A' }, { offset: 0.5, color: '#242424' }, { offset: 1, color: '#0D0D0D' }] },
  ],
  shapes: [
    // Stock and butt plate
    path('M3 30 L46 23 L46 40 L10 54 Q3 57 3 49 Z', { fill: 'url(#wood)', stroke: WOOD, strokeWidth: 1 }),
    rect(0, 29, 4, 26, { rx: 1, fill: '#1F1F1F' }),
    // Barrel with its cooling fins, compensator and front sight
    rect(110, 21, 72, 9, { fill: 'url(#steel)' }),
    ...[112, 116, 120, 124, 128, 132, 136, 140, 144, 148, 152].map(x => rect(x, 18, 2, 15, { fill: '#4B4B4B' })),
    rect(180, 19, 16, 13, { rx: 2, fill: 'url(#steel)' }),
    ...[184, 188, 192].map(x => line(x, 20, x, 24, { stroke: '#0A0A0A', strokeWidth: 1.2 })),
    rect(189, 15, 3, 4, { fill: '#1F1F1F' }),
    // Receiver, rear sight, charging knob and ejection port
    rect(44, 17, 68, 17, { rx: 3, fill: 'url(#steel)', stroke: '#0A0A0A', strokeWidth: 1 }),
    rect(50, 13, 6, 5, { fill: '#1F1F1F' }),
    circle(80, 15, 3, { fill: '#5A5A5A' }),
    rect(64, 19, 14, 4, { rx: 1, fill: '#050505' }),
    // Pistol grip, trigger guard, front grip
    path('M64 33 L80 33 L75 60 Q73 63 69 62 L60 60 Z', { fill: 'url(#wood)', stroke: WOOD, strokeWidth: 1 }),
    path('M80 34 Q83 44 92 42 L92 34', { fill: 'none', stroke: '#1F1F1F', strokeWidth: 2 }),
    path('M124 30 L138 30 L136 54 Q131 60 125 55 Z', { fill: 'url(#wood)', stroke: WOOD, strokeWidth: 1 }),
    // The drum magazine
    circle(99, 46, 18, { fill: '#000000', opacity: 0.3 }),
    circle(97, 44, 18, { fill: 'url(#drum)', stroke: '#050505', strokeWidth: 1.5 }),
    circle(97, 44, 13, { fill: 'none', stroke: '#5A5A5A', strokeWidth: 1.2 }),
    circle(97, 44, 5, { fill: '#6B6B6B' }),
    rect(95.5, 37, 3, 14, { rx: 1, fill: '#8A8A8A' }),
    path('M86 32 A14 14 0 0 1 104 30', { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.5, opacity: 0.25 }),
  ],
};

/** Tracers and empty cases, drawn as plain views */
export const TOMMY_COLORS = {
  tracer: '#FFE082',
  tracerGlow: '#FFB300',
  brass: '#D4A017',
  brassEdge: '#8A6A0A',
};

/** Where the bullets leave and where the empty cases are thrown, in units of the drawing */
export const TOMMY_MUZZLE = { x: 196, y: 25.5 };
export const TOMMY_EJECTION = { x: 71, y: 19 };

/** Flash at the muzzle, pointing right from its left middle */
export const MUZZLE_FLASH: ArtDrawing = {
  width: 40,
  height: 30,
  gradients: [],
  shapes: [
    path('M0 15 L12 2 L13 11 L40 15 L13 19 L12 28 Z', { fill: '#FF8C00', opacity: 0.85 }),
    path('M0 15 L10 8 L12 13 L30 15 L12 17 L10 22 Z', { fill: '#FFD54A' }),
    circle(4, 15, 4, { fill: '#FFF8E1' }),
  ],
};

/** A bullet hole in the board */
export const BULLET_HOLE: ArtDrawing = {
  width: 20,
  height: 20,
  gradients: [],
  shapes: [
    circle(10, 10, 8.5, { fill: '#000000', opacity: 0.25 }),
    ...[[10, 1], [18, 7], [15, 18], [3, 15], [2, 5]].map(([x, y]) => line(10, 10, x, y, { stroke: '#D1D5DB', strokeWidth: 0.8, opacity: 0.6 })),
    circle(10, 10, 4, { fill: '#0B0B0B', stroke: '#6B7280', strokeWidth: 1 }),
  ],
};
