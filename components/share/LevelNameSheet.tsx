import React, { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { LEVEL_NAME_MAX_LENGTH } from '@/utils/sharing';
import type { UiColors } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  /** Name shown when the sheet opens (current name, or the one in the link) */
  initialName?: string;
  confirmLabel: string;
  colors: UiColors;
  isDark: boolean;
  /** Called with the typed name; empty means no name (the level is then "Level 3") */
  onConfirm: (name: string) => void;
  onClose: () => void;
}

/** Optional name of a custom level: when saving it in the creator, importing it, renaming it */
export default function LevelNameSheet({ visible, title, initialName, confirmLabel, colors, isDark, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName ?? '');

  useEffect(() => {
    if (visible) setName(initialName ?? '');
  }, [visible, initialName]);

  return (
    <BottomSheet visible={visible} title={title} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('custom_levels.name_label')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('custom_levels.name_placeholder')}
        placeholderTextColor={colors.textMuted}
        maxLength={LEVEL_NAME_MAX_LENGTH}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => onConfirm(name)}
        accessibilityLabel={t('custom_levels.name_label')}
        style={[styles.input, { color: colors.text, backgroundColor: colors.neutralSoft, borderColor: colors.border }]}
      />
      <Pressable
        onPress={() => onConfirm(name)}
        style={[styles.button, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{confirmLabel}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
