import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, useColorScheme, Text } from 'react-native';
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
import * as Haptics from 'expo-haptics';
import { Vehicle } from '@/store/gameStore';

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

function Block({ vehicle, gridSize, cellSize, onMoveEnd, isHinted, min, max, disabled = false }: BlockProps) {

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  const triggerLightHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerMediumHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleMoveEndSync = useCallback(
    (newRow: number, newCol: number) => {
      onMoveEnd(vehicle.id, newRow, newCol);
    },
    [onMoveEnd, vehicle.id]
  );

  const panGesture = useMemo(() => Gesture.Pan()
    .onStart(() => {
      'use worklet';
      isDragging.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.05, SPRING_CONFIG);
      runOnJS(triggerLightHaptic)();
    })
    .onUpdate((event) => {
      'use worklet';
      if (isHorizontal) {
        const raw = startX.value + event.translationX;
        translateX.value = Math.max(boundsMinPx.value, Math.min(boundsMaxPx.value, raw));
      } else {
        const raw = startY.value + event.translationY;
        translateY.value = Math.max(boundsMinPx.value, Math.min(boundsMaxPx.value, raw));
      }
    })
    .onEnd(() => {
      'use worklet';
      isDragging.value = false;
      scale.value = withSpring(1, SPRING_CONFIG);
      
      const currentValue = isHorizontal ? translateX.value : translateY.value;
      const snappedValue = Math.round(currentValue / cellSize);
      // Stay within bounds (already in cell units for comparison)
      const minCell = boundsMinPx.value / cellSize;
      const maxCell = boundsMaxPx.value / cellSize;
      const finalCell = Math.max(minCell, Math.min(maxCell, snappedValue));
      
      if (isHorizontal) {
        translateX.value = withSpring(finalCell * cellSize, finalCell !== snappedValue ? BOUNCE_SPRING : SPRING_CONFIG);
        if (finalCell !== vehicle.col) {
          runOnJS(handleMoveEndSync)(vehicle.row, finalCell);
          runOnJS(triggerLightHaptic)();
        }
      } else {
        translateY.value = withSpring(finalCell * cellSize, finalCell !== snappedValue ? BOUNCE_SPRING : SPRING_CONFIG);
        if (finalCell !== vehicle.row) {
          runOnJS(handleMoveEndSync)(finalCell, vehicle.col);
          runOnJS(triggerLightHaptic)();
        }
      }
    }), [isHorizontal, vehicle.id, vehicle.row, vehicle.col, cellSize, triggerLightHaptic, handleMoveEndSync]);

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

  const shadowColor = vehicle.isTarget ? '#EF4444' : vehicle.color;

  return (
    <GestureDetector gesture={panGesture.enabled(!disabled)}>


      <Animated.View
        style={[
          styles.block,
          {
            width: width - 4,
            height: height - 4,
            backgroundColor: vehicle.color,
            borderRadius: cellSize * 0.18,
            shadowColor,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
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
                borderColor: '#F59E0B',
                borderRadius: cellSize * 0.18,
                zIndex: 20,
                shadowColor: '#000',
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
                  borderColor: '#000', 
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
            { borderRadius: cellSize * 0.14 },
          ]}
        />
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
  shine: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.18)',
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
    prevProps.disabled === nextProps.disabled
  );
}

export default React.memo(Block, areBlocksEqual);
