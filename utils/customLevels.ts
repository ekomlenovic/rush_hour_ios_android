import type { TFunction } from 'i18next';
import type { Level } from '@/store/types';

export type CustomLevelKind = 'created' | 'imported';

/** Where a custom level is stored, or null for a map level */
export function customLevelKind(id: number, created: Level[], imported: Level[]): CustomLevelKind | null {
  if (created.some(l => l.id === id)) return 'created';
  if (imported.some(l => l.id === id)) return 'imported';
  return null;
}

/**
 * Title of a custom level: its name, else its rank in its list ("Level 3"),
 * never its id (a timestamp).
 */
export function customLevelTitle(t: TFunction, level: Level, kind: CustomLevelKind, levels: Level[]): string {
  if (level.name) return level.name;
  const n = levels.filter(l => l.id <= level.id).length;
  return kind === 'created' ? t('custom_levels.untitled', { n }) : t('custom_levels.untitled_imported', { n });
}
