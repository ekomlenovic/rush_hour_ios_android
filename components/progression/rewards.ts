import type { TFunction } from 'i18next';
import { getFreezeCapacity, getLevelUpReward } from '@/data/progression';
import { getLevelCosmetics } from '@/data/cosmetics';

/** What reaching a player level gives, one line per reward */
export function getLevelRewardLines(t: TFunction, level: number): string[] {
  const lines = [t('progression.reward_freeze')];
  if (getLevelUpReward(level).freezeSlot) {
    lines.push(t('progression.reward_slot', { count: getFreezeCapacity(level) }));
  }
  for (const cosmetic of getLevelCosmetics(level)) {
    lines.push(t('progression.reward_cosmetic', { name: `${cosmetic.icon} ${t(`cosmetics.${cosmetic.kind}.${cosmetic.id}`)}` }));
  }
  return lines;
}
