import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { getLevelInfo, getPlayerTitle } from '@/data/progression';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import XpBar from './XpBar';
import LevelEmblem from './LevelEmblem';

interface Props {
  colors: UiColors;
  onPress: () => void;
}

/** Emblem of the player level, title and XP bar of the home screen */
export default function PlayerLevelBadge({ colors, onPress }: Props) {
  const { t } = useTranslation();
  const xp = useGameStore(s => s.xp);
  const info = getLevelInfo(xp);
  const title = t(`progression.titles.${getPlayerTitle(info.level)}`);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.badge, { backgroundColor: colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={t('progression.a11y_badge', { level: info.level, title, xp: info.xpInLevel, next: info.xpForNext })}
    >
      <LevelEmblem level={info.level} size={RFValue(40)} />
      <View style={styles.main}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.xp, { color: colors.textMuted }]}>
            {t('progression.xp_progress', { xp: info.xpInLevel, next: info.xpForNext })}
          </Text>
        </View>
        <XpBar colors={colors} ratio={info.ratio} height={6} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  main: { flex: 1, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { flex: 1, fontSize: RFValue(15), fontWeight: '700' },
  xp: { fontSize: RFValue(12), fontWeight: '600' },
});
