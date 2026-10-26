import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useRouter } from '@/hooks/useRouter';
import Animated, { FadeIn } from 'react-native-reanimated';
import { haptics, Haptics } from '@/utils/haptics';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { getMapFocusLevel, isMapLevelUnlocked } from '@/utils/mapFocus';
import { isBossLevel } from '@/data/bosses';
import { useTheme } from '@/theme';
import { createMapLayout, generateRoadSegments } from '@/components/map/path';
import { buildZones, zoneOf } from '@/components/map/zones';
import LevelNode from '@/components/map/LevelNode';
import Road from '@/components/map/Road';
import ZoneLayer from '@/components/map/ZoneLayer';
import MapHeader from '@/components/map/MapHeader';
import JumpButton from '@/components/map/JumpButton';
import GenerationPill from '@/components/map/GenerationPill';
import { isGenerationActive } from '@/hooks/useLevelGenerator';
import OptionsSheet from '@/components/settings/OptionsSheet';
import LoadingIndicator from '@/components/LoadingIndicator';

/** Height of the blurred header over the map */
const HEADER_HEIGHT = 140;
/** The scroll position is rounded to this step before re-rendering the visible part of the map */
const SCROLL_STEP = 100;
/** Part of the map drawn above and under the screen */
const DRAW_MARGIN = 1200;
/** The map is drawn once the screen has slid in, or after this delay if the end of the slide is not reported */
const READY_FALLBACK_MS = 600;

export default function MapScreen() {
  const { colors, board, isDark } = useTheme();
  const router = useRouter();
  const navigation = useNavigation<NativeStackNavigationProp<ReactNavigation.RootParamList>>();

  const maxUnlockedLevel = useGameStore(s => s.maxUnlockedLevel);
  const lastPlayedLevelId = useGameStore(s => s.lastPlayedLevelId);
  const progress = useGameStore(s => s.progress);
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const isGenerating = useGameStore(s => s.generationState.isRunning);
  const setGenerationState = useGameStore(s => s.setGenerationState);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0); // Rounded to SCROLL_STEP
  const [isReady, setIsReady] = useState(false);

  // Combine static levels + dynamically generated levels
  const levels = useMemo(() => [...sampleLevels, ...generatedLevels], [generatedLevels]);
  const levelsById = useMemo(() => new Map(levels.map(l => [l.id, l])), [levels]);

  // We add exactly 1 node at the end for the final Padlock marker indicating the end of generated levels
  const pathLength = levels.length + 1;

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const zones = useMemo(() => buildZones(sampleLevels.length, generatedLevels.length), [generatedLevels.length]);

  // Memoize the map geometry to avoid expensive recalculated arrays
  const layout = useMemo(
    () => createMapLayout(pathLength, screenWidth, screenHeight, zones.slice(1).map(z => z.firstId)),
    [pathLength, screenWidth, screenHeight, zones],
  );
  const { points: pathPoints, totalHeight } = layout;

  const roadSegments = useMemo(() => generateRoadSegments(layout), [layout]);

  // Best stars by level, and their sum per zone and over the whole map
  const { starsById, zoneStars, totalStars } = useMemo(() => {
    const byId = new Map<number, number>();
    for (const p of progress) byId.set(p.levelId, p.stars || 0);
    const perZone: Record<number, number> = {};
    let total = 0;
    for (const zone of zones) {
      let sum = 0;
      for (let id = zone.firstId; id <= zone.lastId; id++) sum += byId.get(id) ?? 0;
      perZone[zone.number] = sum;
      total += sum;
    }
    return { starsById: byId, zoneStars: perZone, totalStars: total };
  }, [progress, zones]);

  // Level the map opens on, chosen once: a win or a level replayed further down does not move the map under the player
  const [focusLevel] = useState(() => getMapFocusLevel(lastPlayedLevelId, maxUnlockedLevel, id => progress.some(p => p.levelId === id && p.completed)));

  // Synchronously calculate initial scroll position to avoid "teleportation"
  const initialY = useMemo(() => {
    const targetNode = pathPoints.find(p => p.id === focusLevel);
    if (targetNode) {
      return Math.max(0, targetNode.y - screenHeight / 2 + 50);
    }
    // Fallback to BOTTOM of map (where level 1 is) if target not found
    return Math.max(0, totalHeight - screenHeight);
  }, [pathPoints, focusLevel, screenHeight, totalHeight]);

  // Set initial scroll state
  useEffect(() => {
    setScrollY(Math.round(initialY / SCROLL_STEP) * SCROLL_STEP);
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
  }, [maxUnlockedLevel]);

  useEffect(() => {
    // Drawing the map during the slide from the home screen made it stutter on Android: wait for its end
    const ready = () => setIsReady(true);
    const unsubscribe = navigation.addListener('transitionEnd', ready);
    const timer = setTimeout(ready, READY_FALLBACK_MS);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [navigation]);

  useEffect(() => {
    // A generation left over by a closed app (the state is saved) is not running any more;
    // one still going on keeps its state: starting another would give the same ids (issue 120)
    if (!isGenerationActive()) setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
  }, []);

  const minY = scrollY - DRAW_MARGIN;
  const maxY = scrollY + screenHeight + DRAW_MARGIN;
  const isVisible = (y: number) => y >= minY && y <= maxY;

  const visibleSegments = useMemo(
    () => roadSegments.filter(s => (s.y1 >= minY && s.y1 <= maxY) || (s.y2 >= minY && s.y2 <= maxY)),
    [roadSegments, minY, maxY],
  );

  // Zone in the middle of the screen, named in the header
  const middleId = Math.max(1, Math.round(layout.tAt(scrollY + (screenHeight + HEADER_HEIGHT) / 2)) + 1);
  const currentZone = zoneOf(zones, middleId);

  // Next level to play (the padlock once every level is beaten), and whether it is out of sight
  const nextNode = pathPoints.find(p => p.id === maxUnlockedLevel) ?? pathPoints[pathPoints.length - 1];
  const nextAbove = nextNode.y < scrollY + HEADER_HEIGHT;
  const nextBelow = nextNode.y > scrollY + screenHeight - 60;

  const jumpToNext = () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollViewRef.current?.scrollTo({ y: Math.max(0, nextNode.y - screenHeight / 2 + 50), animated: true });
  };

  const handleLevelPress = useCallback((levelId: number, isUnlocked: boolean, isCustom: boolean) => {
    if (levelId === 0) {
      haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/tutorial');
      return;
    }
    // The padlock after the last level: no level there (it opened a game that could not load), the generator is in the options
    if (levelId > levels.length) {
      haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSettingsVisible(true);
      return;
    }
    // Custom generated levels are ALWAYS accessible regardless of progression lock
    if (!isUnlocked && !isCustom) {
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/game?levelId=${levelId}`);
  }, [router, levels.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapHeader
        colors={colors}
        isDark={isDark}
        zone={currentZone}
        stars={totalStars}
        maxStars={levels.length * 3}
        onBack={() => router.back()}
        onSettings={() => setSettingsVisible(true)}
      />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ height: totalHeight }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate={0.9}
        contentOffset={{ x: 0, y: initialY }}
        onScroll={(e) => {
          const rounded = Math.round(e.nativeEvent.contentOffset.y / SCROLL_STEP) * SCROLL_STEP;
          if (rounded !== scrollY) setScrollY(rounded);
        }}
      >
        {!isReady ? (
          <View style={{ flex: 1, height: totalHeight }} />
        ) : (
          // One fade for the whole map rather than one per level: dozens of entering animations at once lagged on Android
          <Animated.View entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
            <ZoneLayer
              zones={zones}
              zoneStars={zoneStars}
              layout={layout}
              width={screenWidth}
              minY={minY}
              maxY={maxY}
              colors={colors}
              isDark={isDark}
            />

            <Road segments={visibleSegments} maxUnlockedLevel={maxUnlockedLevel} colors={colors} />

            {pathPoints.map((point, index) => {
              if (!isVisible(point.y)) return null;

              const isTutorial = point.id === 0;
              const isPadlockNode = point.id !== 0 && index === pathPoints.length - 1;

              // find level data by matching point.id with level.id
              const levelData = isTutorial || isPadlockNode ? null : levelsById.get(point.id);

              const isUnlocked = isTutorial || isMapLevelUnlocked(point.id, maxUnlockedLevel);
              const isCurrent = point.id === maxUnlockedLevel;
              const isCustom = !isTutorial && !isPadlockNode && point.id > sampleLevels.length;

              return (
                <LevelNode
                  key={`node-${point.id}`}
                  point={point}
                  levelData={levelData}
                  isUnlocked={isUnlocked}
                  isCurrent={isCurrent}
                  isCustom={isCustom}
                  isBoss={!isPadlockNode && isBossLevel(point.id)}
                  isPadlockNode={isPadlockNode}
                  isTutorial={isTutorial}
                  stars={starsById.get(point.id) ?? 0}
                  onPress={handleLevelPress}
                  colors={colors}
                  board={board}
                />
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      {!isReady && <LoadingIndicator size="large" fill style={StyleSheet.absoluteFill} />}

      {isReady && (nextAbove || nextBelow) && !isGenerating && (
        <JumpButton levelId={nextNode.id} isEnd={nextNode.id > levels.length} below={nextBelow} colors={colors} onPress={jumpToNext} />
      )}

      <OptionsSheet
        visible={isSettingsVisible}
        colors={colors}
        showMapLevels
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
});
