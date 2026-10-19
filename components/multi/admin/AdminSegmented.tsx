import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  colors: UiColors;
}

/** A choice between a few views of the same list (a filter, not an action) */
export default function AdminSegmented<T extends string>({ options, value, onChange, colors }: Props<T>) {
  return (
    <View style={[styles.bar, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && { backgroundColor: colors.surface }]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, { color: selected ? colors.text : colors.textMuted }]} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: RFValue(12),
  },
  option: {
    flex: 1,
    paddingVertical: RFValue(7),
    borderRadius: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
});
