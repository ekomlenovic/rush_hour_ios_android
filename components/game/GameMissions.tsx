import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { haptics, Haptics } from '@/utils/haptics';
import { useGameStore } from '@/store/gameStore';
import { countMissionsDone, getMissionsForDay } from '@/data/missions';
import { getFreezeCapacity, getPlayerLevel } from '@/data/progression';
import { getLocalDateString } from '@/utils/date';
import { useNow } from '@/hooks/useNow';
import { MAX_UI_FONT_SCALE } from '@/utils/boardSize';
import MissionsSheet from '@/components/home/MissionsSheet';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  isDark: boolean;
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Today's missions on the game screen: the pill of the home header (flag, 1/3), kept up to date while playing,
 * and the missions sheet of the home screen over the board. The game goes on under the sheet: no hidden pause.
 */
export default function GameMissions({ colors, isDark, visible, onOpen, onClose }: Props) {
  const { t } = useTranslation();
  const today = getLocalDateString(useNow());
  const dailyMissions = useGameStore(s => s.dailyMissions);
  const missionStreak = useGameStore(s => s.missionStreak);
  const currentStreak = useGameStore(s => s.currentStreak);
  const freezeStockFull = useGameStore(s => s.streakFreezes >= getFreezeCapacity(getPlayerLevel(s.xp)));
  const missions = getMissionsForDay(dailyMissions, today);
  const done = countMissionsDone(missions);

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpen();
        }}
        style={[styles.pill, { backgroundColor: colors.card }]}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.missions_progress', { done, total: missions.ids.length })}
        hitSlop={6}
      >
        <Ionicons name={missions.rewarded ? 'checkmark-circle' : 'flag'} size={16} color={missions.rewarded ? colors.success : colors.primaryText} />
        <Text maxFontSizeMultiplier={MAX_UI_FONT_SCALE} style={[styles.pillText, { color: colors.text }]}>{done}/{missions.ids.length}</Text>
      </Pressable>
      <MissionsSheet
        visible={visible}
        colors={colors}
        isDark={isDark}
        missions={missions}
        missionStreak={missionStreak}
        dailyStreak={currentStreak}
        freezeStockFull={freezeStockFull}
        onClose={onClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
