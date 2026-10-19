import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { useTranslation } from 'react-i18next';
import { getLocalDateString, getWeekKey, getDaysLeftInWeek, formatTimeLeft } from '@/utils/date';
import { getMissionsForDay, countMissionsDone } from '@/data/missions';
import { getFreezeCapacity, getPlayerLevel, dailyWinXp, weeklyWinXp } from '@/data/progression';
import { sampleLevels } from '@/data/sampleLevels';
import { useAppOpenAlert } from '@/hooks/useAppOpenAlert';
import { useNow } from '@/hooks/useNow';
import { useTheme, fixedColors } from '@/theme';
import ChallengeCard from '@/components/home/ChallengeCard';
import HomeHeader from '@/components/home/HomeHeader';
import HomeTabBar from '@/components/home/HomeTabBar';
import MissionsSheet from '@/components/home/MissionsSheet';
import OptionsSheet from '@/components/settings/OptionsSheet';
import PlayerLevelBadge from '@/components/progression/PlayerLevelBadge';
import BoardPreview from '@/components/garage/BoardPreview';
import { useNewAchievements } from '@/hooks/useNewAchievements';
import { useCosmetics } from '@/hooks/useCosmetics';
import { getMapFocusLevel } from '@/utils/mapFocus';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Width of the content column: everything lines up on it, whatever the language */
const COLUMN_MAX_WIDTH = 420;
const LOGO_SIZE = 92;
/** Best result of a daily or weekly challenge: its reward is shown as "up to" */
const MAX_STARS = 3;

/** Time left until the next local midnight, when the next daily challenge comes */
function timeUntilTomorrow(now: Date): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return formatTimeLeft(midnight.getTime() - now.getTime());
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark, scheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const currentStreak = useGameStore(s => s.currentStreak);
  const streakFreezes = useGameStore(s => s.streakFreezes);
  const dailyMissions = useGameStore(s => s.dailyMissions);
  const xp = useGameStore(s => s.xp);
  const progress = useGameStore(s => s.progress);
  const maxUnlockedLevel = useGameStore(s => s.maxUnlockedLevel);
  const lastPlayedLevelId = useGameStore(s => s.lastPlayedLevelId);
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const cosmetics = useGameStore(s => s.cosmetics);

  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isMissionsVisible, setMissionsVisible] = useState(false);

  // The screen stays mounted under the others: it follows the clock to show the new day
  const now = useNow();
  const dateStr = getLocalDateString(now);
  useAppOpenAlert(dateStr);
  const { unseen: newCosmetics } = useCosmetics();
  const newAchievements = useNewAchievements();

  const dailyStatus = dailyChallengeProgress[dateStr];

  const todayMissions = getMissionsForDay(dailyMissions, dateStr);
  const missionsDone = countMissionsDone(todayMissions);
  const freezeCapacity = getFreezeCapacity(getPlayerLevel(xp));

  const weekKey = getWeekKey(now);
  const weeklyStatus = weeklyChallengeProgress[weekKey];
  const daysLeftInWeek = getDaysLeftInWeek(now);

  // Play: the tutorial for a brand new player, otherwise the level the map opens on
  const isNewPlayer = progress.length === 0;
  const totalLevels = sampleLevels.length + generatedLevels.length;
  const focusLevel = getMapFocusLevel(lastPlayedLevelId, maxUnlockedLevel);
  const playContext = isNewPlayer
    ? t('home.play_tutorial')
    : focusLevel > totalLevels
      ? t('home.play_all_done')
      // The map opens on level 1 when the focus is not one of its levels
      : t('home.play_level', { level: Math.max(1, focusLevel) });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.delay(100)} style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.column}>
          <HomeHeader
            colors={colors}
            streak={currentStreak}
            freezes={streakFreezes}
            freezeCapacity={freezeCapacity}
            missionsDone={missionsDone}
            missionsTotal={todayMissions.ids.length}
            missionsRewarded={todayMissions.rewarded}
            newAchievements={newAchievements.length}
            onProfile={() => router.push('/profile')}
            onMissions={() => setMissionsVisible(true)}
            onSettings={() => setSettingsVisible(true)}
          />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          {/* Logo: a small board with the car equipped in the garage */}
          <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.hero}>
            <Pressable
              onPress={() => router.push('/garage')}
              accessibilityRole="button"
              accessibilityLabel={t('cosmetics.garage')}
            >
              <BoardPreview selection={cosmetics} scheme={scheme} size={LOGO_SIZE} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">Rush Hours</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('home.subtitle')}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(250).springify()}>
            <PlayerLevelBadge colors={colors} onPress={() => router.push('/profile')} />
          </Animated.View>

          {/* 1. Main action */}
          <AnimatedPressable
            entering={FadeInDown.delay(350).springify()}
            style={[styles.playButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            onPress={() => router.push(isNewPlayer ? '/tutorial' : '/map')}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.world_map')}, ${playContext}`}
          >
            <View style={styles.playTexts}>
              <Text style={styles.playText}>{t('home.world_map')}</Text>
              <Text style={styles.playContext} numberOfLines={1}>{playContext}</Text>
            </View>
            <View style={styles.playArrow}>
              <Ionicons name="play" size={22} color={fixedColors.onPrimary} />
            </View>
          </AnimatedPressable>

          {/* 2. Challenges: same structure, dimmed once won */}
          <View style={styles.challenges}>
            <ChallengeCard
              colors={colors}
              icon="calendar"
              title={t('home.daily_challenge')}
              done={!!dailyStatus?.completed}
              subtitle={dailyStatus?.completed
                ? `${t('home.won_stars', { count: dailyStatus.stars })} · ${t('home.daily_next', { time: timeUntilTomorrow(now) })}`
                : t('home.daily_desc')}
              reward={t('home.reward_xp', { xp: dailyWinXp(MAX_STARS) })}
              enteringDelay={450}
              onPress={() => router.push(`/game?levelId=daily&date=${dateStr}`)}
            />
            <ChallengeCard
              colors={colors}
              icon="trophy"
              title={t('home.weekly_challenge')}
              done={!!weeklyStatus?.completed}
              subtitle={weeklyStatus?.completed
                ? `${t('home.won_stars', { count: weeklyStatus.stars })} · ${t('home.weekly_next', { count: daysLeftInWeek })}`
                : t('home.weekly_days_left', { count: daysLeftInWeek })}
              reward={t('home.reward_xp', { xp: weeklyWinXp(MAX_STARS) })}
              enteringDelay={500}
              onPress={() => router.push(`/game?levelId=weekly&week=${weekKey}`)}
            />
          </View>
        </View>
      </ScrollView>

      {/* 3. Everything else */}
      <Animated.View entering={FadeIn.delay(300)}>
        <HomeTabBar
          colors={colors}
          bottomInset={insets.bottom}
          tabs={[
            { key: 'levels', icon: 'folder-open', label: t('home.my_levels'), onPress: () => router.push('/custom-levels') },
            { key: 'creator', icon: 'construct', label: t('home.tab_creator'), onPress: () => router.push('/creator') },
            {
              key: 'garage',
              icon: 'car-sport',
              label: t('cosmetics.garage'),
              badge: newCosmetics.length,
              accessibilityLabel: newCosmetics.length > 0
                ? `${t('cosmetics.garage')}, ${t('cosmetics.new_count', { count: newCosmetics.length })}`
                : t('cosmetics.garage'),
              onPress: () => router.push('/garage'),
            },
            // Optional, between friends on a self-hosted server (#46)
            { key: 'multi', icon: 'people', label: t('multi.title'), onPress: () => router.push('/multi') },
          ]}
        />
      </Animated.View>

      <MissionsSheet
        visible={isMissionsVisible}
        colors={colors}
        isDark={isDark}
        missions={todayMissions}
        freezeStockFull={streakFreezes >= freezeCapacity}
        onClose={() => setMissionsVisible(false)}
      />

      <OptionsSheet
        visible={isSettingsVisible}
        colors={colors}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  column: {
    width: '100%',
    maxWidth: COLUMN_MAX_WIDTH,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  title: {
    marginTop: 12,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 22,
    paddingRight: 16,
    borderRadius: 20,
    elevation: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  playTexts: {
    flex: 1,
  },
  playText: {
    color: fixedColors.onPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  playContext: {
    color: fixedColors.onPrimary,
    opacity: 0.85,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  playArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fixedColors.shine,
  },
  challenges: {
    gap: 10,
  },
});
