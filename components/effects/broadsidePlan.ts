import { FRIGATE, FRIGATE_WATERLINE, GUNPORT_X, GUNPORT_Y } from '@/theme/art/frigate';

/**
 * Timeline of the Broadside win effect (Anno 1800 style), as shares of BROADSIDE_DURATION_MS:
 * the sea rises, a frigate sails across under full canvas and, halfway, fires its guns one after the other,
 * stern to bow: flash, smoke left behind in the wind, and a cannonball bursting on the board.
 * Pure and deterministic (a replay looks the same); the worklets of BroadsideEffect read it.
 */

export const BROADSIDE_DURATION_MS = 3400;
export const SEA_IN_END = 0.1;
export const SEA_OUT_START = 0.9;
export const FIRE_START = 0.36;
export const FIRE_END = 0.58;
/** Flight of a cannonball to its burst */
export const BALL_FLIGHT = 0.11;
export const FLASH = 0.025;
export const SMOKE = 0.34;
export const BURST = 0.12;

export interface Point { x: number; y: number }

export interface Shot {
  t0: number;
  /** The gunport when it fires */
  from: Point;
  /** Where the ball bursts */
  to: Point;
  /** Height of the arc above the straight line */
  arc: number;
  /** Where the smoke drifts, from the gunport */
  smokeDrift: Point;
}

export interface BroadsidePlan {
  shipWidth: number;
  shipHeight: number;
  /** Top of the ship drawing when not bobbing */
  shipTop: number;
  seaTop: number;
  seaHeight: number;
  /** Left of the ship at t = 0 and at t = 1: it sails at an even speed */
  shipFrom: number;
  shipTo: number;
  shots: Shot[];
}

/** Left of the ship at time t */
export function shipLeft(plan: Pick<BroadsidePlan, 'shipFrom' | 'shipTo'>, t: number): number {
  'worklet';
  return plan.shipFrom + (plan.shipTo - plan.shipFrom) * t;
}

/** Up and down on the swell, in share of the ship height */
export function shipBob(t: number): number {
  'worklet';
  return Math.sin(t * Math.PI * 2 * 2.5) * 0.015;
}

/** Roll of the ship in degrees, heeling away a little more when the guns fire */
export function shipRoll(t: number): number {
  'worklet';
  const firing = t >= FIRE_START && t < FIRE_END + 0.05 ? -1.5 : 0;
  return Math.sin(t * Math.PI * 2 * 2.5 + 1) * 1.5 + firing;
}

/** The sea, 0 (below the area) to 1 (risen) */
export function seaLevel(t: number): number {
  'worklet';
  if (t < SEA_IN_END) return 1 - (1 - t / SEA_IN_END) ** 2;
  if (t > SEA_OUT_START) return 1 - ((t - SEA_OUT_START) / (1 - SEA_OUT_START)) ** 2;
  return 1;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** The sea along the bottom of an area of width × height, the frigate crossing it, and where each gun fires */
export function buildBroadsidePlan(width: number, height: number): BroadsidePlan {
  const rand = rng(1800);
  const shipWidth = Math.min(width * 0.6, 260);
  const shipHeight = shipWidth * (FRIGATE.height / FRIGATE.width);
  const seaHeight = Math.max(30, height * 0.16);
  const seaTop = height - seaHeight;
  // The waterline sits a little into the sea
  const shipTop = seaTop + seaHeight * 0.3 - (FRIGATE_WATERLINE / FRIGATE.height) * shipHeight;
  const plan = { shipWidth, shipHeight, shipTop, seaTop, seaHeight, shipFrom: -shipWidth, shipTo: width };
  const shots = GUNPORT_X.map((portX, i) => {
    const t0 = FIRE_START + (i * (FIRE_END - FIRE_START)) / GUNPORT_X.length;
    const from = {
      x: shipLeft(plan, t0) + (portX / FRIGATE.width) * shipWidth,
      y: shipTop + (GUNPORT_Y / FRIGATE.height + shipBob(t0)) * shipHeight,
    };
    const to = {
      x: Math.min(width - 10, Math.max(10, from.x + width * (0.05 + 0.3 * rand()))),
      y: Math.max(10, height * (0.12 + 0.4 * rand())),
    };
    return {
      t0,
      from,
      to,
      arc: Math.min(height * 0.15, (from.y - to.y) * 0.4),
      smokeDrift: { x: -shipWidth * (0.15 + 0.1 * rand()), y: -shipHeight * (0.12 + 0.1 * rand()) },
    };
  });
  return { ...plan, shots };
}

/** A cannonball on its arc, u from 0 (gunport) to 1 (burst) */
export function ballAt(shot: Shot, u: number): Point {
  'worklet';
  return {
    x: shot.from.x + (shot.to.x - shot.from.x) * u,
    y: shot.from.y + (shot.to.y - shot.from.y) * u - shot.arc * 4 * u * (1 - u),
  };
}
