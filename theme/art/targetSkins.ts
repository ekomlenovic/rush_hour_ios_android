import { type ArtGradient, type ArtShape, type ArtDrawing, circle, ellipse, line, path, rect, dark, light } from './art';

/**
 * Drawings of the target car skins seen from above, in pseudo-3D (shaded body, glass, chrome, shadow):
 * taxi, bus, police car, rocket, sports car, golden car, tractor and flying saucer.
 * Drawn horizontally, the front on the right, in a box of 200 × 100 (the target car is 2 cells long).
 */

const WIDTH = 200;
const HEIGHT = 100;
const TIRE = '#151515';
const HEADLIGHT = '#FFF7D6';
const TAILLIGHT = '#B91C1C';
const WHITE = '#F8FAFC';
const BLACK = '#111111';
const SHADOW = '#000000';

function gradients(color: string): ArtGradient[] {
  return [
    { id: 'body', stops: [
      { offset: 0, color: dark(color, 0.5) }, { offset: 0.2, color }, { offset: 0.47, color: light(color, 0.32) },
      { offset: 0.53, color: light(color, 0.32) }, { offset: 0.8, color }, { offset: 1, color: dark(color, 0.5) },
    ] },
    { id: 'roof', stops: [{ offset: 0, color: dark(color, 0.3) }, { offset: 0.5, color: light(color, 0.2) }, { offset: 1, color: dark(color, 0.3) }] },
    { id: 'glass', stops: [{ offset: 0, color: '#0F172A' }, { offset: 0.5, color: '#4B6B8A' }, { offset: 1, color: '#0F172A' }] },
    { id: 'chrome', stops: [{ offset: 0, color: '#6B7280' }, { offset: 0.5, color: '#F9FAFB' }, { offset: 1, color: '#6B7280' }] },
    { id: 'white', stops: [{ offset: 0, color: '#B8C0CC' }, { offset: 0.5, color: WHITE }, { offset: 1, color: '#B8C0CC' }] },
    { id: 'tire', stops: [{ offset: 0, color: '#050505' }, { offset: 0.5, color: '#3A3A3A' }, { offset: 1, color: '#050505' }] },
    { id: 'disc', radial: true, stops: [{ offset: 0, color: light(color, 0.55) }, { offset: 0.7, color }, { offset: 1, color: dark(color, 0.55) }] },
    { id: 'dome', radial: true, stops: [{ offset: 0, color: '#E0FBFF' }, { offset: 0.6, color: '#38BDF8', opacity: 0.85 }, { offset: 1, color: '#0E4A6E', opacity: 0.9 }] },
    { id: 'flame', horizontal: true, stops: [{ offset: 0, color: '#DC2626', opacity: 0 }, { offset: 0.5, color: '#F97316' }, { offset: 1, color: '#FDE047' }] },
  ];
}

const shadow = (rx = 24): ArtShape => rect(10, 16, 188, 82, { rx, fill: SHADOW, opacity: 0.3 });

/** Tires sticking out of the body at the given centers along the car */
const wheels = (centers: number[], width = 32, thickness = 10): ArtShape[] =>
  centers.flatMap(cx => [
    rect(cx - width / 2, 6, width, thickness, { rx: 4, fill: 'url(#tire)' }),
    rect(cx - width / 2, 94 - thickness, width, thickness, { rx: 4, fill: 'url(#tire)' }),
  ]);

/** A modern car: body, windshield, roof, rear window, mirrors and lights (taxi, police, golden car) */
function car(color: string, roof = 'url(#roof)'): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    shadow(),
    ...wheels([48, 156]),
    path('M24 12 L170 12 Q196 14 197 50 Q196 86 170 88 L24 88 Q4 86 4 50 Q4 14 24 12 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    line(150, 30, 188, 34, { stroke: dark(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    line(150, 70, 188, 66, { stroke: dark(color, 0.35), strokeWidth: 1, opacity: 0.6 }),
    path('M118 18 L142 23 Q149 50 142 77 L118 82 Z', { fill: 'url(#glass)' }),
    rect(52, 18, 68, 64, { rx: 10, fill: roof, stroke: outline, strokeWidth: 1 }),
    path('M38 24 L52 21 L52 79 L38 76 Q33 50 38 24 Z', { fill: 'url(#glass)' }),
    ellipse(124, 9, 6, 3, { fill: 'url(#body)', stroke: outline, strokeWidth: 0.8 }),
    ellipse(124, 91, 6, 3, { fill: 'url(#body)', stroke: outline, strokeWidth: 0.8 }),
    rect(186, 17, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(186, 70, 8, 13, { rx: 3, fill: HEADLIGHT }),
    rect(5, 17, 5, 13, { rx: 2, fill: TAILLIGHT }),
    rect(5, 70, 5, 13, { rx: 2, fill: TAILLIGHT }),
    ellipse(86, 34, 26, 6, { fill: '#FFFFFF', opacity: 0.14 }),
  ];
}

/** Yellow cab: checkered bands along the sides and the lit sign on the roof */
function taxi(color: string): ArtShape[] {
  const checks = [32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152].flatMap((x, i) => [
    rect(x, 13, 8, 4, { fill: i % 2 ? BLACK : WHITE }),
    rect(x, 83, 8, 4, { fill: i % 2 ? WHITE : BLACK }),
  ]);
  return [
    ...car(color),
    ...checks,
    rect(78, 38, 18, 24, { rx: 3, fill: BLACK }),
    rect(80, 40, 14, 20, { rx: 2, fill: HEADLIGHT }),
    line(87, 43, 87, 57, { stroke: BLACK, strokeWidth: 2 }),
  ];
}

/** Police car: white roof, a blue and red light bar, a stripe along the sides */
function police(color: string): ArtShape[] {
  return [
    ...car(color, 'url(#white)'),
    rect(24, 14, 150, 3, { fill: WHITE, opacity: 0.85 }),
    rect(24, 83, 150, 3, { fill: WHITE, opacity: 0.85 }),
    circle(86, 34, 12, { fill: '#3B82F6', opacity: 0.35 }),
    circle(86, 66, 12, { fill: '#EF4444', opacity: 0.35 }),
    rect(80, 24, 12, 52, { rx: 4, fill: '#1F2937' }),
    rect(81.5, 26, 9, 23, { rx: 3, fill: '#2563EB' }),
    rect(81.5, 51, 9, 23, { rx: 3, fill: '#DC2626' }),
    rect(83, 29, 3, 17, { rx: 1.5, fill: '#BFDBFE' }),
    rect(83, 54, 3, 17, { rx: 1.5, fill: '#FECACA' }),
  ];
}

/** Golden car: a long luxury car with chrome trims, a hood ornament and a crown on the roof */
function gold(color: string): ArtShape[] {
  return [
    ...car(color),
    rect(22, 15, 156, 2, { fill: 'url(#chrome)' }),
    rect(22, 83, 156, 2, { fill: 'url(#chrome)' }),
    rect(190, 36, 6, 28, { rx: 2, fill: 'url(#chrome)' }),
    circle(178, 50, 3, { fill: 'url(#chrome)' }),
    path('M72 62 L72 38 L79 46 L86 34 L93 46 L100 38 L100 62 Z', { fill: dark(color, 0.25), stroke: dark(color, 0.6), strokeWidth: 1 }),
    circle(79, 44, 2, { fill: '#DC2626' }),
    circle(86, 40, 2.2, { fill: '#2563EB' }),
    circle(93, 44, 2, { fill: '#16A34A' }),
  ];
}

/** Bus: a long roof with vents, rows of side windows, a wide windshield and mirrors */
function bus(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  const windows = [22, 44, 66, 88, 110, 132, 154].flatMap(x => [
    rect(x, 9, 18, 5, { rx: 1.5, fill: 'url(#glass)' }),
    rect(x, 86, 18, 5, { rx: 1.5, fill: 'url(#glass)' }),
  ]);
  return [
    shadow(14),
    ...wheels([40, 160], 28, 8),
    rect(4, 6, 190, 88, { rx: 12, fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(4, 46, 190, 8, { fill: dark(color, 0.45), opacity: 0.5 }),
    ...windows,
    rect(16, 18, 160, 64, { rx: 8, fill: 'url(#roof)', stroke: outline, strokeWidth: 0.8 }),
    ...[40, 86, 132].map(x => rect(x, 38, 16, 24, { rx: 3, fill: light(color, 0.45), stroke: outline, strokeWidth: 0.8 })),
    path('M180 10 L193 16 Q197 50 193 84 L180 90 Z', { fill: 'url(#glass)' }),
    rect(4, 22, 6, 56, { rx: 2, fill: dark(color, 0.5) }),
    ...[28, 36, 44, 52, 60, 68].map(y => line(5, y, 9, y, { stroke: BLACK, strokeWidth: 1 })),
    ellipse(196, 4, 4, 3, { fill: BLACK }),
    ellipse(196, 96, 4, 3, { fill: BLACK }),
    rect(190, 12, 5, 9, { rx: 2, fill: HEADLIGHT }),
    rect(190, 79, 5, 9, { rx: 2, fill: HEADLIGHT }),
  ];
}

/** Rocket lying on the board: silver body, colored nose cone and fins, a porthole and the flame of the engine */
function rocket(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    ellipse(110, 58, 92, 22, { fill: SHADOW, opacity: 0.3 }),
    path('M34 50 L0 38 Q10 50 0 62 Z', { fill: 'url(#flame)' }),
    path('M34 50 L12 44 Q18 50 12 56 Z', { fill: '#FFF7D6' }),
    path('M40 34 L14 6 L30 6 L72 34 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    path('M40 66 L14 94 L30 94 L72 66 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    path('M32 34 L150 30 Q186 36 198 50 Q186 64 150 70 L32 66 Q26 50 32 34 Z', { fill: 'url(#white)', stroke: '#94A3B8', strokeWidth: 1 }),
    path('M150 30 Q186 36 198 50 Q186 64 150 70 Q156 50 150 30 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(112, 31, 8, 38, { fill: 'url(#body)' }),
    rect(32, 34, 8, 32, { rx: 2, fill: '#64748B' }),
    line(40, 50, 76, 50, { stroke: outline, strokeWidth: 3 }),
    circle(88, 50, 10, { fill: 'url(#chrome)' }),
    circle(88, 50, 7, { fill: 'url(#glass)' }),
    ellipse(130, 40, 40, 4, { fill: '#FFFFFF', opacity: 0.35 }),
  ];
}

/** Sports car: open wheels, front and rear wings, a narrow body with stripes and the driver's helmet */
function sport(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  return [
    ellipse(104, 56, 96, 40, { fill: SHADOW, opacity: 0.28 }),
    rect(22, 2, 38, 22, { rx: 6, fill: 'url(#tire)' }),
    rect(22, 76, 38, 22, { rx: 6, fill: 'url(#tire)' }),
    rect(144, 6, 30, 16, { rx: 5, fill: 'url(#tire)' }),
    rect(144, 78, 30, 16, { rx: 5, fill: 'url(#tire)' }),
    line(56, 20, 70, 34, { stroke: BLACK, strokeWidth: 2.5 }),
    line(56, 80, 70, 66, { stroke: BLACK, strokeWidth: 2.5 }),
    line(158, 22, 150, 40, { stroke: BLACK, strokeWidth: 2.5 }),
    line(158, 78, 150, 60, { stroke: BLACK, strokeWidth: 2.5 }),
    rect(2, 10, 14, 80, { rx: 3, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    path('M12 40 L120 30 Q182 34 194 50 Q182 66 120 70 L12 60 Z', { fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(48, 26, 52, 48, { rx: 12, fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    rect(184, 14, 12, 72, { rx: 3, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    line(112, 46, 192, 48, { stroke: WHITE, strokeWidth: 2.5 }),
    line(112, 54, 192, 52, { stroke: WHITE, strokeWidth: 2.5 }),
    ellipse(104, 50, 17, 11, { fill: BLACK }),
    circle(100, 50, 7, { fill: '#FACC15' }),
    rect(98, 47, 6, 6, { rx: 1, fill: '#1F2937' }),
    circle(66, 50, 9, { fill: WHITE, stroke: outline, strokeWidth: 1 }),
    circle(66, 50, 4, { fill: outline }),
  ];
}

/** Tractor: big rear wheels with treads under their fenders, a long hood, the exhaust stack and the driver's seat */
function tractor(color: string): ArtShape[] {
  const outline = dark(color, 0.6);
  const treads = (y: number) => [26, 32, 38, 44, 50, 56, 62].map(x => line(x, y, x, y + 20, { stroke: '#3A3A3A', strokeWidth: 2 }));
  return [
    shadow(16),
    rect(20, 0, 52, 22, { rx: 6, fill: 'url(#tire)' }), ...treads(1),
    rect(20, 78, 52, 22, { rx: 6, fill: 'url(#tire)' }), ...treads(79),
    rect(148, 8, 34, 13, { rx: 5, fill: 'url(#tire)' }),
    rect(148, 79, 34, 13, { rx: 5, fill: 'url(#tire)' }),
    circle(46, 21, 4, { fill: '#FACC15' }),
    circle(46, 79, 4, { fill: '#FACC15' }),
    circle(165, 20, 3, { fill: '#FACC15' }),
    circle(165, 80, 3, { fill: '#FACC15' }),
    rect(18, 28, 100, 44, { rx: 8, fill: dark(color, 0.35) }),
    rect(14, 16, 64, 12, { rx: 6, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(14, 72, 64, 12, { rx: 6, fill: 'url(#roof)', stroke: outline, strokeWidth: 1 }),
    rect(96, 30, 98, 40, { rx: 10, fill: 'url(#body)', stroke: outline, strokeWidth: 1 }),
    ...[150, 158, 166, 174].map(x => line(x, 34, x, 40, { stroke: outline, strokeWidth: 1.5 })),
    ...[150, 158, 166, 174].map(x => line(x, 60, x, 66, { stroke: outline, strokeWidth: 1.5 })),
    rect(190, 36, 6, 28, { rx: 2, fill: 'url(#chrome)' }),
    circle(186, 34, 4, { fill: HEADLIGHT }),
    circle(186, 66, 4, { fill: HEADLIGHT }),
    rect(36, 38, 20, 24, { rx: 5, fill: BLACK }),
    rect(40, 41, 12, 18, { rx: 4, fill: '#3A3A3A' }),
    circle(76, 50, 8, { fill: 'none', stroke: BLACK, strokeWidth: 2.5 }),
    line(76, 50, 92, 50, { stroke: BLACK, strokeWidth: 2 }),
    circle(124, 40, 5, { fill: 'url(#chrome)' }),
    circle(124, 40, 3, { fill: BLACK }),
    ellipse(140, 42, 34, 4, { fill: '#FFFFFF', opacity: 0.18 }),
  ];
}

/** Flying saucer: a metal disc ringed with lights, a glass dome and its pilot */
function ufo(color: string): ArtShape[] {
  const lights = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return circle(100 + Math.cos(a) * 80, 50 + Math.sin(a) * 37, 3.4, { fill: ['#FDE047', '#22D3EE', '#F472B6'][i % 3] });
  });
  return [
    ellipse(106, 58, 94, 40, { fill: SHADOW, opacity: 0.3 }),
    ellipse(100, 50, 96, 46, { fill: 'url(#disc)', stroke: dark(color, 0.6), strokeWidth: 1 }),
    ellipse(100, 50, 66, 31, { fill: 'none', stroke: dark(color, 0.4), strokeWidth: 1.5 }),
    ...lights,
    ellipse(100, 50, 36, 26, { fill: 'url(#dome)', stroke: '#BAE6FD', strokeWidth: 1 }),
    circle(100, 50, 8, { fill: '#4ADE80' }),
    ellipse(97, 48, 2, 3, { fill: BLACK }),
    ellipse(103, 48, 2, 3, { fill: BLACK }),
    ellipse(92, 40, 12, 5, { fill: '#FFFFFF', opacity: 0.45 }),
  ];
}

const SKIN_SHAPES = { taxi, bus, police, rocket, sport, gold, tractor, ufo };

/** Target car skins with their own drawing */
export type DrawnSkin = keyof typeof SKIN_SHAPES;

export const DRAWN_SKINS = Object.keys(SKIN_SHAPES) as DrawnSkin[];

/** The drawing of a skin of the target car, front on the right */
export function skinDrawing(skin: DrawnSkin, color: string): ArtDrawing {
  return { width: WIDTH, height: HEIGHT, gradients: gradients(color), shapes: SKIN_SHAPES[skin](color) };
}
