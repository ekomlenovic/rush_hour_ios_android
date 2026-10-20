import { type ArtDrawing, type ArtShape, circle, ellipse, path } from './art';

/**
 * Drawings of the Bats win effect (Halloween): a jack-o'-lantern and the bats flying out of it,
 * seen from the front. Points are in units of each drawing (width × height).
 */

const BAT_GRADIENTS: ArtDrawing['gradients'] = [
  { id: 'wing', stops: [{ offset: 0, color: '#5B4A78' }, { offset: 1, color: '#221A31' }] },
  { id: 'body', stops: [{ offset: 0, color: '#46375C' }, { offset: 1, color: '#161020' }] },
];

/** A light edge, so the bats show on a dark board too */
const WING = { fill: 'url(#wing)', stroke: '#A891CC', strokeWidth: 1.2 };

/** Body, head, ears and glowing eyes, the same for both wing beats */
const BAT_BODY: ArtShape[] = [
  ellipse(60, 32, 7, 11, { fill: 'url(#body)' }),
  path('M54.5 17 L53 7 L58.5 14 Z', { fill: 'url(#body)' }),
  path('M65.5 17 L67 7 L61.5 14 Z', { fill: 'url(#body)' }),
  circle(60, 20, 6.5, { fill: 'url(#body)' }),
  circle(57.5, 19.5, 1.5, { fill: '#FDE047' }),
  circle(62.5, 19.5, 1.5, { fill: '#FDE047' }),
];

/** Wings raised, their scalloped edge toward the body */
export const BAT_UP: ArtDrawing = {
  width: 120,
  height: 60,
  gradients: BAT_GRADIENTS,
  shapes: [
    path('M64 26 Q86 6 116 6 Q108 14 106 24 Q98 20 92 28 Q84 25 78 34 Q71 31 64 36 Z', WING),
    path('M56 26 Q34 6 4 6 Q12 14 14 24 Q22 20 28 28 Q36 25 42 34 Q49 31 56 36 Z', WING),
    ...BAT_BODY,
  ],
};

/** Wings lowered: switching with BAT_UP makes it flap */
export const BAT_DOWN: ArtDrawing = {
  width: 120,
  height: 60,
  gradients: BAT_GRADIENTS,
  shapes: [
    path('M64 26 Q90 26 114 46 Q104 42 100 50 Q94 42 86 46 Q80 38 72 42 Q68 36 64 36 Z', WING),
    path('M56 26 Q30 26 6 46 Q16 42 20 50 Q26 42 34 46 Q40 38 48 42 Q52 36 56 36 Z', WING),
    ...BAT_BODY,
  ],
};

/** The jack-o'-lantern, lit from inside */
export const JACK_O_LANTERN: ArtDrawing = {
  width: 100,
  height: 92,
  gradients: [
    { id: 'body', radial: true, stops: [{ offset: 0, color: '#FDBA74' }, { offset: 0.6, color: '#F97316' }, { offset: 1, color: '#C2410C' }] },
    { id: 'side', radial: true, stops: [{ offset: 0, color: '#FB923C' }, { offset: 1, color: '#9A3412' }] },
    { id: 'flame', radial: true, stops: [{ offset: 0, color: '#FEF9C3' }, { offset: 1, color: '#F59E0B' }] },
  ],
  shapes: [
    // Stem and its curl
    path('M46 22 Q45 10 51 4 L57 7 Q52 12 54 22 Z', { fill: '#4D7C0F', stroke: '#365314', strokeWidth: 1 }),
    path('M54 13 Q64 4 70 11', { fill: 'none', stroke: '#65A30D', strokeWidth: 2 }),
    // Ribs, the middle one in front
    ellipse(28, 57, 24, 32, { fill: 'url(#side)', stroke: '#9A3412', strokeWidth: 1 }),
    ellipse(72, 57, 24, 32, { fill: 'url(#side)', stroke: '#9A3412', strokeWidth: 1 }),
    ellipse(50, 57, 26, 34, { fill: 'url(#body)', stroke: '#9A3412', strokeWidth: 1 }),
    path('M38 33 Q44 26 52 26', { fill: 'none', stroke: '#FED7AA', strokeWidth: 2, opacity: 0.6 }),
    // The carved face
    path('M29 49 L40 40 L42 53 Z', { fill: 'url(#flame)' }),
    path('M71 49 L60 40 L58 53 Z', { fill: 'url(#flame)' }),
    path('M47 59 L50 53 L53 59 Z', { fill: 'url(#flame)' }),
    path('M26 64 L33 67 L36 61 L42 68 L50 62 L58 68 L64 61 L67 67 L74 64 Q50 87 26 64 Z', { fill: 'url(#flame)' }),
  ],
};

/** Where the bats fly out (the mouth), in units of JACK_O_LANTERN */
export const LANTERN_MOUTH = { x: 50, y: 70 };

/** Light around the lantern, flickering like a candle */
export const LANTERN_GLOW: ArtDrawing = {
  width: 100,
  height: 100,
  gradients: [
    { id: 'glow', radial: true, stops: [{ offset: 0, color: '#FDE047', opacity: 0.55 }, { offset: 0.5, color: '#F97316', opacity: 0.25 }, { offset: 1, color: '#F97316', opacity: 0 }] },
  ],
  shapes: [circle(50, 50, 50, { fill: 'url(#glow)' })],
};
