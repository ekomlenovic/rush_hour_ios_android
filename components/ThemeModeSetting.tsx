import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import type { ThemeMode } from '@/store/types';
import { haptics, Haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import { fixedColors, type UiColors } from '@/theme';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

interface Props {
  colors: UiColors;
  labelStyle: StyleProp<TextStyle>;
}

/** Appearance setting of the option sheets: Automatic (system) / Light / Dark */
export default function ThemeModeSetting({ colors, labelStyle }: Props) {
  const { t } = useTranslation();
  const themeMode = useGameStore(s => s.themeMode);
  const setThemeMode = useGameStore(s => s.setThemeMode);

  return (
    <View style={styles.container}>
      <Text style={[labelStyle, { color: colors.text }]}>{t('common.theme')}</Text>
      <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={t('common.theme')}>
        {MODES.map(mode => {
          const selected = themeMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => {
                setThemeMode(mode);
                haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[styles.segment, selected && { backgroundColor: colors.primary }]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, { color: selected ? colors.onPrimary : colors.text }]}>
                {t(`common.theme_${mode}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  segments: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: fixedColors.neutralSoft,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
});
