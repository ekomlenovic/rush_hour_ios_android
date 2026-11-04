import { daysBetween } from '../utils/date';
import type { ReviewPromptState } from './types';

/**
 * Review prompt of the Play Store (issue 318): rare and discreet, see docs/GAME_DESIGN.md, Demande de note.
 * Only Google's own window, never one of the app before it (Google forbids filtering the happy players).
 */

/** Days since the first open of the app on the phone */
export const REVIEW_MIN_DAYS_INSTALLED = 7;
/** Different days the app was opened */
export const REVIEW_MIN_PLAY_DAYS = 5;
/** Levels won (map and custom levels, each once) */
export const REVIEW_MIN_LEVELS_WON = 30;
/** Times the review is ever asked */
export const REVIEW_MAX_ASKS = 2;
/** Days between the first and the second time */
export const REVIEW_DAYS_BETWEEN_ASKS = 120;
/** Wait after the win card closes, so that the window opens on the map, not during its transition */
export const REVIEW_DELAY_MS = 800;

export const initialReviewPrompt = (): ReviewPromptState => ({ firstOpenDate: null, playDays: 0, askCount: 0, lastAskDate: null });

/** The player has played long enough, and was not asked too often, for the review to be asked today */
export function isReviewDue(review: ReviewPromptState, levelsWon: number, today: string): boolean {
  if (!review.firstOpenDate || daysBetween(review.firstOpenDate, today) < REVIEW_MIN_DAYS_INSTALLED) return false;
  if (review.playDays < REVIEW_MIN_PLAY_DAYS || levelsWon < REVIEW_MIN_LEVELS_WON) return false;
  if (review.askCount >= REVIEW_MAX_ASKS) return false;
  if (review.askCount === 0) return true;
  return !!review.lastAskDate && daysBetween(review.lastAskDate, today) >= REVIEW_DAYS_BETWEEN_ASKS;
}

