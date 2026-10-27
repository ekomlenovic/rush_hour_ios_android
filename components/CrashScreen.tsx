import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, useColorScheme } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { ErrorBoundaryProps } from 'expo-router';
import { exportProgress } from '@/utils/saveTransfer';
import { shareSaveFile } from '@/utils/shareSave';
import { getUiColors, resolveScheme } from '@/theme/ui';

/** What the player can copy to report the crash: nothing is sent anywhere (no crash reporting, Privacy_Policy.md) */
export function crashDetails(error: Error): string {
  return [`${error.name}: ${error.message}`, error.stack ?? ''].join('\n').trim();
}

/**
 * The "oops" screen shown instead of a blank screen when a render throws (ErrorBoundary of app/_layout.tsx).
 * It does not read the theme from the store, which may be what broke: it follows the system scheme.
 * The player can try again, export the save (file, or code if the device cannot share files) and copy the error.
 */
export default function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const colors = getUiColors(resolveScheme('system', useColorScheme()));

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert(t('save.copied_title'), t('save.copied_body'));
  };

  const handleExport = async () => {
    let code: string;
    try {
      code = exportProgress();
    } catch {
      Alert.alert(t('crash.export_failed_title'), t('crash.export_failed_body'));
      return;
    }
    if (!(await shareSaveFile(code, t('save.share_title')))) await copyCode(code);
  };

  const handleCopyError = async () => {
    await Clipboard.setStringAsync(crashDetails(error));
    Alert.alert(t('crash.error_copied_title'), t('crash.error_copied_body'));
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Ionicons name="car-sport-outline" size={64} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('crash.title')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('crash.body')}</Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={retry} accessibilityRole="button">
          <Text style={[styles.mainBtnText, { color: colors.onPrimary }]}>{t('crash.retry_btn')}</Text>
        </Pressable>
        <Pressable style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={handleExport} accessibilityRole="button">
          <Text style={[styles.outlineBtnText, { color: colors.primaryText }]}>{t('crash.export_btn')}</Text>
        </Pressable>
        <Pressable onPress={handleCopyError} accessibilityRole="button" hitSlop={8} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('crash.copy_error_btn')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 16,
  },
  mainBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  mainBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  outlineBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkBtn: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
