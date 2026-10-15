import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { fixedColors, type UiColors } from '@/theme';

interface Props<T> {
  title: string;
  options: readonly T[];
  isActive: (option: T) => boolean;
  getLabel: (option: T) => string;
  onSelect: (option: T) => void;
  colors: UiColors;
}

/** Row of pills under a small title (grid size, exit side) */
export default function PillSelector<T extends string | number>({ title, options, isActive, getLabel, onSelect, colors }: Props<T>) {
  return (
    <View style={styles.subHeader}>
      <Text style={[styles.subTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={styles.gridSizeSelector}>
        {options.map(option => {
          const active = isActive(option);
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.sizePill, active && { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`${title} ${getLabel(option)}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.sizePillText, { color: active ? colors.onPrimary : colors.textMuted }]}>{getLabel(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridSizeSelector: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: fixedColors.neutralSoft,
    padding: 2,
    borderRadius: 20,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sizePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  sizePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
