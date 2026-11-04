import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, light, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Wood board: the planks of a workbench and their grain, a folding rule down the left edge, wood
 * shavings on the right one, and the tools at the bottom (hammer, set square, carpenter's pencil, nails).
 * In dark mode, a walnut bench in the evening under the halo of a lamp.
 */

/** A curl of wood shaving */
function shaving(x: number, y: number, k: number, color: string): ArtShape[] {
  return [
    path(`M${x} ${y} c${8 * k} ${-10 * k} ${20 * k} ${-4 * k} ${16 * k} ${6 * k} c${-4 * k} ${8 * k} ${-14 * k} ${4 * k} ${-10 * k} ${-3 * k}`
      + ` c${3 * k} ${-4 * k} ${8 * k} ${-2 * k} ${7 * k} ${2 * k}`, { fill: 'none', stroke: color, strokeWidth: 3 * k, strokeLinecap: 'round' }),
    path(`M${x} ${y} c${8 * k} ${-10 * k} ${20 * k} ${-4 * k} ${16 * k} ${6 * k}`, { fill: 'none', stroke: light(color, 0.4), strokeWidth: 1 * k, strokeLinecap: 'round' }),
  ];
}

/** A nail lying on the bench */
function nail(x: number, y: number, k: number, deg: number): ArtShape[] {
  const t = { transform: `rotate(${deg} ${x} ${y})` };
  return [
    rect(x - 12 * k, y - 1.2 * k, 24 * k, 2.4 * k, { fill: '#9CA3AF', stroke: '#4B5563', strokeWidth: 0.5, ...t }),
    path(`M${x + 12 * k} ${y - 1.2 * k} L${x + 16 * k} ${y} L${x + 12 * k} ${y + 1.2 * k} Z`, { fill: '#6B7280', ...t }),
    rect(x - 14 * k, y - 4 * k, 2.5 * k, 8 * k, { rx: 0.8 * k, fill: '#D1D5DB', stroke: '#4B5563', strokeWidth: 0.5, ...t }),
  ];
}

export function woodBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(77);
  const base = darkScheme ? '#4A3322' : '#E2C08F';
  const seam = darkScheme ? '#1F140B' : '#A8784A';
  const grain = darkScheme ? '#2A1C10' : '#B4844F';
  // The planks, each a little lighter or darker, their grain and a few knots
  const plank = 44 * u;
  const planks: ArtShape[] = [];
  for (let y = 0, i = 0; y < h; y += plank, i++) {
    planks.push(rect(0, y, w, plank, { fill: (rand() < 0.5 ? dark : light)(base, rand() * 0.08) }));
    for (let g = 0; g < 4; g++) {
      const gy = y + (8 + g * 9 + rand() * 4) * u;
      const wave = (2 + rand() * 3) * u;
      planks.push(path(`M0 ${gy} Q${w * 0.25} ${gy - wave} ${w * 0.5} ${gy} T${w} ${gy}`, { fill: 'none', stroke: grain, strokeWidth: 0.8, opacity: darkScheme ? 0.5 : 0.35 }));
    }
    if (y > CALM_TOP * u && rand() < 0.6) {
      const kx = rand() * w;
      const ky = y + plank / 2;
      planks.push(ellipse(kx, ky, 9 * u, 4 * u, { fill: 'none', stroke: grain, strokeWidth: 1, opacity: 0.55 }));
      planks.push(ellipse(kx, ky, 4 * u, 1.8 * u, { fill: dark(base, 0.25), opacity: 0.6 }));
    }
    planks.push(line(0, y, w, y, { stroke: seam, strokeWidth: 1.2, opacity: 0.6 }));
  }
  // The folding rule down the left edge, its yellow segments and marks
  const ruleTop = h * 0.3;
  const segment = 46 * u;
  const rule = Array.from({ length: Math.ceil((h * 0.42) / segment) }, (_, i) => {
    const y = ruleTop + i * segment;
    return [
      rect(3 * u, y, 12 * u, segment - 1, { fill: '#FACC15', stroke: '#A16207', strokeWidth: 0.6 }),
      ...Array.from({ length: 9 }, (_, j) => line(3 * u, y + (j + 0.5) * segment / 9, (j % 5 === 4 ? 10 : 7) * u, y + (j + 0.5) * segment / 9, { stroke: '#1C1917', strokeWidth: 0.6 })),
      circle(9 * u, y + segment - 1, 1.6 * u, { fill: '#A8A29E', stroke: '#57534E', strokeWidth: 0.5 }),
    ];
  }).flat();
  const shavingColor = darkScheme ? '#C8935A' : '#F3D9B1';
  const bottom = h - 12 * u;
  const hammer = { transform: `rotate(-24 ${w * 0.2} ${bottom - 30 * u})` };
  const square = { transform: `rotate(8 ${w - 70 * u} ${bottom - 30 * u})` };
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'lamp', radial: true, stops: [{ offset: 0, color: '#FDE68A', opacity: darkScheme ? 0.22 : 0 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
      { id: 'steel', stops: [{ offset: 0, color: '#E5E7EB' }, { offset: 1, color: '#6B7280' }] },
      { id: 'handle', horizontal: true, stops: [{ offset: 0, color: '#92400E' }, { offset: 1, color: '#B45309' }] },
    ],
    shapes: [
      ...(noSky ? [] : planks),
      ...(darkScheme ? [circle(w * 0.5, h - 30 * u, 240 * u, { fill: 'url(#lamp)' })] : []),
      ...rule,
      // Shavings on the right edge and under the texts
      ...shaving(w - 18 * u, h * 0.4, 1 * u, shavingColor),
      ...shaving(w - 14 * u, h * 0.48, 0.8 * u, shavingColor),
      ...shaving(w - 20 * u, h * 0.62, 0.9 * u, shavingColor),
      ...shaving(w * 0.78, (CALM_TOP + 36) * u, 0.8 * u, shavingColor),
      // The hammer
      rect(w * 0.08, bottom - 34 * u, 86 * u, 9 * u, { rx: 3 * u, fill: 'url(#handle)', stroke: '#78350F', strokeWidth: 0.8, ...hammer }),
      rect(w * 0.08 + 84 * u, bottom - 46 * u, 14 * u, 34 * u, { rx: 2 * u, fill: 'url(#steel)', stroke: '#374151', strokeWidth: 0.8, ...hammer }),
      path(`M${w * 0.08 + 98 * u} ${bottom - 44 * u} q${10 * u} ${4 * u} ${12 * u} ${12 * u} l${-12 * u} ${-2 * u} Z`, { fill: '#6B7280', ...hammer }),
      // The set square
      path(`M${w - 112 * u} ${bottom} L${w - 112 * u} ${bottom - 70 * u} L${w - 30 * u} ${bottom} Z`,
        { fill: '#FDE047', fillOpacity: 0.75, stroke: '#A16207', strokeWidth: 1, ...square }),
      path(`M${w - 100 * u} ${bottom - 10 * u} L${w - 100 * u} ${bottom - 42 * u} L${w - 64 * u} ${bottom - 10 * u} Z`,
        { fill: darkScheme ? '#4A3322' : '#E2C08F', stroke: '#A16207', strokeWidth: 0.8, ...square }),
      ...Array.from({ length: 12 }, (_, i) => line(w - 112 * u, bottom - (i + 1) * 5.5 * u, w - (i % 2 ? 108 : 105) * u, bottom - (i + 1) * 5.5 * u, { stroke: '#1C1917', strokeWidth: 0.6, ...square })),
      // The carpenter's pencil
      rect(w * 0.42, bottom - 14 * u, 70 * u, 9 * u, { rx: 1 * u, fill: '#DC2626', stroke: '#7F1D1D', strokeWidth: 0.6 }),
      path(`M${w * 0.42 + 70 * u} ${bottom - 14 * u} L${w * 0.42 + 82 * u} ${bottom - 11 * u} L${w * 0.42 + 82 * u} ${bottom - 8 * u} L${w * 0.42 + 70 * u} ${bottom - 5 * u} Z`, { fill: '#F5D0A9', stroke: '#B45309', strokeWidth: 0.6 }),
      rect(w * 0.42 + 80 * u, bottom - 11 * u, 3 * u, 3 * u, { fill: '#374151' }),
      // Nails
      ...nail(w * 0.5, bottom - 34 * u, u, 20),
      ...nail(w * 0.58, bottom - 40 * u, u, -35),
      ...nail(w * 0.36, bottom - 4 * u, u, 70),
      ...shaving(w * 0.62, bottom - 2 * u, 1.1 * u, shavingColor),
    ],
  };
}
