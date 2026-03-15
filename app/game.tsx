import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, ActivityIndicator, InteractionManager } from 'react-native';
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
import { generateLevel, DIFFICULTY_LEVELS, generateDailyLevel } from '@/utils/generator';
import { getShareUrl, getQRCodeUrl, deserializeLevel } from '@/utils/sharing';
import { Image, Modal, Share, Clipboard, Alert } from 'react-native';

export default function GameScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ levelId: string }>();

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
  const dailyChallengeSaveState = useGameStore(s => s.dailyChallengeSaveState);
  const saveDailyState = useGameStore(s => s.saveDailyState);

  const [won, setWon] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [hintVehicleId, setHintVehicleId] = useState<string | null>(null);
  const [computedMinMoves, setComputedMinMoves] = useState<number | null>(null);
  const [hintRemainingMoves, setHintRemainingMoves] = useState<number | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  const [isShareVisible, setShareVisible] = useState(false);

  const handleShare = async () => {
    if (!currentLevel) return;
    const url = getShareUrl(currentLevel);
    try {
      await Share.share({
        message: `Challenge me on Rush Hours! Can you beat this level in ${minMoves} moves?\n${url}`,
        url: url,
      });
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  const handleCopyLink = () => {
    if (!currentLevel) return;
    const url = getShareUrl(currentLevel);
    Clipboard.setString(url);
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Link copied to clipboard.");
  };

  // Load the level and compute the real minMoves via BFS
  useEffect(() => {
    setLoading(true);
    setWon(false);
    setHintRemainingMoves(null);

    // CRITICAL: Stop any background generation to free up main thread for gameplay
    cancelGeneration();

    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        const idParam = params.levelId;
        const dateParam = (params as any).date;
        const id = Number(idParam);
        const dataParamInUrl = (params as any).data;

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
            level = generateDailyLevel(dateParam);
            if (level) {
              useGameStore.setState({ 
                currentDailyLevel: level, 
                dailyLevelDate: dateParam 
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
          // If it's the daily challenge and we have a saved state, load it
          if (idParam === 'daily' && dailyChallengeSaveState) {
            loadLevel(level, dailyChallengeSaveState);
          } else {
            loadLevel(level);
          }
          setComputedMinMoves(level.minMoves > 0 ? level.minMoves : null);
          setLoading(false);
        } else {
          // If level not found, don't just hang or show empty grid
          // Redirect back or show error
          console.error("Level not found for ID:", id);
          if (idParam) {
            Alert.alert("Error", "Could not load this level.");
            router.back();
          }
        }
      }, 300);
    });

    return () => task.cancel();
  }, [params.levelId, (params as any).date, createdLevels, importedLevels]);


  const isDailyCompleted = !!(params.levelId === 'daily' && (params as any).date && useGameStore.getState().dailyChallengeProgress[(params as any).date]?.completed);

  const handleMoveEnd = useCallback((vehicleId: string, newRow: number, newCol: number) => {
    if (won || isDailyCompleted) return;

    setHintVehicleId(null); // Clear hint highlight on any move
    setHintRemainingMoves(null);
    moveVehicle(vehicleId, newRow, newCol);

    // Check win after store update
    const updatedVehicles = useGameStore.getState().vehicles;
    const updatedMoveCount = useGameStore.getState().moveCount;
    if (currentLevel && checkWin(updatedVehicles, currentLevel.exitRow, currentLevel.exitCol, currentLevel.gridSize)) {
      setWon(true);
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Calculate and save score
      const minMoves = computedMinMoves ?? currentLevel.minMoves;
      const score = calculateScore(updatedMoveCount, minMoves);
      const stars = updatedMoveCount <= minMoves ? 3 : updatedMoveCount <= minMoves + 3 ? 2 : 1;
      
      const idParam = params.levelId;
      const dateParam = (params as any).date;

      if (idParam === 'daily' && dateParam) {
        useGameStore.getState().completeDailyChallenge(dateParam, score, stars);
      } else {
        completeLevel(currentLevel.id, score, stars);
      }
    } else {
      // If it's a daily challenge and NOT won, save progress
      const idParam = params.levelId;
      if (idParam === 'daily') {
        saveDailyState(updatedVehicles, updatedMoveCount, useGameStore.getState().history);
      }
    }
  }, [won, moveVehicle, currentLevel, computedMinMoves, completeLevel, params.levelId, (params as any).date, saveDailyState]);

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

    setIsHintLoading(true);
    try {
      const result = await solvePuzzleAsync(
        vehicles,
        currentLevel.gridSize,
        currentLevel.exitRow,
        currentLevel.exitCol
      );

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
  }, [vehicles, currentLevel, won, isHintLoading]);

  const minMoves = computedMinMoves ?? currentLevel?.minMoves ?? 0;
  const score = calculateScore(moveCount, minMoves);

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', card: 'rgba(255,255,255,0.06)', accent: '#6C63FF', hint: '#F59E0B' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', card: 'rgba(0,0,0,0.04)', accent: '#5A4FE0', hint: '#D97706' };

  // Star rating
  const stars = moveCount <= minMoves ? 3 : moveCount <= minMoves + 3 ? 2 : 1;

  if (isLoading || !currentLevel) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View entering={FadeIn.duration(400)}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.sub }]}>Preparing Puzzle...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.sub }]}>← Map</Text>
        </Pressable>
        <Text style={[styles.levelTitle, { color: colors.text }]}>
          {params.levelId === 'daily' ? `Daily Challenge` : `Level ${currentLevel.id}`}
        </Text>
        <Pressable onPress={() => setShareVisible(true)} style={styles.shareHeaderBtn}>
          <Text style={{ fontSize: 22 }}>📤</Text>
        </Pressable>
      </Animated.View>

      {/* Stats bar */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.statsBar, { backgroundColor: colors.card }]}>
        <View style={styles.statsPanel}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Moves</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{moveCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.sub }]}>Best</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {minMoves}
              {hintRemainingMoves ? <Text style={{ color: colors.hint, fontSize: 13 }}> ({hintRemainingMoves} left)</Text> : null}
            </Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.sub }]} />
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.sub }]}>Score</Text>
          <Text style={[styles.statValue, { color: score > 0 ? '#10B981' : colors.sub }]}>{score}</Text>
        </View>
      </Animated.View>

      {/* Board */}
      <Animated.View 
        entering={FadeInDown.delay(300).springify()} 
        style={[styles.boardWrapper, isDailyCompleted && { opacity: 0.7 }]}
      >
        <Board
          gridSize={currentLevel.gridSize}
          vehicles={vehicles}
          exitRow={currentLevel.exitRow}
          exitCol={currentLevel.exitCol}
          onMoveEnd={handleMoveEnd}
          hintVehicleId={hintVehicleId}
          disabled={isDailyCompleted}
        />
      </Animated.View>

      {/* Win overlay */}
      {won && (
        <Animated.View entering={FadeInDown.springify()} style={styles.winOverlay}>
          <Animated.View
            entering={ZoomIn.delay(200).springify()}
            style={[styles.winCard, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}
          >
            <Text style={styles.winStars}>
              {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
            </Text>
            <Text style={[styles.winTitle, { color: colors.accent }]}>Level Complete!</Text>
            <Text style={[styles.winScore, { color: colors.text }]}>
              {moveCount} moves · Best: {minMoves} · Score: {score}
            </Text>
            <Pressable
              style={[styles.winButton, { backgroundColor: colors.accent }]}
              onPress={() => router.back()}
            >
              <Text style={styles.winButtonText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* Hint Loading Pill */}
      {isHintLoading && (
        <Animated.View 
          entering={FadeInUp.duration(300)} 
          exiting={FadeOut.duration(300)} 
          style={[styles.hintPill, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.1)' }]}
        >
          <ActivityIndicator size="small" color={colors.hint} />
          <Text style={[styles.hintPillText, { color: colors.hint }]}>Analyzing Puzzle...</Text>
        </Animated.View>
      )}

      {/* Action buttons - Hidden for daily challenge or if won */}
      {params.levelId !== 'daily' && !won && (
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.actions}>
          <Pressable onPress={handleUndo} style={[styles.actionBtn, { backgroundColor: colors.card }]}>
            <Text style={[styles.actionText, { color: colors.text }]}>↩ Undo</Text>
          </Pressable>
          <Pressable 
            onPress={handleHint} 
            style={[styles.actionBtn, { backgroundColor: colors.hint + '22' }]}
            disabled={isHintLoading}
          >
            {isHintLoading ? (
              <ActivityIndicator size="small" color={colors.hint} />
            ) : (
              <Text style={[styles.actionText, { color: colors.hint }]}>💡 Hint</Text>
            )}
          </Pressable>
          <Pressable onPress={handleReset} style={[styles.actionBtn, { backgroundColor: colors.card }]}>
            <Text style={[styles.actionText, { color: colors.text }]}>↻ Reset</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Share Modal */}
      <Modal visible={isShareVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Animated.View entering={FadeInDown.springify()} style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Share Level</Text>
              <Pressable onPress={() => setShareVisible(false)}>
                <Text style={{ fontSize: 20, color: colors.sub, padding: 8 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.qrContainer}>
                <Image 
                    source={{ uri: getQRCodeUrl(getShareUrl(currentLevel)) }} 
                    style={styles.qrCode} 
                />
                <Text style={[styles.qrHint, { color: colors.sub }]}>Scan to challenge a friend!</Text>
            </View>

            <View style={styles.shareButtonsRow}>
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: colors.accent, flex: 1 }]}
                  onPress={handleShare}
                >
                  <Text style={styles.mainBtnText}>Share Link</Text>
                </Pressable>
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: colors.sub, flex: 1 }]}
                  onPress={handleCopyLink}
                >
                  <Text style={styles.mainBtnText}>Copy URL</Text>
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
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
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
  }
});
