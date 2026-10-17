import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { IoniconName } from '@/utils/icons';

/** Size of each icon, by number of icons: they still fit in the badge */
const SCALE = { 1: 1, 2: 0.72, 3: 0.6 };

interface Props {
  icon: IoniconName;
  /** The icon repeated, for the steps of one series (1, 2 then 3 flames) */
  count?: 1 | 2 | 3;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/** Icon of an achievement */
export default function AchievementIcon({ icon, count = 1, size, color, style }: Props) {
  const each = size * SCALE[count];
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: count }, (_, i) => (
        <Ionicons key={i} name={icon} size={each} color={color} style={i > 0 && { marginLeft: -each * 0.3 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
