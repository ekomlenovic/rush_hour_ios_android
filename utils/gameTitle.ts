import type { TFunction } from 'i18next';
import type { Level } from '@/store/types';
import { isBossLevel } from '@/data/bosses';
import { dateLocale, parseLocalDateString } from './date';
import { customLevelTitle, type CustomLevelKind } from './customLevels';

export interface GameTitleContext {
  level: Level;
  challengeKind: 'daily' | 'weekly' | null;
  /** Day of an archive level (YYYY-MM-DD), null otherwise */
  archiveDate: string | null;
  customKind: CustomLevelKind | null;
  /** The list of the custom level (created or imported), to number an untitled one */
  customLevels: Level[];
  language: string;
}

/**
 * Title of the game screen, also given to the share sheet (issue 170): never a reserved id
 * ("Level 999999") for a challenge or an archive, never the id (a timestamp) of a custom level.
 */
export function gameTitle(t: TFunction, { level, challengeKind, archiveDate, customKind, customLevels, language }: GameTitleContext): string {
  if (challengeKind === 'daily') return t('home.daily_challenge');
  if (challengeKind === 'weekly') return t('home.weekly_challenge');
  if (archiveDate) {
    const date = parseLocalDateString(archiveDate).toLocaleDateString(dateLocale(language), { day: 'numeric', month: 'short' });
    return t('game.archive_title', { date });
  }
  if (customKind) return customLevelTitle(t, customLevels.find(l => l.id === level.id) ?? level, customKind, customLevels);
  return isBossLevel(level.id) ? t('game.level_boss', { id: level.id }) : t('game.level_count', { id: level.id });
}
