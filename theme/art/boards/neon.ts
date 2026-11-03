import type { ColorScheme } from '../../ui';
import { type ArtDrawing, type ArtShape, circle, line, path, rect } from '../art';
import { type BackdropOptions, CALM_TOP, backdropUnit, rng } from '../events/backdropKit';

/**
 * Backdrop of the Neon board, synthwave: a striped sun setting between the towers of a city, a glowing grid running to
 * the horizon at the bottom. A pastel dawn in light mode (the texts stay dark on a pale sky), the night and its neon
 * signs in dark mode.
 */

export function neonBackdrop(scheme: ColorScheme, w: number, h: number, { noSky }: BackdropOptions): ArtDrawing {
  const darkScheme = scheme === 'dark';
  const u = backdropUnit(w, h);
  const rand = rng(1984);
  const horizon = h - 96 * u;
  const sunR = 64 * u;
  const cx = w / 2;
  const skyBottom = darkScheme ? '#831843' : '#FDBA74';
  // The bands cut through the lower half of the sun, thicker toward the horizon
  const bands = Array.from({ length: 5 }, (_, i) => {
    const y = horizon - sunR * (0.62 - i * 0.14);
    return rect(cx - sunR, y, sunR * 2, (1.5 + i * 1.3) * u, { fill: skyBottom });
  });
  // The towers on both sides of the sun, their lit windows and the neon of their roofs
  const towers: ArtShape[] = [];
  for (const side of [0, 1]) {
    let x = side ? cx + sunR * 0.9 : -6 * u;
    const end = side ? w + 6 * u : cx - sunR * 0.9;
    while (x < end) {
      const tw = Math.min((22 + rand() * 20) * u, end - x + 6 * u);
      const th = (34 + rand() * 60) * u;
      const top = horizon - th;
      towers.push(rect(x, top, tw, th, { fill: darkScheme ? '#160A2E' : '#6D28D9', stroke: darkScheme ? (rand() < 0.5 ? '#00E5FF' : '#FF2BD6') : '#4C1D95', strokeWidth: darkScheme ? 1.2 : 0.8 }));
      for (let wy = top + 6 * u; wy < horizon - 6 * u; wy += 8 * u) {
        for (let wx = x + 4 * u; wx < x + tw - 6 * u; wx += 7 * u) {
          if (rand() < 0.45) towers.push(rect(wx, wy, 3 * u, 3.5 * u, { fill: darkScheme ? (rand() < 0.5 ? '#FDE047' : '#F0ABFC') : '#FDE68A', opacity: darkScheme ? 0.85 : 0.7 }));
        }
      }
      x += tw + (1 + rand() * 4) * u;
    }
  }
  // The floor: lines closer and closer toward the horizon, others running to the vanishing point
  const glow = darkScheme ? '#00E5FF' : '#F0ABFC';
  const floor = h - horizon;
  const across = Array.from({ length: 9 }, (_, i) => {
    const y = horizon + floor * ((i + 1) / 9) ** 1.8;
    return line(0, y, w, y, { stroke: glow, strokeWidth: 1.2, opacity: 0.85 });
  });
  const along = Array.from({ length: 15 }, (_, i) => {
    const x = cx + (i - 7) * w * 0.2;
    return line(cx + (x - cx) * 0.06, horizon, x, h, { stroke: glow, strokeWidth: 1.2, opacity: 0.85 });
  });
  const stars = darkScheme
    ? Array.from({ length: 40 }, () => circle(rand() * w, (CALM_TOP + 10) * u + rand() * (horizon - (CALM_TOP + 120) * u), (0.6 + rand()) * u, { fill: '#FFFFFF', opacity: 0.3 + rand() * 0.5 }))
    : [];
  return {
    width: w,
    height: h,
    gradients: [
      { id: 'sky', stops: darkScheme
        ? [{ offset: 0, color: '#0B0620' }, { offset: 0.55, color: '#1E0B3F' }, { offset: 0.85, color: '#4A1050' }, { offset: 1, color: skyBottom }]
        : [{ offset: 0, color: '#FAF5FF' }, { offset: 0.5, color: '#F5E1FB' }, { offset: 0.8, color: '#FBCFE8' }, { offset: 1, color: skyBottom }] },
      { id: 'sun', stops: [{ offset: 0, color: '#FDE047' }, { offset: 1, color: darkScheme ? '#FF2BD6' : '#F472B6' }] },
      { id: 'halo', radial: true, stops: [{ offset: 0, color: darkScheme ? '#FF2BD6' : '#F472B6', opacity: 0.45 }, { offset: 1, color: '#F472B6', opacity: 0 }] },
      { id: 'floor', stops: [{ offset: 0, color: darkScheme ? '#1A0633' : '#4C1D95' }, { offset: 1, color: darkScheme ? '#0B0620' : '#2E1065' }] },
    ],
    shapes: [
      ...(noSky ? [] : [rect(0, 0, w, horizon, { fill: 'url(#sky)' })]),
      ...stars,
      circle(cx, horizon - sunR * 0.3, sunR * 2, { fill: 'url(#halo)' }),
      path(`M${cx - sunR} ${horizon} A${sunR} ${sunR} 0 0 1 ${cx + sunR} ${horizon} Z`, { fill: 'url(#sun)' }),
      ...bands,
      ...towers,
      rect(0, horizon, w, floor, { fill: 'url(#floor)' }),
      ...across,
      ...along,
      line(0, horizon, w, horizon, { stroke: darkScheme ? '#FF2BD6' : '#F472B6', strokeWidth: 2 * u }),
    ],
  };
}
