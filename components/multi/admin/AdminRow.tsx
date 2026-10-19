import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import type { IconName } from '@/components/IconText';

interface Props {
  icon: IconName;
  title: string;
  /** A word on what is inside; nothing while unknown */
  subtitle?: string | null;
  /** Things waiting for the admin */
  badge?: number;
  danger?: boolean;
  /** Not the last of its group: a line below */
  divider?: boolean;
  /** Does something at once instead of opening a page: no chevron */
  action?: boolean;
  onPress: () => void;
  colors: UiColors;
}

/** A line of the home of the admin panel: icon, title, a word on it, what waits, a chevron */
export default function AdminRow({ icon, title, subtitle, badge, danger, divider, action, onPress, colors }: Props) {
  const tint = danger ? colors.danger : colors.primaryText;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, badge ? String(badge) : null].filter(Boolean).join(', ')}
    >
      <View style={[styles.icon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={RFValue(18)} color={tint} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: danger ? colors.danger : colors.text }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      {!action && <Ionicons name="chevron-forward" size={RFValue(18)} color={colors.textMuted} />}
    </Pressable>
  );
}

/** Lines of the same kind, under a title */
export function AdminGroup({ title, colors, children }: { title: string; colors: UiColors; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textMuted }]} accessibilityRole="header">{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: RFValue(18),
  },
  groupTitle: {
    fontSize: RFValue(12),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: RFValue(6),
    marginLeft: RFValue(4),
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: RFValue(11),
    paddingHorizontal: RFValue(12),
    minHeight: 52,
  },
  icon: {
    width: RFValue(32),
    height: RFValue(32),
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  subtitle: {
    fontSize: RFValue(12),
    marginTop: 1,
  },
  badge: {
    minWidth: RFValue(22),
    height: RFValue(22),
    borderRadius: RFValue(11),
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: RFValue(12),
    fontWeight: '800',
  },
});
