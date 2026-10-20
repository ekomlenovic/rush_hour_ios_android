import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { useTheme } from '@/theme';
import { availableRecaps, buildRecap, isInProgress, periodLabel, recapKind } from '@/utils/recap';

/** Past recaps, from the profile: the last 12 months and every year (issue 125) */
export default function RecapsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const monthlyStats = useGameStore(s => s.monthlyStats);
  const yearlyStats = useGameStore(s => s.yearlyStats);
  const achievementMonths = useGameStore(s => s.achievementMonths);
  const recapSince = useGameStore(s => s.recapSince);
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const frozenDates = useGameStore(s => s.frozenDates);

  const source = useMemo(
    () => ({ monthlyStats, yearlyStats, achievementMonths, recapSince, dailyChallengeProgress, weeklyChallengeProgress, frozenDates }),
    [monthlyStats, yearlyStats, achievementMonths, recapSince, dailyChallengeProgress, weeklyChallengeProgress, frozenDates],
  );
  const keys = useMemo(() => availableRecaps(source), [source]);
  const groups = [
    { title: t('recap.list_months'), keys: keys.filter(k => recapKind(k) === 'month') },
    { title: t('recap.list_years'), keys: keys.filter(k => recapKind(k) === 'year') },
  ].filter(group => group.keys.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('recap.list_title')}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.closeText, { color: colors.primaryText }]}>{t('common.close')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {groups.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('recap.list_empty')}</Text>
        ) : null}
        {groups.map(group => (
          <View key={group.title} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.groupTitle, { color: colors.textMuted }]} accessibilityRole="header">{group.title}</Text>
            {group.keys.map((key, i) => {
              const recap = buildRecap(source, key);
              const label = periodLabel(key, i18n.language);
              const detail = [
                t(`recap.profile_${recap.profile}`),
                // Never a zero in a recap (see docs/GAME_DESIGN.md)
                recap.stats.wins > 0 ? t('recap.list_wins', { count: recap.stats.wins }) : null,
                isInProgress(recap) ? t('recap.in_progress') : null,
              ].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={key}
                  onPress={() => router.push(`/recap?period=${key}`)}
                  style={[styles.row, i < group.keys.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${detail}`}
                >
                  <View style={styles.rowTexts}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
                    <Text style={[styles.rowDetail, { color: colors.textMuted }]}>{detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    bottom: 15,
    padding: 5,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  empty: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  rowDetail: {
    fontSize: 13,
  },
});
