import type { TFunction } from 'i18next';
import type { ChallengeResult } from '../store/gameStore';
import { dateLocale, formatDuration, parseLocalDateString } from './date';

/** Where friends can get the game */
export const APP_URL = 'https://github.com/ekomlenovic/rush_hour_ios_android';

interface ShareResultOptions {
  kind: 'daily' | 'weekly';
  /** YYYY-MM-DD for the daily, YYYY-Www for the weekly */
  key: string;
  result: ChallengeResult;
  /** Current streak, shown for the daily only */
  streak: number;
  language: string;
}

/**
 * Wordle-like result text: comparable between players (same puzzle for everyone)
 * and spoiler-free (no move of the solution).
 */
export function buildChallengeShareText(t: TFunction, { kind, key, result, streak, language }: ShareResultOptions): string {
  // Plain text: dates contain '/', which must not be HTML-escaped
  const plain = { interpolation: { escapeValue: false } };
  let title: string;
  if (kind === 'daily') {
    const date = parseLocalDateString(key);
    const label = date.toLocaleDateString(dateLocale(language), { day: '2-digit', month: '2-digit' });
    title = date.getDay() === 1 ? t('share.title_monday', { date: label, ...plain }) : t('share.title_daily', { date: label, ...plain });
  } else {
    title = t('share.title_weekly', { week: Number(key.split('-W')[1]) });
  }

  const stars = '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
  const moves = result.moves !== undefined && result.minMoves !== undefined
    ? `  ${t('share.moves', { moves: result.moves, optimal: result.minMoves })}`
    : '';

  const extras = [
    result.timeMs ? `⏱️ ${formatDuration(result.timeMs)}` : null,
    kind === 'daily' && streak > 0 ? `🔥 ${t('share.streak', { count: streak })}` : null,
  ].filter(Boolean).join('   ');

  return [`Rush Hours — ${title}`, `${stars}${moves}`, extras, APP_URL].filter(Boolean).join('\n');
}
