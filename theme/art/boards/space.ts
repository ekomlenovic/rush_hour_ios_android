import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, ellipse, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Space board: stars, a soft nebula, a comet crossing under the texts, a satellite on the right edge,
 * a small red planet on the left one and a big ringed planet rising at the bottom. In light mode the top of the screen
 * is a pale glow of the atmosphere, so the texts stay readable, and space begins under it; dark mode is deep space all
 * the way up.
 */

/** A satellite: its body, its solar panels and its dish */
function satellite(cx: number, cy: number, k: number, deg: number): ArtShape[] {
  const t = { transform: `rotate(${deg} ${cx} ${cy})` };
  const panel = (x: number) => [
    rect(x, cy - 6 * k, 22 * k, 12 * k, { fill: '#1E3A8A', stroke: '#93C5FD', strokeWidth: 0.6, ...t }),
    line(x + 11 * k, cy - 6 * k, x + 11 * k, cy + 6 * k, { stroke: '#93C5FD', strokeWidth: 0.5, ...t }),
  ];
  return [
    ...panel(cx - 34 * k),
    ...panel(cx + 12 * k),
    line(cx - 12 * k, cy, cx + 12 * k, cy, { stroke: '#CBD5E1', strokeWidth: 1.2 * k, ...t }),
    rect(cx - 7 * k, cy - 8 * k, 14 * k, 16 * k, { rx: 2 * k, fill: '#E5E7EB', stroke: '#6B7280', strokeWidth: 0.6, ...t }),
    ellipse(cx, cy - 12 * k, 6 * k, 2.5 * k, { fill: '#F8FAFC', stroke: '#6B7280', strokeWidth: 0.6, ...t }),
    line(cx, cy - 12 * k, cx, cy - 18 * k, { stroke: '#94A3B8', strokeWidth: 0.8, ...t }),
  ];
}

export function spaceBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const lightScheme = scheme === 'light';
  const u = backdropUnit(w, h);
  const rand = rng(42);
  // In light mode, stars only where space has begun
  const starTop = lightScheme ? (CALM_TOP + 40) * u : 0;
  const stars = Array.from({ length: 90 }, () => {
    const y = starTop + rand() * (h - starTop);
    return circle(rand() * w, y, (0.5 + rand() * 1.2) * u, { fill: rand() < 0.2 ? '#C4B5FD' : '#FFFFFF', opacity: 0.35 + rand() * 0.6 });
  });
  const ringed = { x: w * 0.72, y: h - 30 * u, r: 70 * u };
  const ringT = { transform: `rotate(-14 ${ringed.x} ${ringed.y})` };
  const comet = { x: w * 0.7, y: (CALM_TOP + 54) * u };
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: lightScheme
        ? [{ offset: 0, color: '#EEF0FF' }, { offset: 0.14, color: '#C7C9F5' }, { offset: 0.3, color: '#312E81' }, { offset: 0.5, color: '#0F1235' }, { offset: 1, color: '#070B1F' }]
        : [{ offset: 0, color: '#05081A' }, { offset: 1, color: '#0B1030' }] },
      { id: 'nebula', radial: true, stops: [{ offset: 0, color: '#A855F7', opacity: 0.35 }, { offset: 1, color: '#A855F7', opacity: 0 }] },
      { id: 'nebula2', radial: true, stops: [{ offset: 0, color: '#EC4899', opacity: 0.25 }, { offset: 1, color: '#EC4899', opacity: 0 }] },
      { id: 'planet', stops: [{ offset: 0, color: '#FDE68A' }, { offset: 0.5, color: '#F59E0B' }, { offset: 1, color: '#B45309' }] },
      { id: 'mars', stops: [{ offset: 0, color: '#FCA5A5' }, { offset: 1, color: '#B91C1C' }] },
      { id: 'tail', horizontal: true, stops: [{ offset: 0, color: '#FFFFFF', opacity: 0 }, { offset: 1, color: '#E0F2FE', opacity: 0.9 }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      circle(w * 0.2, h * 0.7, 160 * u, { fill: 'url(#nebula)' }),
      circle(w * 0.85, h * 0.45, 130 * u, { fill: 'url(#nebula2)' }),
      ...stars,
      // The comet under the texts, its tail behind
      path(`M${comet.x - 120 * u} ${comet.y - 26 * u} L${comet.x} ${comet.y - 3 * u} L${comet.x} ${comet.y + 3 * u} Z`, { fill: 'url(#tail)' }),
      circle(comet.x, comet.y, 4 * u, { fill: '#FFFFFF' }),
      circle(comet.x, comet.y, 8 * u, { fill: '#E0F2FE', opacity: 0.35 }),
      // The satellite on the right edge, the small red planet on the left one
      ...satellite(w - 16 * u, h * 0.5, 0.8 * u, -25),
      circle(4 * u, h * 0.6, 20 * u, { fill: 'url(#mars)' }),
      ellipse(0, h * 0.6 - 6 * u, 8 * u, 3 * u, { fill: '#7F1D1D', opacity: 0.4 }),
      circle(10 * u, h * 0.6 + 8 * u, 3 * u, { fill: '#7F1D1D', opacity: 0.35 }),
      // The ringed planet rising at the bottom: the back of its ring, the planet, the front of its ring
      path(`M${ringed.x - ringed.r * 1.8} ${ringed.y} A${ringed.r * 1.8} ${ringed.r * 0.45} 0 0 1 ${ringed.x + ringed.r * 1.8} ${ringed.y}`,
        { fill: 'none', stroke: '#FDE68A', strokeWidth: 7 * u, opacity: 0.7, ...ringT }),
      circle(ringed.x, ringed.y, ringed.r, { fill: 'url(#planet)' }),
      ...[-0.4, 0, 0.35].map(f => ellipse(ringed.x, ringed.y + f * ringed.r, ringed.r * Math.sqrt(1 - f * f) * 0.98, 3 * u, { fill: '#92400E', opacity: 0.35, ...ringT })),
      path(`M${ringed.x - ringed.r * 1.8} ${ringed.y} A${ringed.r * 1.8} ${ringed.r * 0.45} 0 0 0 ${ringed.x + ringed.r * 1.8} ${ringed.y}`,
        { fill: 'none', stroke: '#FDE68A', strokeWidth: 7 * u, opacity: 0.85, ...ringT }),
      // A small moon at the bottom left
      circle(w * 0.14, h - 40 * u, 14 * u, { fill: '#CBD5E1' }),
      circle(w * 0.14 - 4 * u, h - 44 * u, 3 * u, { fill: '#94A3B8' }),
      circle(w * 0.14 + 5 * u, h - 36 * u, 2 * u, { fill: '#94A3B8' }),
    ],
  };
}
