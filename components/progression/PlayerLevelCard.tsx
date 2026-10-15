import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { getFreezeCapacity, getLevelInfo, getPlayerTitle } from '@/data/progression';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import XpBar from './XpBar';
import { getLevelRewardLines } from './rewards';

/** Player level of the profile: title, XP bar and the rewards of the next level */
export default function PlayerLevelCard({ colors }: { colors: UiColors }) {
  const { t } = useTranslation();
  const xp = useGameStore(s => s.xp);
  const info = getLevelInfo(xp);
  const title = t(`progression.titles.${getPlayerTitle(info.level)}`);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View
        accessible
        accessibilityLabel={t('progression.a11y_badge', { level: info.level, title, xp: info.xpInLevel, next: info.xpForNext })}
      >
        <View style={styles.row}>
          <Text style={[styles.level, { color: colors.primaryText }]}>{t('progression.level', { level: info.level })}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <XpBar colors={colors} ratio={info.ratio} height={10} />
        <Text style={[styles.xp, { color: colors.textMuted }]}>
          {t('progression.xp_progress', { xp: info.xpInLevel, next: info.xpForNext })}
        </Text>
      </View>

      <Text style={[styles.subTitle, { color: colors.textMuted }]}>{t('progression.next_level', { level: info.level + 1 })}</Text>
      {getLevelRewardLines(t, info.level + 1).map(line => (
        <Text key={line} style={[styles.reward, { color: colors.text }]}>• {line}</Text>
      ))}
      <Text style={[styles.capacity, { color: colors.textMuted }]}>
        {t('progression.freeze_capacity')} : {getFreezeCapacity(info.level)} ❄️
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  level: { fontSize: RFValue(20), fontWeight: '800' },
  title: { fontSize: RFValue(16), fontWeight: '600' },
  xp: { fontSize: RFValue(12), fontWeight: '600', marginTop: 6 },
  subTitle: { fontSize: RFValue(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  reward: { fontSize: RFValue(14) },
  capacity: { fontSize: RFValue(12), marginTop: 8 },
});
