import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, ScrollView, Dimensions, Modal, ActivityIndicator, Switch, InteractionManager, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { haptics, Haptics } from '@/utils/haptics';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { useAudio } from '@/context/AudioProvider';
import { DIFFICULTY_LEVELS, generateLevel } from '@/utils/generator';
import { useTranslation } from 'react-i18next';
import i18n, { changeLanguage } from '@/utils/i18n';
import { RFValue } from '@/utils/responsive';

const { width } = Dimensions.get('window');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const GENERATION_TIME_MAP: Record<string, number> = {
  'EASY': 1000,
  'NORMAL': 3000,
  'HARD': 15000,
  'EXPERT': 500000,
  'MASTER': 1200000,
};

// Candy crush style path generator (Bottom to Top)
const generatePathPoints = (count: number, screenHeight: number) => {
  const points = [];
  const amplitude = width * 0.25;
  const centerX = width / 2;
  const nodeSpacing = 130;

  // Calculate a total height that guarantees the content can be scrolled if needed,
  // or at least fills the screen so the bottom-most level is near the bottom edge.
  const contentHeight = count * nodeSpacing + 150;
  const totalHeight = Math.max(screenHeight * 1.1, contentHeight);

  for (let i = 0; i < count; i++) {
    // i=0 is level 1. It goes at the BOTTOM.
    const xOffset = Math.sin(i * 1.5) * amplitude;
    points.push({
      id: i + 1,
      x: centerX + xOffset,
      y: totalHeight - 150 - (i * nodeSpacing),
    });
  }
  return { points, totalHeight };
};

interface LevelNodeProps {
  point: { id: number; x: number; y: number };
  levelData: any;
  isUnlocked: boolean;
  isCurrent: boolean;
  isCustom: boolean;
  isPadlockNode: boolean;
  stars: number;
  onPress: (id: number, unlocked: boolean, custom: boolean) => void;
  colors: any;
  isDark: boolean;
  index: number;
}

const LevelNode = React.memo(({
  point,
  levelData,
  isUnlocked,
  isCurrent,
  isCustom,
  isPadlockNode,
  stars,
  onPress,
  colors,
  isDark,
  index
}: LevelNodeProps) => {
  const { t } = useTranslation();
  const getCustomColor = () => {
    if (!levelData) return '#8B5CF6';
    if (levelData.minMoves < 14) return '#10B981';
    if (levelData.minMoves < 23) return '#F59E0B';
    return '#EF4444';
  };

  let carColor = colors.locked;
  if (isPadlockNode) {
    carColor = colors.locked;
  } else if (isCurrent) {
    carColor = '#EF4444';
  } else if (isCustom) {
    carColor = getCustomColor();
  } else {
    carColor = '#5A4FE0';
  }

  const nodeOpacity = (isUnlocked || isPadlockNode) ? 1 : 0.4;

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[
        styles.nodeContainer,
        { left: point.x - 40, top: point.y - 40 }
      ]}
    >
      <Pressable
        onPress={() => onPress(point.id, isUnlocked, isCustom)}
        style={({ pressed }) => [
          styles.carNode,
          { backgroundColor: carColor, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', opacity: nodeOpacity },
          isCurrent && { transform: [{ scale: 1.15 }], shadowColor: carColor, shadowOpacity: 0.6, shadowRadius: 12, elevation: 12 },
          isCustom && { borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', shadowColor: carColor },
          { transform: [{ scale: pressed && isUnlocked ? 0.9 : (isCurrent ? 1.15 : 1) }] }
        ]}
      >
        <View style={[styles.carShine, { backgroundColor: isUnlocked ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }]} />

        {isPadlockNode ? (
          <Text style={[styles.lockedIcon, { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]}>🔒</Text>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.nodeText}>
              {isCustom ? `∞` : point.id}
            </Text>
            {!isUnlocked && (
              <Text style={{ fontSize: 12, position: 'absolute', bottom: -18 }}>🔒</Text>
            )}
          </View>
        )}
      </Pressable>

      {isUnlocked && (
        <View style={styles.starsContainer}>
          {stars > 0 ? (
            <Text style={styles.starsText}>
              {'⭐'.repeat(stars)}
            </Text>
          ) : isCurrent ? (
            <Text style={[styles.currentText, { color: colors.accent }]}>{t('map.next')}</Text>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
});

export default function MapScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const { maxUnlockedLevel, lastPlayedLevelId, progress, generatedLevels, generationState, setGenerationState, cancelGeneration, hardReset, purgeCustomLevels, isHapticsEnabled, toggleHapticsEnabled } = useGameStore();
  const { toggleMusic, isPlaying: isMusicEnabled } = useAudio();
  const scrollViewRef = useRef<ScrollView>(null);

  // Modal State
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [genAmount, setGenAmount] = useState<number>(3);
  const [genDifficulty, setGenDifficulty] = useState<keyof typeof DIFFICULTY_LEVELS>('NORMAL');
  const [genGridSize, setGenGridSize] = useState<number>(6);
  const [scrollY, setScrollY] = useState(0); // Will be updated in useMemo or effect
  const [settingsScrolledToBottom, setSettingsScrolledToBottom] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Convenience derived values from the store
  const isGenerating = generationState.isRunning;

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', locked: '#2A2A35', line: 'rgba(255,255,255,0.1)' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', locked: '#E0E0E8', line: 'rgba(0,0,0,0.1)' };

  // Combine static levels + dynamically generated levels
  const levels = [...sampleLevels, ...generatedLevels];

  // We add exactly 1 node at the end for the final Padlock marker indicating the end of generated levels
  const pathLength = levels.length + 1;

  const screenHeight = Dimensions.get('window').height;

  // Memoize path points and total height to avoid expensive recalculated arrays
  const { points: pathPoints, totalHeight } = useMemo(() => {
    return generatePathPoints(pathLength, screenHeight);
  }, [pathLength, screenHeight]);

  // Synchronously calculate initial scroll position to avoid "teleportation"
  const initialY = useMemo(() => {
    const targetId = lastPlayedLevelId || maxUnlockedLevel;
    const targetNode = pathPoints.find(p => p.id === targetId);
    if (targetNode) {
      return Math.max(0, targetNode.y - screenHeight / 2 + 50);
    }
    return 0;
  }, [pathPoints, lastPlayedLevelId, maxUnlockedLevel, screenHeight]);

  // Set initial scroll state
  useEffect(() => {
    setScrollY(initialY);
  }, [initialY]);

  // Custom Generator Logic
  const handleGenerateCustomLevels = async () => {
    const baseTimePerLevel = GENERATION_TIME_MAP[genDifficulty] || 2000;
    const initialEst = Math.ceil(((genAmount * baseTimePerLevel) + (genAmount * 150)) / 1000);

    setGenerationState({
      isRunning: true,
      current: 0,
      total: genAmount,
      shouldCancel: false,
      estimatedRemainingSeconds: initialEst
    });

    // Close modal so user can browse the map in background
    setSettingsVisible(false);

    setTimeout(async () => {
      const { addGeneratedLevel } = useGameStore.getState();
      const startingId = levels.length > 0 ? levels[levels.length - 1].id + 1 : 1;

      let totalGenerationTime = 0;

      for (let i = 0; i < genAmount; i++) {
        // Check cancel flag before each level
        const { shouldCancel } = useGameStore.getState().generationState;
        if (shouldCancel) break;

        const startTime = Date.now();
        const config = { ...DIFFICULTY_LEVELS[genDifficulty], gridSize: genGridSize };
        // Pass a copy of config to be safe
        const newLevel = generateLevel(startingId + i, { ...config });
        const duration = Date.now() - startTime;
        totalGenerationTime += duration;

        if (newLevel) {
          addGeneratedLevel(newLevel);
        }

        // Calculate remaining time based on actual average
        const avgSoFar = totalGenerationTime / (i + 1);
        const remainingCount = genAmount - (i + 1);
        const estRemaining = Math.ceil((remainingCount * (avgSoFar + 150)) / 1000);

        setGenerationState({
          current: i + 1,
          estimatedRemainingSeconds: estRemaining
        });

        // Yield to the JS event loop — lets the Cancel button press be processed.
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 100);
  };

  const handleResetLevels = () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    purgeCustomLevels(sampleLevels.length);
  };

  const handleHardReset = () => {
    Alert.alert(
      t('common.hard_reset'),
      t('home.hard_reset_confirm_desc', { defaultValue: "This will erase EVERYTHING: all your progress, stars, and custom levels. Are you sure?" }),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('home.hard_reset_confirm_btn', { defaultValue: "Yes, Reset Everything" }),
          style: "destructive",
          onPress: () => {
            hardReset();
            setSettingsVisible(false);
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  useEffect(() => {
    // Defer heavy rendering until after navigation transition
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    // Reset generation state on mount to prevent stuck "Canceling..." state
    setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
  }, []);

  useEffect(() => {
    // If levels change (generation), we might need to adjust, 
    // but the initial "teleport" is solved by contentOffset.
  }, [lastPlayedLevelId, maxUnlockedLevel]);

  const windowHeight = screenHeight * 1.5;
  const isVisible = (y: number) => {
    return y >= scrollY - 1200 && y <= scrollY + screenHeight + 1200;
  };

  const handleLevelPress = (levelId: number, isUnlocked: boolean, isCustom: boolean) => {
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
          <Text style={[styles.backText, { color: colors.sub }]}>← {t('common.home', { defaultValue: 'Home' })}</Text>
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
            {/* Since React Native SVG can be tricky to set up quickly without rendering issues,
            we will use a simpler pure-View based path generation for the connections. */}
            {pathPoints.map((point, index) => {
              if (index === pathPoints.length - 1) return null;
              const nextPoint = pathPoints[index + 1];

              // Only render the line if at least one point is visible
              if (!isVisible(point.y) && !isVisible(nextPoint.y)) return null;

              const isUnlockedLine = maxUnlockedLevel > point.id;

              // Calculate angle and distance for the line segment
              const dx = nextPoint.x - point.x;
              const dy = nextPoint.y - point.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={`line-${point.id}`}
                  style={{
                    position: 'absolute',
                    left: point.x,
                    top: point.y,
                    width: distance,
                    height: 8,
                    backgroundColor: isUnlockedLine ? colors.accent : colors.line,
                    borderRadius: 4,
                    transform: [
                      { translateX: 0 },
                      { translateY: -4 }, // Center the line
                      { rotate: `${angle}deg` },
                      { translateX: distance / 2 - distance / 2 }, // Reset origin (React Native transforms are from center by default)
                    ],
                    // Quick fix for transform origin in React Native
                    transformOrigin: 'left',
                    zIndex: 1,
                  }}
                />
              );
            })}

            {/* Draw Nodes */}
            {pathPoints.map((point, index) => {
              if (!isVisible(point.y)) return null;

              const isPadlockNode = index === levels.length;
              const levelData = isPadlockNode ? null : levels[index];

              const isUnlocked = point.id <= maxUnlockedLevel;
              const isCurrent = point.id === maxUnlockedLevel;
              const isCustom = !isPadlockNode && point.id > sampleLevels.length;

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
                  stars={stars}
                  onPress={handleLevelPress}
                  colors={colors}
                  isDark={isDark}
                  index={index}
                />
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Settings & Generator Modal */}
      <Modal visible={isSettingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('home.options')}</Text>
              <Pressable onPress={() => setSettingsVisible(false)}>
                <Text style={{ fontSize: RFValue(20), color: colors.sub, padding: 8 }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={true} 
              indicatorStyle={isDark ? 'white' : 'black'}
              contentContainerStyle={{ paddingBottom: 60 }}
              onScroll={(e) => {
                const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
                setSettingsScrolledToBottom(isCloseToBottom);
              }}
              scrollEventThrottle={16}
            >
              {/* Language Switcher */}
              <View style={styles.settingRow}>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('common.language')}</Text>
                  <Text style={[styles.settingSub, { color: colors.sub }]}>{i18n.language === 'en' ? t('common.en') : t('common.fr')}</Text>
                </View>
                <View style={styles.languageBtns}>
                  <Pressable
                    onPress={() => changeLanguage('en')}
                    style={[styles.langBtn, i18n.language === 'en' && { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.langBtnText, { color: i18n.language === 'en' ? '#FFF' : colors.text }]}>EN</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => changeLanguage('fr')}
                    style={[styles.langBtn, i18n.language === 'fr' && { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.langBtnText, { color: i18n.language === 'fr' ? '#FFF' : colors.text }]}>FR</Text>
                  </Pressable>
                </View>
              </View>

              {/* Music Toggle */}
              <View style={styles.settingRow}>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.background_music')}</Text>
                  <Text style={[styles.settingSub, { color: colors.sub }]}>{t('map.music_name')}</Text>
                </View>
                <Switch
                  value={isMusicEnabled}
                  onValueChange={toggleMusic}
                  trackColor={{ false: '#767577', true: colors.accent }}
                />
              </View>

              <View style={styles.settingRow}>
                <View>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.haptic_feedback')}</Text>
                  <Text style={[styles.settingSub, { color: colors.sub }]}>{t('map.vibrate_interactions')}</Text>
                </View>
                <Switch
                  value={isHapticsEnabled}
                  onValueChange={() => {
                    toggleHapticsEnabled();
                    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  trackColor={{ false: '#767577', true: colors.accent }}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.sub }]} />

              {/* Generator Setttings */}
              <Text style={[styles.sectionTitle, { color: colors.accent }]}>{t('map.level_generator')}</Text>

              <Text style={[styles.settingSub, { color: '#F59E0B', marginBottom: 16, fontWeight: '600' }]}>
                {t('map.generator_warning', { defaultValue: '⚠️ Note: Complex level generation (Expert/Master) can be resource-intensive on mobile devices.' })}
              </Text>

              <View style={styles.settingBlock}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('creator.difficulty')}: {genDifficulty}</Text>
                <View style={styles.buttonSegmentGroup}>
                  {(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const).map(diff => (
                    <Pressable
                      key={diff}
                      onPress={() => {
                        setGenDifficulty(diff);
                        setGenGridSize(DIFFICULTY_LEVELS[diff].gridSize);
                      }}
                      style={[styles.segmentBtn, genDifficulty === diff && { backgroundColor: colors.accent }]}
                    >
                      <Text 
                        style={[styles.segmentText, { color: genDifficulty === diff ? '#FFF' : colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {diff}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.settingBlock}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.grid_size', { size: genGridSize, defaultValue: `Grid Size: ${genGridSize}x${genGridSize}` })}</Text>
                <View style={styles.buttonSegmentGroup}>
                  {[6, 7, 8].map(size => (
                    <Pressable
                      key={size}
                      onPress={() => setGenGridSize(size)}
                      style={[styles.segmentBtn, genGridSize === size && { backgroundColor: colors.accent }]}
                    >
                      <Text style={[styles.segmentText, { color: genGridSize === size ? '#FFF' : colors.text }]}>
                        {size}x{size}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>



              <View style={styles.settingBlock}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.amount_to_create', { amount: genAmount, defaultValue: `Amount to create: ${genAmount}` })}</Text>
                <View style={styles.buttonSegmentGroup}>
                  {[1, 5, 10, 20].map(amt => (
                    <Pressable
                      key={amt}
                      onPress={() => setGenAmount(amt)}
                      style={[styles.segmentBtn, genAmount === amt && { backgroundColor: colors.accent }]}
                    >
                      <Text style={[styles.segmentText, { color: genAmount === amt ? '#FFF' : colors.text }]}>
                        {amt}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Generation Actions */}
              <View style={{ marginTop: 24, gap: 12 }}>
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: colors.accent, opacity: isGenerating ? 0.5 : 1 }]}
                  onPress={handleGenerateCustomLevels}
                  disabled={isGenerating}
                >
                  <Text style={styles.mainBtnText}>
                    {isGenerating ? t('map.generating', { defaultValue: '⏳ Generation in Progress...' }) : t('map.generate_btn', { amount: genAmount, time: Math.ceil((genAmount * (GENERATION_TIME_MAP[genDifficulty] || 2000)) / 1000), defaultValue: `Generate ${genAmount} Levels (~${Math.ceil((genAmount * (GENERATION_TIME_MAP[genDifficulty] || 2000)) / 1000)}s)` })}
                  </Text>
                </Pressable>

                {!isGenerating && generatedLevels.length > 0 && (
                  <Pressable
                    style={[styles.resetBtn, { borderColor: '#EF4444' }]}
                    onPress={handleResetLevels}
                  >
                    <Text style={[styles.resetBtnText, { color: '#EF4444' }]}>{t('map.reset_custom')}</Text>
                  </Pressable>
                )}

                <View style={[styles.divider, { backgroundColor: colors.sub, marginVertical: 12 }]} />

                <Text style={[styles.sectionTitle, { color: colors.accent, marginBottom: 8 }]}>{t('map.community_levels', { defaultValue: 'Community & Levels' })}</Text>
                <Pressable
                  style={[styles.mainBtn, { backgroundColor: '#24292e', marginBottom: 12 }]}
                  onPress={() => Linking.openURL('https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?title=Request:%20New%20Complex%20Levels&body=I%20would%20like%20to%20see%20more%20high-difficulty%20levels%21')}
                >
                  <Text style={styles.mainBtnText}>{t('map.request_github')}</Text>
                </Pressable>

                <Pressable
                  style={[styles.resetBtn, { borderColor: colors.sub, borderStyle: 'dotted', marginTop: 12 }]}
                  onPress={handleHardReset}
                >
                  <Text style={[styles.resetBtnText, { color: colors.sub }]}>{t('map.hard_reset_progress')}</Text>
                </Pressable>
              </View>
            </ScrollView>

            {!settingsScrolledToBottom && (
              <Animated.View entering={FadeInDown} style={styles.scrollHint}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: RFValue(12) }}>{t('map.scroll_hint', { defaultValue: 'Scroll for more content ↓' })}</Text>
              </Animated.View>
            )}
          </View>
        </View>
      </Modal>

      {/* Floating generation progress pill — pinned below the header */}
      {isGenerating && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[
            styles.generationPill,
            { backgroundColor: isDark ? 'rgba(22,20,40,0.96)' : 'rgba(255,255,255,0.96)' }
          ]}
        >
          {/* Top row: title + cancel */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={generationState.shouldCancel ? '#EF4444' : colors.accent} size="small" />
              <Text style={[styles.pillTitle, { color: generationState.shouldCancel ? '#EF4444' : colors.text }]}>
                {generationState.shouldCancel ? t('map.canceling', { defaultValue: 'Canceling...' }) : t('map.generating_levels', { defaultValue: 'Generating Levels' })}
              </Text>
            </View>
            {!generationState.shouldCancel && (
              <Pressable
                onPress={() => cancelGeneration()}
                hitSlop={15}
                style={[styles.pillCancelBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.1)' }]}
              >
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: RFValue(13) }}>✕ {t('common.cancel')}</Text>
              </Pressable>
            )}
          </View>

          {/* Progress bar */}
          <View style={styles.pillBarTrack}>
            <View
              style={[
                styles.pillBarFill,
                {
                  backgroundColor: colors.accent,
                  width: `${Math.round((generationState.current / Math.max(generationState.total, 1)) * 100)}%`,
                }
              ]}
            />
          </View>

          {/* Count and time */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.pillSub, { color: colors.sub }]}>
              {t('map.generation_progress', { current: generationState.current, total: generationState.total, defaultValue: `${generationState.current} of ${generationState.total} levels ready !` })}
            </Text>
            {generationState.estimatedRemainingSeconds > 0 && !generationState.shouldCancel && (
              <Text style={[styles.pillSub, { color: colors.accent, fontWeight: '600' }]}>
                ~{t('map.time_left', { seconds: generationState.estimatedRemainingSeconds, defaultValue: `${generationState.estimatedRemainingSeconds}s left` })}
              </Text>
            )}
          </View>
        </Animated.View>
      )}

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
  nodeContainer: {
    position: 'absolute',
    width: 80,
    height: 100,
    alignItems: 'center',
    zIndex: 10,
  },
  settingsButton: {
    width: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
  },
  carNode: {
    width: 48,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  carShine: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: '45%',
    borderRadius: 8,
  },
  nodeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    zIndex: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  lockedIcon: {
    fontSize: 20,
    zIndex: 2,
  },
  starsContainer: {
    marginTop: 8,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsText: {
    fontSize: 12,
    letterSpacing: 1,
  },
  currentText: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: RFValue(24),
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSub: {
    fontSize: RFValue(13),
  },
  languageBtns: { 
    flexDirection: 'row', 
    gap: 8, 
    backgroundColor: 'rgba(0,0,0,0.05)', 
    padding: 4, 
    borderRadius: 12 
  },
  langBtn: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  langBtnText: { 
    fontSize: RFValue(14), 
    fontWeight: '700' 
  },
  divider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: RFValue(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  settingBlock: {
    marginBottom: 20,
  },
  buttonSegmentGroup: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  mainBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  resetBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  generationPill: {
    position: 'absolute',
    top: 115, // below the header (which has paddingTop: 60 + paddingBottom: 16 + ~30 content)
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    zIndex: 200,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  pillTitle: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  pillBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
    marginTop: 2,
  },
  pillBarFill: {
    height: 6,
    borderRadius: 3,
  },
  pillSub: {
    fontSize: RFValue(12),
    marginTop: 6,
  },
  pillCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  scrollHint: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
});

