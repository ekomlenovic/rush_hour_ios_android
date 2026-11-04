import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { canTransferSave, exportProgress, parseSave } from '@/utils/saveTransfer';
import { readPickedFile, shareSaveFile } from '@/utils/shareSave';
import { streakLines } from '@/hooks/useAppOpenAlert';
import { haptics, Haptics } from '@/utils/haptics';
import type { UiColors } from '@/theme';
import { settingsStyles as styles } from './styles';

interface Props {
  colors: UiColors;
  onClose: () => void;
}

/**
 * Export the progress as a .rushsave file (share sheet) or a code, import it from a file or the clipboard:
 * see docs/GAME_DESIGN.md (Sauvegarde). The file only holds the code, both go through the same checks.
 */
export default function SaveSection({ colors, onClose }: Props) {
  const { t } = useTranslation();
  const importProgress = useGameStore(s => s.importProgress);

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert(t('save.copied_title'), t('save.copied_body'));
  };

  /** Nothing to export nor to replace while the game's save is not loaded: it says so instead (issue 174) */
  const saveReady = () => {
    if (canTransferSave()) return true;
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(t('save.not_loaded_title'), t('save.not_loaded_body'));
    return false;
  };

  const handleExportFile = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!saveReady()) return;
    const code = exportProgress();
    // No file sharing on this device: the code still works
    if (!(await shareSaveFile(code, t('save.share_title')))) await copyCode(code);
  };

  const handleCopyCode = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!saveReady()) return;
    await copyCode(exportProgress());
  };

  /** Checks a save code, then replaces the progress once the player confirms */
  const confirmImport = (code: string, emptyMessage = t('save.error_empty')) => {
    if (!code.trim()) {
      Alert.alert(t('save.error_title'), emptyMessage);
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
            if (!saveReady()) return;
            const info = importProgress(result.state);
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
            // The days missed since the export are applied: said, or the streak announced above seems lost by the import
            const lines = streakLines(info, t, useGameStore.getState().currentStreak);
            Alert.alert(t('save.success_title'), [t('save.success_body'), ...lines].join('\n\n'));
          },
        },
      ]
    );
  };

  const handleImportFile = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!saveReady()) return;
    // A .rushsave file has no known type: any file can be picked, the checks refuse the others
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    let code: string;
    try {
      code = await readPickedFile(picked.assets[0]);
    } catch {
      Alert.alert(t('save.error_title'), t('save.error_read'));
      return;
    }
    confirmImport(code, t('save.error_invalid'));
  };

  const handlePasteCode = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!saveReady()) return;
    confirmImport(await Clipboard.getStringAsync());
  };

  const linkButton = (label: string, onPress: () => void, hint?: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={hint} hitSlop={8} style={{ paddingVertical: 4 }}>
      <Text style={[styles.settingSub, { color: colors.primaryText, fontWeight: '700', textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.primaryText }]} accessibilityRole="header">{t('save.title')}</Text>
      <Text style={[styles.settingSub, { color: colors.textMuted, marginBottom: 16 }]}>{t('save.desc')}</Text>
      <View style={{ gap: 12 }}>
        <Pressable style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={handleExportFile} accessibilityRole="button">
          <Text style={styles.mainBtnText}>{t('save.export_btn')}</Text>
        </Pressable>
        <Pressable style={[styles.outlineBtn, { borderColor: colors.primary }]} onPress={handleImportFile} accessibilityRole="button">
          <Text style={[styles.outlineBtnText, { color: colors.primaryText }]}>{t('save.import_btn')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 }}>
          {linkButton(t('save.copy_code_btn'), handleCopyCode)}
          {linkButton(t('save.paste_code_btn'), handlePasteCode, t('save.import_hint'))}
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />
    </View>
  );
}
