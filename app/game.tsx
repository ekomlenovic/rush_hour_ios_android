import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Alert, AccessibilityInfo } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { haptics, Haptics } from '@/utils/haptics';
import Board from '@/components/Board';
import { useGameStore } from '@/store/gameStore';
import type { MissionReward } from '@/data/missions';
import { checkWin } from '@/utils/collision';
import { solvePuzzleAsync } from '@/utils/solver.background';
import { customLevelKind, customLevelTitle } from '@/utils/customLevels';
import { useTranslation } from 'react-i18next';
import { parseLocalDateString } from '@/utils/date';
import { buildChallengeShareText } from '@/utils/shareResult';
import { requestReminderPermission } from '@/utils/notifications';
import { calculateScore, getStars } from '@/utils/scoring';
import { resolveLevel, GameRouteParams } from '@/utils/levelResolver';
import { useActivePlayTime } from '@/hooks/useActivePlayTime';
import { describeVehicle, getVehicleLetters, getMoveDirection } from '@/utils/accessibility';
import { useTheme } from '@/theme';
import GameLoading from '@/components/game/GameLoading';
import GameStatsBar from '@/components/game/GameStatsBar';
import GameActions from '@/components/game/GameActions';
import WinModal from '@/components/game/WinModal';
import ShareLevelSheet from '@/components/share/ShareLevelSheet';
import ShareIcon from '@/components/share/ShareIcon';
import ChallengeDoneBanner from '@/components/game/ChallengeDoneBanner';
import HintLoadingPill from '@/components/game/HintLoadingPill';
import SolutionPlayer from '@/components/game/SolutionPlayer';

export default function GameScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark, board } = useTheme();
  const winEffect = useGameStore(s => s.cosmetics.effect);
  const winEffectColors = useMemo(() => [board.targetCar, ...board.vehicles.slice(0, 6)], [board]);
  const router = useRouter();
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
  const [winMissionReward, setWinMissionReward] = useState<MissionReward | null>(null);
  const [winXpGain, setWinXpGain] = useState<{ from: number; to: number } | null>(null);
  const [winLevelUps, setWinLevelUps] = useState<number[]>([]);

  const [isShareVisible, setShareVisible] = useState(false);
  const [isSolutionVisible, setSolutionVisible] = useState(false);

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
    router.back();
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

  // Load the level and compute the real minMoves via BFS
  useEffect(() => {
    setLoading(true);
    setWon(false);
    setHintRemainingMoves(null);

    // CRITICAL: Stop any background generation to free up main thread for gameplay
    cancelGeneration();

    const timer = setTimeout(async () => {
      const level = await resolveLevel(params as GameRouteParams);

      if (level) {
        loadLevel(level);
        setComputedMinMoves(level.minMoves > 0 ? level.minMoves : null);
        setLoading(false);
      } else {
        // If level not found, don't just hang or show empty grid
        // Redirect back or show error
        console.error("Level not found for ID:", params.levelId);
        if (params.levelId) {
          Alert.alert(t('common.error'), t('game.load_error'));
          router.back();
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [params.levelId, params.date, params.week, createdLevels, importedLevels]);

  const playTime = useActivePlayTime(!isLoading && !!currentLevel && !won && !isChallengeCompleted);

  const handleMoveEnd = useCallback((vehicleId: string, newRow: number, newCol: number) => {
    if (won || isChallengeCompleted) return;

    setHintVehicleId(null); // Clear hint highlight on any move
    setHintRemainingMoves(null);
    moveVehicle(vehicleId, newRow, newCol);

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

      const details = { moves: updatedMoveCount, minMoves };
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
      setWinMissionReward(useGameStore.getState().consumeMissionReward());
      setWinXpGain(useGameStore.getState().lastXpGain);
      setWinLevelUps(useGameStore.getState().consumeLevelUps());
      setWinTimeMs(timeMs);
      setWon(true);
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
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

    // Give React and UI thread time to render the loading indicator
    // before the UI thread potentially gets blocked by the solver worklet
    await new Promise(resolve => setTimeout(resolve, 150));

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

  // A custom level is called by its name (or "Level 3"), never by its id (a timestamp)
  const customKind = currentLevel ? customLevelKind(currentLevel.id, createdLevels, importedLevels) : null;
  const customLevels = customKind === 'created' ? createdLevels : importedLevels;
  const levelTitle = !currentLevel ? ''
    : customKind ? customLevelTitle(t, customLevels.find(l => l.id === currentLevel.id) ?? currentLevel, customKind, customLevels)
    : t('game.level_count', { id: currentLevel.id });

  if (isLoading || !currentLevel) {
    const isMondayDaily = (params.levelId === 'daily' || isArchive) && !!params.date && parseLocalDateString(params.date).getDay() === 1;
    return <GameLoading colors={colors} isMondayDaily={isMondayDaily} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} onTouchStart={handleScreenTouch}>
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={8}>
          <Text style={[styles.backText, { color: colors.textMuted }]}>← {customKind ? t('a11y.back') : t('common.map')}</Text>
        </Pressable>
        <Text style={[styles.levelTitle, { color: colors.text }]} accessibilityRole="header">
          {challengeKind === 'daily' ? t('home.daily_challenge')
            : challengeKind === 'weekly' ? t('home.weekly_challenge')
            : isArchive ? t('game.archive_title', {
                date: parseLocalDateString(params.date!).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
              })
            : levelTitle}
        </Text>
        <Pressable onPress={() => setShareVisible(true)} style={styles.shareHeaderBtn} accessibilityRole="button" accessibilityLabel={t('a11y.share_level')}>
          <ShareIcon size={24} color={colors.primaryText} />
        </Pressable>
      </Animated.View>

      <GameStatsBar
        colors={colors}
        moveCount={moveCount}
        minMoves={minMoves}
        score={score}
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
        missionReward={winMissionReward}
        xpGain={winXpGain}
        levelUps={winLevelUps}
        effect={winEffect}
        effectColors={winEffectColors}
        canShareResult={!!challengeKind}
        onShareResult={handleShareResult}
        onShowSolution={() => setSolutionVisible(true)}
        onRetry={challengeKind ? undefined : handleRetry}
        onContinue={handleWinContinue}
        onRequestClose={() => router.back()}
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

      {isChallengeCompleted && (
        <ChallengeDoneBanner
          colors={colors}
          kind={challengeKind}
          stars={challengeResult?.stars ?? 3}
          onShareResult={handleShareResult}
          onShowSolution={() => setSolutionVisible(true)}
        />
      )}

      {/* Goal text for Level 1 */}
      {currentLevel.id === 1 && !challengeKind && !won && (
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.goalContainer}>
          <Text style={[styles.goalHeader, { color: colors.primaryText }]}>🎯 {t('game.goal_title')}</Text>
          <Text style={[styles.goalText, { color: colors.textMuted }]}>{t('game.goal_desc')}</Text>
        </Animated.View>
      )}

      <SolutionPlayer
        visible={isSolutionVisible}
        level={currentLevel}
        colors={colors}
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
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  levelTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  boardWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  shareHeaderBtn: {
    width: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
