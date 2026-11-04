import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, dark, ellipse, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Paper board: a kraft paper desk seen from above, a paper plane flying under the texts, paper
 * clips on the left edge, origami (a boat and a crane), sticky notes, a crumpled ball and a coffee ring at the bottom.
 * In dark mode, the same desk at night under the halo of a lamp.
 */

const turn = (deg: number, x: number, y: number) => ({ transform: `rotate(${deg} ${x} ${y})` });

/** A paper plane seen from above, its nose toward the right */
function paperPlane(x: number, y: number, k: number, deg: number, color: string): ArtShape[] {
  const t = turn(deg, x, y);
  const p = (dx: number, dy: number) => `${x + dx * k} ${y + dy * k}`;
  return [
    path(`M${p(32, 4)} L${p(-24, -14)} L${p(-14, 4)} Z`, { fill: '#000000', opacity: 0.12, ...t }),
    path(`M${p(30, 0)} L${p(-26, -18)} L${p(-16, 0)} Z`, { fill: color, stroke: dark(color, 0.3), strokeWidth: 0.8, strokeLinejoin: 'round', ...t }),
    path(`M${p(30, 0)} L${p(-26, 18)} L${p(-16, 0)} Z`, { fill: dark(color, 0.1), stroke: dark(color, 0.3), strokeWidth: 0.8, strokeLinejoin: 'round', ...t }),
    path(`M${p(30, 0)} L${p(-20, 4)} L${p(-16, 0)} Z`, { fill: dark(color, 0.22), ...t }),
  ];
}

/** An origami boat seen from the side */
function paperBoat(x: number, y: number, k: number, color: string): ArtShape[] {
  const p = (dx: number, dy: number) => `${x + dx * k} ${y + dy * k}`;
  return [
    ellipse(x, y + 14 * k, 34 * k, 4 * k, { fill: '#000000', opacity: 0.12 }),
    path(`M${p(-14, 0)} L${p(0, -28)} L${p(14, 0)} Z`, { fill: dark(color, 0.12), stroke: dark(color, 0.35), strokeWidth: 0.8, strokeLinejoin: 'round' }),
    path(`M${p(0, -28)} L${p(14, 0)} L${p(0, 0)} Z`, { fill: dark(color, 0.25) }),
    path(`M${p(-34, 0)} L${p(34, 0)} L${p(22, 12)} L${p(-22, 12)} Z`, { fill: color, stroke: dark(color, 0.35), strokeWidth: 0.8, strokeLinejoin: 'round' }),
    line(x - 22 * k, y + 5 * k, x + 22 * k, y + 5 * k, { stroke: dark(color, 0.25), strokeWidth: 0.8 }),
  ];
}

/** An origami crane seen from the side, its head toward the left */
function paperCrane(x: number, y: number, k: number, color: string): ArtShape[] {
  const p = (dx: number, dy: number) => `${x + dx * k} ${y + dy * k}`;
  const stroke = { stroke: dark(color, 0.35), strokeWidth: 0.8, strokeLinejoin: 'round' };
  return [
    ellipse(x, y + 14 * k, 28 * k, 3.5 * k, { fill: '#000000', opacity: 0.12 }),
    // The far wing, the body, the neck and head, the tail, the near wing
    path(`M${p(-2, 0)} L${p(10, -30)} L${p(12, -2)} Z`, { fill: dark(color, 0.25), ...stroke }),
    path(`M${p(-14, 2)} L${p(0, -4)} L${p(16, 2)} L${p(0, 10)} Z`, { fill: color, ...stroke }),
    path(`M${p(-8, 2)} L${p(-24, -18)} L${p(-30, -14)} L${p(-25, -16)} L${p(-12, 4)} Z`, { fill: dark(color, 0.1), ...stroke }),
    path(`M${p(10, 2)} L${p(30, -16)} L${p(14, 4)} Z`, { fill: dark(color, 0.15), ...stroke }),
    path(`M${p(0, -2)} L${p(-6, -34)} L${p(8, -2)} Z`, { fill: color, ...stroke }),
  ];
}

/** A paper clip, upright */
function paperClip(x: number, y: number, k: number, deg: number, color: string): ArtShape {
  const d = `M${x} ${y + 22 * k} L${x} ${y + 4 * k} A${4 * k} ${4 * k} 0 0 1 ${x + 8 * k} ${y + 4 * k} L${x + 8 * k} ${y + 26 * k}`
    + ` A${5.5 * k} ${5.5 * k} 0 0 1 ${x - 3 * k} ${y + 26 * k} L${x - 3 * k} ${y + 8 * k}`;
  return path(d, { fill: 'none', stroke: color, strokeWidth: 1.6 * k, strokeLinecap: 'round', ...turn(deg, x, y + 14 * k) });
}

/** A square sticky note with a scribble */
function stickyNote(x: number, y: number, s: number, deg: number, color: string, ink: string): ArtShape[] {
  const t = turn(deg, x + s / 2, y + s / 2);
  return [
    rect(x + 2, y + 3, s, s, { fill: '#000000', opacity: 0.12, ...t }),
    rect(x, y, s, s, { fill: color, ...t }),
    rect(x, y, s, s * 0.16, { fill: dark(color, 0.08), ...t }),
    path(`M${x + s * 0.18} ${y + s * 0.42} q${s * 0.08} ${-s * 0.08} ${s * 0.16} 0 t${s * 0.16} 0 t${s * 0.16} 0 t${s * 0.16} 0`,
      { fill: 'none', stroke: ink, strokeWidth: 1.2, opacity: 0.6, ...t }),
    path(`M${x + s * 0.18} ${y + s * 0.64} q${s * 0.08} ${-s * 0.08} ${s * 0.16} 0 t${s * 0.16} 0 t${s * 0.12} 0`,
      { fill: 'none', stroke: ink, strokeWidth: 1.2, opacity: 0.6, ...t }),
  ];
}

export function paperBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(311);
  // Paper is a little dimmer on the desk at night
  const tone = (c: string) => (darkScheme ? dark(c, 0.28) : c);
  const fibers = Array.from({ length: 80 }, () => {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI;
    const l = (4 + rand() * 8) * u;
    return line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, { stroke: darkScheme ? '#FFFFFF' : '#8B6B3E', strokeWidth: 0.6, opacity: darkScheme ? 0.05 : 0.16 });
  });
  const top = (CALM_TOP + 42) * u;
  const ink = '#1E3A8A';
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#221E19' }, { offset: 1, color: '#2E2820' }]
        : [{ offset: 0, color: '#EFE3CC' }, { offset: 1, color: '#E2CFAE' }] },
      { id: 'lamp', radial: true, stops: [{ offset: 0, color: '#FDE68A', opacity: darkScheme ? 0.2 : 0 }, { offset: 1, color: '#FDE68A', opacity: 0 }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, h, { fill: 'url(#sky)' })]),
      ...fibers,
      ...(darkScheme ? [circle(w * 0.8, h - 40 * u, 220 * u, { fill: 'url(#lamp)' })] : []),
      // The paper plane flying under the texts, its dashed trail behind
      path(`M${-10 * u} ${top + 30 * u} Q${w * 0.35} ${top - 10 * u} ${w - 70 * u} ${top + 6 * u}`,
        { fill: 'none', stroke: darkScheme ? '#D6D3D1' : '#78716C', strokeWidth: 1.2 * u, strokeDasharray: `${5 * u} ${6 * u}`, opacity: 0.5 }),
      ...paperPlane(w - 40 * u, top + 6 * u, 0.9 * u, 6, tone('#F8FAFC')),
      // Paper clips on the left edge, a sticky note on the right one
      paperClip(9 * u, h * 0.42, 1.1 * u, -8, darkScheme ? '#A8A29E' : '#64748B'),
      paperClip(7 * u, h * 0.42 + 40 * u, 1.1 * u, 12, darkScheme ? '#F87171' : '#DC2626'),
      ...stickyNote(w - 20 * u, h * 0.55, 34 * u, 10, tone('#FBCFE8'), ink),
      // At the bottom: sticky notes, origami, a crumpled ball and a coffee ring
      ...stickyNote(14 * u, h - 74 * u, 54 * u, -7, tone('#FDE68A'), ink),
      ...stickyNote(46 * u, h - 52 * u, 46 * u, 9, tone('#BBF7D0'), ink),
      ...paperCrane(w * 0.42, h - 46 * u, 1.05 * u, tone('#F87171')),
      ...paperBoat(w * 0.66, h - 30 * u, 0.95 * u, tone('#60A5FA')),
      circle(w * 0.55, h - 14 * u, 11 * u, { fill: tone('#F5F5F4'), stroke: darkScheme ? '#57534E' : '#A8A29E', strokeWidth: 0.8 }),
      path(`M${w * 0.55 - 7 * u} ${h - 18 * u} l${5 * u} ${4 * u} l${3 * u} ${-5 * u} l${5 * u} ${6 * u} M${w * 0.55 - 4 * u} ${h - 8 * u} l${6 * u} ${-3 * u} l${4 * u} ${3 * u}`,
        { fill: 'none', stroke: darkScheme ? '#78716C' : '#A8A29E', strokeWidth: 0.8 }),
      circle(w - 34 * u, h - 40 * u, 24 * u, { fill: 'none', stroke: '#7C4A26', strokeWidth: 3.5 * u, opacity: darkScheme ? 0.4 : 0.28 }),
      circle(w - 34 * u, h - 40 * u, 21 * u, { fill: 'none', stroke: '#7C4A26', strokeWidth: 1 * u, opacity: darkScheme ? 0.3 : 0.2 }),
      circle(w - 8 * u, h - 58 * u, 2.5 * u, { fill: '#7C4A26', opacity: darkScheme ? 0.4 : 0.25 }),
    ],
  };
}
