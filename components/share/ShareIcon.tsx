import React from 'react';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
  size: number;
  color: string;
}

/**
 * The one share icon of the app (level, result, invitation): the one of the system,
 * so that it reads as "share" on each platform.
 */
export default function ShareIcon({ size, color }: Props) {
  return <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={size} color={color} />;
}
