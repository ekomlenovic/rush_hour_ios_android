import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { haptics, Haptics } from '@/utils/haptics';
import { useLevelGenerator, formatGenerationTime, estimateGenerationSeconds } from '@/hooks/useLevelGenerator';
import { useGenerationTimes } from '@/store/generationTimes';
import { needsConfirmation } from '@/utils/generationEstimate';
import {
  batchConfig, buildGenerationPlan, clampAmount, clampMinMoves, planTotal,
  DEFAULT_DIFFICULTY_PARTS, DEFAULT_GRID_SIZE_PARTS, GENERATION_DIFFICULTIES, GENERATION_GRID_SIZES,
  MAX_GENERATION_AMOUNT, MAX_MIN_MOVES, MAX_PARTS,
} from '@/utils/generationPlan';
import { RFValue } from '@/utils/responsive';
import { fixedColors, type UiColors } from '@/theme';
import BottomSheet from '../home/BottomSheet';
import IconText from '../IconText';
import { settingsStyles } from '../settings/styles';
import Chip from './Chip';

/** Numbers of levels offered at a touch; any other number is typed */
const QUICK_AMOUNTS = [3, 10, 20, 50];
const DEFAULT_AMOUNT = 3;

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  /** Also called when a generation starts: it runs in the background, the map can be browsed */
  onClose: () => void;
}

/**
 * Level generator of the world map: how many levels (typed or picked), and in which proportions
 * of difficulties and grid sizes. Also deletes the generated levels.
 */
export default function GeneratorSheet({ visible, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const isGenerating = useGameStore(s => s.generationState.isRunning);
  const purgeCustomLevels = useGameStore(s => s.purgeCustomLevels);
  const startGeneration = useLevelGenerator();
  // Times measured on this phone: the estimate follows them (re-rendered after each level made)
  const samples = useGenerationTimes(s => s.samples);

  // What is typed, kept as typed (an empty field while the player rewrites the number)
  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT));
  const [difficultyParts, setDifficultyParts] = useState(DEFAULT_DIFFICULTY_PARTS);
  const [sizeParts, setSizeParts] = useState(DEFAULT_GRID_SIZE_PARTS);

  // Empty: the minimum of each difficulty
  const [minMovesText, setMinMovesText] = useState('');
  const minMoves = clampMinMoves(parseInt(minMovesText, 10));

  const amount = clampAmount(parseInt(amountText, 10));
  const setAmount = (value: number) => setAmountText(String(clampAmount(value)));

  const plan = useMemo(() => buildGenerationPlan(amount, difficultyParts, sizeParts, minMoves), [amount, difficultyParts, sizeParts, minMoves]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the estimate reads the measures
  const estimatedSeconds = useMemo(() => estimateGenerationSeconds(plan), [plan, samples]);
  const total = planTotal(plan);

  const handleGenerate = () => {
    const start = () => {
      startGeneration(plan);
      onClose();
    };
    // A level that blocks the app a minute or more (Expert, Master, big grids): never started without saying so
    const slow = plan.filter(b => needsConfirmation(batchConfig(b).difficulty, b.gridSize, samples));
    if (slow.length === 0) return start();
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t('map.long_generation_title'),
      t('map.long_generation_body', {
        time: formatGenerationTime(estimatedSeconds),
        // A minimum of moves that makes a batch as long as a harder difficulty is said with it
        slow: slow.map(b => `${t(`difficulty.${b.difficulty}`)} ${b.gridSize}x${b.gridSize}${batchConfig(b).raised ? ` (${t('map.min_moves_short', { count: b.minMoves })})` : ''}`).join(', '),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('map.long_generation_confirm'), style: 'destructive', onPress: start },
      ],
    );
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

  const roundButton = (icon: 'remove' | 'add', onPress: () => void, disabled: boolean, label: string, size = 36) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.35 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
    >
      <Ionicons name={icon} size={size / 2} color={colors.text} />
    </Pressable>
  );

  /** One difficulty or grid size: its share of the levels, and its parts changed a step at a time */
  function partsRow<K extends string | number>(key: K, name: string, parts: Record<K, number>, setParts: (next: Record<K, number>) => void, count: number) {
    const value = parts[key];
    const totalParts = Object.values<number>(parts).reduce((a, b) => a + b, 0);
    const percent = totalParts > 0 ? Math.round((value / totalParts) * 100) : 0;
    const change = (delta: number) => {
      haptics.selectionAsync();
      setParts({ ...parts, [key]: value + delta });
    };
    return (
      <View key={String(key)} style={styles.partsRow}>
        <Text style={[styles.partsName, { color: value > 0 ? colors.text : colors.textMuted }]} numberOfLines={1}>{name}</Text>
        <Text
          style={[styles.share, { color: value > 0 ? colors.primaryText : colors.textMuted }]}
          accessibilityLabel={t('a11y.generation_share', { name, percent, count })}
        >
          {value > 0 ? `${percent} % · ${count}` : '–'}
        </Text>
        {/* The last part of a proportion stays: a generation needs a difficulty and a grid size */}
        {roundButton('remove', () => change(-1), value === 0 || totalParts === 1, t('a11y.decrease', { name }))}
        <Text style={[styles.partsValue, { color: colors.text }]} importantForAccessibility="no" accessibilityElementsHidden>{value}</Text>
        {roundButton('add', () => change(1), value >= MAX_PARTS, t('a11y.increase', { name }))}
      </View>
    );
  }

  const countOf = (match: (b: typeof plan[number]) => boolean) => plan.filter(match).reduce((sum, b) => sum + b.count, 0);

  return (
    <BottomSheet visible={visible} title={t('map.level_generator')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.62, flexGrow: 0 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('map.amount_label')}</Text>
        <View style={styles.amountRow}>
          {roundButton('remove', () => setAmount(amount - 1), amount <= 1, t('a11y.decrease', { name: t('map.amount_label') }), 44)}
          <TextInput
            value={amountText}
            onChangeText={text => setAmountText(text.replace(/[^0-9]/g, '').slice(0, 3))}
            onBlur={() => setAmount(amount)}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            maxLength={3}
            accessibilityLabel={t('map.amount_label')}
            style={[styles.amountInput, { color: colors.text, backgroundColor: colors.neutralSoft, borderColor: colors.border }]}
          />
          {roundButton('add', () => setAmount(amount + 1), amount >= MAX_GENERATION_AMOUNT, t('a11y.increase', { name: t('map.amount_label') }), 44)}
        </View>
        <View style={styles.chips}>
          {QUICK_AMOUNTS.map(n => <Chip key={n} label={String(n)} selected={amount === n} onPress={() => setAmount(n)} colors={colors} />)}
        </View>
        <Text style={[settingsStyles.settingSub, styles.hint, { color: colors.textMuted }]}>{t('map.amount_hint', { max: MAX_GENERATION_AMOUNT })}</Text>

        <Text style={[settingsStyles.settingLabel, styles.section, { color: colors.text }]}>{t('map.mix_difficulty')}</Text>
        {GENERATION_DIFFICULTIES.map(d => partsRow(d, t(`difficulty.${d}`), difficultyParts, setDifficultyParts, countOf(b => b.difficulty === d)))}

        <Text style={[settingsStyles.settingLabel, styles.section, { color: colors.text }]}>{t('map.mix_grid_size')}</Text>
        {GENERATION_GRID_SIZES.map((s: number) => partsRow(s, `${s}x${s}`, sizeParts, setSizeParts, countOf(b => b.gridSize === s)))}

        <Text style={[settingsStyles.settingSub, styles.hint, { color: colors.textMuted }]}>{t('map.mix_hint')}</Text>

        <View style={[styles.minMovesRow, styles.section]}>
          <Text style={[settingsStyles.settingLabel, { flex: 1, color: colors.text }]}>{t('map.min_moves_label')}</Text>
          <TextInput
            value={minMovesText}
            onChangeText={text => setMinMovesText(text.replace(/[^0-9]/g, '').slice(0, 2))}
            onBlur={() => setMinMovesText(minMoves === null ? '' : String(minMoves))}
            placeholder={t('map.min_moves_auto')}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            maxLength={2}
            accessibilityLabel={t('map.min_moves_label')}
            style={[styles.minMovesInput, { color: colors.text, backgroundColor: colors.neutralSoft, borderColor: colors.border }]}
          />
        </View>
        <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{t('map.min_moves_hint', { max: MAX_MIN_MOVES })}</Text>

        <IconText icon="warning" color={colors.warning} style={{ marginTop: 16 }} textStyle={[settingsStyles.settingSub, { fontWeight: '600' }]}>
          {t('map.generator_warning')}
        </IconText>
      </ScrollView>

      <View style={{ gap: 12, marginTop: 16 }}>
        <Pressable
          style={[settingsStyles.mainBtn, { backgroundColor: colors.primary, opacity: isGenerating || total === 0 ? 0.5 : 1 }]}
          onPress={handleGenerate}
          disabled={isGenerating || total === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: isGenerating || total === 0, busy: isGenerating }}
        >
          {isGenerating ? (
            <IconText icon="hourglass" color={fixedColors.onPrimary} textStyle={settingsStyles.mainBtnText}>{t('map.generating')}</IconText>
          ) : (
            <Text style={settingsStyles.mainBtnText}>
              {t('map.generate_btn', { count: total, time: formatGenerationTime(estimatedSeconds) })}
            </Text>
          )}
        </Pressable>

        {!isGenerating && generatedLevels.length > 0 && (
          <Pressable style={[settingsStyles.outlineBtn, { borderColor: colors.danger }]} onPress={handleResetLevels} accessibilityRole="button">
            <Text style={[settingsStyles.outlineBtnText, { color: colors.danger }]}>{t('map.reset_custom')}</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  amountInput: {
    flex: 1,
    // A web text field has a width of its own: without this it pushed the + button out of the sheet
    minWidth: 0,
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  minMovesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minMovesInput: {
    width: 96,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  hint: {
    marginTop: 8,
  },
  section: {
    marginTop: 20,
    marginBottom: 4,
  },
  round: {
    backgroundColor: fixedColors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  partsName: {
    flex: 1,
    fontSize: RFValue(15),
    fontWeight: '600',
  },
  share: {
    fontSize: RFValue(13),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  partsValue: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: RFValue(16),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
