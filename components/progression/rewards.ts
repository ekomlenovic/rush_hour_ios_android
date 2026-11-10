import type { TFunction } from 'i18next';
import { getFreezeCapacity, getLevelUpReward } from '@/data/progression';
import type { MissionReward } from '@/data/missions';
import { getLevelCosmetics } from '@/data/cosmetics';

/**
 * What reaching a player level gives, one line per reward.
 * `freezes`: the current stock, to say when it is full (a freeze may still be used before the level is reached).
 */
export function getLevelRewardLines(t: TFunction, level: number, freezes?: number): string[] {
  const capacity = getFreezeCapacity(level);
  const lines = [freezes !== undefined && freezes >= capacity
    ? t('progression.reward_freeze_full', { count: freezes, capacity })
    : t('progression.reward_freeze')];
  if (getLevelUpReward(level).freezeSlot) {
    lines.push(t('progression.reward_slot', { count: capacity }));
  }
  for (const cosmetic of getLevelCosmetics(level)) {
    lines.push(t('progression.reward_cosmetic', { name: t(`cosmetics.${cosmetic.kind}.${cosmetic.id}`) }));
  }
  return lines;
}

/** What completing the 3 missions of the day gave */
export function missionRewardText(t: TFunction, reward: MissionReward): string {
  const text = t(reward.freezeGranted ? 'missions.reward_freeze' : 'missions.reward_full', { xp: reward.xp });
  if (reward.multiplier <= 1) return text;
  return `${text} · ${t('missions.reward_streak', { count: reward.streak, multiplier: formatMultiplier(t, reward.multiplier) })}`;
}

/** A multiplier as the language writes it: 1,75 in French, 1.75 in English */
export function formatMultiplier(t: TFunction, multiplier: number): string {
  return String(Math.round(multiplier * 100) / 100).replace('.', t('missions.decimal_separator'));
}
