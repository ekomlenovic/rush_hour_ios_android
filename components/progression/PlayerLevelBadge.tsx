import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { getLevelInfo, getPlayerTitle } from '@/data/progression';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import XpBar from './XpBar';

interface Props {
  colors: UiColors;
  onPress: () => void;
}

/** Player level, title and XP bar of the home screen */
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
      <View style={styles.row}>
        <Text style={[styles.level, { color: colors.primaryText }]}>{t('progression.level_short', { level: info.level })}</Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.xp, { color: colors.textMuted }]}>
          {t('progression.xp_progress', { xp: info.xpInLevel, next: info.xpForNext })}
        </Text>
      </View>
      <XpBar colors={colors} ratio={info.ratio} height={6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  level: { fontSize: RFValue(15), fontWeight: '800' },
  title: { flex: 1, fontSize: RFValue(14), fontWeight: '600' },
  xp: { fontSize: RFValue(12), fontWeight: '600' },
});
