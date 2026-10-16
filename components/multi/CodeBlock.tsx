import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { haptics, Haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props {
  code: string;
  colors: UiColors;
  /** What is copied, read by the screen reader */
  label: string;
}

/** A command or a file to copy on the server */
export default function CodeBlock({ code, colors, label }: Props) {
  const { t } = useTranslation();
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  return (
    <View style={[styles.block, { backgroundColor: colors.neutralSoft, borderColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={[styles.code, { color: colors.text }]} selectable>{code.trimEnd()}</Text>
      </ScrollView>
      <Pressable onPress={copy} style={[styles.copy, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={t('multi.setup_copy_a11y', { what: label })}>
        <Text style={[styles.copyText, { color: colors.onPrimary }]}>{t('multi.copy')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
    borderRadius: 12,
    padding: RFValue(10),
    marginTop: RFValue(8),
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: RFValue(11),
    lineHeight: RFValue(16),
  },
  copy: {
    alignSelf: 'flex-end',
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(12),
    borderRadius: 10,
    marginTop: RFValue(8),
  },
  copyText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
});
