import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';
import { haptics, Haptics } from '@/utils/haptics';
import { useTranslation } from 'react-i18next';
import { getLocalDateString, getWeekKey, getDaysLeftInWeek } from '@/utils/date';
import { getMissionsForDay, countMissionsDone } from '@/data/missions';
import { getFreezeCapacity, getPlayerLevel } from '@/data/progression';
import { useAppOpenAlert } from '@/hooks/useAppOpenAlert';
import { useTheme, fixedColors } from '@/theme';
import type { UiColors } from '@/theme';
import ChallengeButton from '@/components/home/ChallengeButton';
import MissionsSheet from '@/components/home/MissionsSheet';
import OptionsSheet from '@/components/settings/OptionsSheet';
import PlayerLevelBadge from '@/components/progression/PlayerLevelBadge';
import { useCosmetics } from '@/hooks/useCosmetics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Width of the content column: everything lines up on it, whatever the language */
const COLUMN_MAX_WIDTH = 420;

interface ShortcutProps {
  colors: UiColors;
  icon: string;
  label: string;
  /** Small counter in the corner of the icon (new cosmetics) */
  badge?: number;
  accessibilityLabel?: string;
  enteringDelay: number;
  onPress: () => void;
}

/** Square tile of the shortcut grid: same size for every label, which wraps on two lines if needed */
function Shortcut({ colors, icon, label, badge, accessibilityLabel, enteringDelay, onPress }: ShortcutProps) {
  return (
    <AnimatedPressable
      entering={FadeInDown.delay(enteringDelay).springify()}
      style={[styles.shortcut, { backgroundColor: colors.card }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View>
        <Text style={styles.shortcutIcon}>{icon}</Text>
        {badge ? (
          <View style={[styles.shortcutBadge, { backgroundColor: colors.danger }]}>
            <Text style={styles.shortcutBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.shortcutLabel, { color: colors.text }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const currentStreak = useGameStore(s => s.currentStreak);
  const streakFreezes = useGameStore(s => s.streakFreezes);
  const dailyMissions = useGameStore(s => s.dailyMissions);
  const xp = useGameStore(s => s.xp);

  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isMissionsVisible, setMissionsVisible] = useState(false);

  useAppOpenAlert();
  const { unseen: newCosmetics } = useCosmetics();

  const dateStr = getLocalDateString(new Date());
  const dailyStatus = dailyChallengeProgress[dateStr];

  const todayMissions = getMissionsForDay(dailyMissions, dateStr);
  const missionsDone = countMissionsDone(todayMissions);

  const weekKey = getWeekKey(new Date());
  const weeklyStatus = weeklyChallengeProgress[weekKey];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header: profile on the left, settings on the right, so the title stays centered */}
      <Animated.View entering={FadeIn.delay(1000)} style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.push('/profile')}
          style={[styles.iconButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('home.profile')}
          hitSlop={8}
        >
          <Text style={styles.iconButtonText}>👤</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSettingsVisible(true);
          }}
          style={[styles.iconButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.settings')}
          hitSlop={8}
        >
          <Text style={styles.iconButtonText}>⚙️</Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {/* Title */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.hero}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              Rush Hours
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
              {t('home.subtitle')}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).springify()}>
            <PlayerLevelBadge colors={colors} onPress={() => router.push('/profile')} />
          </Animated.View>

          {/* Main action */}
          <AnimatedPressable
            entering={FadeInDown.delay(550).springify()}
            style={[styles.playButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            onPress={() => router.push('/map')}
            accessibilityRole="button"
          >
            <Text style={styles.playText}>▶  {t('home.world_map')}</Text>
          </AnimatedPressable>

          {/* Tutorial, right under Play for new players */}
          <AnimatedPressable
            entering={FadeInDown.delay(600).springify()}
            style={styles.tutorialLink}
            onPress={() => router.push('/tutorial')}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={[styles.tutorialText, { color: colors.primaryText }]}>❓ {t('home.how_to_play')}</Text>
          </AnimatedPressable>

          {/* Challenges */}
          <View style={styles.row}>
            <ChallengeButton
              colors={colors}
              icon="📅"
              done={!!dailyStatus?.completed}
              label={dailyStatus?.completed ? t('home.daily_done', { stars: dailyStatus.stars }) : t('home.daily_challenge')}
              enteringDelay={650}
              onPress={() => router.push(`/game?levelId=daily&date=${dateStr}`)}
            />
            <ChallengeButton
              colors={colors}
              icon="🏆"
              done={!!weeklyStatus?.completed}
              label={weeklyStatus?.completed ? t('home.weekly_done', { stars: weeklyStatus.stars }) : t('home.weekly_challenge')}
              detail={weeklyStatus?.completed ? undefined : t('home.weekly_days_left', { count: getDaysLeftInWeek(new Date()) })}
              enteringDelay={700}
              onPress={() => router.push(`/game?levelId=weekly&week=${weekKey}`)}
            />
          </View>

          {/* Optional, between friends on a self-hosted server (#46) */}
          <AnimatedPressable
            entering={FadeInDown.delay(750).springify()}
            style={[styles.multiButton, { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft }]}
            onPress={() => router.push('/multi')}
            accessibilityRole="button"
            accessibilityLabel={t('multi.title')}
          >
            <Text style={[styles.multiText, { color: colors.primaryText }]} numberOfLines={1}>
              👥  {t('multi.title')}
            </Text>
          </AnimatedPressable>

          {/* Streak and missions */}
          <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.chips}>
            {currentStreak > 0 && (
              <View style={[styles.chip, { backgroundColor: colors.warningSoft }]}>
                <Text style={[styles.chipText, { color: colors.warning }]} numberOfLines={1}>
                  {t('home.streak', { count: currentStreak })}
                  {streakFreezes > 0 ? `  ❄️ ×${streakFreezes}` : ''}
                </Text>
              </View>
            )}
            <Pressable
              style={[styles.chip, { backgroundColor: todayMissions.rewarded ? colors.successSoft : colors.card }]}
              onPress={() => {
                haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMissionsVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.missions_progress', { done: missionsDone, total: todayMissions.ids.length })}
            >
              <Text
                style={[styles.chipText, { color: todayMissions.rewarded ? colors.success : colors.text }]}
                numberOfLines={1}
              >
                🎯 {t('missions.title')} {missionsDone}/{todayMissions.ids.length}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Shortcuts: three equal tiles, so the grid stays centered in every language */}
          <View style={[styles.row, styles.shortcuts]}>
            <Shortcut
              colors={colors}
              icon="📁"
              label={t('home.my_levels')}
              enteringDelay={850}
              onPress={() => router.push('/custom-levels')}
            />
            <Shortcut
              colors={colors}
              icon="🛠️"
              label={t('home.level_creator')}
              enteringDelay={900}
              onPress={() => router.push('/creator')}
            />
            <Shortcut
              colors={colors}
              icon="🚘"
              label={t('cosmetics.garage')}
              badge={newCosmetics.length}
              accessibilityLabel={newCosmetics.length > 0
                ? `${t('cosmetics.garage')}, ${t('cosmetics.new_count', { count: newCosmetics.length })}`
                : t('cosmetics.garage')}
              enteringDelay={950}
              onPress={() => router.push('/garage')}
            />
          </View>
        </View>
      </ScrollView>

      <MissionsSheet
        visible={isMissionsVisible}
        colors={colors}
        isDark={isDark}
        missions={todayMissions}
        freezeStockFull={streakFreezes >= getFreezeCapacity(getPlayerLevel(xp))}
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
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 22,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  column: {
    width: '100%',
    maxWidth: COLUMN_MAX_WIDTH,
    gap: 14,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  playButton: {
    marginTop: 6,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playText: {
    color: fixedColors.onPrimary,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tutorialLink: {
    alignSelf: 'center',
    marginTop: -4,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  tutorialText: {
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  multiButton: {
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  multiText: {
    fontSize: 16,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  shortcuts: {
    marginTop: 10,
    gap: 10,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    gap: 6,
  },
  shortcutIcon: {
    fontSize: 24,
    textAlign: 'center',
  },
  shortcutBadge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutBadgeText: {
    color: fixedColors.onPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    // Two lines reserved: tiles keep the same height whether the label wraps or not
    minHeight: 30,
  },
});
