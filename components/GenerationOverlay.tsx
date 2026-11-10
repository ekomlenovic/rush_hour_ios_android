import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { formatGenerationTime, isGenerationActive } from '@/hooks/useLevelGenerator';
import { RFValue } from '@/utils/responsive';
import { fixedColors, useTheme } from '@/theme';

/** Space between the bubble and the edges of the screen */
const EDGE = 12;
/** How long the end of a generation stays on screen */
const DONE_MS = 3000;
const SNAP = { damping: 18, stiffness: 180 };

/**
 * Where the bubble was left, for the rest of the session: the side of the screen and the height,
 * as a share of the screen. Not saved: the next launch starts from the default place
 */
const place = { right: false, top: 0.8 };

/**
 * The map generation, on every screen (issue: play while levels are generated): a small bubble
 * with the progress and Cancel, above the game but never in the way. It is dragged anywhere
 * along the left or right edge, and touched to show the details (time left, Cancel with its name).
 * The end of a generation shows for a moment, then the bubble goes.
 */
export default function GenerationOverlay() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const generationState = useGameStore(s => s.generationState);
  const cancelGeneration = useGameStore(s => s.cancelGeneration);
  const { isRunning, current, total, shouldCancel, estimatedRemainingSeconds } = generationState;

  // A generation left over by a closed app (the state is saved) is not running any more
  useEffect(() => {
    if (!isGenerationActive()) useGameStore.getState().setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
  }, []);

  const [expanded, setExpanded] = useState(false);
  // The end of a generation that made levels: shown DONE_MS, a cancelled one just goes
  const [done, setDone] = useState<{ current: number; total: number } | null>(null);
  const wasRunning = useRef(false);
  const cancelled = useRef(false);
  if (shouldCancel) cancelled.current = true;
  useEffect(() => {
    if (isRunning) {
      if (!wasRunning.current) { cancelled.current = shouldCancel; setDone(null); }
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    setExpanded(false);
    if (cancelled.current || current === 0) return;
    setDone({ current, total });
    const timer = setTimeout(() => setDone(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [isRunning]);

  // Position: the edge the bubble keeps to (a style, so a new width never moves it off screen),
  // a sideways offset while it is dragged, and its top in the window
  const minTop = insets.top + EDGE;
  const maxTop = Math.max(minTop, height - insets.bottom - EDGE - 48);
  const [onRight, setOnRight] = useState(place.right);
  const size = useSharedValue({ w: 0, h: 0 });
  const dx = useSharedValue(0);
  const y = useSharedValue(minTop + place.top * (maxTop - minTop));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // A drag ends with a release that would also touch the bubble: that touch does not open it
  const dragging = useRef(false);
  // Offset that keeps the bubble where it was released once it holds to its new edge, then slides to it
  const switched = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (switched.current === null) return;
    dx.value = switched.current;
    dx.value = withSpring(0, SNAP);
    switched.current = null;
  }, [onRight]);

  // A new size (details shown or hidden, another number): the bubble stays on screen
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    size.value = { w, h };
    y.value = Math.min(Math.max(y.value, minTop), height - insets.bottom - EDGE - h);
  };

  const drag = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      dragging.current = true;
      startX.value = dx.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      dx.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      // To the nearest edge, inside the safe area
      const { w, h } = size.value;
      const left = (onRight ? width - EDGE - w : EDGE) + dx.value;
      const toRight = left + w / 2 > width / 2;
      const top = Math.min(Math.max(y.value, minTop), height - insets.bottom - EDGE - h);
      y.value = withSpring(top, SNAP);
      if (toRight === onRight) dx.value = withSpring(0, SNAP);
      else {
        switched.current = left - (toRight ? width - EDGE - w : EDGE);
        setOnRight(toRight);
      }
      place.right = toRight;
      place.top = maxTop > minTop ? (top - minTop) / (maxTop - minTop) : 0;
    })
    .onFinalize(() => {
      setTimeout(() => { dragging.current = false; }, 0);
    })
    // On the JS thread: it remembers the place for the session (a plain object, out of reach of a worklet)
    .runOnJS(true);

  const position = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: y.value }] }));

  // wasRunning: the render where a generation just ended, before its end is shown (no blink in between)
  if (!isRunning && !done && !wasRunning.current) return null;

  const progress = done ?? { current, total };
  const ratio = progress.current / Math.max(progress.total, 1);
  const title = shouldCancel ? t('map.canceling') : t('map.generating_levels');
  const count = t('map.generation_progress', { current: progress.current, total: progress.total });
  const showTime = !done && estimatedRemainingSeconds > 0 && !shouldCancel;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={drag}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(250)}
          onLayout={onLayout}
          style={[
            styles.bubble,
            { backgroundColor: colors.floating, borderColor: done ? colors.successBorder : colors.primaryBorder },
            expanded && [styles.expanded, { width: Math.min(300, width - 2 * EDGE) }],
            onRight ? { right: EDGE } : { left: EDGE },
            position,
          ]}
        >
          <View style={styles.row}>
            <Pressable
              onPress={() => { if (!dragging.current) setExpanded(e => !e); }}
              disabled={!!done}
              accessibilityRole="button"
              accessibilityLabel={done ? count : `${title}, ${count}`}
              accessibilityHint={done ? undefined : t('a11y.generation_details')}
              accessibilityState={{ expanded }}
              style={styles.summary}
              hitSlop={6}
            >
              {done
                ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                : <ActivityIndicator color={shouldCancel ? colors.danger : colors.primary} size="small" />}
              {expanded && !done ? (
                <Text style={[styles.title, { color: shouldCancel ? colors.danger : colors.text }]} numberOfLines={2}>{title}</Text>
              ) : (
                <Text style={[styles.count, { color: done ? colors.success : colors.text }]}>
                  {done ? count : `${progress.current}/${progress.total}`}
                </Text>
              )}
            </Pressable>
            {!done && !shouldCancel && (
              <Pressable
                onPress={() => cancelGeneration()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.cancel_generation')}
                style={[styles.cancel, { backgroundColor: colors.dangerSoft }, expanded && styles.cancelWide]}
              >
                <Ionicons name="close" size={16} color={colors.danger} />
                {expanded && <Text style={[styles.cancelText, { color: colors.danger }]}>{t('common.cancel')}</Text>}
              </Pressable>
            )}
          </View>

          {!done && (
            <View style={[styles.track, expanded ? styles.trackWide : null]}>
              <View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          )}

          {expanded && !done && (
            <View style={styles.details} accessibilityLiveRegion="polite">
              <Text style={[styles.sub, { color: colors.textMuted }]}>{count}</Text>
              {showTime && (
                <Text style={[styles.sub, { color: colors.primaryText, fontWeight: '600' }]}>
                  {t('map.time_left', { time: formatGenerationTime(estimatedRemainingSeconds) })}
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: fixedColors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  expanded: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    flexGrow: 1,
  },
  title: {
    fontSize: RFValue(14),
    fontWeight: '700',
    flexShrink: 1,
  },
  count: {
    fontSize: RFValue(13),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 5,
    borderRadius: 10,
  },
  cancelWide: {
    paddingHorizontal: 10,
  },
  cancelText: {
    fontWeight: '700',
    fontSize: RFValue(13),
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: fixedColors.neutralSoft,
    overflow: 'hidden',
    marginTop: 6,
  },
  trackWide: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sub: {
    fontSize: RFValue(12),
  },
});
