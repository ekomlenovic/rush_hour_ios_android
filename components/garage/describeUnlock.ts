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
    case 'weeklies': return t('cosmetics.unlock.weeklies', { count: rule.count, current: c.weeklies });
    case 'achievement':
      // A secret achievement keeps its name until unlocked
      if (ACHIEVEMENTS_BY_ID[rule.id]?.hidden && !c.achievements.has(rule.id)) return t('cosmetics.unlock.secret');
      return t('cosmetics.unlock.achievement', { name: t(`achievements.${rule.id}`) });
    case 'winter': return t('cosmetics.unlock.winter');
  }
}
