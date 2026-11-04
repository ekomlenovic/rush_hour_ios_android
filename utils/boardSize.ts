/**
 * Size of the board in the game screens (game, tutorial, multiplayer challenge): see docs/GAME_DESIGN.md
 * (Accessibilité). The screen width minus its margins, bounded by the height left under the header, the
 * stats and the actions (issues 155 and 156): an iPad in landscape or a large font on a small phone shrink
 * the board rather than push the actions off the screen, which does not scroll.
 */

/** Margin on each side of the board */
export const BOARD_PADDING = 24;

/** Most the texts of the game screen grow with the system font size (maxFontSizeMultiplier) */
export const MAX_UI_FONT_SCALE = 1.5;

/** Height of what is around the board, out of its texts: insets, margins, buttons */
const RESERVED_FIXED = 180;
/** Height of the texts around the board at the default font size */
const RESERVED_TEXT = 140;
/** Never smaller than this: a 6×6 grid stays playable */
const MIN_BOARD_SIZE = 200;

export interface WindowSize {
  width: number;
  height: number;
  /** System font scale (useWindowDimensions().fontScale) */
  fontScale?: number;
}

export function boardSizeFor({ width, height, fontScale = 1 }: WindowSize): number {
  const byWidth = width - BOARD_PADDING * 2;
  const reserved = RESERVED_FIXED + RESERVED_TEXT * Math.min(Math.max(fontScale, 1), MAX_UI_FONT_SCALE);
  return Math.max(Math.min(byWidth, MIN_BOARD_SIZE), Math.min(byWidth, height - reserved));
}
