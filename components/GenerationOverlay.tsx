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
/** A bubble let go this close to the left or right edge (or past it) is docked there, minimized */
const DOCK_DISTANCE = 24;
/** A docked tab pulled this far from its edge comes off it */
const UNDOCK_PULL = 40;
/** Width of the docked tab */
const TAB_WIDTH = 34;
/** How long the end of a generation stays on screen */
const DONE_MS = 3000;
const SNAP = { damping: 18, stiffness: 180 };

type Side = 'left' | 'right';

/**
 * Where the bubble was left, for the rest of the session: free (its left edge, as a share of the
 * screen) or docked to a side, and its height, as a share of the screen. Not saved: the next
 * launch starts from the default place
 */
const place: { docked: Side | null; left: number; top: number } = { docked: null, left: 0, top: 0.8 };

/**
 * The map generation, on every screen: a small bubble with the progress and Cancel, above the
 * game but never in the way. It is dragged anywhere and stays where it is let go; let go against
 * the left or right edge, it is docked there as a small tab, whose arrow (or a pull) brings the
 * bubble back. Touched, the bubble shows the details (time left, Cancel with its name).
 * Cancel hides it at once (the generation stops after the call going on); the end of a
 * generation shows for a moment, then the bubble goes. The app closed, the generation stops.
 */
export default function GenerationOverlay() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const generationState = useGameStore(s => s.generationState);
  const cancelGeneration = useGameStore(s => s.cancelGeneration);
  const { isRunning, current, total, shouldCancel, estimatedRemainingSeconds } = generationState;

  useEffect(() => {
    // A generation left over by a closed app (the state is saved) is not running any more
    if (!isGenerationActive()) useGameStore.getState().setGenerationState({ isRunning: false, shouldCancel: false, estimatedRemainingSeconds: 0 });
  }, []);
  // The app closed (on Android, its process can outlive it): the generation stops, never picked up at the next launch.
  // A layout effect: its cleanup runs as the app goes, not some time after
  useLayoutEffect(() => () => { if (isGenerationActive()) useGameStore.getState().cancelGeneration(); }, []);

  const [expanded, setExpanded] = useState(false);
  // A generation really going on: a state left over by a closed app shows nothing, even before it is reset
  const running = isRunning && isGenerationActive();
  // The end of a generation that made levels: shown DONE_MS; a cancelled one just goes.
  // Worked out as the generation ends, in the same render: no frame without the bubble in between,
  // and none with it after a cancel (it stayed on screen, a second touch on ✕ was needed)
  const [done, setDone] = useState<{ current: number; total: number } | null>(null);
  const cancelled = useRef(false);
  if (shouldCancel) cancelled.current = true;
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (running) {
      cancelled.current = shouldCancel;
      setDone(null);
    } else {
      setExpanded(false);
      if (!cancelled.current && current > 0) setDone({ current, total });
    }
  }
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), DONE_MS);
    return () => clearTimeout(timer);
  }, [done]);

  // Position: the top left corner of the bubble in the window, or the side it is docked to
  const minTop = insets.top + EDGE;
  const bottomOf = (h: number) => Math.max(minTop, height - insets.bottom - EDGE - h);
  const [docked, setDocked] = useState<Side | null>(place.docked);
  const size = useSharedValue({ w: 0, h: 0 });
  const x = useSharedValue(EDGE + place.left * width);
  const y = useSharedValue(minTop + place.top * (bottomOf(48) - minTop));
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // A drag ends with a release that would also touch the bubble: that touch does not open it
  const dragging = useRef(false);

  const remember = (side: Side | null, left: number, top: number) => {
    place.docked = side;
    place.left = Math.max(0, (left - EDGE) / Math.max(1, width));
    place.top = (top - minTop) / Math.max(1, bottomOf(48) - minTop);
  };

  // A new size (details shown or hidden, another number, docked or not): the bubble stays on screen
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    size.value = { w, h };
    // Free: kept inside the screen; the end of a generation shown from the tab: next to its edge
    if (docked && done) x.value = docked === 'left' ? EDGE : width - EDGE - w;
    else if (!docked) x.value = Math.min(Math.max(x.value, EDGE), Math.max(EDGE, width - EDGE - w));
    y.value = Math.min(Math.max(y.value, minTop), bottomOf(h));
  };

  /** The bubble comes off its edge, next to it */
  const undock = (side: Side) => {
    // Its width is not known yet: onLayout keeps it on screen
    x.value = side === 'left' ? EDGE : width;
    setDocked(null);
    remember(null, x.value, y.value);
  };

  const dock = (side: Side) => {
    setExpanded(false);
    setDocked(side);
    remember(side, x.value, y.value);
  };

  const drag = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      dragging.current = true;
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      if (docked) {
        // A docked tab slides along its edge, and comes off it when pulled away
        const pull = docked === 'left' ? e.translationX : -e.translationX;
        if (pull > UNDOCK_PULL) {
          setDocked(null);
          x.value = docked === 'left' ? EDGE + pull - UNDOCK_PULL : width - EDGE - (pull - UNDOCK_PULL);
          startX.value = x.value - e.translationX;
        }
        return;
      }
      x.value = startX.value + e.translationX;
    })
    .onEnd(() => {
      const { w, h } = size.value;
      const top = Math.min(Math.max(y.value, minTop), bottomOf(h));
      y.value = withSpring(top, SNAP);
      if (docked) {
        remember(docked, x.value, top);
        return;
      }
      // Against an edge (or past it): docked there; anywhere else: where it is let go, on screen
      if (x.value < DOCK_DISTANCE) return dock('left');
      if (x.value + w > width - DOCK_DISTANCE) return dock('right');
      const left = Math.min(Math.max(x.value, EDGE), width - EDGE - w);
      x.value = withSpring(left, SNAP);
      remember(null, left, top);
    })
    .onFinalize(() => {
      setTimeout(() => { dragging.current = false; }, 0);
    })
    // On the JS thread: it docks the bubble (React state) and remembers its place for the session
    .runOnJS(true);

  const position = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const tabPosition = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  // Cancel hides the bubble at once
  if (shouldCancel || (!running && !done)) return null;

  const progress = done ?? { current, total };
  const ratio = progress.current / Math.max(progress.total, 1);
  const title = t('map.generating_levels');
  const count = t('map.generation_progress', { current: progress.current, total: progress.total });
  const showTime = !done && estimatedRemainingSeconds > 0;

  const tab = docked !== null && !done;
  const percent = `${Math.round(ratio * 100)} %`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={drag}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(250)}
          onLayout={onLayout}
          // One view, docked or not: a drag that pulls the tab off its edge goes on with the bubble
          style={tab ? [
            styles.tab,
            docked === 'left' ? [styles.tabLeft, { left: 0 }] : [styles.tabRight, { right: 0 }],
            { backgroundColor: colors.floating, borderColor: colors.primaryBorder },
            tabPosition,
          ] : [
            styles.bubble,
            { backgroundColor: colors.floating, borderColor: done ? colors.successBorder : colors.primaryBorder },
            expanded && [styles.expanded, { width: Math.min(300, width - 2 * EDGE) }],
            position,
          ]}
        >
          {tab ? (
            <Pressable
              onPress={() => { if (!dragging.current) undock(docked!); }}
              accessibilityRole="button"
              accessibilityLabel={`${title}, ${count}`}
              accessibilityHint={t('a11y.generation_undock')}
              accessibilityActions={[{ name: 'cancel', label: t('a11y.cancel_generation') }]}
              onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'cancel') cancelGeneration(); }}
              style={styles.tabInner}
              hitSlop={8}
            >
              <Ionicons name={docked === 'left' ? 'chevron-forward' : 'chevron-back'} size={18} color={colors.primaryText} />
              <Text style={[styles.tabPercent, { color: colors.text }]} numberOfLines={1}>{percent}</Text>
              <View style={styles.tabTrack}>
                <View style={[styles.fill, { backgroundColor: colors.primary, height: `${Math.round(ratio * 100)}%` }]} />
              </View>
            </Pressable>
          ) : (
            <>
              <View style={styles.row}>
                <Pressable
                  onPress={() => { if (!dragging.current) setExpanded(e => !e); }}
                  disabled={!!done}
                  accessibilityRole="button"
                  accessibilityLabel={done ? count : `${title}, ${count}`}
                  accessibilityHint={done ? undefined : t('a11y.generation_details')}
                  accessibilityState={{ expanded }}
                  accessibilityActions={done ? undefined : [{ name: 'dock', label: t('a11y.generation_dock') }]}
                  onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'dock') dock(x.value + size.value.w / 2 > width / 2 ? 'right' : 'left'); }}
                  style={styles.summary}
                  hitSlop={6}
                >
                  {done
                    ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    : <ActivityIndicator color={colors.primary} size="small" />}
                  {expanded && !done ? (
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
                  ) : (
                    <Text style={[styles.count, { color: done ? colors.success : colors.text }]}>
                      {done ? count : `${progress.current}/${progress.total}`}
                    </Text>
                  )}
                </Pressable>
                {!done && (
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
            </>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const shadow = {
  shadowColor: fixedColors.shadow,
  shadowOpacity: 0.2,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 12,
};

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    ...shadow,
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
    width: '100%',
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
  tab: {
    position: 'absolute',
    top: 0,
    width: TAB_WIDTH,
    borderWidth: 1,
    ...shadow,
  },
  tabLeft: {
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderLeftWidth: 0,
  },
  tabRight: {
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderRightWidth: 0,
  },
  tabInner: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  tabPercent: {
    fontSize: RFValue(9),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tabTrack: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: fixedColors.neutralSoft,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
});
