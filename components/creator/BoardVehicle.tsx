import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Vehicle } from '@/store/gameStore';
import { SNAP } from './snap';
import { vehicleStyles as styles } from './vehicleStyles';
import { useTheme, PALETTE_ART } from '@/theme';
import DrawnVehicle from '@/components/vehicles/DrawnVehicle';

type BoardVehicleProps = {
  vehicle: Vehicle;
  /** Displayed color (vehicle palette), the vehicle's color if undefined */
  color?: string;
  cellSize: number;
  isGhost: boolean;
  onDragStart: () => void;
  onDragMove: (tx: number, ty: number) => void;
  onDragEnd: (tx: number, ty: number) => void;
  onRemove: () => void;
  onPress: () => void;
  /** Screen reader: vehicle, position, and the labels of its actions */
  a11yLabel: string;
  a11yValue: string;
  a11yStrings: { hint: string; pivot: string; remove: string };
};

/** A vehicle on the creator board: drag to move, tap to pivot, long press to remove */
const BoardVehicle = React.memo(function BoardVehicle({ vehicle: v, color, cellSize, isGhost, onDragStart, onDragMove, onDragEnd, onRemove, onPress, a11yLabel, a11yValue, a11yStrings }: BoardVehicleProps) {
  const { board, palette } = useTheme();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = SNAP(isGhost ? 0.12 : 1);
  }, [isGhost]);

  const tap = Gesture.Tap()
    .onStart(() => {
      scheduleOnRN(onPress);
    });

  const pan = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      'use worklet';
      sc.value = SNAP(1.05);
      scheduleOnRN(onDragStart);
    })
    .onUpdate(e => {
      'use worklet';
      tx.value = e.translationX;
      ty.value = e.translationY;
      scheduleOnRN(onDragMove, e.translationX, e.translationY);
    })
    .onEnd(e => {
      'use worklet';
      sc.value = SNAP(1);
      tx.value = SNAP(0);
      ty.value = SNAP(0);
      scheduleOnRN(onDragEnd, e.translationX, e.translationY);
    });

  const longPress = Gesture.LongPress()
    .minDuration(600)
    .onStart(() => scheduleOnRN(onRemove));

  const gesture = Gesture.Exclusive(pan, tap, longPress);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
    ],
    opacity: opacity.value,
    zIndex: sc.value > 1 ? 80 : 2,
    elevation: sc.value > 1 ? 10 : 4,
  }));

  const radius = cellSize * board.vehicleRadius;
  const w = (v.orientation === 'horizontal' ? v.length : 1) * cellSize - 4;
  const h = (v.orientation === 'vertical' ? v.length : 1) * cellSize - 4;
  const fill = v.isTarget ? board.targetCar : color ?? v.color;
  // Drawn skin or palette (as on the game board): the drawing replaces the block, its shine and grip
  const art = v.isTarget ? board.targetArt : PALETTE_ART[palette];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityValue={{ text: a11yValue }}
        accessibilityHint={a11yStrings.hint}
        accessibilityActions={[
          { name: 'activate', label: a11yStrings.pivot },
          ...(v.isTarget ? [] : [{ name: 'remove', label: a11yStrings.remove }, { name: 'longpress', label: a11yStrings.remove }]),
        ]}
        onAccessibilityAction={e => (e.nativeEvent.actionName === 'activate' ? onPress() : onRemove())}
        style={[
        styles.vehicleBlock, animStyle,
        {
          top: v.row * cellSize + 2, left: v.col * cellSize + 2, width: w, height: h, borderRadius: radius,
          backgroundColor: fill, borderColor: board.vehicleBorder,
        },
        art && styles.drawnBlock,
      ]}>
        {art ? (
          <DrawnVehicle art={art} length={v.length} orientation={v.orientation} color={fill} width={w} height={h} />
        ) : (<>
        <View style={[styles.vehicleShine, { borderRadius: radius, backgroundColor: board.vehicleShine }, v.orientation === 'vertical' && styles.vehicleShineV]} />
        {v.isTarget
          ? (board.targetIcon ? <Text style={{ fontSize: cellSize * 0.5 }}>{board.targetIcon}</Text> : null)
          : <View style={[styles.vehicleGrip, v.orientation === 'vertical' && { flexDirection: 'column' }]}>
            <View style={[styles.gripDot, { backgroundColor: board.vehicleGrip }]} /><View style={[styles.gripDot, { backgroundColor: board.vehicleGrip }]} />
          </View>
        }
        </>)}
      </Animated.View>
    </GestureDetector>
  );
});

export default BoardVehicle;
