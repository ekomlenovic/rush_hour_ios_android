import React from 'react';
import { View, Text, Pressable, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { exportProgress, parseSave } from '@/utils/saveTransfer';
import { haptics, Haptics } from '@/utils/haptics';
import type { UiColors } from '@/theme';
import { settingsStyles as styles } from './styles';

interface Props {
  colors: UiColors;
  onClose: () => void;
}

/** Export the progress as a code (share sheet) and import one from the clipboard: see docs/GAME_DESIGN.md (Sauvegarde) */
export default function SaveSection({ colors, onClose }: Props) {
  const { t } = useTranslation();
  const importProgress = useGameStore(s => s.importProgress);

  const handleExport = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const code = exportProgress();
    try {
      await Share.share({ message: code, title: t('save.share_title') });
    } catch {
      // The share sheet could not open: the code is still copied
      await Clipboard.setStringAsync(code);
      Alert.alert(t('save.copied_title'), t('save.copied_body'));
    }
  };

  const handleImport = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const code = await Clipboard.getStringAsync();
    if (!code.trim()) {
      Alert.alert(t('save.error_title'), t('save.error_empty'));
      return;
    }

    const result = parseSave(code);
    if (!result.ok) {
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('save.error_title'), t(`save.error_${result.error}`));
      return;
    }

    const { summary } = result;
    Alert.alert(
      t('save.confirm_title'),
      t('save.confirm_body', {
        date: summary.exportedAt,
        level: summary.playerLevel,
        levels: summary.completedLevels,
        stars: summary.totalStars,
        streak: summary.currentStreak,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('save.confirm_btn'),
          style: 'destructive',
          onPress: () => {
            importProgress(result.state);
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
            Alert.alert(t('save.success_title'), t('save.success_body'));
          },
        },
      ]
    );
  };

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.primaryText }]} accessibilityRole="header">{t('save.title')}</Text>
      <Text style={[styles.settingSub, { color: colors.textMuted, marginBottom: 16 }]}>{t('save.desc')}</Text>
      <View style={{ gap: 12 }}>
        <Pressable style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={handleExport} accessibilityRole="button">
          <Text style={styles.mainBtnText}>{t('save.export_btn')}</Text>
        </Pressable>
        <Pressable
          style={[styles.outlineBtn, { borderColor: colors.primary }]}
          onPress={handleImport}
          accessibilityRole="button"
          accessibilityHint={t('save.import_hint')}
        >
          <Text style={[styles.outlineBtnText, { color: colors.primaryText }]}>{t('save.import_btn')}</Text>
        </Pressable>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />
    </View>
  );
}
