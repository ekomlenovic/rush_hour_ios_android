import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Level } from '@/store/gameStore';
import { fixedColors, type BoardColors, type UiColors } from '@/theme';
import { PathPoint } from './path';

const TOKEN = 60;
const DEPTH = 5;

interface LevelNodeProps {
  point: PathPoint;
  levelData: Level | null | undefined;
  isUnlocked: boolean;
  isCurrent: boolean;
  isCustom: boolean;
  /** Much harder than the levels before it: announced so the jump is expected (data/bosses.ts) */
  isBoss: boolean;
  isPadlockNode: boolean;
  isTutorial: boolean;
  stars: number;
  onPress: (id: number, unlocked: boolean, custom: boolean) => void;
  colors: UiColors;
  board: BoardColors;
}

/** Ring pulsing out of the next level to play */
function Halo({ color }: { color: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: color }, style]} />;
}

/** Three star slots under a played level */
function Stars({ stars, colors }: { stars: number; colors: UiColors }) {
  return (
    <View style={[styles.starsPill, { backgroundColor: colors.floating, borderColor: colors.border }]}>
      {[1, 2, 3].map(i => (
        <Text key={i} style={[styles.star, { color: i <= stars ? colors.star : colors.mapLockedText }]}>★</Text>
      ))}
    </View>
  );
}

const LevelNode = React.memo(({
  point,
  levelData,
  isUnlocked,
  isCurrent,
  isCustom,
  isBoss,
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

  const isPlayable = isUnlocked || isTutorial || isCustom;
  const isLocked = isPadlockNode || (!isUnlocked && !isTutorial && !isCustom);

  let face: string = colors.mapLocked;
  if (isPadlockNode) face = colors.mapLocked;
  else if (isTutorial) face = colors.levelTutorial;
  else if (isCurrent) face = board.targetCar;
  else if (isCustom) face = getCustomColor();
  else if (isUnlocked) face = colors.primary;

  const isPerfect = stars >= 3 && !isCurrent;

  // "Level 12, 3 stars" / "Level 13, boss, next level" / "Level 14, locked"
  const a11yLabel = isPadlockNode ? t('a11y.map_end')
    : isTutorial ? t('tutorial.title')
    : [
        isCustom ? t('a11y.generated_level', { id: point.id }) : t('a11y.level', { id: point.id }),
        isBoss ? t('a11y.level_boss') : null,
        stars > 0 ? t('a11y.level_stars', { count: stars }) : null,
        isCurrent ? t('a11y.level_next') : null,
        !isUnlocked && !isCustom ? t('a11y.level_locked') : null,
      ].filter(Boolean).join(', ');

  const glyph = isPadlockNode ? 'lock-closed' : isTutorial ? 'school' : null;
  const label = isCustom ? '∞' : String(point.id);
  const labelSize = glyph ? 24 : label.length >= 3 ? 19 : 23;
  const labelColor = isLocked ? colors.mapLockedText : fixedColors.onPrimary;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.nodeContainer, { left: point.x - 45, top: point.y - TOKEN / 2 - 4 }]}
    >
      {isCurrent && (
        <View style={[styles.nextPill, { backgroundColor: colors.primary }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={styles.nextText}>{t('map.next')}</Text>
        </View>
      )}

      <View style={[styles.tokenSlot, isCurrent && styles.tokenCurrent]}>
        {isCurrent && <Halo color={colors.mapHalo} />}
        <Pressable
          onPress={() => onPress(point.id, isUnlocked, isCustom)}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          // The padlock at the end opens the level generator
          accessibilityState={{ disabled: !isPlayable && !isPadlockNode }}
          hitSlop={6}
          style={({ pressed }) => ({ transform: [{ translateY: pressed && isPlayable ? DEPTH - 1 : 0 }] })}
        >
          {/* Rim under the token: the 3D button depth */}
          <View style={[styles.depth, { backgroundColor: face }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.mapNodeDepth }]} />
          </View>
          <View
            style={[
              styles.face,
              { backgroundColor: face, borderColor: isPerfect ? colors.star : isLocked ? colors.border : colors.shine },
              isPerfect && styles.facePerfect,
              isPadlockNode && styles.facePadlock,
            ]}
          >
            {!isLocked && <View style={[styles.shine, { backgroundColor: colors.shine }]} />}
            <Text
              style={[
                styles.nodeText,
                { fontSize: labelSize, color: labelColor },
                isLocked && styles.nodeTextFlat,
              ]}
            >
              {glyph ? <Ionicons name={glyph} size={labelSize} color={labelColor} /> : label}
            </Text>
          </View>
          {isBoss && (
            <View style={[styles.bossBadge, { backgroundColor: colors.levelHard, borderColor: colors.surface }]}>
              <Ionicons name="skull" size={12} color={fixedColors.onPrimary} />
            </View>
          )}
          {isLocked && !isPadlockNode && (
            <View style={[styles.lockBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.below} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {isTutorial ? (
          <Text style={[styles.caption, { color: colors.primaryText }]}>{t('tutorial.title')}</Text>
        ) : isPlayable && !isCurrent && !isPadlockNode && (stars > 0 || !isCustom) ? (
          <Stars stars={stars} colors={colors} />
        ) : null}
      </View>
    </Animated.View>
  );
});

export default LevelNode;

const styles = StyleSheet.create({
  nodeContainer: {
    position: 'absolute',
    width: 90,
    alignItems: 'center',
    zIndex: 10,
  },
  tokenSlot: {
    width: TOKEN,
    height: TOKEN + DEPTH,
    alignItems: 'center',
  },
  tokenCurrent: {
    transform: [{ scale: 1.12 }],
  },
  halo: {
    position: 'absolute',
    top: 0,
    width: TOKEN,
    height: TOKEN,
    borderRadius: TOKEN / 2,
  },
  depth: {
    position: 'absolute',
    top: DEPTH,
    width: TOKEN,
    height: TOKEN,
    borderRadius: TOKEN / 2,
    overflow: 'hidden',
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  face: {
    width: TOKEN,
    height: TOKEN,
    borderRadius: TOKEN / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 7,
  },
  facePerfect: {
    borderWidth: 3,
  },
  facePadlock: {
    borderStyle: 'dashed',
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: TOKEN * 0.4,
    borderRadius: TOKEN,
  },
  nodeText: {
    fontWeight: '900',
    textShadowColor: fixedColors.textShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontVariant: ['tabular-nums'],
  },
  nodeTextFlat: {
    textShadowRadius: 0,
  },
  lockBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  bossBadge: {
    position: 'absolute',
    left: -4,
    top: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  nextPill: {
    position: 'absolute',
    top: -30,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  nextText: {
    color: fixedColors.onPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  below: {
    marginTop: 4,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsPill: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    gap: 1,
  },
  star: {
    fontSize: 13,
    lineHeight: 17,
  },
  caption: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
