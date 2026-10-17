import React from 'react';
import { Pressable, Text } from 'react-native';
import IconText, { type IconName } from '@/components/IconText';
import { adminStyles } from './styles';

interface Props {
  label: string;
  onPress: () => void;
  background: string;
  color: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: IconName;
}

export default function AdminButton({ label, onPress, background, color, disabled, accessibilityLabel, icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[adminStyles.button, { backgroundColor: background, opacity: disabled ? 0.5 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon ? <IconText icon={icon} color={color} textStyle={adminStyles.buttonText}>{label}</IconText>
        : <Text style={[adminStyles.buttonText, { color }]}>{label}</Text>}
    </Pressable>
  );
}
