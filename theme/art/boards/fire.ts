import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Fire board: a volcano erupting at the bottom, its lava flows and smoke, basalt columns in the
 * corners, a lava lake along the bottom and embers rising in the margins. A hazy warm sky in light mode, the night and
 * the glowing cracks in dark mode.
 */

/** The top of a basalt column: a hexagon, its lit side */
function column(cx: number, cy: number, r: number, rock: string, crack: string | null): ArtShape[] {
  const pts = Array.from({ length: 6 }, (_, i) => `${cx + Math.cos((i * Math.PI) / 3) * r} ${cy + Math.sin((i * Math.PI) / 3) * r * 0.6}`);
  return [
    path(`M${cx - r} ${cy} L${cx - r} ${cy + r * 2} L${cx + r} ${cy + r * 2} L${cx + r} ${cy} Z`, { fill: dark(rock, 0.3) }),
    path(`M${pts.join(' L')} Z`, { fill: rock, stroke: crack ?? dark(rock, 0.4), strokeWidth: crack ? 1.4 : 0.8 }),
  ];
}

export function fireBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const night = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(666);
  const base = h - 30 * u;
  const cx = w / 2;
  const top = base - 120 * u;
  const rock = night ? '#1F1512' : '#57534E';
  const crack = night ? '#FB923C' : null;
  const embers = Array.from({ length: 34 }, () => {
    const side = rand() < 0.5;
    const x = side ? rand() * 22 * u : w - rand() * 22 * u;
    const y = (CALM_TOP + 30) * u + rand() * (h - (CALM_TOP + 30) * u);
    return circle(rand() < 0.15 ? rand() * w : x, y, (1 + rand() * 2) * u, { fill: rand() < 0.5 ? '#FDBA74' : '#F97316', opacity: 0.5 + rand() * 0.5 });
  });
  const smoke = Array.from({ length: 7 }, (_, i) =>
    circle(cx + (i % 2 ? 1 : -1) * i * 5 * u, top - (16 + i * 14) * u, (14 + i * 4) * u, { fill: night ? '#44403C' : '#A8A29E', opacity: 0.55 - i * 0.05 }));
  const flows = [
    `M${cx - 8 * u} ${top + 2 * u} C${cx - 20 * u} ${top + 40 * u} ${cx - 50 * u} ${top + 70 * u} ${cx - 70 * u} ${base}`,
    `M${cx + 6 * u} ${top + 2 * u} C${cx + 14 * u} ${top + 50 * u} ${cx + 40 * u} ${top + 80 * u} ${cx + 52 * u} ${base}`,
    `M${cx} ${top + 4 * u} C${cx - 4 * u} ${top + 50 * u} ${cx + 4 * u} ${top + 90 * u} ${cx - 6 * u} ${base}`,
  ];
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: night
        ? [{ offset: 0, color: '#140402' }, { offset: 0.6, color: '#2A0A02' }, { offset: 1, color: '#5A1405' }]
        : [{ offset: 0, color: '#FFF3EA' }, { offset: 0.6, color: '#FFE2CC' }, { offset: 1, color: '#FDBA8C' }] },
      { id: 'lava', stops: [{ offset: 0, color: '#FDE047' }, { offset: 0.5, color: '#F97316' }, { offset: 1, color: '#DC2626' }] },
      { id: 'glow', radial: true, stops: [{ offset: 0, color: '#F97316', opacity: night ? 0.55 : 0.4 }, { offset: 1, color: '#F97316', opacity: 0 }] },
      { id: 'cone', horizontal: true, stops: [{ offset: 0, color: dark(rock, 0.25) }, { offset: 0.6, color: rock }, { offset: 1, color: dark(rock, 0.35) }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      circle(cx, top, 120 * u, { fill: 'url(#glow)' }),
      ...smoke,
      // The volcano, its crater and lava flows
      path(`M${cx - 150 * u} ${base} L${cx - 22 * u} ${top} L${cx + 22 * u} ${top} L${cx + 150 * u} ${base} Z`, { fill: 'url(#cone)' }),
      path(`M${cx - 22 * u} ${top} Q${cx} ${top + 8 * u} ${cx + 22 * u} ${top} Q${cx} ${top - 5 * u} ${cx - 22 * u} ${top} Z`, { fill: '#FDE047' }),
      ...flows.map(d => path(d, { fill: 'none', stroke: 'url(#lava)', strokeWidth: 6 * u, strokeLinecap: 'round' })),
      ...flows.map(d => path(d, { fill: 'none', stroke: '#FDE047', strokeWidth: 1.6 * u, strokeLinecap: 'round', opacity: 0.8 })),
      // Basalt columns in the corners
      ...[[0.04, 0, 16], [0.13, 10, 14], [0.06, 26, 12], [0.96, 4, 16], [0.87, 16, 13], [0.95, 30, 11]]
        .flatMap(([f, dy, r]) => column(w * f, base - (48 - dy) * u, r * u, rock, crack)),
      // The lava lake along the bottom
      path(`M0 ${base} Q${w * 0.25} ${base - 6 * u} ${w * 0.5} ${base} T${w} ${base} V${h} H0 Z`, { fill: 'url(#lava)' }),
      ...Array.from({ length: 6 }, () => circle(rand() * w, base + (8 + rand() * 16) * u, (2 + rand() * 3) * u, { fill: '#FDE047', opacity: 0.7 })),
      ...embers,
    ],
  };
}
