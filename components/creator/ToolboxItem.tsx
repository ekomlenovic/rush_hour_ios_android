import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, SharedValue } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useTheme, type UiColors } from '@/theme';
import { DIR_LABEL, MINI_CELL, VehicleTemplate } from './constants';
import { SNAP } from './snap';

type ToolboxItemProps = {
  template: VehicleTemplate;
  colors: UiColors;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  dragVisible: SharedValue<number>;
  onDragStart: (template: VehicleTemplate, sx: number, sy: number) => void;
  onDragMove: (sx: number, sy: number) => void;
  onDrop: (sx: number, sy: number) => void;
  /** Screen readers cannot drag: this action puts the vehicle on the first free cell */
  onA11yAdd: () => void;
};

/** A vehicle of the toolbox, dragged onto the board to add it */
const ToolboxItem = React.memo(function ToolboxItem({ template, colors, dragX, dragY, dragVisible, onDragStart, onDragMove, onDrop, onA11yAdd }: ToolboxItemProps) {
  const { board } = useTheme();
  const { t } = useTranslation();
  const sc = useSharedValue(1);

  const gesture = Gesture.Pan()
    .onStart((e) => {
      'use worklet';
      sc.value = SNAP(0.95);
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      dragVisible.value = 1;
      runOnJS(onDragStart)(template, e.absoluteX, e.absoluteY);
    })
    .onUpdate(e => {
      'use worklet';
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd(e => {
      'use worklet';
      sc.value = SNAP(1);
      dragVisible.value = 0;
      runOnJS(onDrop)(e.absoluteX, e.absoluteY);
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sc.value }]
  }));

  const isH = template.orientation === 'horizontal';
  const pw = (isH ? template.length : 1) * MINI_CELL;
  const ph = (!isH ? template.length : 1) * MINI_CELL;
  const dir = DIR_LABEL[template.orientation];
  const size = `${template.length}×1`;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t(`creator.${template.label.toLowerCase()}`)}, ${t(isH ? 'a11y.horizontal' : 'a11y.vertical')}, ${size}`}
        accessibilityHint={t('a11y.tool_hint')}
        accessibilityActions={[{ name: 'activate', label: t('a11y.add_to_board') }]}
        onAccessibilityAction={onA11yAdd}
        style={[styles.toolCard, animStyle, {
        backgroundColor: colors.card,
        borderColor: colors.border,
      }]}>
        <View style={[styles.toolPreviewWrap, { width: pw + 8, height: Math.max(ph + 8, MINI_CELL + 8) }]}>
          <View style={[styles.toolPreview, { width: pw, height: ph, backgroundColor: template.color }]}>
            <View style={[styles.toolPreviewShine, { backgroundColor: board.vehicleShineStrong }]} />
          </View>
        </View>

        <View style={styles.toolLabels}>
          <Text style={[styles.toolName, { color: colors.text }]}>{t(`creator.${template.label.toLowerCase()}`)}</Text>
          <View style={[styles.toolBadge, { backgroundColor: template.color + '28', borderColor: template.color + '55' }]}>
            <Text style={[styles.toolBadgeText, { color: template.color }]}>{dir} {size}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

export default ToolboxItem;

const styles = StyleSheet.create({
  toolCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexBasis: '48%' },
  toolPreviewWrap: { justifyContent: 'center', alignItems: 'center', width: 52, height: 38 },
  toolPreview: { borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-start' },
  toolPreviewShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' },
  toolLabels: { alignItems: 'flex-start', gap: 3 },
  toolName: { fontSize: 12, fontWeight: '700' },
  toolBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  toolBadgeText: { fontSize: 10, fontWeight: '700' },
});
