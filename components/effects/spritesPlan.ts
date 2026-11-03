/**
 * Timeline of the drawn win effects of the seasonal events (hearts, clovers, champagne…), as shares of the
 * duration of the effect: drawings fall from the top, rise from the bottom or burst from the bottom middle,
 * each one turning and swaying, then fade out. Pure and deterministic (a replay looks the same); the worklets of
 * SpritesEffect read it.
 */

export type SpriteMotion = 'fall' | 'rise' | 'burst';

export interface SpriteSpec {
  motion: SpriteMotion;
  duration: number;
  count: number;
  /** Number of drawings, given in turn */
  drawings: number;
  /** Size of a drawing, as a share of the width of the area */
  minSize: number;
  maxSize: number;
  /** Turns of a drawing on its way, in degrees (both ways) */
  spin: number;
  seed: number;
}

export interface Point { x: number; y: number }

export interface Sprite {
  t0: number;
  /** Its life, as a share of the duration */
  life: number;
  from: Point;
  to: Point;
  size: number;
  /** Side to side on the way */
  sway: number;
  spin: number;
  /** Index of its drawing */
  drawing: number;
}

/** When the last drawing leaves */
export const LAUNCH_END = 0.45;
/** Share of its life a drawing takes to show, then to fade out */
const FADE_IN = 0.1;
const FADE_OUT = 0.3;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSpritesPlan(spec: SpriteSpec, width: number, height: number): Sprite[] {
  const rand = rng(spec.seed);
  return Array.from({ length: spec.count }, (_, i) => {
    const size = width * (spec.minSize + (spec.maxSize - spec.minSize) * rand());
    // Spread across the width in a shuffled order
    const slot = ((i * 7) % spec.count + 0.2 + 0.6 * rand()) / spec.count;
    const x = size / 2 + (width - size) * slot;
    const t0 = (i / spec.count) * LAUNCH_END;
    const life = Math.min(1 - t0, 0.5 + 0.1 * rand());
    const spin = (rand() - 0.5) * 2 * spec.spin;
    const sway = size * (0.3 + 0.5 * rand()) * (rand() < 0.5 ? -1 : 1);
    switch (spec.motion) {
      case 'fall':
        return { t0, life, from: { x, y: -size }, to: { x: x + sway, y: height * (0.75 + 0.25 * rand()) }, size, sway, spin, drawing: i % spec.drawings };
      case 'rise':
        return { t0, life, from: { x, y: height + size / 2 }, to: { x: x + sway, y: height * (0.05 + 0.35 * rand()) }, size, sway, spin, drawing: i % spec.drawings };
      default: {
        // From the bottom middle toward the whole top half
        const from = { x: width / 2 + (rand() - 0.5) * width * 0.15, y: height + size / 2 };
        return { t0, life, from, to: { x, y: height * (0.05 + 0.45 * rand()) }, size, sway: 0, spin, drawing: i % spec.drawings };
      }
    }
  });
}

/** Where a drawing is at time t (0 to 1 of the effect), turned, and how much it shows */
export function spriteAt(s: Sprite, motion: SpriteMotion, t: number): { x: number; y: number; rotate: number; opacity: number; scale: number } {
  'worklet';
  const u = (t - s.t0) / s.life;
  if (u <= 0 || u >= 1) return { x: s.from.x, y: s.from.y, rotate: 0, opacity: 0, scale: 1 };
  const opacity = u < FADE_IN ? u / FADE_IN : u > 1 - FADE_OUT ? (1 - u) / FADE_OUT : 1;
  // Falling: faster and faster; rising and bursting: fast, then slowing down
  const k = motion === 'fall' ? u * u * 0.6 + u * 0.4 : 1 - (1 - u) * (1 - u);
  const swing = motion === 'burst' ? 0 : s.sway * Math.sin(u * Math.PI * 2) * 0.5;
  // A burst falls back a little once up
  const drop = motion === 'burst' && u > 0.6 ? (u - 0.6) * (u - 0.6) * s.size * 4 : 0;
  return {
    x: s.from.x + (s.to.x - s.from.x) * k + swing,
    y: s.from.y + (s.to.y - s.from.y) * k + drop,
    rotate: s.spin * u,
    opacity,
    scale: motion === 'burst' ? 0.6 + 0.4 * Math.min(1, u * 3) : 1,
  };
}
