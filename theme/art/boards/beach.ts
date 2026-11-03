import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Beach board, seen from above: the sand, footprints under the texts, starfish and shells in the
 * margins, parasols and beach towels at the bottom, the sea and its foam along the bottom edge. A sunny day in light
 * mode, the sunset and its orange gleams on the sea in dark mode.
 */

/** A parasol seen from above: alternating wedges */
function parasol(cx: number, cy: number, r: number, colors: [string, string]): ArtShape[] {
  const wedges = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    const b = ((i + 1) / 8) * Math.PI * 2;
    return path(`M${cx} ${cy} L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} L${cx + Math.cos(b) * r} ${cy + Math.sin(b) * r} Z`,
      { fill: colors[i % 2], stroke: dark(colors[i % 2], 0.25), strokeWidth: 0.6, strokeLinejoin: 'round' });
  });
  return [ellipse(cx + r * 0.3, cy + r * 0.35, r, r * 0.85, { fill: '#000000', opacity: 0.15 }), ...wedges, circle(cx, cy, r * 0.1, { fill: '#F8FAFC' })];
}

/** A striped beach towel lying flat */
function towel(x: number, y: number, tw: number, th: number, deg: number, colors: string[]): ArtShape[] {
  const t = { transform: `rotate(${deg} ${x + tw / 2} ${y + th / 2})` };
  const stripe = th / colors.length;
  return [
    rect(x + 2, y + 3, tw, th, { rx: 2, fill: '#000000', opacity: 0.12, ...t }),
    ...colors.map((c, i) => rect(x, y + i * stripe, tw, stripe + 0.3, { fill: c, ...t })),
  ];
}

/** A five-arm starfish */
function starfish(cx: number, cy: number, r: number, color: string, deg: number): ArtShape[] {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const d = i % 2 ? r * 0.42 : r;
    return `${cx + Math.cos(a) * d} ${cy + Math.sin(a) * d}`;
  });
  const t = { transform: `rotate(${deg} ${cx} ${cy})` };
  return [
    path(`M${pts.join(' L')} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8, strokeLinejoin: 'round', ...t }),
    ...[0, 1, 2, 3, 4].map(i => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return circle(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.07, { fill: '#FFF7ED', opacity: 0.8, ...t });
    }),
  ];
}

/** A scallop shell, its ribs fanning out */
function shell(cx: number, cy: number, r: number, color: string): ArtShape[] {
  return [
    path(`M${cx} ${cy + r * 0.6} L${cx - r} ${cy - r * 0.2} Q${cx} ${cy - r * 1.3} ${cx + r} ${cy - r * 0.2} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.7 }),
    ...[-0.6, -0.2, 0.2, 0.6].map(f => path(`M${cx} ${cy + r * 0.6} L${cx + f * r} ${cy - r * 0.6}`, { stroke: dark(color, 0.25), strokeWidth: 0.6 })),
  ];
}

export function beachBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const sunset = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(2024);
  const tone = (c: string) => (sunset ? dark(c, 0.3) : c);
  const shore = h - 58 * u;
  const grains = Array.from({ length: 120 }, () =>
    circle(rand() * w, rand() * shore, (0.5 + rand() * 0.8) * u, { fill: sunset ? '#000000' : '#B45309', opacity: sunset ? 0.18 : 0.12 }));
  // Footprints walking down from under the texts
  const steps = Array.from({ length: 7 }, (_, i) => {
    const x = w * 0.08 + i * 26 * u;
    const y = (CALM_TOP + 30) * u + i * 6 * u + (i % 2 ? 7 * u : 0);
    return ellipse(x, y, 5 * u, 2.6 * u, { fill: sunset ? '#000000' : '#B45309', opacity: sunset ? 0.25 : 0.18, transform: `rotate(12 ${x} ${y})` });
  });
  const foam = `M0 ${shore} Q${w * 0.125} ${shore - 8 * u} ${w * 0.25} ${shore} T${w * 0.5} ${shore} T${w * 0.75} ${shore} T${w} ${shore}`;
  const gleams = sunset
    ? Array.from({ length: 12 }, () => {
      const y = shore + (12 + rand() * 40) * u;
      const x = w * 0.5 + (rand() - 0.5) * w * 0.7;
      return rect(x, y, (10 + rand() * 24) * u, 2 * u, { rx: 1 * u, fill: '#FDBA74', opacity: 0.6 });
    })
    : Array.from({ length: 10 }, () => rect(rand() * w, shore + (12 + rand() * 40) * u, (8 + rand() * 14) * u, 1.6 * u, { rx: 1 * u, fill: '#FFFFFF', opacity: 0.5 }));
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: sunset
        ? [{ offset: 0, color: '#2A2218' }, { offset: 1, color: '#3E3220' }]
        : [{ offset: 0, color: '#FBEFD2' }, { offset: 1, color: '#F1D9A4' }] },
      { id: 'sea', stops: sunset
        ? [{ offset: 0, color: '#155E75' }, { offset: 1, color: '#0B2F3E' }]
        : [{ offset: 0, color: '#5EEAD4' }, { offset: 0.35, color: '#22D3EE' }, { offset: 1, color: '#0E7490' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...grains,
      ...steps,
      // Starfish and shells in the margins
      ...starfish(w - 22 * u, (CALM_TOP + 44) * u, 10 * u, tone('#F97316'), 18),
      ...starfish(12 * u, h * 0.5, 9 * u, tone('#F43F5E'), -10),
      ...shell(w - 12 * u, h * 0.6, 8 * u, tone('#FBCFE8')),
      ...shell(12 * u, h * 0.66, 7 * u, tone('#FDE68A')),
      // Towels and parasols at the bottom
      ...towel(w * 0.06, shore - 70 * u, 40 * u, 72 * u, -12, ['#F8FAFC', '#2563EB', '#F8FAFC', '#2563EB', '#F8FAFC', '#2563EB'].map(tone)),
      ...parasol(w * 0.2, shore - 64 * u, 34 * u, [tone('#EF4444'), tone('#F8FAFC')]),
      ...towel(w * 0.62, shore - 64 * u, 74 * u, 34 * u, 6, ['#FACC15', '#F472B6', '#FACC15', '#F472B6'].map(tone)),
      ...parasol(w * 0.86, shore - 50 * u, 30 * u, [tone('#14B8A6'), tone('#FDE047')]),
      circle(w * 0.48, shore - 24 * u, 9 * u, { fill: tone('#F8FAFC'), stroke: tone('#94A3B8'), strokeWidth: 0.8 }),
      path(`M${w * 0.48 - 9 * u} ${shore - 24 * u} A${9 * u} ${9 * u} 0 0 1 ${w * 0.48} ${shore - 33 * u} L${w * 0.48} ${shore - 24 * u} Z`, { fill: tone('#EF4444') }),
      path(`M${w * 0.48 + 9 * u} ${shore - 24 * u} A${9 * u} ${9 * u} 0 0 1 ${w * 0.48} ${shore - 15 * u} L${w * 0.48} ${shore - 24 * u} Z`, { fill: tone('#2563EB') }),
      // The sea and its foam
      path(`${foam} V${h} H0 Z`, { fill: 'url(#sea)' }),
      path(foam, { fill: 'none', stroke: sunset ? '#CBD5E1' : '#FFFFFF', strokeWidth: 4 * u, opacity: 0.85 }),
      path(foam, { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.4 * u, opacity: 0.5, transform: `translate(0 ${10 * u})` }),
      ...gleams,
    ],
  };
}
