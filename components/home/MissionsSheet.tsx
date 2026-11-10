import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from '@/utils/responsive';
import { DailyMissionsState, MISSIONS_BY_ID, MissionDef, MissionStreakState, activeMissionStreak, getMissionProgress } from '@/data/missions';
import { missionsXp, xpMultiplier } from '@/data/progression';
import BottomSheet from './BottomSheet';
import BonusBox from './BonusBox';
import type { UiColors } from '@/theme';

function formatMissionProgress(mission: MissionDef, progress: number): string {
  if (mission.counter === 'playMs') {
    return `${Math.floor(progress / 60000)}/${mission.target / 60000} min`;
  }
  return `${progress}/${mission.target}`;
}

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  missions: DailyMissionsState;
  /** Days in a row with the 3 missions done: multiplies their XP */
  missionStreak: MissionStreakState;
  /** Streak of the daily challenge: the other XP bonus, for the XP announced */
  dailyStreak: number;
  /** The freeze stock is full: the missions give more XP instead of a freeze */
  freezeStockFull: boolean;
  onClose: () => void;
}

/** Today's 3 missions with their progress */
export default function MissionsSheet({ visible, colors, isDark, missions, missionStreak, dailyStreak, freezeStockFull, onClose }: Props) {
  const { t } = useTranslation();
  // Days in a row so far (today included once its missions are done)
  const streak = activeMissionStreak(missionStreak, missions.date);
  // Finishing today's missions makes the streak a day longer, which already counts for their XP
  const rewardXp = Math.round(missionsXp(!freezeStockFull) * xpMultiplier(streak + 1, dailyStreak));
  return (
    <BottomSheet visible={visible} title={t('missions.title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.settingSub, { color: missions.rewarded ? colors.success : colors.textMuted, marginBottom: 12 }]}>
        {missions.rewarded
          ? t('missions.all_done')
          : t(freezeStockFull ? 'missions.reward_hint_full' : 'missions.reward_hint', { xp: rewardXp })}
      </Text>
      <BonusBox
        colors={colors}
        days={streak}
        title={t('missions.streak', { count: streak })}
        emptyTitle={t('missions.streak_none')}
        rule={t('missions.streak_rule')}
      />
      {missions.ids.map((id) => {
        const mission = MISSIONS_BY_ID[id];
        if (!mission) return null;
        const progress = getMissionProgress(mission, missions.counters);
        const done = progress >= mission.target;
        return (
          <View key={id} style={styles.missionRow} accessible accessibilityLabel={`${t(`missions.list.${id}`)}, ${formatMissionProgress(mission, progress)}`} accessibilityState={{ checked: done }}>
            <Ionicons name={done ? 'checkmark-circle' : mission.icon} size={26} color={done ? colors.success : colors.primaryText} style={styles.missionIcon} />
            <View style={styles.missionBody}>
              <Text style={[styles.missionLabel, { color: colors.text, opacity: done ? 0.6 : 1 }]}>{t(`missions.list.${id}`)}</Text>
              <View style={[styles.missionTrack, { backgroundColor: colors.card }]}>
                <View style={[styles.missionFill, { width: `${(progress / mission.target) * 100}%`, backgroundColor: done ? colors.success : colors.primary }]} />
              </View>
            </View>
            <Text style={[styles.missionCount, { color: colors.textMuted }]}>{formatMissionProgress(mission, progress)}</Text>
          </View>
        );
      })}
      <Text style={[styles.settingSub, { color: colors.textMuted, marginTop: 8, textAlign: 'center' }]}>{t('missions.renew')}</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  settingSub: {
    fontSize: RFValue(14),
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  missionIcon: {
    marginRight: 12,
  },
  missionBody: {
    flex: 1,
  },
  missionLabel: {
    fontSize: RFValue(15),
    fontWeight: '600',
    marginBottom: 6,
  },
  missionTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  missionFill: {
    height: '100%',
    borderRadius: 3,
  },
  missionCount: {
    fontSize: RFValue(13),
    fontWeight: '600',
    marginLeft: 12,
    minWidth: 56,
    textAlign: 'right',
  },
});
