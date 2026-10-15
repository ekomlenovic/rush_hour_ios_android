import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { haptics, Haptics } from '@/utils/haptics';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { useTranslation } from 'react-i18next';
import { getMapColors } from '@/components/map/colors';
import { generatePathPoints } from '@/components/map/path';
import LevelNode from '@/components/map/LevelNode';
import PathLine from '@/components/map/PathLine';
import GenerationPill from '@/components/map/GenerationPill';
import MapSettingsSheet from '@/components/map/MapSettingsSheet';

export default function MapScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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

  const colors = getMapColors(isDark);

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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(100).springify()} style={[styles.header, { backgroundColor: isDark ? 'rgba(15,15,26,0.85)' : 'rgba(245,245,250,0.85)' }]}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.sub }]}>← {t('common.home')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('map.title')}</Text>
        <Pressable onPress={() => setSettingsVisible(true)} style={styles.settingsButton}>
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
                  color={isUnlockedLine ? colors.accent : colors.line}
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
                  isDark={isDark}
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

      {isGenerating && <GenerationPill colors={colors} isDark={isDark} />}
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
  },
});
