import { TOMMY_EJECTION, TOMMY_GUN, TOMMY_MUZZLE } from '@/theme/art/tommyGun';

/**
 * Timeline of the Tommy gun win effect, as shares of TOMMY_DURATION_MS: the gun slides in,
 * sprays a burst across the board (tracers, bullet holes, empty cases), then slides out.
 * Pure and deterministic (a replay looks the same); the worklets of TommyGunEffect read it.
 */

export const TOMMY_DURATION_MS = 2600;
export const GUN_IN_END = 0.12;
export const FIRE_START = 0.14;
export const FIRE_END = 0.72;
export const GUN_OUT_START = 0.8;
export const SHOTS = 18;
/** Flight of a bullet to its hole */
export const BULLET_FLIGHT = 0.045;
/** Flight of an empty case */
export const CASE_FLIGHT = 0.16;
/** Holes fade from here to the end */
export const HOLES_FADE = 0.88;

/** Angle of the gun in degrees (positive: down), sprayed up and down while firing */
export function sprayAngle(t: number): number {
  'worklet';
  const u = Math.min(1, Math.max(0, (t - FIRE_START) / (FIRE_END - FIRE_START)));
  return -4 + 12 * Math.sin(u * Math.PI * 3);
}

/** Share of the current shot elapsed (0 to 1), or -1 when not firing: the muzzle flashes and the gun recoils at its start */
export function shotPhase(t: number): number {
  'worklet';
  if (t < FIRE_START || t >= FIRE_END) return -1;
  const shot = (t - FIRE_START) / ((FIRE_END - FIRE_START) / SHOTS);
  return shot - Math.floor(shot);
}

export interface Point { x: number; y: number }

export interface Shot {
  /** When it is fired */
  t0: number;
  /** Direction in degrees */
  angle: number;
  from: Point;
  /** The bullet hole */
  to: Point;
  /** The empty case: thrown from the ejection port, back and up, then falling */
  caseFrom: Point;
  caseDx: number;
  caseRise: number;
  caseFall: number;
}

export interface TommyGunPlan {
  gunWidth: number;
  gunHeight: number;
  /** Center of the gun (it turns around it) */
  center: Point;
  shots: Shot[];
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A point of the gun drawing on screen, with the gun turned by `angle` degrees around its center */
export function gunPoint(plan: Pick<TommyGunPlan, 'gunWidth' | 'gunHeight' | 'center'>, p: Point, angle: number): Point {
  const lx = (p.x / TOMMY_GUN.width - 0.5) * plan.gunWidth;
  const ly = (p.y / TOMMY_GUN.height - 0.5) * plan.gunHeight;
  const a = (angle * Math.PI) / 180;
  return { x: plan.center.x + lx * Math.cos(a) - ly * Math.sin(a), y: plan.center.y + lx * Math.sin(a) + ly * Math.cos(a) };
}

/** The gun on the left of an area of width × height, and where each of its shots goes */
export function buildTommyGunPlan(width: number, height: number): TommyGunPlan {
  const rand = rng(1931);
  const gunWidth = Math.min(width * 0.45, 200);
  const gunHeight = gunWidth * (TOMMY_GUN.height / TOMMY_GUN.width);
  const center = { x: gunWidth / 2 + 4, y: height * 0.62 };
  const margin = Math.max(6, gunHeight * 0.15);
  const shots = Array.from({ length: SHOTS }, (_, i) => {
    const t0 = FIRE_START + (i * (FIRE_END - FIRE_START)) / SHOTS;
    const angle = sprayAngle(t0);
    const from = gunPoint({ gunWidth, gunHeight, center }, TOMMY_MUZZLE, angle);
    const a = (angle * Math.PI) / 180;
    const targetX = Math.max(from.x + 20, width * (0.55 + 0.4 * rand()));
    let distance = (targetX - from.x) / Math.cos(a);
    const y = from.y + Math.sin(a) * distance;
    // A hole stays on the board
    if (y < margin) distance = (margin - from.y) / Math.sin(a);
    if (y > height - margin) distance = (height - margin - from.y) / Math.sin(a);
    return {
      t0,
      angle,
      from,
      to: { x: from.x + Math.cos(a) * distance, y: from.y + Math.sin(a) * distance },
      caseFrom: gunPoint({ gunWidth, gunHeight, center }, TOMMY_EJECTION, angle),
      caseDx: -(gunWidth * (0.1 + 0.15 * rand())),
      caseRise: gunHeight * (1.2 + 0.6 * rand()),
      caseFall: gunHeight * 3,
    };
  });
  return { gunWidth, gunHeight, center, shots };
}
