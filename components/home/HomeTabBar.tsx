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
  /** Tabs of a screen (multiplayer): the current one stands out; none on the home screen, where tabs open places */
  activeKey?: string;
}

/** Bar at the bottom of the home screen: the secondary places, same width each whatever the language */
export default function HomeTabBar({ colors, tabs, bottomInset, activeKey }: Props) {
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(10, bottomInset) },
      ]}
    >
      {tabs.map(tab => {
        const active = tab.key === activeKey;
        const dimmed = activeKey !== undefined && !active;
        return (
        <Pressable
          key={tab.key}
          onPress={tab.onPress}
          style={styles.tab}
          accessibilityRole={activeKey !== undefined ? 'tab' : 'button'}
          accessibilityState={activeKey !== undefined ? { selected: active } : undefined}
          accessibilityLabel={tab.accessibilityLabel ?? tab.label}
        >
          <View style={active ? [styles.activePill, { backgroundColor: colors.primarySoft }] : null}>
            <Ionicons name={tab.icon} size={22} color={dimmed ? colors.textMuted : colors.primaryText} />
            {tab.badge ? (
              <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{tab.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.label, { color: active ? colors.primaryText : colors.textMuted }, active && styles.activeLabel]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {tab.label}
          </Text>
        </Pressable>
        );
      })}
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
  activeLabel: {
    fontWeight: '800',
  },
  activePill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
});
