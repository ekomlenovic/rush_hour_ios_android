import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import type { HostInstance, ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '@/store/gameStore';
import PlayerLevelCard from '@/components/progression/PlayerLevelCard';
import StreakCard from '@/components/profile/StreakCard';
import AchievementsSection from '@/components/profile/AchievementsSection';
import AchievementSheet from '@/components/profile/AchievementSheet';
import RecapPreviewCard from '@/components/profile/RecapPreviewCard';
import ScreenHeader from '@/components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration, formatPlayTime } from '@/utils/date';
import { ACHIEVEMENTS, buildAchievementContext } from '@/data/achievements';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const progress = useGameStore((state) => state.progress || []);
  const currentStreak = useGameStore((state) => state.currentStreak || 0);
  const bestStreak = useGameStore((state) => state.bestStreak || 0);
  const dailyChallengeProgress = useGameStore((state) => state.dailyChallengeProgress || {});
  const totalHintsUsed = useGameStore((state) => state.totalHintsUsed || 0);
  const achievements = useGameStore((state) => state.achievements || []);
  const weeklyChallengeProgress = useGameStore((state) => state.weeklyChallengeProgress || {});
  const archiveProgress = useGameStore((state) => state.archiveProgress || {});
  const createdLevels = useGameStore((state) => state.createdLevels);
  const stats = useGameStore((state) => state.stats);
  // Achievement shown in the sheet at the bottom, and the room it takes
  const [selectedAchievement, setSelectedAchievement] = useState<string | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const closeSheet = useCallback(() => setSelectedAchievement(null), []);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const selectedBadge = useRef<HostInstance | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const selectAchievement = useCallback((id: string | null, badge?: HostInstance | null) => {
    selectedBadge.current = badge ?? null;
    setSelectedAchievement(id);
  }, []);

  // The medal touched stays in view: scroll it above the sheet when the sheet would cover it
  useEffect(() => {
    const badge = selectedBadge.current;
    if (!selectedAchievement || !badge || sheetHeight === 0) return;
    badge.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height + RFValue(12) - (windowHeight - sheetHeight);
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }, [selectedAchievement, sheetHeight, windowHeight]);

  const totalStars = useMemo(() => progress.reduce((sum, p) => sum + (p.stars || 0), 0), [progress]);
  const context = useMemo(
    () => buildAchievementContext({ progress, dailyChallengeProgress, weeklyChallengeProgress, archiveProgress, createdLevels, bestStreak, totalHintsUsed, stats }),
    [progress, dailyChallengeProgress, weeklyChallengeProgress, archiveProgress, createdLevels, bestStreak, totalHintsUsed, stats]
  );
  const perfectRate = context.completedLevels > 0 ? Math.round((context.perfectLevels / context.completedLevels) * 100) : 0;

  const keyNumbers = [
    { value: String(currentStreak), label: t('profile.key_streak', { count: currentStreak }), color: colors.warning },
    { value: String(bestStreak), label: t('profile.key_best_streak'), color: colors.warning },
    { value: String(totalStars), label: t('profile.key_stars', { count: totalStars }), color: colors.starText },
    { value: `${achievements.length}/${ACHIEVEMENTS.length}`, label: t('profile.key_achievements'), color: colors.primaryText },
  ];

  const statGroups = [
    {
      title: t('profile.group_campaign'),
      rows: [
        [t('profile.levels_won'), String(context.completedLevels)],
        [t('profile.stars'), String(totalStars)],
        [t('profile.perfect_rate'), `${perfectRate} %`],
        [t('profile.no_hint_levels'), String(context.noHintLevels)],
      ],
    },
    {
      title: t('profile.group_challenges'),
      rows: [
        [t('profile.dailies_won'), String(context.dailies)],
        [t('profile.fastest_daily'), context.fastestDailyMs !== null ? formatDuration(context.fastestDailyMs) : '—'],
        [t('profile.weeklies_won'), String(context.weeklies)],
        [t('profile.archives_won'), String(context.archives)],
      ],
    },
    {
      title: t('profile.group_game'),
      rows: [
        [t('profile.play_time'), formatPlayTime(stats.totalPlayTimeMs)],
        [t('profile.total_moves'), String(stats.totalMoves)],
        [t('profile.hints_used'), String(totalHintsUsed)],
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Touching the header also closes the achievement sheet */}
      <Pressable onPress={selectedAchievement ? closeSheet : undefined} disabled={!selectedAchievement} accessible={false}>
        <ScreenHeader colors={colors} title={t('profile.title')} backLabel={t('common.home')} divider />
      </Pressable>

      <ScrollView
        ref={scrollRef}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + RFValue(40), sheetHeight + RFValue(20)) }}
      >
        {/* Touching the screen outside a badge closes the achievement sheet */}
        <Pressable onPress={selectedAchievement ? closeSheet : undefined} disabled={!selectedAchievement} accessible={false} style={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <PlayerLevelCard colors={colors} ring onSeeAll={() => router.push('/progression')}>
              <View style={styles.keyNumbers}>
                {keyNumbers.map(item => (
                  <View key={item.label} style={[styles.keyNumber, { backgroundColor: colors.card }]} accessible accessibilityLabel={`${item.value} ${item.label}`}>
                    <Text style={[styles.keyValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={[styles.keyLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </PlayerLevelCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <StreakCard colors={colors} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(125).duration(400)}>
            <RecapPreviewCard colors={colors} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">{t('profile.stats')}</Text>
            {statGroups.map(group => (
              <View key={group.title} style={[styles.statGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{group.title}</Text>
                {group.rows.map(([label, value], i) => (
                  <View
                    key={label}
                    style={[styles.statRow, i < group.rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                    accessible
                    accessibilityLabel={`${label} : ${value}`}
                  >
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <AchievementsSection colors={colors} context={context} selected={selectedAchievement} onSelect={selectAchievement} />
          </Animated.View>
        </Pressable>
      </ScrollView>

      <AchievementSheet colors={colors} context={context} id={selectedAchievement} onClose={closeSheet} onHeight={setSheetHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: RFValue(20),
    gap: RFValue(20),
  },
  keyNumbers: {
    flexDirection: 'row',
    gap: RFValue(6),
    marginTop: RFValue(8),
  },
  keyNumber: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(4),
    borderRadius: RFValue(12),
  },
  keyValue: {
    fontSize: RFValue(19),
    fontWeight: '800',
  },
  keyLabel: {
    fontSize: RFValue(11),
    textAlign: 'center',
  },
  section: {
    gap: RFValue(12),
  },
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  statGroup: {
    borderRadius: RFValue(16),
    borderWidth: 1,
    paddingHorizontal: RFValue(16),
    paddingVertical: RFValue(6),
  },
  groupTitle: {
    fontSize: RFValue(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: RFValue(10),
    paddingBottom: RFValue(4),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: RFValue(12),
  },
  statLabel: {
    flex: 1,
    fontSize: RFValue(15),
  },
  statValue: {
    fontSize: RFValue(17),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
