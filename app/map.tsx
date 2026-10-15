import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { haptics, Haptics } from '@/utils/haptics';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { generatePathPoints } from '@/components/map/path';
import LevelNode from '@/components/map/LevelNode';
import PathLine from '@/components/map/PathLine';
import GenerationPill from '@/components/map/GenerationPill';
import MapSettingsSheet from '@/components/map/MapSettingsSheet';

export default function MapScreen() {
  const { t } = useTranslation();
  const { colors, board, isDark } = useTheme();
  const router = useRouter();

  const maxUnlockedLevel = useGameStore(s => s.maxUnlockedLevel);
  const lastPlayedLevelId = useGameStore(s => s.lastPlayedLevelId);
  const progress = useGameStore(s => s.progress);
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const isGenerating = useGameStore(s => s.generationState.isRunning);
  const setGenerationState = useGameStore(s => s.setGenerationState);
  const scrollViewRef = useRef<ScrollView>(null);

  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0); // Will be updated in useMemo or effect
  const [isReady, setIsReady] = useState(false);

  // Combine static levels + dynamically generated levels
  const levels = [...sampleLevels, ...generatedLevels];

  // We add exactly 1 node at the end for the final Padlock marker indicating the end of generated levels
  const pathLength = levels.length + 1;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Memoize path points and total height to avoid expensive recalculated arrays
  const { points: pathPoints, totalHeight } = useMemo(() => {
    return generatePathPoints(pathLength, screenWidth, screenHeight);
  }, [pathLength, screenWidth, screenHeight]);

  // Synchronously calculate initial scroll position to avoid "teleportation"
  const initialY = useMemo(() => {
    const targetId = (lastPlayedLevelId && lastPlayedLevelId < 900000) ? lastPlayedLevelId : maxUnlockedLevel;
    const targetNode = pathPoints.find(p => p.id === targetId);
    if (targetNode) {
      return Math.max(0, targetNode.y - screenHeight / 2 + 50);
    }
    // Fallback to BOTTOM of map (where level 1 is) if target not found
    return Math.max(0, totalHeight - screenHeight);
  }, [pathPoints, lastPlayedLevelId, maxUnlockedLevel, screenHeight]);

  // Set initial scroll state
  useEffect(() => {
    setScrollY(initialY);
    // Force scroll after a short delay once ready
    if (isReady) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: initialY, animated: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialY, isReady]);

  useEffect(() => {
    // Sanitization: Fix corrupted maxUnlockedLevel if it's a legacy Daily ID (999999)
    if (maxUnlockedLevel >= 900000) {
      useGameStore.setState({ maxUnlockedLevel: sampleLevels.length + 1 });
    }

    // Defer heavy rendering until after navigation transition
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [maxUnlockedLevel]);

  useEffect(() => {
    // Reset generation state on mount to prevent stuck "Canceling..." state
    setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
  }, []);

  const isVisible = (y: number) => {
    return y >= scrollY - 1200 && y <= scrollY + screenHeight + 1200;
  };

  const handleLevelPress = (levelId: number, isUnlocked: boolean, isCustom: boolean) => {
    if (levelId === 0) {
      haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/tutorial');
      return;
    }
    // Custom generated levels are ALWAYS accessible regardless of progression lock
    if (!isUnlocked && !isCustom) {
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/game?levelId=${levelId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={[styles.header, { backgroundColor: colors.backgroundTranslucent }]}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={8}>
          <Text style={[styles.backText, { color: colors.textMuted }]}>← {t('common.home')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} accessibilityRole="header">{t('map.title')}</Text>
        <Pressable onPress={() => setSettingsVisible(true)} style={[styles.settingsButton, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('a11y.settings')}>
          <Text style={{ fontSize: 24, color: colors.text }}>⚙️</Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ height: totalHeight }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate={0.9}
        contentOffset={{ x: 0, y: initialY }}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
      >
        {!isReady ? (
          <View style={{ flex: 1, height: totalHeight }} />
        ) : (
          <>
            {/* Path connections, only where at least one end is visible */}
            {pathPoints.map((point, index) => {
              if (index === pathPoints.length - 1) return null;

              const nextPoint = pathPoints[index + 1];
              if (!isVisible(point.y) && !isVisible(nextPoint.y)) return null;

              const isUnlockedLine = maxUnlockedLevel > point.id;
              return (
                <PathLine
                  key={`line-${point.id}`}
                  from={point}
                  to={nextPoint}
                  color={isUnlockedLine ? colors.primary : colors.divider}
                />
              );
            })}

            {/* Draw Nodes */}
            {pathPoints.map((point, index) => {
              if (!isVisible(point.y)) return null;

              const isTutorial = point.id === 0;
              const isPadlockNode = point.id !== 0 && index === pathPoints.length - 1;

              // find level data by matching point.id with level.id
              const levelData = isTutorial || isPadlockNode ? null : levels.find(l => l.id === point.id);

              const isUnlocked = isTutorial || point.id <= maxUnlockedLevel;
              const isCurrent = point.id === maxUnlockedLevel;
              const isCustom = !isTutorial && !isPadlockNode && point.id > sampleLevels.length;

              const levelProgress = progress.find(p => p.levelId === point.id);
              const stars = levelProgress?.stars || 0;

              return (
                <LevelNode
                  key={`node-${point.id}`}
                  point={point}
                  levelData={levelData}
                  isUnlocked={isUnlocked}
                  isCurrent={isCurrent}
                  isCustom={isCustom}
                  isPadlockNode={isPadlockNode}
                  isTutorial={isTutorial}
                  stars={stars}
                  onPress={handleLevelPress}
                  colors={colors}
                  board={board}
                />
              );
            })}
          </>
        )}
      </ScrollView>

      <MapSettingsSheet
        visible={isSettingsVisible}
        colors={colors}
        isDark={isDark}
        onClose={() => setSettingsVisible(false)}
      />

      {isGenerating && <GenerationPill colors={colors} />}
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
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsButton: {
    width: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
});
