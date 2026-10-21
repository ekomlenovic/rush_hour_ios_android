import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Alert, AccessibilityInfo, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { haptics, Haptics } from '@/utils/haptics';
import Board from '@/components/Board';
import { useGameStore } from '@/store/gameStore';
import type { MissionReward } from '@/data/missions';
import { isBossLevel } from '@/data/bosses';
import { newlyUnlockedCosmetics } from '@/data/cosmetics';
import { checkWin } from '@/utils/collision';
import { solvePuzzleAsync } from '@/utils/solver.background';
import { customLevelKind, customLevelTitle } from '@/utils/customLevels';
import { useTranslation } from 'react-i18next';
import { parseLocalDateString } from '@/utils/date';
import { buildChallengeShareText } from '@/utils/shareResult';
import { requestReminderPermission } from '@/utils/notifications';
import { calculateScore, getStars } from '@/utils/scoring';
import { importSharedLevel, resolveLevel, GameRouteParams } from '@/utils/levelResolver';
import { isArchiveDateAvailable } from '@/utils/archives';
import { isDailyOpen, isWeeklyOpen } from '@/utils/challengeDates';
import { nextMapLevel } from '@/utils/mapFocus';
import { sampleLevels } from '@/data/sampleLevels';
import { useActivePlayTime } from '@/hooks/useActivePlayTime';
import { useOpenDaily } from '@/hooks/useOpenDaily';
import { describeVehicle, getVehicleLetters, getMoveDirection } from '@/utils/accessibility';
import { useTheme } from '@/theme';
import GameLoading from '@/components/game/GameLoading';
import GameStatsBar from '@/components/game/GameStatsBar';
import GameActions from '@/components/game/GameActions';
import WinModal from '@/components/game/WinModal';
import ShareLevelSheet from '@/components/share/ShareLevelSheet';
import ShareIcon from '@/components/share/ShareIcon';
import ChallengeDoneBanner from '@/components/game/ChallengeDoneBanner';
import type { SolutionSource } from '@/components/game/SolutionPlayer';
import IconText from '@/components/IconText';
import HintLoadingPill from '@/components/game/HintLoadingPill';
import SolutionPlayer from '@/components/game/SolutionPlayer';

export default function GameScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark, board } = useTheme();
  const winEffect = useGameStore(s => s.cosmetics.effect);
  const winEffectColors = useMemo(() => [board.targetCar, ...board.vehicles.slice(0, 6)], [board]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ levelId: string; date?: string; week?: string; data?: string }>();

  const currentLevel = useGameStore(s => s.currentLevel);
  const vehicles = useGameStore(s => s.vehicles);
  const moveCount = useGameStore(s => s.moveCount);
  const loadLevel = useGameStore(s => s.loadLevel);
  const moveVehicle = useGameStore(s => s.moveVehicle);
  const undo = useGameStore(s => s.undo);
  const resetLevel = useGameStore(s => s.resetLevel);
  const completeLevel = useGameStore(s => s.completeLevel);
  const createdLevels = useGameStore(s => s.createdLevels);
  const importedLevels = useGameStore(s => s.importedLevels);
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const cancelGeneration = useGameStore(s => s.cancelGeneration);
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const recordHintUsed = useGameStore(s => s.recordHintUsed);

  const [won, setWon] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [hintVehicleId, setHintVehicleId] = useState<string | null>(null);
  const [computedMinMoves, setComputedMinMoves] = useState<number | null>(null);
  const [hintRemainingMoves, setHintRemainingMoves] = useState<number | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [winTimeMs, setWinTimeMs] = useState<number | null>(null);
  const [winUnlocks, setWinUnlocks] = useState<string[]>([]);
  const [winCosmetics, setWinCosmetics] = useState<string[]>([]);
  const [winMissionReward, setWinMissionReward] = useState<MissionReward | null>(null);
  const [winXpGain, setWinXpGain] = useState<{ from: number; to: number } | null>(null);
  const [winLevelUps, setWinLevelUps] = useState<number[]>([]);

  const [isShareVisible, setShareVisible] = useState(false);
  const [isSolutionVisible, setSolutionVisible] = useState(false);
  const [solutionStart, setSolutionStart] = useState<SolutionSource>('optimal');

  // Daily and weekly challenges are one-shot: no hint, undo or reset (see docs/GAME_DESIGN.md)
  const challengeKind = params.levelId === 'daily' && params.date ? 'daily'
    : params.levelId === 'weekly' && params.week ? 'weekly'
    : null;
  const challengeResult = challengeKind === 'daily' ? dailyChallengeProgress[params.date!]
    : challengeKind === 'weekly' ? weeklyChallengeProgress[params.week!]
    : undefined;
  const isChallengeCompleted = !!challengeResult?.completed;
  // A past daily replayed from the archives: training, played like a map level
  const isArchive = params.levelId === 'archive' && !!params.date;

  /** Back where the level was opened from; home for a level opened by a link at launch (nothing under it) */
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // Wordle-like result of the daily / weekly challenge (no spoiler)
  const handleShareResult = async () => {
    const state = useGameStore.getState();
    const key = challengeKind === 'daily' ? params.date : params.week;
    const result = challengeKind === 'daily' ? state.dailyChallengeProgress[key!]
      : challengeKind === 'weekly' ? state.weeklyChallengeProgress[key!]
      : undefined;
    if (!challengeKind || !key || !result) return;

    const message = buildChallengeShareText(t, {
      kind: challengeKind,
      key,
      result,
      streak: state.currentStreak,
      language: i18n.language,
    });
    try {
      const shared = await Share.share({ message });
      if (shared.action === Share.sharedAction) {
        state.recordResultShared();
      }
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  // After the first daily won, offer the reminders once (see docs/GAME_DESIGN.md)
  const handleWinContinue = () => {
    // A challenge stays open on its result: going back under the closing modal
    // only happened once it was gone, seconds later (see docs/GAME_DESIGN.md)
    if (challengeKind) setWon(false);
    else goBack();
    const state = useGameStore.getState();
    if (challengeKind !== 'daily' || state.notificationsPrompted || state.notificationsEnabled) return;
    state.markNotificationsPrompted();
    setTimeout(() => {
      Alert.alert(t('reminders.prompt_title'), t('reminders.prompt_body'), [
        { text: t('common.later'), style: 'cancel' },
        {
          text: t('reminders.prompt_yes'),
          onPress: async () => {
            if (await requestReminderPermission()) {
              useGameStore.getState().setNotificationsEnabled(true);
            }
          },
        },
      ]);
    }, 400);
  };

  /** From the win screen straight into the following level of the map: back from it still leads to the map */
  const handleNextLevel = (levelId: number) => {
    router.replace(`/game?levelId=${levelId}`);
  };

  /** From the win screen to the garage, to pick what the win unlocked; back from it leads where Continue goes */
  const handleOpenGarage = () => {
    if (challengeKind) {
      setWon(false);
      router.push('/garage');
    } else {
      router.replace('/garage');
    }
  };

  /** A route to a level that can't be played (a broken or outdated link) */
  const closeUnavailable = () => {
    Alert.alert(t('common.error'), t('game.load_error'));
    goBack();
  };

  // Load the level and compute the real minMoves via BFS
  useEffect(() => {
    setLoading(true);
    setWon(false);
    setHintRemainingMoves(null);

    // CRITICAL: Stop any background generation to free up main thread for gameplay
    cancelGeneration();

    const timer = setTimeout(async () => {
      // A shared link (rush-hours://game?data=…): imported, then opened as an imported level
      if (params.data && !params.levelId) {
        const id = await importSharedLevel(params.data);
        if (id !== null) {
          router.replace(`/game?levelId=${id}`);
        } else {
          Alert.alert(t('common.error'), t('custom_levels.import_error'));
          // Opened by the link at launch: nothing to go back to
          goBack();
        }
        return;
      }
      // The daily and the weekly open on their own day and week only (issue 119): a past day is an archive
      if (params.levelId === 'daily' && !isDailyOpen(params.date ?? '')) {
        if (params.date && isArchiveDateAvailable(params.date)) return router.replace(`/game?levelId=archive&date=${params.date}`);
        return closeUnavailable();
      }
      if (params.levelId === 'weekly' && !isWeeklyOpen(params.week ?? '')) return closeUnavailable();

      const level = await resolveLevel(params as GameRouteParams);

      if (level) {
        loadLevel(level);
        setComputedMinMoves(level.minMoves > 0 ? level.minMoves : null);
        setLoading(false);
      } else {
        // Never left on the loading screen: a route without a level (a deleted level, a broken link) goes back
        console.error("Level not found for ID:", params.levelId);
        closeUnavailable();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [params.levelId, params.date, params.week, params.data, createdLevels, importedLevels]);

  const playTime = useActivePlayTime(!isLoading && !!currentLevel && !won && !isChallengeCompleted);

  // A daily left open past midnight can still be won: while it is open, its day is not missed (see docs/GAME_DESIGN.md)
  useOpenDaily(challengeKind === 'daily' && !isLoading && !isChallengeCompleted ? params.date! : null);

  const handleMoveEnd = useCallback((vehicleId: string, newRow: number, newCol: number) => {
    if (won || isChallengeCompleted) return false;
    // Refused when another vehicle took the room meanwhile (two fingers): the block goes back
    if (!moveVehicle(vehicleId, newRow, newCol)) return false;

    setHintVehicleId(null); // Clear hint highlight on any move
    setHintRemainingMoves(null);

    // Check win after store update
    const updatedVehicles = useGameStore.getState().vehicles;
    const updatedMoveCount = useGameStore.getState().moveCount;
    if (currentLevel && checkWin(updatedVehicles, currentLevel.exitRow, currentLevel.exitCol, currentLevel.gridSize)) {
      // Stop the clock before recording the win
      playTime.stop();
      const timeMs = useGameStore.getState().currentAttempt.elapsedMs;

      // Calculate and save score
      const minMoves = computedMinMoves ?? currentLevel.minMoves;
      const score = calculateScore(updatedMoveCount, minMoves);
      const stars = getStars(updatedMoveCount, minMoves);

      const details = { moves: updatedMoveCount, minMoves, moveLog: useGameStore.getState().moveLog };
      const before = useGameStore.getState();
      if (challengeKind === 'daily') {
        useGameStore.getState().completeDailyChallenge(params.date!, score, stars, timeMs, details);
      } else if (challengeKind === 'weekly') {
        useGameStore.getState().completeWeeklyChallenge(params.week!, score, stars, timeMs, details);
      } else if (isArchive) {
        useGameStore.getState().completeArchiveChallenge(params.date!, score, stars, timeMs, details);
      } else {
        completeLevel(currentLevel.id, score, stars, timeMs);
      }

      // Unlocked achievements are shown in the win modal instead of the global toast
      setWinUnlocks(useGameStore.getState().consumeUnlockQueue());
      setWinCosmetics(newlyUnlockedCosmetics(before, useGameStore.getState()));
      setWinMissionReward(useGameStore.getState().consumeMissionReward());
      setWinXpGain(useGameStore.getState().lastXpGain);
      setWinLevelUps(useGameStore.getState().consumeLevelUps());
      setWinTimeMs(timeMs);
      setWon(true);
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return true;
  }, [won, isChallengeCompleted, moveVehicle, currentLevel, computedMinMoves, completeLevel, challengeKind, isArchive, params.date, params.week, playTime.stop]);

  const handleUndo = useCallback(() => {
    undo();
    setHintVehicleId(null);
    setHintRemainingMoves(null);
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [undo]);

  const handleReset = useCallback(() => {
    resetLevel();
    setWon(false);
    setHintVehicleId(null);
    setHintRemainingMoves(null);
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [resetLevel]);

  // Replay a won map / custom level from the start, as a fresh attempt
  const handleRetry = useCallback(() => {
    if (!currentLevel) return;
    loadLevel(currentLevel, { vehicles: currentLevel.vehicles, moveCount: 0, history: [] });
    setWon(false);
    setHintVehicleId(null);
    setHintRemainingMoves(null);
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [currentLevel, loadLevel]);

  const handleHint = useCallback(async () => {
    if (!currentLevel || won || isHintLoading) return;

    // Hints are unlimited, only counted for stats (see docs/GAME_DESIGN.md)
    recordHintUsed();

    const startTime = Date.now();
    setIsHintLoading(true);

    // Solved on a thread of its own: the loading indicator keeps turning meanwhile
    try {
      const result = await solvePuzzleAsync(
        vehicles,
        currentLevel.gridSize,
        currentLevel.exitRow,
        currentLevel.exitCol
      );

      // Ensure at least 800ms of loading time for visual consistency and to avoid "flashing"
      const duration = Date.now() - startTime;
      if (duration < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - duration));
      }

      // A move, an undo or a reset during the search: the hint is for a board that is gone
      const latest = useGameStore.getState();
      if (latest.vehicles !== vehicles || latest.currentLevel !== currentLevel) return;

      if (result.minMoves > 0 && result.moves.length > 0) {
        setHintRemainingMoves(result.minMoves);
        const hintMove = result.moves[0];
        setHintVehicleId(hintMove.vehicleId);
        haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // The highlight is visual only: say which vehicle to move and where
        const hinted = vehicles.find(v => v.id === hintMove.vehicleId);
        if (hinted) {
          const direction = getMoveDirection(hinted, hintMove);
          AccessibilityInfo.announceForAccessibility(t('a11y.hint_found', {
            vehicle: describeVehicle(t, hinted, getVehicleLetters(vehicles)[hinted.id]),
            direction: t(`a11y.dir_${direction}`),
          }));
        }

        // The highlight stays until the next touch on the screen (see handleScreenTouch)
      } else {
        haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      console.error("Hint calculation failed:", error);
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsHintLoading(false);
    }
  }, [vehicles, currentLevel, won, isHintLoading, recordHintUsed, t]);

  // Any touch on the screen dismisses the hint highlight
  const handleScreenTouch = useCallback(() => {
    if (hintVehicleId === null) return;
    setHintVehicleId(null);
    setHintRemainingMoves(null);
  }, [hintVehicleId]);

  const minMoves = computedMinMoves ?? currentLevel?.minMoves ?? 0;
  const score = calculateScore(moveCount, minMoves);
  const stars = getStars(moveCount, minMoves);
  // A challenge already won shows its result, not the untouched board's 0 moves
  const shownMoves = isChallengeCompleted ? challengeResult?.moves ?? moveCount : moveCount;
  const shownScore = isChallengeCompleted ? challengeResult?.score ?? score : score;
  const playerMoves = challengeKind ? challengeResult?.moveLog : undefined;

  const showSolution = (source: SolutionSource) => {
    setSolutionStart(source);
    setSolutionVisible(true);
  };

  // A custom level is called by its name (or "Level 3"), never by its id (a timestamp)
  const customKind = currentLevel ? customLevelKind(currentLevel.id, createdLevels, importedLevels) : null;
  const customLevels = customKind === 'created' ? createdLevels : importedLevels;
  const levelTitle = !currentLevel ? ''
    : customKind ? customLevelTitle(t, customLevels.find(l => l.id === currentLevel.id) ?? currentLevel, customKind, customLevels)
    : t('game.level_count', { id: currentLevel.id });
  // A level of the map (campaign or generated) has a next one, until the last one
  const nextLevelId = currentLevel && !customKind && !challengeKind && !isArchive
    ? nextMapLevel(currentLevel.id, sampleLevels.length + generatedLevels.length)
    : null;

  if (isLoading || !currentLevel) {
    const isMondayDaily = (params.levelId === 'daily' || isArchive) && !!params.date && parseLocalDateString(params.date).getDay() === 1;
    return <GameLoading colors={colors} isMondayDaily={isMondayDaily} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]} onTouchStart={handleScreenTouch}>
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <Pressable onPress={goBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={8}>
          {/* "Map" only where it leads: challenges come from the home screen, archives from the profile */}
          <Text style={[styles.backText, { color: colors.textMuted }]} numberOfLines={1}>← {customKind || challengeKind || isArchive ? t('a11y.back') : t('common.map')}</Text>
        </Pressable>
        <Text style={[styles.levelTitle, { color: colors.text }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {challengeKind === 'daily' ? t('home.daily_challenge')
            : challengeKind === 'weekly' ? t('home.weekly_challenge')
            : isArchive ? t('game.archive_title', {
                date: parseLocalDateString(params.date!).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
              })
            : !customKind && isBossLevel(currentLevel.id) ? t('game.level_boss', { id: currentLevel.id })
            : levelTitle}
        </Text>
        <Pressable onPress={() => setShareVisible(true)} style={styles.shareHeaderBtn} accessibilityRole="button" accessibilityLabel={t('a11y.share_level')}>
          <ShareIcon size={24} color={colors.primaryText} />
        </Pressable>
      </Animated.View>

      <GameStatsBar
        colors={colors}
        moveCount={shownMoves}
        minMoves={minMoves}
        score={shownScore}
        hintRemainingMoves={hintRemainingMoves}
      />

      {/* Board */}
      <Animated.View
        entering={FadeInDown.delay(300).springify()}
        style={styles.boardWrapper}
      >
        <View style={isChallengeCompleted ? { opacity: 0.7 } : undefined}>
          <Board
            gridSize={currentLevel.gridSize}
            vehicles={vehicles}
            exitRow={currentLevel.exitRow}
            exitCol={currentLevel.exitCol}
            onMoveEnd={handleMoveEnd}
            hintVehicleId={hintVehicleId}
            disabled={isChallengeCompleted}
          />
        </View>
      </Animated.View>

      <WinModal
        visible={won && !isSolutionVisible}
        colors={colors}
        stars={stars}
        moveCount={moveCount}
        minMoves={minMoves}
        score={score}
        timeMs={winTimeMs}
        unlocks={winUnlocks}
        cosmeticUnlocks={winCosmetics}
        onOpenGarage={handleOpenGarage}
        missionReward={winMissionReward}
        xpGain={winXpGain}
        levelUps={winLevelUps}
        effect={winEffect}
        effectColors={winEffectColors}
        canShareResult={!!challengeKind}
        onShareResult={handleShareResult}
        onShowSolution={() => showSolution(playerMoves ? 'mine' : 'optimal')}
        onRetry={challengeKind ? undefined : handleRetry}
        onNextLevel={nextLevelId !== null ? () => handleNextLevel(nextLevelId) : undefined}
        onContinue={handleWinContinue}
        onRequestClose={goBack}
      />

      {isHintLoading && <HintLoadingPill colors={colors} />}

      {/* Action buttons - Daily: none, Weekly: reset only (see docs/GAME_DESIGN.md) */}
      {challengeKind !== 'daily' && !won && !isChallengeCompleted && (
        <GameActions
          colors={colors}
          showUndoAndHint={!challengeKind}
          isHintLoading={isHintLoading}
          onUndo={handleUndo}
          onHint={handleHint}
          onReset={handleReset}
        />
      )}

      {/* A challenge has no hint nor undo: said, so their absence does not look like a bug */}
      {challengeKind && !won && !isChallengeCompleted && (
        <Animated.View entering={FadeInDown.delay(450).springify()} style={[styles.rules, challengeKind === 'weekly' && styles.rulesUnderActions]}>
          <IconText icon="information-circle-outline" color={colors.textMuted} textStyle={styles.rulesText}>
            {t(challengeKind === 'daily' ? 'game.daily_rules' : 'game.weekly_rules')}
          </IconText>
        </Animated.View>
      )}

      {/* Scrolls when large text or a small screen leaves too little room under the board */}
      {isChallengeCompleted && (
        <ScrollView style={styles.bannerScroll} contentContainerStyle={styles.bannerScrollContent} showsVerticalScrollIndicator={false}>
          <ChallengeDoneBanner
            colors={colors}
            kind={challengeKind}
            stars={challengeResult?.stars ?? 3}
            moves={challengeResult?.moves}
            minMoves={challengeResult?.minMoves ?? minMoves}
            onShareResult={handleShareResult}
            onShowMine={playerMoves?.length ? () => showSolution('mine') : undefined}
            onShowSolution={() => showSolution('optimal')}
          />
        </ScrollView>
      )}

      {/* Goal text for Level 1 */}
      {currentLevel.id === 1 && !challengeKind && !won && (
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.goalContainer}>
          <IconText icon="flag" color={colors.primaryText} textStyle={styles.goalHeader}>{t('game.goal_title')}</IconText>
          <Text style={[styles.goalText, { color: colors.textMuted }]}>{t('game.goal_desc')}</Text>
        </Animated.View>
      )}

      <SolutionPlayer
        visible={isSolutionVisible}
        level={currentLevel}
        colors={colors}
        playerMoves={playerMoves}
        startWith={solutionStart}
        onClose={() => setSolutionVisible(false)}
      />

      <ShareLevelSheet
        level={isShareVisible ? currentLevel : null}
        title={levelTitle}
        colors={colors}
        isDark={isDark}
        onClose={() => setShareVisible(false)}
      />
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  // Same width as the share button: the title stays centered
  backButton: {
    width: 76,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  levelTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  boardWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bannerScroll: {
    flex: 1,
  },
  bannerScrollContent: {
    paddingBottom: 32,
  },
  shareHeaderBtn: {
    width: 76,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rules: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  rulesUnderActions: {
    marginTop: 16,
  },
  rulesText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  goalContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  goalHeader: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  goalText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  }
});
