import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { DailyMissionsState, MISSIONS_BY_ID, MissionDef, getMissionProgress } from '@/data/missions';
import BottomSheet from './BottomSheet';
import { HomeColors } from './colors';

function formatMissionProgress(mission: MissionDef, progress: number): string {
  if (mission.counter === 'playMs') {
    return `${Math.floor(progress / 60000)}/${mission.target / 60000} min`;
  }
  return `${progress}/${mission.target}`;
}

interface Props {
  visible: boolean;
  colors: HomeColors;
  isDark: boolean;
  missions: DailyMissionsState;
  onClose: () => void;
}

/** Today's 3 missions with their progress */
export default function MissionsSheet({ visible, colors, isDark, missions, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} title={`🎯 ${t('missions.title')}`} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.settingSub, { color: missions.rewarded ? colors.success : colors.sub, marginBottom: 20 }]}>
        {missions.rewarded ? t('missions.all_done') : t('missions.reward_hint')}
      </Text>
      {missions.ids.map((id) => {
        const mission = MISSIONS_BY_ID[id];
        if (!mission) return null;
        const progress = getMissionProgress(mission, missions.counters);
        const done = progress >= mission.target;
        return (
          <View key={id} style={styles.missionRow}>
            <Text style={styles.missionIcon}>{done ? '✅' : mission.icon}</Text>
            <View style={styles.missionBody}>
              <Text style={[styles.missionLabel, { color: colors.text, opacity: done ? 0.6 : 1 }]}>{t(`missions.list.${id}`)}</Text>
              <View style={[styles.missionTrack, { backgroundColor: colors.card }]}>
                <View style={[styles.missionFill, { width: `${(progress / mission.target) * 100}%`, backgroundColor: done ? colors.success : colors.accent }]} />
              </View>
            </View>
            <Text style={[styles.missionCount, { color: colors.sub }]}>{formatMissionProgress(mission, progress)}</Text>
          </View>
        );
      })}
      <Text style={[styles.settingSub, { color: colors.sub, marginTop: 8, textAlign: 'center' }]}>{t('missions.renew')}</Text>
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
    fontSize: 26,
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
