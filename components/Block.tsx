import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, AccessibilityActionEvent, AccessibilityInfo } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { haptics, Haptics } from '@/utils/haptics';
import { Vehicle } from '@/store/gameStore';
import { stepVehicle } from '@/utils/accessibility';
import { useTheme } from '@/theme';

interface BlockProps {
  vehicle: Vehicle;
  allVehicles: Vehicle[];
  gridSize: number;
  cellSize: number;
  onMoveEnd: (vehicleId: string, newRow: number, newCol: number) => void;
  isHinted?: boolean;
  min: number;
  max: number;
  disabled?: boolean;
  /** Screen reader: what the vehicle is ("Car B (blue)") and where ("horizontal, row 3…") */
  a11yLabel: string;
  a11yValue: string;
  /** Labels of the move actions and the announcement when blocked, translated by the board */
  a11yStrings: BlockA11yStrings;
  /** Letter drawn on the vehicle (color-blind option), none if undefined */
  letter?: string;
}

export interface BlockA11yStrings {
  hint: string;
  blocked: string;
  left: string;
  right: string;
  up: string;
  down: string;
}


const SPRING_CONFIG = {
  damping: 15,
  stiffness: 200,
  mass: 0.8,
};

const BOUNCE_SPRING = {
  damping: 12,
  stiffness: 400,
  mass: 0.5,
};

function Block({ vehicle, gridSize, cellSize, onMoveEnd, isHinted, min, max, disabled = false, a11yLabel, a11yValue, a11yStrings, letter }: BlockProps) {

  const { board } = useTheme();
  const fillColor = vehicle.isTarget ? board.targetCar : vehicle.color;

  const width = vehicle.orientation === 'horizontal' ? cellSize * vehicle.length : cellSize;
  const height = vehicle.orientation === 'vertical' ? cellSize * vehicle.length : cellSize;

  const translateX = useSharedValue(vehicle.col * cellSize);
  const translateY = useSharedValue(vehicle.row * cellSize);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  // Shared values for movement bounds (in pixels)
  // These are synced directly from props calculated in the Board component.
  const boundsMinPx = useSharedValue(min * cellSize);
  const boundsMaxPx = useSharedValue(max * cellSize);

  const startX = useSharedValue(vehicle.col * cellSize);
  const startY = useSharedValue(vehicle.row * cellSize);

  const isHorizontal = vehicle.orientation === 'horizontal';

  // Sync prop bounds to shared values
  useEffect(() => {
    boundsMinPx.value = min * cellSize;
    boundsMaxPx.value = max * cellSize;
  }, [min, max, cellSize]);

  // Hint glow animation
  const hintGlow = useSharedValue(0);
  useEffect(() => {
    if (isHinted) {
      hintGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.3, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      hintGlow.value = withTiming(0, { duration: 200 });
    }
  }, [isHinted]);

  const triggerMoveHaptic = useCallback(() => {
    if (vehicle.length >= 3) {
      haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [vehicle.length]);

  const triggerCollisionHaptic = useCallback(() => {
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const handleMoveEndSync = useCallback(
    (newRow: number, newCol: number) => {
      onMoveEnd(vehicle.id, newRow, newCol);
    },
    [onMoveEnd, vehicle.id]
  );

  const hasHitMin = useSharedValue(false);
  const hasHitMax = useSharedValue(false);

  const panGesture = useMemo(() => Gesture.Pan()
    .onStart(() => {
      'use worklet';
      isDragging.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.05, SPRING_CONFIG);
      runOnJS(triggerMoveHaptic)();
    })
    .onUpdate((event) => {
      'use worklet';
      let raw = 0;
      if (isHorizontal) {
        raw = startX.value + event.translationX;
        const clamped = Math.max(boundsMinPx.value, Math.min(boundsMaxPx.value, raw));
        
        // Dynamic collision haptic
        if (raw < boundsMinPx.value && !hasHitMin.value) {
          runOnJS(triggerCollisionHaptic)();
          hasHitMin.value = true;
        } else if (raw > boundsMaxPx.value && !hasHitMax.value) {
          runOnJS(triggerCollisionHaptic)();
          hasHitMax.value = true;
        } else if (raw >= boundsMinPx.value && raw <= boundsMaxPx.value) {
          hasHitMin.value = false;
          hasHitMax.value = false;
        }
        
        translateX.value = clamped;
      } else {
        raw = startY.value + event.translationY;
        const clamped = Math.max(boundsMinPx.value, Math.min(boundsMaxPx.value, raw));
        
        if (raw < boundsMinPx.value && !hasHitMin.value) {
          runOnJS(triggerCollisionHaptic)();
          hasHitMin.value = true;
        } else if (raw > boundsMaxPx.value && !hasHitMax.value) {
          runOnJS(triggerCollisionHaptic)();
          hasHitMax.value = true;
        } else if (raw >= boundsMinPx.value && raw <= boundsMaxPx.value) {
          hasHitMin.value = false;
          hasHitMax.value = false;
        }

        translateY.value = clamped;
      }
    })
    .onEnd(() => {
      'use worklet';
      isDragging.value = false;
      scale.value = withSpring(1, SPRING_CONFIG);
      hasHitMin.value = false;
      hasHitMax.value = false;
      
      const currentValue = isHorizontal ? translateX.value : translateY.value;
      const snappedValue = Math.round(currentValue / cellSize);
      const minCell = boundsMinPx.value / cellSize;
      const maxCell = boundsMaxPx.value / cellSize;
      const finalCell = Math.max(minCell, Math.min(maxCell, snappedValue));
      
      if (isHorizontal) {
        translateX.value = withSpring(finalCell * cellSize, finalCell !== snappedValue ? BOUNCE_SPRING : SPRING_CONFIG);
        if (finalCell !== vehicle.col) {
          runOnJS(handleMoveEndSync)(vehicle.row, finalCell);
          runOnJS(triggerMoveHaptic)();
        }
      } else {
        translateY.value = withSpring(finalCell * cellSize, finalCell !== snappedValue ? BOUNCE_SPRING : SPRING_CONFIG);
        if (finalCell !== vehicle.row) {
          runOnJS(handleMoveEndSync)(finalCell, vehicle.col);
          runOnJS(triggerMoveHaptic)();
        }
      }
    }), [isHorizontal, vehicle.id, vehicle.row, vehicle.col, vehicle.length, cellSize, triggerMoveHaptic, triggerCollisionHaptic, handleMoveEndSync]);

  // Moves of one cell without dragging: VoiceOver / TalkBack swipe (adjustable) or named actions
  const a11yActions = useMemo(() => disabled ? [] : (isHorizontal
    ? [{ name: 'increment' }, { name: 'decrement' }, { name: 'right', label: a11yStrings.right }, { name: 'left', label: a11yStrings.left }]
    : [{ name: 'increment' }, { name: 'decrement' }, { name: 'down', label: a11yStrings.down }, { name: 'up', label: a11yStrings.up }]
  ), [disabled, isHorizontal, a11yStrings]);

  const handleA11yAction = useCallback((event: AccessibilityActionEvent) => {
    const forward = ['increment', 'right', 'down'].includes(event.nativeEvent.actionName);
    const next = stepVehicle(vehicle, { min, max }, forward ? 1 : -1);
    if (!next) {
      AccessibilityInfo.announceForAccessibility(a11yStrings.blocked);
      triggerCollisionHaptic();
      return;
    }
    onMoveEnd(vehicle.id, next.row, next.col);
    triggerMoveHaptic();
  }, [vehicle, min, max, onMoveEnd, a11yStrings, triggerCollisionHaptic, triggerMoveHaptic]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const hintGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: hintGlow.value,
      transform: [{ scale: 1 + hintGlow.value * 0.04 }],
      borderWidth: 2 + hintGlow.value * 2,
    };
  });

  // Sync position when store updates (e.g. undo / reset)
  useEffect(() => {
    if (!isDragging.value) {
      translateX.value = withSpring(vehicle.col * cellSize, SPRING_CONFIG);
      translateY.value = withSpring(vehicle.row * cellSize, SPRING_CONFIG);
    }
  }, [vehicle.col, vehicle.row, cellSize, isDragging]);

  const shadowColor = fillColor;

  return (
    <GestureDetector gesture={panGesture.enabled(!disabled)}>


      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={a11yLabel}
        accessibilityValue={{ text: a11yValue }}
        accessibilityHint={disabled ? undefined : a11yStrings.hint}
        accessibilityState={{ disabled }}
        accessibilityActions={a11yActions}
        onAccessibilityAction={handleA11yAction}
        style={[
          styles.block,
          {
            width: width - 4,
            height: height - 4,
            backgroundColor: fillColor,
            borderRadius: cellSize * 0.18,
            shadowColor,
            borderColor: board.vehicleBorder,
          },
          vehicle.isTarget && styles.targetBlock,
          animatedStyle,
        ]}
      >
        {isHinted && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderColor: board.hint,
                borderRadius: cellSize * 0.18,
                zIndex: 20,
                shadowColor: board.hintOutline,
                shadowOpacity: 1,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
              },
              hintGlowStyle,
            ]}
          >
            <View 
              style={[
                StyleSheet.absoluteFill, 
                { 
                  borderWidth: 1, 
                  borderColor: board.hintOutline,
                  borderRadius: cellSize * 0.18,
                  margin: -1,
                }
              ]} 
            />
          </Animated.View>
        )}
        <View
          style={[
            styles.shine,
            { borderRadius: cellSize * 0.14, backgroundColor: board.vehicleShine },
          ]}
        />
        {letter !== undefined && (
          <Text style={[styles.letter, { fontSize: cellSize * 0.42, color: board.vehicleLabel, textShadowColor: board.vehicleLabelShadow }]}>{letter}</Text>
        )}
      </Animated.View>


    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  targetBlock: {
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  letter: {
    fontWeight: '900',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shine: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: '45%',
  },
});



// Custom comparison function for Block memoization
function areBlocksEqual(prevProps: BlockProps, nextProps: BlockProps) {
  return (
    prevProps.vehicle.id === nextProps.vehicle.id &&
    prevProps.vehicle.row === nextProps.vehicle.row &&
    prevProps.vehicle.col === nextProps.vehicle.col &&
    prevProps.vehicle.color === nextProps.vehicle.color &&
    prevProps.cellSize === nextProps.cellSize &&
    prevProps.gridSize === nextProps.gridSize &&
    prevProps.isHinted === nextProps.isHinted &&
    prevProps.onMoveEnd === nextProps.onMoveEnd &&
    prevProps.min === nextProps.min &&
    prevProps.max === nextProps.max &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.a11yLabel === nextProps.a11yLabel &&
    prevProps.a11yValue === nextProps.a11yValue &&
    prevProps.a11yStrings === nextProps.a11yStrings &&
    prevProps.letter === nextProps.letter
  );
}

export default React.memo(Block, areBlocksEqual);
