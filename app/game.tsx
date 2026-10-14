import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, ZoomIn, FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { haptics, Haptics } from '@/utils/haptics';
import Board from '@/components/Board';
import { useGameStore } from '@/store/gameStore';
import { checkWin } from '@/utils/collision';
import { sampleLevels } from '@/data/sampleLevels';
import { Move, solvePuzzle } from '@/utils/solver';
import { solvePuzzleAsync } from '@/utils/solver.background';
import { generateLevel, DIFFICULTY_LEVELS, generateDailyLevel, generateWeeklyLevel } from '@/utils/generator';
import { getShareUrl, getQRCodeUrl, deserializeLevel } from '@/utils/sharing';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Share, Alert, AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { formatDuration } from '@/utils/date';

export default function GameScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const createdLevels = useGameStore(s => s.createdLevels);
  const importedLevels = useGameStore(s => s.importedLevels);
  const addGeneratedLevel = useGameStore(s => s.addGeneratedLevel);
  const cancelGeneration = useGameStore(s => s.cancelGeneration);
  const currentDailyLevel = useGameStore(s => s.currentDailyLevel);
  const dailyLevelDate = useGameStore(s => s.dailyLevelDate);
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

  const [isShareVisible, setShareVisible] = useState(false);

  const handleShare = async () => {
    if (!currentLevel) return;
    const url = getShareUrl(currentLevel);
    try {
      const result = await Share.share({
        message: t('game.share_message', { moves: minMoves, url: url }),
        url: url,
      });
      if (result.action === Share.sharedAction) {
        useGameStore.getState().recordLevelShared();
      }
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  const handleCopyLink = async () => {
    if (!currentLevel) return;
    const url = getShareUrl(currentLevel);
    await Clipboard.setStringAsync(url);
    useGameStore.getState().recordLevelShared();
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('common.copied'), t('common.link_copied'));
  };

  // Load the level and compute the real minMoves via BFS
  useEffect(() => {
    setLoading(true);
    setWon(false);
    setHintRemainingMoves(null);

    // CRITICAL: Stop any background generation to free up main thread for gameplay
    cancelGeneration();

    const timer = setTimeout(async () => {
      const idParam = params.levelId;
      const dateParam = params.date;
      const weekParam = params.week;
      const id = Number(idParam);
      const dataParamInUrl = params.data;

      let level: any = null;

      // 0. Primary: Check if level data is passed directly in URL (Deep Link fallback)
      if (dataParamInUrl) {
        level = deserializeLevel(dataParamInUrl as string);
      }

      if (idParam === 'daily' && dateParam) {
        // Use cache if available and date matches
        if (currentDailyLevel && dailyLevelDate === dateParam) {
          level = currentDailyLevel;
        } else {
          level = await generateDailyLevel(dateParam);
          if (level) {
            useGameStore.setState({ 
              currentDailyLevel: level, 
              dailyLevelDate: dateParam 
            });
          }
        }
      } else if (idParam === 'weekly' && weekParam) {
        const { currentWeeklyLevel, weeklyLevelKey } = useGameStore.getState();
        if (currentWeeklyLevel && weeklyLevelKey === weekParam) {
          level = currentWeeklyLevel;
        } else {
          level = await generateWeeklyLevel(weekParam);
          if (level) {
            useGameStore.setState({
              currentWeeklyLevel: level,
              weeklyLevelKey: weekParam
            });
          }
        }
      } else {
        // 1. Try to find it in the pre-baked JSON
        level = sampleLevels.find((l) => l.id === id);
        
        // 2. Try to find it in the generated Zustand memory cache
        if (!level) {
          level = generatedLevels.find((l) => l.id === id);
        }

        // 3. Try to find it in created or imported levels (use string comparison for robustness)
        if (!level && id) {
          const state = useGameStore.getState();
          level = state.createdLevels.find((l) => String(l.id) === String(id)) || 
                  state.importedLevels.find((l) => String(l.id) === String(id));
        }

        // 4. Fallback: Generate it right now (Infinite Map support)
        // Adjust difficulty based on level ID range
        if (!level && id > 0 && id <= 2000) {
          let difficulty = DIFFICULTY_LEVELS.EASY;
          if (id > 1500) difficulty = DIFFICULTY_LEVELS.MASTER;
          else if (id > 800) difficulty = DIFFICULTY_LEVELS.EXPERT;
          else if (id > 400) difficulty = DIFFICULTY_LEVELS.HARD;
          else if (id > 100) difficulty = DIFFICULTY_LEVELS.NORMAL;

          level = generateLevel(id || 1, difficulty) || sampleLevels[0];
          if (level && level.id !== sampleLevels[0].id) {
            addGeneratedLevel(level);
          }
        }
      }

      if (level && level.vehicles && level.vehicles.length > 0) {
        loadLevel(level);
        setComputedMinMoves(level.minMoves > 0 ? level.minMoves : null);
        setLoading(false);
      } else {
        // If level not found, don't just hang or show empty grid
        // Redirect back or show error
        console.error("Level not found for ID:", id);
        if (idParam) {
          Alert.alert(t('common.error'), t('game.load_error'));
          router.back();
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [params.levelId, params.date, params.week, createdLevels, importedLevels]);

  // Daily and weekly challenges are one-shot: no hint, undo or reset (see docs/GAME_DESIGN.md)
  const challengeKind = params.levelId === 'daily' && params.date ? 'daily'
    : params.levelId === 'weekly' && params.week ? 'weekly'
    : null;
  const challengeResult = challengeKind === 'daily' ? dailyChallengeProgress[params.date!]
    : challengeKind === 'weekly' ? weeklyChallengeProgress[params.week!]
    : undefined;
  const isChallengeCompleted = !!challengeResult?.completed;

  // Active play time: counted while this screen is open, the app in foreground and the level unsolved
  const segmentStartRef = useRef<number | null>(null);
  const flushPlayTime = useCallback(() => {
    if (segmentStartRef.current === null) return;
    const now = Date.now();
    useGameStore.getState().addPlayTime(now - segmentStartRef.current);
    segmentStartRef.current = now;
  }, []);
  const isTrackingTime = !isLoading && !!currentLevel && !won && !isChallengeCompleted;

  useEffect(() => {
    if (!isTrackingTime) return;
    segmentStartRef.current = Date.now();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        segmentStartRef.current = Date.now();
      } else {
        flushPlayTime();
        segmentStartRef.current = null;
      }
    });
    return () => {
      subscription.remove();
      flushPlayTime();
      segmentStartRef.current = null;
    };
  }, [isTrackingTime, flushPlayTime]);

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
      flushPlayTime();
      segmentStartRef.current = null;
      const timeMs = useGameStore.getState().currentAttempt.elapsedMs;

      // Calculate and save score
      const minMoves = computedMinMoves ?? currentLevel.minMoves;
      const score = calculateScore(updatedMoveCount, minMoves);
      const stars = updatedMoveCount <= minMoves ? 3 : updatedMoveCount <= minMoves + 3 ? 2 : 1;

      if (challengeKind === 'daily') {
        useGameStore.getState().completeDailyChallenge(params.date!, score, stars, timeMs);
      } else if (challengeKind === 'weekly') {
        useGameStore.getState().completeWeeklyChallenge(params.week!, score, stars, timeMs);
      } else {
        completeLevel(currentLevel.id, score, stars, timeMs);
      }

      // Unlocked achievements are shown in the win modal instead of the global toast
      setWinUnlocks(useGameStore.getState().consumeUnlockQueue());
      setWinTimeMs(timeMs);
      setWon(true);
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [won, isChallengeCompleted, moveVehicle, currentLevel, computedMinMoves, completeLevel, challengeKind, params.date, params.week, flushPlayTime]);

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

        // Auto-clear hint highlight after 8 seconds
        setTimeout(() => {
          setHintVehicleId(null);
          setHintRemainingMoves(null);
        }, 8000);
      } else {
        haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      console.error("Hint calculation failed:", error);
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsHintLoading(false);
    }
  }, [vehicles, currentLevel, won, isHintLoading, recordHintUsed]);

  const minMoves = computedMinMoves ?? currentLevel?.minMoves ?? 0;
  const score = calculateScore(moveCount, minMoves);

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', card: 'rgba(255,255,255,0.06)', accent: '#6C63FF', hint: '#F59E0B' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', card: 'rgba(0,0,0,0.04)', accent: '#5A4FE0', hint: '#D97706' };

  // Star rating
  const stars = moveCount <= minMoves ? 3 : moveCount <= minMoves + 3 ? 2 : 1;

  if (isLoading || !currentLevel) {
    const isMondayDaily = params.levelId === 'daily' && params.date && new Date(params.date).getDay() === 1;

    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>{t('game.preparing_puzzle')}</Text>
          {isMondayDaily && (
            <Animated.View entering={FadeInDown.delay(1000)}>
              <Text style={[styles.mondayWarning, { color: colors.sub }]}>
                {t('game.monday_warning')}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    );
  }


  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.sub }]}>← {t('common.map')}</Text>
        </Pressable>
        <Text style={[styles.levelTitle, { color: colors.text }]}>
          {challengeKind === 'daily' ? t('home.daily_challenge')
            : challengeKind === 'weekly' ? t('home.weekly_challenge')
            : t('game.level_count', { id: currentLevel.id })}
        </Text>
        <Pressable onPress={() => setShareVisible(true)} style={styles.shareHeaderBtn}>
          <Text style={{ fontSize: 22 }}>📤</Text>
        </Pressable>
      </Animated.View>

      {/* Stats bar */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.statsBar, { backgroundColor: colors.card }]}>
        <View style={styles.statsPanel}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.sub }]}>{t('game.moves')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{moveCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.sub }]}>{t('game.best')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {minMoves}
              {hintRemainingMoves ? <Text style={{ color: colors.hint, fontSize: 13 }}> ({t('game.hint_left', { count: hintRemainingMoves })})</Text> : null}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.sub }]} />
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.sub }]}>{t('game.score')}</Text>
          <Text style={[styles.statValue, { color: score > 0 ? '#10B981' : colors.sub }]}>{score}</Text>
        </View>
      </Animated.View>

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

      {/* Win overlay */}
      <Modal visible={won} transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={styles.winOverlay}>
          <View
            style={[styles.winCard, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}
          >
            <Text style={styles.winStars}>
              {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
            </Text>
            <Text style={[styles.winTitle, { color: colors.accent }]}>{t('game.level_complete')}</Text>
            <Text style={[styles.winScore, { color: colors.text }]}>
              {t('game.win_stats', { moves: moveCount, best: minMoves, score: score })}
            </Text>
            {winTimeMs !== null && winTimeMs > 0 && (
              <Text style={[styles.winTime, { color: colors.sub }]}>
                ⏱️ {formatDuration(winTimeMs)}
              </Text>
            )}
            {winUnlocks.length > 0 && (
              <View style={[styles.winUnlocks, { backgroundColor: colors.card }]}>
                <Text style={styles.winUnlocksTitle}>{t('achievements.unlocked')}</Text>
                {winUnlocks.map((id) => (
                  <Text key={id} style={[styles.winUnlockItem, { color: colors.text }]}>
                    {ACHIEVEMENTS_BY_ID[id]?.icon} {t(`achievements.${id}`)}
                  </Text>
                ))}
              </View>
            )}
            <Pressable
              style={[styles.winButton, { backgroundColor: colors.accent }]}
              onPress={() => router.back()}
            >
             <Text style={styles.winButtonText}>{t('common.continue')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Hint Loading Pill */}
      {isHintLoading && (
        <Animated.View 
          entering={FadeInUp.duration(300)} 
          exiting={FadeOut.duration(300)} 
          style={[styles.hintPill, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.1)' }]}
        >
          <ActivityIndicator size="small" color={colors.hint} />
          <Text style={[styles.hintPillText, { color: colors.hint }]}>{t('game.analyzing')}</Text>
        </Animated.View>
      )}

      {/* Action buttons - Hidden for challenges (one-shot) or if won */}
      {!challengeKind && !won && (
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.actions}>
          <Pressable onPress={handleUndo} style={[styles.actionBtn, { backgroundColor: colors.card }]}>
            <Text style={[styles.actionText, { color: colors.text }]}>↩ {t('game.undo')}</Text>
          </Pressable>
          <Pressable 
            onPress={handleHint} 
            style={[styles.actionBtn, { backgroundColor: colors.hint + '22' }]}
            disabled={isHintLoading}
          >
            {isHintLoading ? (
              <ActivityIndicator size="small" color={colors.hint} />
            ) : (
              <Text style={[styles.actionText, { color: colors.hint }]}>💡 {t('game.hint')}</Text>
            )}
          </Pressable>
           <Pressable onPress={handleReset} style={[styles.actionBtn, { backgroundColor: colors.card }]}>
            <Text style={[styles.actionText, { color: colors.text }]}>↻ {t('common.reset')}</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Completed Challenge Banner */}
      {isChallengeCompleted && (
        <Animated.View
          entering={FadeInDown.delay(350).springify()}
          style={[
            styles.goalContainer,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(5, 150, 105, 0.08)',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(5, 150, 105, 0.25)',
              borderWidth: 1.5,
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
              alignItems: 'center',
            }
          ]}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>✅</Text>
          <Text style={{ color: isDark ? '#34D399' : '#059669', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
            {t(challengeKind === 'weekly' ? 'home.weekly_done' : 'home.daily_done', { stars: challengeResult?.stars ?? 3 })}
          </Text>
          <Text style={{ color: colors.sub, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
            {t(challengeKind === 'weekly' ? 'game.weekly_already_completed' : 'game.daily_already_completed')}
          </Text>
        </Animated.View>
      )}

      {/* Goal text for Level 1 */}
      {currentLevel.id === 1 && !challengeKind && !won && (
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.goalContainer}>
          <Text style={[styles.goalHeader, { color: colors.accent }]}>🎯 {t('game.goal_title')}</Text>
          <Text style={[styles.goalText, { color: colors.sub }]}>{t('game.goal_desc')}</Text>
        </Animated.View>
      )}

      {/* Share Modal */}
      <Modal visible={isShareVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInDown.springify()} style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('game.share_level')}</Text>
              <Pressable onPress={() => setShareVisible(false)}>
                <Text style={{ fontSize: 20, color: colors.sub, padding: 8 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.qrContainer}>
                <Image 
                    source={{ uri: getQRCodeUrl(getShareUrl(currentLevel)) }} 
                     style={styles.qrCode} 
                />
                <Text style={[styles.qrHint, { color: colors.sub }]}>{t('game.qr_hint')}</Text>
            </View>

            <View style={styles.shareButtonsRow}>
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: colors.accent, flex: 1 }]}
                  onPress={handleShare}
                >
                   <Text style={styles.mainBtnText}>{t('game.share_link')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: colors.sub, flex: 1 }]}
                  onPress={handleCopyLink}
                >
                   <Text style={styles.mainBtnText}>{t('game.copy_url')}</Text>
                </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>

  );
}

/**
 * Calculate the score based on moves vs optimal.
 * Perfect play = max score. Each extra move costs 15 points.
 */
function calculateScore(moveCount: number, minMoves: number): number {
  const maxScore = minMoves * 100;
  const penalty = Math.max(0, moveCount - minMoves) * 15;
  return Math.max(0, maxScore - penalty);
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
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statsPanel: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    opacity: 0.2,
  },
  boardWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  winOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  winCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 280,
  },
  winStars: {
    fontSize: 36,
    marginBottom: 8,
  },
  winTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  winScore: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  winTime: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -16,
    marginBottom: 20,
    textAlign: 'center',
  },
  winUnlocks: {
    alignSelf: 'stretch',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  winUnlocksTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  winUnlockItem: {
    fontSize: 15,
    fontWeight: '700',
    marginVertical: 2,
  },
  winButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  winButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  shareHeaderBtn: {
    width: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 10,
  },
  qrCode: {
    width: 250,
    height: 250,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#FFF',
  },
  qrHint: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mainBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  hintPill: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 100,
  },
  hintPillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  mondayWarning: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.7,
    fontStyle: 'italic',
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

