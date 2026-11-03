import type { ColorScheme } from '../../ui';
import type { ArtDrawing } from '../art';

/**
 * Shared pieces of the backdrops of the event boards (theme/art/boardDecor.ts): the calm top kept for the texts
 * of the screen, the options and the deterministic random numbers.
 */

/** Height of the calm top of a backdrop, in units: the header and the stats of the game screen */
export const CALM_TOP = 130;

/** Options of a backdrop */
export interface BackdropOptions {
  /** Without its sky (the background color): drawn over another background, like the recap image */
  noSky?: boolean;
}

/** Draws the backdrop of a board for an area of w × h pixels */
export type Backdrop = (scheme: ColorScheme, w: number, h: number, options: BackdropOptions) => ArtDrawing;

/** Unit of a backdrop: 1 on a phone 400 wide, never so big that the top and the bottom meet */
export const backdropUnit = (w: number, h: number) => Math.min(1.6, w / 400, h / 420);

/** Deterministic pseudo-random numbers, so a backdrop is the same every time */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
