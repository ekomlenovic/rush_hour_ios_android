import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { getFreezeCapacity, getPlayerLevel } from '@/data/progression';
import PlayerLevelCard from '@/components/progression/PlayerLevelCard';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { getLocalDateString, formatDuration } from '@/utils/date';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, buildAchievementContext } from '@/data/achievements';
import { fixedColors, useTheme } from '@/theme';


function getCalendarDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateString(today);

  // Monday-first day of week: 0=Mon, ..., 6=Sun
  const todayDow = (today.getDay() + 6) % 7;

  // Start from Monday, 4 weeks before this week's Monday
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - todayDow - 28);

  const days = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateString = getLocalDateString(d);
    days.push({
      date: d,
      dateString,
      isToday: dateString === todayStr,
      isFuture: d > today,
    });
  }
  return days;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const { colors } = useTheme();
  const bgColor = colors.background;
  const textColor = colors.text;
  const secondaryTextColor = colors.textMuted;
  const cardColor = colors.surface;
  const borderColor = colors.border;
  const accentColor = colors.primary;

  const progress = useGameStore((state) => state.progress || []);
  const currentStreak = useGameStore((state) => state.currentStreak || 0);
  const bestStreak = useGameStore((state) => state.bestStreak || 0);
  const dailyChallengeProgress = useGameStore((state) => state.dailyChallengeProgress || {});
  const totalHintsUsed = useGameStore((state) => state.totalHintsUsed || 0);
  const achievements = useGameStore((state) => state.achievements || []);
  const weeklyChallengeProgress = useGameStore((state) => state.weeklyChallengeProgress || {});
  const createdLevels = useGameStore((state) => state.createdLevels);
  const stats = useGameStore((state) => state.stats);
  const streakFreezes = useGameStore((state) => state.streakFreezes);
  const frozenDates = useGameStore((state) => state.frozenDates);
  const frozenSet = useMemo(() => new Set(frozenDates), [frozenDates]);
  const xp = useGameStore((state) => state.xp);
  const freezeCapacity = getFreezeCapacity(getPlayerLevel(xp));

  const totalStars = useMemo(() => progress.reduce((sum, p) => sum + (p.stars || 0), 0), [progress]);
  const context = useMemo(
    () => buildAchievementContext({ progress, dailyChallengeProgress, weeklyChallengeProgress, createdLevels, bestStreak, totalHintsUsed, stats }),
    [progress, dailyChallengeProgress, weeklyChallengeProgress, createdLevels, bestStreak, totalHintsUsed, stats]
  );
  const perfectRate = context.completedLevels > 0 ? Math.round((context.perfectLevels / context.completedLevels) * 100) : 0;

  const days = useMemo(() => getCalendarDays(), []);
  const weekDays = [
    t('profile.mon', 'L'),
    t('profile.tue', 'M'),
    t('profile.wed', 'M'),
    t('profile.thu', 'J'),
    t('profile.fri', 'V'),
    t('profile.sat', 'S'),
    t('profile.sun', 'D'),
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.title, { color: textColor }]} accessibilityRole="header">{t('profile.title', 'Profile')}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.primaryText, fontSize: RFValue(16), fontWeight: '600' }}>{t('common.close', 'Close')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('progression.player_level')}</Text>
          <PlayerLevelCard colors={colors} onSeeAll={() => router.push('/progression')} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('profile.stats', 'Statistics')}</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{context.completedLevels}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.levels_completed', 'Levels Completed')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{totalStars}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.total_stars', 'Total Stars')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>🔥 {currentStreak}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.current_streak', 'Current Streak')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{bestStreak}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.best_streak', 'Best Streak')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>❄️ {streakFreezes}/{freezeCapacity}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.streak_freezes')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{context.dailies}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.dailies_completed', 'Dailies Completed')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>💡 {totalHintsUsed}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.hints_used', 'Hints Used')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>⏳ {formatDuration(stats.totalPlayTimeMs)}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.play_time')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{perfectRate}%</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.perfect_rate')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{context.noHintLevels}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.no_hint_levels')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{stats.totalMoves}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.total_moves')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>
                {context.fastestDailyMs !== null ? formatDuration(context.fastestDailyMs) : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.fastest_daily')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{context.weeklies}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.weeklies_completed')}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('profile.streak_calendar', 'Streak Calendar')}</Text>
          <View style={[styles.calendarCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.calendarRow}>
              {weekDays.map((day, i) => (
                <Text key={i} style={[styles.weekDayText, { color: secondaryTextColor }]}>{day}</Text>
              ))}
            </View>
            {[0, 1, 2, 3, 4].map((weekIdx) => (
              <View key={weekIdx} style={styles.calendarRow}>
                {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((day) => {
                  if (day.isFuture) {
                    return <View key={day.dateString} style={[styles.calendarCell, { backgroundColor: 'transparent' }]} />;
                  }
                  const daily = dailyChallengeProgress?.[day.dateString];
                  const cellBgColor = daily?.completed
                    ? colors.dailyStars[daily.stars - 1] ?? colors.dailyStars[2]
                    : frozenSet.has(day.dateString) ? colors.frozen
                    : borderColor;
                  return (
                    <View
                      key={day.dateString}
                      style={[
                        styles.calendarCell,
                        {
                          backgroundColor: cellBgColor,
                          borderColor: day.isToday ? accentColor : 'transparent',
                          borderWidth: day.isToday ? 2 : 0,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[styles.section, { paddingBottom: RFValue(40) }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            {t('profile.achievements', 'Achievements')} · {achievements.length}/{ACHIEVEMENTS.length}
          </Text>
          {ACHIEVEMENT_CATEGORIES.map((category) => (
            <View key={category} style={styles.achievementCategory}>
              <Text style={[styles.categoryTitle, { color: secondaryTextColor }]}>{t(`achievements.categories.${category}`)}</Text>
              <View style={styles.achievementsList}>
                {ACHIEVEMENTS.filter(a => a.category === category).map((ach) => {
                  const isUnlocked = achievements.includes(ach.id);
                  const isSecret = ach.hidden && !isUnlocked;
                  const current = Math.min(ach.value(context), ach.target);
                  const showProgress = !isUnlocked && !isSecret && ach.target > 1;
                  return (
                    <View key={ach.id} style={[styles.achievementCard, { backgroundColor: cardColor, borderColor }]}>
                      <View style={[styles.achievementIconContainer, { opacity: isUnlocked ? 1 : 0.4 }]}>
                        <Text style={styles.achievementIcon}>{isUnlocked ? ach.icon : '🔒'}</Text>
                      </View>
                      <View style={styles.achievementTextContainer}>
                        <Text style={[styles.achievementName, { color: textColor, opacity: isUnlocked ? 1 : 0.6 }]}>
                          {isSecret ? '???' : t(`achievements.${ach.id}`)}
                        </Text>
                        <Text style={[styles.achievementDesc, { color: secondaryTextColor, opacity: isUnlocked ? 1 : 0.6 }]}>
                          {isSecret ? t('achievements.secret_desc') : t(`achievements.${ach.id}_desc`)}
                        </Text>
                        {showProgress && (
                          <View style={styles.progressRow}>
                            <View style={[styles.progressTrack, { backgroundColor: borderColor }]}>
                              <View style={[styles.progressFill, { width: `${(current / ach.target) * 100}%`, backgroundColor: accentColor }]} />
                            </View>
                            <Text style={[styles.progressText, { color: secondaryTextColor }]}>{current}/{ach.target}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </Animated.View>
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
    paddingTop: RFValue(50),
    paddingBottom: RFValue(15),
    borderBottomWidth: 1,
    position: 'relative',
  },
  title: {
    fontSize: RFValue(20),
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: RFValue(20),
    bottom: RFValue(15),
    padding: RFValue(5),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: RFValue(20),
  },
  section: {
    marginBottom: RFValue(24),
  },
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: RFValue(12),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: RFValue(16),
    borderRadius: RFValue(12),
    borderWidth: 1,
    marginBottom: RFValue(12),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: RFValue(24),
    fontWeight: 'bold',
    marginBottom: RFValue(4),
  },
  statLabel: {
    fontSize: RFValue(12),
    textAlign: 'center',
  },
  calendarCard: {
    padding: RFValue(12),
    borderRadius: RFValue(12),
    borderWidth: 1,
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarRow: {
    flexDirection: 'row',
    marginBottom: RFValue(4),
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: RFValue(11),
    fontWeight: '600',
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: RFValue(4),
    marginHorizontal: RFValue(2),
  },
  achievementCategory: {
    marginBottom: RFValue(16),
  },
  categoryTitle: {
    fontSize: RFValue(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: RFValue(8),
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: RFValue(8),
  },
  progressTrack: {
    flex: 1,
    height: RFValue(6),
    borderRadius: RFValue(3),
    overflow: 'hidden',
    marginRight: RFValue(8),
  },
  progressFill: {
    height: '100%',
    borderRadius: RFValue(3),
  },
  progressText: {
    fontSize: RFValue(11),
    fontWeight: '600',
  },
  achievementsList: {
    gap: RFValue(12),
  },
  achievementCard: {
    flexDirection: 'row',
    padding: RFValue(16),
    borderRadius: RFValue(12),
    borderWidth: 1,
    alignItems: 'center',
  },
  achievementIconContainer: {
    width: RFValue(48),
    height: RFValue(48),
    borderRadius: RFValue(24),
    backgroundColor: fixedColors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: RFValue(16),
  },
  achievementIcon: {
    fontSize: RFValue(24),
  },
  achievementTextContainer: {
    flex: 1,
  },
  achievementName: {
    fontSize: RFValue(16),
    fontWeight: 'bold',
    marginBottom: RFValue(4),
  },
  achievementDesc: {
    fontSize: RFValue(13),
  },
});
