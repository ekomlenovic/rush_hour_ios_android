import { type ArtDrawing, circle, dark, light, path, rect } from './art';

/**
 * Drawings of the Gift shower win effect (Christmas): wrapped presents tied with a bow, seen from the front.
 * Points are in units of the drawing (100 × 100).
 */

/** Wrapping and ribbon of each present, in turn */
export const GIFT_COLORS: { wrap: string; ribbon: string }[] = [
  { wrap: '#DC2626', ribbon: '#FACC15' },
  { wrap: '#16A34A', ribbon: '#FACC15' },
  { wrap: '#2563EB', ribbon: '#F8FAFC' },
  { wrap: '#9333EA', ribbon: '#FACC15' },
  { wrap: '#F8FAFC', ribbon: '#DC2626' },
  { wrap: '#DB2777', ribbon: '#F8FAFC' },
  { wrap: '#0D9488', ribbon: '#FACC15' },
  { wrap: '#CA8A04', ribbon: '#B91C1C' },
];

/** A present: box, lid, ribbon and a bow on top */
export function giftBox(wrap: string, ribbon: string): ArtDrawing {
  const knot = dark(ribbon, 0.15);
  const edge = dark(ribbon, 0.3);
  return {
    width: 100,
    height: 100,
    gradients: [
      { id: 'box', horizontal: true, stops: [{ offset: 0, color: light(wrap, 0.12) }, { offset: 1, color: dark(wrap, 0.3) }] },
      { id: 'lid', stops: [{ offset: 0, color: light(wrap, 0.25) }, { offset: 1, color: wrap }] },
    ],
    shapes: [
      rect(10, 40, 80, 56, { rx: 3, fill: 'url(#box)', stroke: dark(wrap, 0.4), strokeWidth: 1 }),
      rect(10, 44, 80, 4, { fill: '#000000', opacity: 0.15 }),
      rect(4, 30, 92, 14, { rx: 3, fill: 'url(#lid)', stroke: dark(wrap, 0.4), strokeWidth: 1 }),
      rect(44, 30, 12, 66, { fill: ribbon }),
      rect(46, 30, 3, 66, { fill: light(ribbon, 0.5), opacity: 0.6 }),
      // The bow: two loops and the knot
      path('M50 30 C38 8 16 14 30 28 Q40 32 50 30 Z', { fill: ribbon, stroke: edge, strokeWidth: 1 }),
      path('M50 30 C62 8 84 14 70 28 Q60 32 50 30 Z', { fill: ribbon, stroke: edge, strokeWidth: 1 }),
      circle(50, 29, 5, { fill: knot, stroke: edge, strokeWidth: 1 }),
    ],
  };
}

/** Sparkles thrown when a present lands */
export const GIFT_SPARKLE = '#FDE047';
