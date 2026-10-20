import { JACK_O_LANTERN, LANTERN_MOUTH } from '@/theme/art/halloween';

/**
 * Timeline of the Bats win effect (Halloween), as shares of BATS_DURATION_MS: a jack-o'-lantern pops up
 * at the bottom, then bats fly out of its mouth one after the other, flapping, and leave by the top.
 * Pure and deterministic (a replay looks the same); the worklets of BatsEffect read it.
 */

export const BATS_DURATION_MS = 2800;
export const LANTERN_IN_END = 0.1;
export const LANTERN_OUT_START = 0.82;
export const LAUNCH_START = 0.08;
export const LAUNCH_END = 0.48;
/** Flight of a bat, from the mouth to above the top */
export const BAT_FLIGHT = 0.42;
export const BATS = 12;
/** Wing beats per second */
const FLAPS_PER_S = 7;

export interface Point { x: number; y: number }

export interface Bat {
  t0: number;
  /** Center of the bat when it leaves, then when it is gone */
  from: Point;
  to: Point;
  /** Width of the bat */
  width: number;
  /** Side to side on its way up */
  sway: number;
  turns: number;
  /** So the bats do not all flap together */
  flapOffset: number;
}

export interface BatsPlan {
  lanternWidth: number;
  lanternHeight: number;
  /** Top left of the lantern */
  lantern: Point;
  bats: Bat[];
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Size of the lantern: pops up a little too big, settles, then shrinks away at the end */
export function lanternScale(t: number): number {
  'worklet';
  if (t <= 0 || t >= 1) return 0;
  if (t < LANTERN_IN_END) {
    const u = t / LANTERN_IN_END;
    return u < 0.7 ? (u / 0.7) * 1.15 : 1.15 - ((u - 0.7) / 0.3) * 0.15;
  }
  if (t > LANTERN_OUT_START) return 1 - (t - LANTERN_OUT_START) / (1 - LANTERN_OUT_START);
  return 1;
}

/** Light of the candle inside, 0 to 1 */
export function lanternGlow(t: number): number {
  'worklet';
  return lanternScale(t) > 0 ? 0.75 + 0.25 * Math.sin(t * 60) * Math.sin(t * 23) : 0;
}

/** Where a bat is at time t, its size (small as it leaves the mouth) and opacity */
export function batAt(bat: Bat, t: number): { x: number; y: number; scale: number; opacity: number } {
  'worklet';
  const u = (t - bat.t0) / BAT_FLIGHT;
  if (u <= 0 || u >= 1) return { x: bat.from.x, y: bat.from.y, scale: 0, opacity: 0 };
  // Slow out of the mouth, faster on the way up
  const e = 0.6 * u + 0.4 * u * u;
  return {
    x: bat.from.x + (bat.to.x - bat.from.x) * e + bat.sway * Math.sin(e * Math.PI * bat.turns),
    y: bat.from.y + (bat.to.y - bat.from.y) * e,
    scale: 0.3 + 0.7 * Math.min(1, u * 3),
    opacity: Math.min(1, u * 20),
  };
}

/** Wings up or down, switched FLAPS_PER_S times a second */
export function wingsUp(bat: Bat, t: number): boolean {
  'worklet';
  return Math.floor(t * (BATS_DURATION_MS / 1000) * FLAPS_PER_S * 2 + bat.flapOffset) % 2 === 0;
}

/** The lantern at the bottom middle of an area of width × height, and the flight of each bat */
export function buildBatsPlan(width: number, height: number): BatsPlan {
  const rand = rng(1031);
  const lanternWidth = Math.min(130, Math.max(44, Math.min(width, height) * 0.3));
  const lanternHeight = lanternWidth * (JACK_O_LANTERN.height / JACK_O_LANTERN.width);
  const lantern = { x: width / 2 - lanternWidth / 2, y: height * 0.95 - lanternHeight };
  const mouth = {
    x: lantern.x + (LANTERN_MOUTH.x / JACK_O_LANTERN.width) * lanternWidth,
    y: lantern.y + (LANTERN_MOUTH.y / JACK_O_LANTERN.height) * lanternHeight,
  };
  const batWidth = Math.min(90, Math.max(26, width * 0.2));
  const bats = Array.from({ length: BATS }, (_, i) => {
    const w = batWidth * (0.75 + 0.5 * rand());
    // Every other bat to each side, so they fill the area
    const side = i % 2 ? 0.5 : 0;
    return {
      t0: LAUNCH_START + (i * (LAUNCH_END - LAUNCH_START)) / BATS,
      from: mouth,
      to: { x: width * (side + 0.08 + 0.42 * rand()), y: -w },
      width: w,
      sway: width * (0.04 + 0.06 * rand()) * (rand() < 0.5 ? -1 : 1),
      turns: 1.5 + 1.5 * rand(),
      flapOffset: Math.floor(rand() * 2),
    };
  });
  return { lanternWidth, lanternHeight, lantern, bats };
}
