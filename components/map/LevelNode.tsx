import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Level } from '@/store/gameStore';
import { MapColors } from './colors';
import { PathPoint } from './path';

interface LevelNodeProps {
  point: PathPoint;
  levelData: Level | null | undefined;
  isUnlocked: boolean;
  isCurrent: boolean;
  isCustom: boolean;
  isPadlockNode: boolean;
  isTutorial: boolean;
  stars: number;
  onPress: (id: number, unlocked: boolean, custom: boolean) => void;
  colors: MapColors;
  isDark: boolean;
}

const LevelNode = React.memo(({
  point,
  levelData,
  isUnlocked,
  isCurrent,
  isCustom,
  isPadlockNode,
  isTutorial,
  stars,
  onPress,
  colors,
  isDark,
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
  } else if (isTutorial) {
    carColor = '#3B82F6'; // Distinct blue for tutorial
  } else if (isCurrent) {
    carColor = '#EF4444';
  } else if (isCustom) {
    carColor = getCustomColor();
  } else {
    carColor = '#5A4FE0';
  }

  const nodeOpacity = (isUnlocked || isPadlockNode || isTutorial) ? 1 : 0.4;

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
          { transform: [{ scale: pressed && (isUnlocked || isTutorial) ? 0.9 : (isCurrent ? 1.15 : 1) }] }
        ]}
      >
        <View style={[styles.carShine, { backgroundColor: (isUnlocked || isTutorial) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }]} />

        {isPadlockNode ? (
          <Text style={[styles.lockedIcon, { color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]}>🔒</Text>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.nodeText}>
              {isCustom ? `∞` : isTutorial ? '0' : point.id}
            </Text>
            {!isUnlocked && !isTutorial && (
              <Text style={{ fontSize: 12, position: 'absolute', bottom: -18 }}>🔒</Text>
            )}
          </View>
        )}
      </Pressable>

      {(isUnlocked || isTutorial) && (
        <View style={styles.starsContainer}>
          {stars > 0 ? (
            <Text style={styles.starsText}>
              {'⭐'.repeat(stars)}
            </Text>
          ) : isCurrent ? (
            <Text style={[styles.currentText, { color: colors.accent }]}>{t('map.next')}</Text>
          ) : isTutorial ? (
            <Text style={[styles.currentText, { color: colors.accent, fontSize: 10 }]}>{t('tutorial.title')}</Text>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
});

export default LevelNode;

const styles = StyleSheet.create({
  nodeContainer: {
    position: 'absolute',
    width: 80,
    height: 100,
    alignItems: 'center',
    zIndex: 10,
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
});
