import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from '@/hooks/useRouter';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { availableRecaps, buildRecap, isInProgress, pendingRecap, periodLabel, recapAchievementCount } from '@/utils/recap';
import { formatPlayTime } from '@/utils/date';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
}

/**
 * The latest recap in the profile (issue 125): its profile and a few numbers, opened in one touch,
 * then every past recap. "New" until it is opened, like on the home screen
 */
export default function RecapPreviewCard({ colors }: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const monthlyStats = useGameStore(s => s.monthlyStats);
  const yearlyStats = useGameStore(s => s.yearlyStats);
  const achievementMonths = useGameStore(s => s.achievementMonths);
  const recapSince = useGameStore(s => s.recapSince);
  const recapsSeen = useGameStore(s => s.recapsSeen);
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const frozenDates = useGameStore(s => s.frozenDates);

  const { recap, isNew } = useMemo(() => {
    const source = { monthlyStats, yearlyStats, achievementMonths, recapSince, dailyChallengeProgress, weeklyChallengeProgress, frozenDates };
    // The one announced on the home screen first, otherwise the latest month played
    const pending = pendingRecap({ ...source, recapsSeen });
    const key = pending ?? availableRecaps(source).find(k => k.length === 7);
    return { recap: key ? buildRecap(source, key) : null, isNew: !!pending };
  }, [monthlyStats, yearlyStats, achievementMonths, recapSince, recapsSeen, dailyChallengeProgress, weeklyChallengeProgress, frozenDates]);

  const header = (
    <View style={styles.header}>
      <Ionicons name="gift" size={RFValue(20)} color={colors.warning} />
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('recap.list_title')}</Text>
      {isNew ? (
        <View style={[styles.pill, { backgroundColor: colors.warning }]}>
          <Text style={[styles.pillText, { color: colors.onWarning }]}>{t('recap.new')}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!recap) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {header}
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('recap.list_empty')}</Text>
      </View>
    );
  }

  const label = periodLabel(recap.key, i18n.language);
  const profile = t(`recap.profile_${recap.profile}`);
  const figures = [
    { value: String(recap.stats.wins), label: t('recap.hero_wins', { count: recap.stats.wins }), show: recap.stats.wins > 0 },
    { value: String(recap.dailies), label: t('recap.hero_dailies', { count: recap.dailies }), show: recap.dailies > 0 },
    { value: formatPlayTime(recap.stats.playTimeMs), label: t('recap.hero_play_time'), show: recap.stats.playTimeMs >= 60_000 },
    { value: String(recapAchievementCount(recap)), label: t('recap.hero_achievements', { count: recapAchievementCount(recap) }), show: recapAchievementCount(recap) > 0 },
  ].filter(f => f.show).slice(0, 3);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: isNew ? colors.warning : colors.border }]}>
      {header}
      <Pressable
        onPress={() => router.push(`/recap?period=${recap.key}`)}
        style={[styles.latest, { backgroundColor: colors.warningSoft }]}
        accessibilityRole="button"
        accessibilityLabel={[label, profile, ...figures.map(f => `${f.value} ${f.label}`), isInProgress(recap) ? t('recap.in_progress') : ''].filter(Boolean).join(', ')}
      >
        <View style={styles.latestTop}>
          <View style={styles.latestTexts}>
            <Text style={[styles.period, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.profile, { color: colors.primaryText }]}>{profile}</Text>
          </View>
          {isInProgress(recap) ? (
            <View style={[styles.pill, { backgroundColor: colors.surface }]}>
              <Text style={[styles.pillText, { color: colors.textMuted }]}>{t('recap.in_progress')}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={RFValue(18)} color={colors.textMuted} />
        </View>
        {figures.length > 0 ? (
          <View style={styles.figures}>
            {figures.map(f => (
              <View key={f.label} style={styles.figure}>
                <Text style={[styles.figureValue, { color: colors.text }]}>{f.value}</Text>
                <Text style={[styles.figureLabel, { color: colors.textMuted }]} numberOfLines={2}>{f.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
      <Pressable onPress={() => router.push('/recaps')} style={styles.seeAll} accessibilityRole="button" hitSlop={6}>
        <Text style={[styles.seeAllText, { color: colors.primaryText }]}>{t('recap.see_all')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RFValue(16),
    borderWidth: 1,
    padding: RFValue(14),
    gap: RFValue(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  title: {
    flex: 1,
    fontSize: RFValue(17),
    fontWeight: '700',
  },
  muted: {
    fontSize: RFValue(14),
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pillText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  latest: {
    borderRadius: RFValue(12),
    padding: RFValue(12),
    gap: RFValue(10),
  },
  latestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  latestTexts: {
    flex: 1,
  },
  period: {
    fontSize: RFValue(18),
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  profile: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  figures: {
    flexDirection: 'row',
    gap: RFValue(8),
  },
  figure: {
    flex: 1,
  },
  figureValue: {
    fontSize: RFValue(20),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  figureLabel: {
    fontSize: RFValue(12),
  },
  seeAll: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  seeAllText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
});
