import type { TFunction } from 'i18next';
import type { CosmeticContext, CosmeticDef } from '@/data/cosmetics';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';

/** How to unlock a cosmetic, with the current progress */
export function describeUnlock(t: TFunction, def: CosmeticDef, c: CosmeticContext): string {
  const rule = def.unlock;
  switch (rule.type) {
    case 'default': return t('cosmetics.unlock.default');
    case 'level': return t('cosmetics.unlock.level', { level: rule.level });
    case 'stars': return t('cosmetics.unlock.stars', { count: rule.count, current: c.totalStars });
    case 'levels': return t('cosmetics.unlock.levels', { count: rule.count, current: c.levelsWon });
    case 'weeklies': return t('cosmetics.unlock.weeklies', { count: rule.count, current: c.weeklies });
    case 'achievement':
      // A secret achievement keeps its name until unlocked
      if (ACHIEVEMENTS_BY_ID[rule.id]?.hidden && !c.achievements.has(rule.id)) return t('cosmetics.unlock.secret');
      return t('cosmetics.unlock.achievement', { name: t(`achievements.${rule.id}`) });
    case 'winter': return t('cosmetics.unlock.winter');
  }
}

/** The same, short enough for one line of a garage card: the full sentence is read out and shown in the preview */
export function describeUnlockShort(t: TFunction, def: CosmeticDef, c: CosmeticContext): string {
  const rule = def.unlock;
  switch (rule.type) {
    case 'default': return t('cosmetics.unlock.default');
    case 'level': return t('cosmetics.unlock_short.level', { level: rule.level });
    case 'stars': return `★ ${Math.min(c.totalStars, rule.count)}/${rule.count}`;
    case 'levels': return t('cosmetics.unlock_short.levels', { count: rule.count, current: Math.min(c.levelsWon, rule.count) });
    case 'weeklies': return t('cosmetics.unlock_short.weeklies', { count: rule.count, current: Math.min(c.weeklies, rule.count) });
    // The achievement's name alone says nothing: what it asks comes with it.
    // A secret one keeps its name until unlocked, then only its name (not how it was found)
    case 'achievement': {
      const achievement = ACHIEVEMENTS_BY_ID[rule.id];
      if (achievement?.hidden && !c.achievements.has(rule.id)) return t('cosmetics.unlock.secret');
      return achievement?.hidden
        ? t(`achievements.${rule.id}`)
        : `${t(`achievements.${rule.id}`)} : ${t(`achievements.${rule.id}_desc`)}`;
    }
    case 'winter': return t('cosmetics.unlock_short.winter');
  }
}
