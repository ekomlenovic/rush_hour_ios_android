import type { TFunction } from 'i18next';
import { getFreezeCapacity, getLevelUpReward } from '@/data/progression';
import type { MissionReward } from '@/data/missions';
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

/** What completing the 3 missions of the day gave */
export function missionRewardText(t: TFunction, reward: MissionReward): string {
  return t(reward.freezeGranted ? 'missions.reward_freeze' : 'missions.reward_full', { xp: reward.xp });
}
