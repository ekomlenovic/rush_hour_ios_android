import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { dismissInstallHint, installMode, promptInstall, subscribeInstall } from '@/utils/webInstall';
import type { UiColors } from '@/theme';

/**
 * Home screen of the web version, while it is not installed: how to put it on the home screen
 * (Safari's Share menu on iOS, the browser's prompt elsewhere). On iOS it also says why: Safari
 * erases the progress of a site left 7 days without a visit. Closed for good by its cross.
 * Nothing on iOS and Android apps.
 */
export default function InstallHint({ colors }: { colors: UiColors }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(installMode);
  useEffect(() => subscribeInstall(() => setMode(installMode())), []);
  if (!mode) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={mode === 'ios' ? 'share-outline' : 'download-outline'} size={22} color={colors.primaryText} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]}>{t('web.install_title')}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t(mode === 'ios' ? 'web.install_ios' : 'web.install_prompt')}</Text>
        {mode === 'prompt' && (
          <Pressable onPress={promptInstall} accessibilityRole="button" style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('web.install_button')}</Text>
          </Pressable>
        )}
      </View>
      <Pressable onPress={dismissInstallHint} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={10}>
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
