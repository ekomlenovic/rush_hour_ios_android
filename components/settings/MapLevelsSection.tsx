import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { DIFFICULTY_LEVELS } from '@/utils/generator';
import { haptics, Haptics } from '@/utils/haptics';
import { useLevelGenerator, GENERATION_TIME_MAP, DifficultyKey } from '@/hooks/useLevelGenerator';
import { fixedColors, type UiColors } from '@/theme';
import IconText from '../IconText';
import { settingsStyles as styles } from './styles';

const REQUEST_LEVELS_URL = 'https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?title=Request:%20New%20Complex%20Levels&body=I%20would%20like%20to%20see%20more%20high-difficulty%20levels%21';

interface Props {
  colors: UiColors;
  /** The generation runs in the background: the sheet closes so the map can be browsed */
  onClose: () => void;
}

/** World map only: level generator, community levels and unlocking every level */
export default function MapLevelsSection({ colors, onClose }: Props) {
  const { t } = useTranslation();
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const isGenerating = useGameStore(s => s.generationState.isRunning);
  const purgeCustomLevels = useGameStore(s => s.purgeCustomLevels);
  const unlockAllLevels = useGameStore(s => s.unlockAllLevels);
  const startGeneration = useLevelGenerator();

  const [genAmount, setGenAmount] = useState<number>(3);
  const [genDifficulty, setGenDifficulty] = useState<DifficultyKey>('NORMAL');
  const [genGridSize, setGenGridSize] = useState<number>(6);

  const handleGenerate = () => {
    startGeneration({ amount: genAmount, difficulty: genDifficulty, gridSize: genGridSize });
    onClose();
  };

  // Deletes the generated levels with their stars: never at a single touch
  const handleResetLevels = () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('map.reset_custom'),
      t('map.reset_custom_confirm', { count: generatedLevels.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => purgeCustomLevels(sampleLevels.length) },
      ],
    );
  };

  const handleUnlockAll = () => {
    Alert.alert(
      t('home.unlock_all'),
      t('home.unlock_all_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: () => {
            unlockAllLevels();
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(t('common.success'), t('home.unlock_all_success'));
          },
        },
      ]
    );
  };

  const segment = <T,>(value: T, selected: T, label: string, onPress: () => void) => (
    <Pressable
      key={String(value)}
      onPress={onPress}
      style={[styles.segmentBtn, value === selected && { backgroundColor: colors.primary }]}
      accessibilityRole="button"
      accessibilityState={{ selected: value === selected }}
    >
      <Text style={[styles.segmentText, { color: value === selected ? colors.onPrimary : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.primaryText }]} accessibilityRole="header">{t('map.level_generator')}</Text>
      <IconText icon="warning" color={colors.warning} style={{ marginBottom: 16 }} textStyle={[styles.settingSub, { fontWeight: '600' }]}>
        {t('map.generator_warning')}
      </IconText>

      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('creator.difficulty')}: {t(`difficulty.${genDifficulty}`)}</Text>
        <View style={styles.segmentGroup}>
          {(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const).map(diff =>
            segment(diff, genDifficulty, t(`difficulty.${diff}`), () => {
              setGenDifficulty(diff);
              setGenGridSize(DIFFICULTY_LEVELS[diff].gridSize);
            })
          )}
        </View>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.grid_size', { size: genGridSize })}</Text>
        <View style={styles.segmentGroup}>
          {[6, 7, 8].map(size => segment(size, genGridSize, `${size}x${size}`, () => setGenGridSize(size)))}
        </View>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.amount_to_create', { amount: genAmount })}</Text>
        <View style={styles.segmentGroup}>
          {[1, 5, 10, 20].map(amt => segment(amt, genAmount, String(amt), () => setGenAmount(amt)))}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Pressable
          style={[styles.mainBtn, { backgroundColor: colors.primary, opacity: isGenerating ? 0.5 : 1 }]}
          onPress={handleGenerate}
          disabled={isGenerating}
          accessibilityRole="button"
          accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
        >
          {isGenerating ? (
            <IconText icon="hourglass" color={fixedColors.onPrimary} textStyle={styles.mainBtnText}>{t('map.generating')}</IconText>
          ) : (
            <Text style={styles.mainBtnText}>
              {t('map.generate_btn', { amount: genAmount, time: Math.ceil((genAmount * (GENERATION_TIME_MAP[genDifficulty] || 2000)) / 1000) })}
            </Text>
          )}
        </Pressable>

        {!isGenerating && generatedLevels.length > 0 && (
          <Pressable style={[styles.outlineBtn, { borderColor: colors.danger }]} onPress={handleResetLevels} accessibilityRole="button">
            <Text style={[styles.outlineBtnText, { color: colors.danger }]}>{t('map.reset_custom')}</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />

      <Text style={[styles.sectionTitle, { color: colors.primaryText }]} accessibilityRole="header">{t('map.community_levels')}</Text>
      <Pressable
        style={[styles.mainBtn, { backgroundColor: colors.github, marginBottom: 12 }]}
        onPress={() => Linking.openURL(REQUEST_LEVELS_URL)}
        accessibilityRole="link"
      >
        <Text style={styles.mainBtnText}>{t('map.request_github')}</Text>
      </Pressable>
      <Pressable
        style={[styles.outlineBtn, { borderColor: colors.primary }]}
        onPress={handleUnlockAll}
        accessibilityRole="button"
        accessibilityLabel={t('home.unlock_all')}
      >
        <IconText icon="lock-open" color={colors.primaryText} textStyle={styles.outlineBtnText}>{t('home.unlock_all')}</IconText>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />
    </View>
  );
}
