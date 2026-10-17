import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  color: string;
  /** Size of the icon; the size of the text by default */
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: React.ReactNode;
}

/** A line of text after its icon: the icons of the app, not emojis */
export default function IconText({ icon, color, size, style, textStyle, numberOfLines, children }: Props) {
  const fontSize = StyleSheet.flatten(textStyle)?.fontSize;
  return (
    <View style={[styles.row, style]}>
      <Ionicons name={icon} size={size ?? fontSize ?? 16} color={color} />
      <Text style={[styles.text, textStyle, { color }]} numberOfLines={numberOfLines}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    flexShrink: 1,
  },
});
