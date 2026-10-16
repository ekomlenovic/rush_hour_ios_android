import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { UiColors } from '@/theme';

export interface HomeTab {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Counter on the icon (new cosmetics) */
  badge?: number;
  accessibilityLabel?: string;
  onPress: () => void;
}

interface Props {
  colors: UiColors;
  tabs: HomeTab[];
  bottomInset: number;
}

/** Bar at the bottom of the home screen: the secondary places, same width each whatever the language */
export default function HomeTabBar({ colors, tabs, bottomInset }: Props) {
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(10, bottomInset) },
      ]}
    >
      {tabs.map(tab => (
        <Pressable
          key={tab.key}
          onPress={tab.onPress}
          style={styles.tab}
          accessibilityRole="button"
          accessibilityLabel={tab.accessibilityLabel ?? tab.label}
        >
          <View>
            <Ionicons name={tab.icon} size={22} color={colors.primaryText} />
            {tab.badge ? (
              <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{tab.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.label, { color: colors.textMuted }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
