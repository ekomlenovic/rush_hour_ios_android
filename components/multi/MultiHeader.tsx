import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props {
  title: string;
  colors: UiColors;
  /** Shown on the right, e.g. the account button */
  right?: React.ReactNode;
}

/** Header of the multiplayer screens: back (home when opened from a link), title, an optional action */
export default function MultiHeader({ title, colors, right }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + RFValue(8) }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.side} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={8}>
        <Text style={[styles.back, { color: colors.primaryText }]}>←</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: RFValue(12),
    paddingHorizontal: RFValue(16),
    borderBottomWidth: 1,
  },
  side: {
    // Room for two actions on the right (multiplayer: invite, account)
    width: RFValue(68),
    minHeight: 44,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  back: {
    fontSize: RFValue(24),
    fontWeight: '700',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: RFValue(20),
    fontWeight: '800',
  },
});
