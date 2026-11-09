import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { RFValue } from '@/utils/responsive';
import { fixedColors, type UiColors } from '@/theme';

/** A choice of the map sheets (search, generator): filled when it is selected */
export default function Chip({ label, selected, onPress, colors, accessibilityLabel }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: UiColors;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={4}
    >
      <Text style={[styles.text, { color: selected ? colors.onPrimary : colors.text }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: fixedColors.neutralSoft,
  },
  text: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
});
