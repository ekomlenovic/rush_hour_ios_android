import { GIFT_COLORS } from '@/theme/art/christmas';

/**
 * Timeline of the Gift shower win effect (Christmas), as shares of GIFTS_DURATION_MS: presents fall
 * from above the top one after the other, spinning, land at the bottom with a bounce and a few sparkles,
 * then all fade out. Pure and deterministic (a replay looks the same); the worklets of GiftsEffect read it.
 */

export const GIFTS_DURATION_MS = 2800;
export const GIFTS = 12;
export const DROP_END = 0.4;
/** Fall of a present to the ground */
export const FALL = 0.32;
/** Bounce once landed */
export const BOUNCE = 0.1;
/** Sparkles once landed */
export const SPARKLE = 0.14;
export const FADE_START = 0.85;
const SPARKLES_PER_GIFT = 4;

export interface Point { x: number; y: number }

export interface Gift {
  t0: number;
  /** Center of the present */
  x: number;
  fromY: number;
  landY: number;
  size: number;
  /** Side to side while falling */
  sway: number;
  /** Turn in degrees when it leaves, then once landed */
  spin: number;
  rest: number;
  /** Index in GIFT_COLORS */
  color: number;
}

export interface Sparkle {
  t0: number;
  from: Point;
  /** Where it ends, from `from` */
  dx: number;
  dy: number;
  size: number;
}

export interface GiftsPlan {
  gifts: Gift[];
  sparkles: Sparkle[];
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** When a present lands */
export const landsAt = (gift: Pick<Gift, 't0'>) => gift.t0 + FALL;

/** Where a present is at time t: falling, bouncing once landed, then fading out with the others */
export function giftAt(gift: Gift, t: number): { x: number; y: number; rotate: number; squash: number; opacity: number } {
  'worklet';
  const u = (t - gift.t0) / FALL;
  const opacity = u <= 0 ? 0 : t < FADE_START ? 1 : Math.max(0, (1 - t) / (1 - FADE_START));
  if (u < 1) {
    const v = Math.max(0, u);
    return {
      x: gift.x + gift.sway * Math.sin(v * Math.PI),
      // Falls faster and faster
      y: gift.fromY + (gift.landY - gift.fromY) * v * v,
      rotate: gift.spin + (gift.rest - gift.spin) * v,
      squash: 1,
      opacity,
    };
  }
  const since = (t - gift.t0 - FALL) / BOUNCE;
  return {
    x: gift.x,
    y: since < 1 ? gift.landY - gift.size * 0.25 * Math.sin(Math.PI * since) : gift.landY,
    rotate: gift.rest,
    // Squashed a little as it hits the ground
    squash: since < 0.3 ? 0.85 + 0.5 * since : 1,
    opacity,
  };
}

/** Presents falling across an area of width × height, on the ground at its bottom */
export function buildGiftsPlan(width: number, height: number): GiftsPlan {
  const rand = rng(1224);
  const ground = height * 0.95;
  const baseSize = Math.min(70, Math.max(22, width * 0.13));
  const gifts = Array.from({ length: GIFTS }, (_, i) => {
    const size = baseSize * (0.8 + 0.4 * rand());
    // Spread across the width, in a shuffled order
    const slot = (i * 5) % GIFTS;
    const x = size / 2 + ((width - size) * (slot + 0.2 + 0.6 * rand())) / GIFTS;
    return {
      t0: (i * DROP_END) / GIFTS,
      x,
      fromY: -size,
      landY: ground - size / 2 - size * 0.3 * rand(),
      size,
      sway: size * (0.3 + 0.4 * rand()) * (rand() < 0.5 ? -1 : 1),
      spin: (rand() - 0.5) * 120,
      rest: (rand() - 0.5) * 16,
      color: i % GIFT_COLORS.length,
    };
  });
  const sparkles = gifts.flatMap(gift => Array.from({ length: SPARKLES_PER_GIFT }, (_, k) => {
    // Up and to both sides, from the bottom of the present
    const angle = Math.PI * (1.1 + (0.8 * k) / (SPARKLES_PER_GIFT - 1));
    const distance = gift.size * (0.5 + 0.4 * rand());
    return {
      t0: landsAt(gift),
      from: { x: gift.x, y: gift.landY + gift.size * 0.4 },
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: Math.max(3, gift.size * 0.1),
    };
  }));
  return { gifts, sparkles };
}
