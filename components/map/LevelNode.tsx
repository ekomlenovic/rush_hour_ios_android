import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Level } from '@/store/gameStore';
import { fixedColors, type BoardColors, type UiColors } from '@/theme';
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
  colors: UiColors;
  board: BoardColors;
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
  board,
}: LevelNodeProps) => {
  const { t } = useTranslation();
  const getCustomColor = () => {
    if (!levelData) return colors.levelUnknown;
    if (levelData.minMoves < 14) return colors.levelEasy;
    if (levelData.minMoves < 23) return colors.levelMedium;
    return colors.levelHard;
  };

  let carColor = colors.inactive;
  if (isPadlockNode) {
    carColor = colors.inactive;
  } else if (isTutorial) {
    carColor = colors.levelTutorial; // Distinct blue for tutorial
  } else if (isCurrent) {
    carColor = board.targetCar;
  } else if (isCustom) {
    carColor = getCustomColor();
  } else {
    carColor = colors.levelCustom;
  }

  const nodeOpacity = (isUnlocked || isPadlockNode || isTutorial) ? 1 : 0.4;

  // "Level 12, 3 stars" / "Level 13, next level" / "Level 14, locked"
  const a11yLabel = isPadlockNode ? t('a11y.map_end')
    : isTutorial ? t('tutorial.title')
    : [
        isCustom ? t('a11y.generated_level', { id: point.id }) : t('a11y.level', { id: point.id }),
        stars > 0 ? t('a11y.level_stars', { count: stars }) : null,
        isCurrent ? t('a11y.level_next') : null,
        !isUnlocked && !isCustom ? t('a11y.level_locked') : null,
      ].filter(Boolean).join(', ');

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
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: !isUnlocked && !isCustom && !isTutorial }}
        style={({ pressed }) => [
          styles.carNode,
          { backgroundColor: carColor, borderColor: board.vehicleBorder, opacity: nodeOpacity },
          isCurrent && { transform: [{ scale: 1.15 }], shadowColor: carColor, shadowOpacity: 0.6, shadowRadius: 12, elevation: 12 },
          isCustom && { borderRadius: 24, borderWidth: 2, borderColor: board.dragBorder, shadowColor: carColor },
          { transform: [{ scale: pressed && (isUnlocked || isTutorial) ? 0.9 : (isCurrent ? 1.15 : 1) }] }
        ]}
      >
        <View style={[styles.carShine, { backgroundColor: (isUnlocked || isTutorial) ? colors.shine : colors.shineFaint }]} />

        {isPadlockNode ? (
          <Text style={[styles.lockedIcon, { color: board.vehicleBorder }]}>🔒</Text>
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
        <View style={styles.starsContainer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {stars > 0 ? (
            <Text style={styles.starsText}>
              {'⭐'.repeat(stars)}
            </Text>
          ) : isCurrent ? (
            <Text style={[styles.currentText, { color: colors.primaryText }]}>{t('map.next')}</Text>
          ) : isTutorial ? (
            <Text style={[styles.currentText, { color: colors.primaryText, fontSize: 10 }]}>{t('tutorial.title')}</Text>
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
    shadowColor: fixedColors.shadow,
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
    color: fixedColors.onPrimary,
    zIndex: 2,
    textShadowColor: fixedColors.textShadow,
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
