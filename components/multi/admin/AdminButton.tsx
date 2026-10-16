import React from 'react';
import { Pressable, Text } from 'react-native';
import { adminStyles } from './styles';

interface Props {
  label: string;
  onPress: () => void;
  background: string;
  color: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export default function AdminButton({ label, onPress, background, color, disabled, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[adminStyles.button, { backgroundColor: background, opacity: disabled ? 0.5 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[adminStyles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}
