import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { useGameStore } from '@/store/gameStore';
import { haptics, Haptics } from '@/utils/haptics';
import { useTranslation } from 'react-i18next';
import { getLocalDateString, getWeekKey, getDaysLeftInWeek } from '@/utils/date';
import { getMissionsForDay, countMissionsDone } from '@/data/missions';
import { useAppOpenAlert } from '@/hooks/useAppOpenAlert';
import { useTheme, fixedColors } from '@/theme';
import ChallengeButton from '@/components/home/ChallengeButton';
import MissionsSheet from '@/components/home/MissionsSheet';
import OptionsSheet from '@/components/settings/OptionsSheet';
import PlayerLevelBadge from '@/components/progression/PlayerLevelBadge';
import { useCosmetics } from '@/hooks/useCosmetics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const currentStreak = useGameStore(s => s.currentStreak);
  const streakFreezes = useGameStore(s => s.streakFreezes);
  const dailyMissions = useGameStore(s => s.dailyMissions);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.Text
        entering={FadeInUp.delay(200).springify()}
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
      >
        Rush Hours
      </Animated.Text>

      <Animated.Text
        entering={FadeInUp.delay(400).springify()}
        style={[styles.subtitle, { color: colors.textMuted }]}
      >
        {t('home.subtitle')}
      </Animated.Text>

      <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.badgeWrap}>
        <PlayerLevelBadge colors={colors} onPress={() => router.push('/profile')} />
      </Animated.View>

      <AnimatedPressable
        entering={FadeInDown.delay(600).springify()}
        style={[styles.playButton, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => {
          router.push('/map');
        }}
        accessibilityRole="button"
      >
        <Text style={styles.playText}>{t('home.world_map') || 'Play'}</Text>
      </AnimatedPressable>

      <ChallengeButton
        colors={colors}
        color={colors.primary}
        done={!!dailyStatus?.completed}
        label={dailyStatus?.completed ? t('home.daily_done', { stars: dailyStatus.stars }) : t('home.daily_challenge')}
        enteringDelay={750}
        onPress={() => router.push(`/game?levelId=daily&date=${dateStr}`)}
      />

      <ChallengeButton
        colors={colors}
        color={colors.weekly}
        done={!!weeklyStatus?.completed}
        label={weeklyStatus?.completed ? t('home.weekly_done', { stars: weeklyStatus.stars }) : t('home.weekly_challenge')}
        detail={weeklyStatus?.completed ? undefined : t('home.weekly_days_left', { count: getDaysLeftInWeek(new Date()) })}
        enteringDelay={775}
        onPress={() => router.push(`/game?levelId=weekly&week=${weekKey}`)}
      />

      {currentStreak > 0 && (
        <Animated.Text
          entering={FadeInDown.delay(800).springify()}
          style={[styles.streakText, { color: colors.warning }]}
        >
          {t('home.streak', { count: currentStreak })}
          {streakFreezes > 0 ? `   ❄️ ×${streakFreezes}` : ''}
        </Animated.Text>
      )}

      <AnimatedPressable
        entering={FadeInDown.delay(825).springify()}
        style={[styles.missionsPill, { backgroundColor: colors.card }]}
        onPress={() => {
          haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setMissionsVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.missions_progress', { done: missionsDone, total: todayMissions.ids.length })}
      >
        <Text style={[styles.missionsPillText, { color: todayMissions.rewarded ? colors.success : colors.text }]}>
          🎯 {t('missions.title')} {missionsDone}/{todayMissions.ids.length}
        </Text>
      </AnimatedPressable>

      <MissionsSheet
        visible={isMissionsVisible}
        colors={colors}
        isDark={isDark}
        missions={todayMissions}
        onClose={() => setMissionsVisible(false)}
      />

      <View style={styles.footerLinks}>
        <AnimatedPressable
          entering={FadeInDown.delay(900).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/custom-levels')}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('home.my_levels')}</Text>
        </AnimatedPressable>

        <AnimatedPressable
          entering={FadeInDown.delay(950).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/profile')}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('home.profile')}</Text>
        </AnimatedPressable>

        <AnimatedPressable
          entering={FadeInDown.delay(1000).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/creator')}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('home.level_creator')}</Text>
        </AnimatedPressable>
      </View>

      <View style={[styles.footerLinks, { marginTop: -10 }]}>
        <AnimatedPressable
          entering={FadeInDown.delay(1100).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/tutorial')}
          accessibilityRole="link"
        >
          <Text style={[styles.linkText, { color: colors.textMuted }]}>{t('home.how_to_play')}</Text>
        </AnimatedPressable>

        <AnimatedPressable
          entering={FadeInDown.delay(1150).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/garage')}
          accessibilityRole="link"
          accessibilityLabel={newCosmetics.length > 0
            ? `${t('cosmetics.garage')}, ${t('cosmetics.new_count', { count: newCosmetics.length })}`
            : t('cosmetics.garage')}
        >
          <Text style={[styles.linkText, { color: colors.primaryText }]}>
            🚘 {t('cosmetics.garage')}{newCosmetics.length > 0 ? ` (${newCosmetics.length})` : ''}
          </Text>
        </AnimatedPressable>

      </View>

      {/* Settings Button */}
      <Animated.View entering={FadeIn.delay(1200)} style={styles.headerRight}>
        <Pressable
          onPress={() => {
            haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSettingsVisible(true);
          }}
          style={[styles.settingsButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.settings')}
        >
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </Pressable>
      </Animated.View>

      <OptionsSheet
        visible={isSettingsVisible}
        colors={colors}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  badgeWrap: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 48,
  },
  playButton: {
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playText: {
    color: fixedColors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  missionsPill: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  missionsPillText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  linkButton: {
    marginTop: 24,
    padding: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  headerRight: {
    position: 'absolute',
    top: 60,
    right: 24,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
