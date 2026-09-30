import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';

const ACHIEVEMENT_LIST = [
  { id: 'novice', icon: '🌟' },
  { id: 'expert', icon: '🏅' },
  { id: 'veteran', icon: '🎖️' },
  { id: 'perfectionist', icon: '⭐' },
  { id: 'daily_winner', icon: '📅' },
  { id: 'streak_3', icon: '🔥' },
  { id: 'streak_7', icon: '🔥🔥' },
  { id: 'streak_30', icon: '🔥🔥🔥' },
  { id: 'creator_star', icon: '🎨' },
  { id: 'daily_devotee', icon: '📆' },
  { id: 'weekly_warrior', icon: '⚔️' },
];

function getCalendarDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Monday-first day of week: 0=Mon, ..., 6=Sun
  const todayDow = (today.getDay() + 6) % 7;

  // Start from Monday, 4 weeks before this week's Monday
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - todayDow - 28);

  const days = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateString = d.toISOString().split('T')[0];
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
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0F0F1A' : '#F5F5FA';
  const textColor = isDark ? '#FFFFFF' : '#1A1A24';
  const secondaryTextColor = isDark ? '#A0A0B0' : '#606070';
  const cardColor = isDark ? '#1C1C28' : '#FFFFFF';
  const borderColor = isDark ? '#2D2D3A' : '#E0E0E8';
  const accentColor = isDark ? '#6C63FF' : '#5A4FE0';

  const progress = useGameStore((state) => state.progress || []);
  const currentStreak = useGameStore((state) => state.currentStreak || 0);
  const bestStreak = useGameStore((state) => state.bestStreak || 0);
  const dailyChallengeProgress = useGameStore((state) => state.dailyChallengeProgress || {});
  const totalHintsUsed = useGameStore((state) => state.totalHintsUsed || 0);
  const achievements = useGameStore((state) => state.achievements || []);

  const levelsCompleted = useMemo(() => progress.filter(p => p.completed).length, [progress]);
  const totalStars = useMemo(() => progress.reduce((sum, p) => sum + (p.stars || 0), 0), [progress]);
  const dailiesCompleted = useMemo(() => Object.values(dailyChallengeProgress).filter((p: any) => p.completed).length, [dailyChallengeProgress]);

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
        <Text style={[styles.title, { color: textColor }]}>{t('profile.title', 'Profile')}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Text style={{ color: accentColor, fontSize: RFValue(16), fontWeight: '600' }}>{t('common.close', 'Close')}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('profile.stats', 'Statistics')}</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>{levelsCompleted}</Text>
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
              <Text style={[styles.statValue, { color: textColor }]}>{dailiesCompleted}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.dailies_completed', 'Dailies Completed')}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.statValue, { color: textColor }]}>💡 {totalHintsUsed}</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>{t('profile.hints_used', 'Hints Used')}</Text>
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
                  const isCompleted = dailyChallengeProgress?.[day.dateString]?.completed;
                  const cellBgColor = isCompleted ? '#4CAF50' : (isDark ? '#2D2D3A' : '#E0E0E8');
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
          <Text style={[styles.sectionTitle, { color: textColor }]}>{t('profile.achievements', 'Achievements')}</Text>
          <View style={styles.achievementsList}>
            {ACHIEVEMENT_LIST.map((ach) => {
              const isUnlocked = achievements?.includes(ach.id);
              return (
                <View key={ach.id} style={[styles.achievementCard, { backgroundColor: cardColor, borderColor }]}>
                  <View style={[styles.achievementIconContainer, { opacity: isUnlocked ? 1 : 0.4 }]}>
                    <Text style={styles.achievementIcon}>{isUnlocked ? ach.icon : '🔒'}</Text>
                  </View>
                  <View style={styles.achievementTextContainer}>
                    <Text style={[styles.achievementName, { color: textColor, opacity: isUnlocked ? 1 : 0.6 }]}>
                      {t(`achievements.${ach.id}`)}
                    </Text>
                    <Text style={[styles.achievementDesc, { color: secondaryTextColor, opacity: isUnlocked ? 1 : 0.6 }]}>
                      {t(`achievements.${ach.id}_desc`)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
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
    shadowColor: '#000',
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
    shadowColor: '#000',
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
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
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
