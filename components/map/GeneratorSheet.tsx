import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { haptics, Haptics } from '@/utils/haptics';
import { useLevelGenerator, formatGenerationTime, estimateGenerationSeconds } from '@/hooks/useLevelGenerator';
import { useGenerationTimes } from '@/store/generationTimes';
import { needsConfirmation } from '@/utils/generationEstimate';
import {
  batchConfig, buildGenerationPlan, clampAmount, clampMinMoves, movesRange, planTotal,
  DEFAULT_DIFFICULTY_PARTS, DEFAULT_GRID_SIZE_PARTS, GENERATION_DIFFICULTIES, GENERATION_GRID_SIZES,
  MAX_GENERATION_AMOUNT, MAX_PARTS, type DifficultyKey, type MinMovesByDifficulty,
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

  // Minimum of moves typed for each difficulty, as typed; empty: the usual moves of the difficulty
  const [minMovesText, setMinMovesText] = useState<Partial<Record<DifficultyKey, string>>>({});
  const minMoves = useMemo(() => {
    const byDifficulty: MinMovesByDifficulty = {};
    for (const d of GENERATION_DIFFICULTIES) {
      const value = clampMinMoves(parseInt(minMovesText[d] ?? '', 10), d);
      if (value !== null) byDifficulty[d] = value;
    }
    return byDifficulty;
  }, [minMovesText]);

  // The explanation unfolded, one at a time (folded at first: the sheet stays short)
  const [openHelp, setOpenHelp] = useState<string | null>(null);

  // More below than the sheet shows: the bottom fades out and a hint says to scroll
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [atBottom, setAtBottom] = useState(false);
  const showScrollHint = contentHeight > viewportHeight + 16 && !atBottom;

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
    const slow = plan.filter(b => needsConfirmation(b.difficulty, b.gridSize, samples, batchConfig(b).slowdown));
    if (slow.length === 0) return start();
    haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t('map.long_generation_title'),
      t('map.long_generation_body', {
        time: formatGenerationTime(estimatedSeconds),
        slow: slow.map(b => `${t(`difficulty.${b.difficulty}`)} ${b.gridSize}x${b.gridSize}${b.minMoves ? ` (${t('map.min_moves_short', { count: b.minMoves })})` : ''}`).join(', '),
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

  const roundButton = (icon: 'remove' | 'add', onPress: () => void, disabled: boolean, label: string, size = 36, background?: string) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.35 : 1 }, background ? { backgroundColor: background } : null]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
    >
      <Ionicons name={icon} size={size / 2} color={colors.text} />
    </Pressable>
  );

  /** One difficulty or grid size: its parts changed a step at a time, and the levels it gets (count and bar) */
  function partsRow<K extends string | number>(key: K, name: string, parts: Record<K, number>, setParts: (next: Record<K, number>) => void, count: number) {
    const value = parts[key];
    const totalParts = Object.values<number>(parts).reduce((a, b) => a + b, 0);
    const percent = totalParts > 0 ? Math.round((value / totalParts) * 100) : 0;
    const active = value > 0;
    const change = (delta: number) => {
      haptics.selectionAsync();
      setParts({ ...parts, [key]: value + delta });
    };
    return (
      <View style={styles.partsRow}>
        <View style={styles.partsInfo} accessible accessibilityLabel={active ? t('a11y.generation_share', { name, percent, count }) : name}>
          <View style={styles.partsHeader}>
            <Text style={[styles.partsName, { color: active ? colors.text : colors.textMuted }]} numberOfLines={1}>{name}</Text>
            {active && (
              <View style={[styles.countBadge, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.countText, { color: colors.primaryText }]}>{count}</Text>
              </View>
            )}
          </View>
          {/* Share of the levels, at a glance */}
          <View style={[styles.bar, { backgroundColor: active ? colors.neutralSoft : 'transparent' }]}>
            {active && <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: colors.primary }]} />}
          </View>
        </View>
        {/* The last part of a proportion stays: a generation needs a difficulty and a grid size */}
        <View style={[styles.stepper, { backgroundColor: colors.neutralSoft }]}>
          {roundButton('remove', () => change(-1), value === 0 || totalParts === 1, t('a11y.decrease', { name }), 32, colors.surface)}
          <Text style={[styles.partsValue, { color: active ? colors.text : colors.textMuted }]} importantForAccessibility="no" accessibilityElementsHidden>{value}</Text>
          {roundButton('add', () => change(1), value >= MAX_PARTS, t('a11y.increase', { name }), 32, colors.surface)}
        </View>
      </View>
    );
  }

  /** Minimum of moves of a difficulty being generated: typed, or left to the usual moves of the difficulty */
  const minMovesRow = (difficulty: DifficultyKey) => {
    const { min, max } = movesRange(difficulty);
    const setText = (text: string) => setMinMovesText({ ...minMovesText, [difficulty]: text });
    return (
      <View style={[styles.minMovesRow, { borderLeftColor: colors.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.minMovesLabel, { color: colors.text }]}>{t('map.min_moves_label')}</Text>
          <Text style={[styles.minMovesRange, { color: colors.textMuted }]}>{t('map.min_moves_usual', { min, max })}</Text>
        </View>
        <TextInput
          value={minMovesText[difficulty] ?? ''}
          onChangeText={text => setText(text.replace(/[^0-9]/g, '').slice(0, 2))}
          onBlur={() => setText(minMoves[difficulty] === undefined ? '' : String(minMoves[difficulty]))}
          placeholder={t('map.min_moves_auto')}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          maxLength={2}
          accessibilityLabel={t('a11y.min_moves', { name: t(`difficulty.${difficulty}`), min, max })}
          style={[styles.minMovesInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
      </View>
    );
  };

  /** A titled card; its explanation, long, stays folded behind the help button */
  const section = (title: string, help: { key: string; text: string } | null, children: React.ReactNode, aside?: string) => {
    const open = help !== null && openHelp === help.key;
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">{title}</Text>
          {aside && <Text style={[styles.cardAside, { color: colors.textMuted }]}>{aside}</Text>}
          {help && (
            <Pressable
              onPress={() => setOpenHelp(open ? null : help.key)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.help', { name: title })}
              accessibilityState={{ expanded: open }}
            >
              <Ionicons name={open ? 'information-circle' : 'information-circle-outline'} size={RFValue(20)} color={open ? colors.primaryText : colors.textMuted} />
            </Pressable>
          )}
        </View>
        {open && help && (
          <Text style={[styles.helpText, { color: colors.textMuted, backgroundColor: colors.neutralSoft }]}>{help.text}</Text>
        )}
        {children}
      </View>
    );
  };

  const countOf = (match: (b: typeof plan[number]) => boolean) => plan.filter(match).reduce((sum, b) => sum + b.count, 0);
  // The warning only when it applies: a slow difficulty or a big grid is in the mix
  const slowMix = difficultyParts.EXPERT > 0 || difficultyParts.MASTER > 0 || sizeParts[7] > 0 || sizeParts[8] > 0;

  return (
    <BottomSheet visible={visible} title={t('map.level_generator')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <View>
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: height * 0.62, flexGrow: 0 }}
          contentContainerStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onScroll={e => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            setScrollY(contentOffset.y);
            setAtBottom(layoutMeasurement.height + contentOffset.y >= contentSize.height - 16);
          }}
          scrollEventThrottle={16}
        >
          {section(t('map.amount_label'), null, (
            <>
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
                  style={[styles.amountInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                />
                {roundButton('add', () => setAmount(amount + 1), amount >= MAX_GENERATION_AMOUNT, t('a11y.increase', { name: t('map.amount_label') }), 44)}
              </View>
              <View style={styles.chips}>
                {QUICK_AMOUNTS.map(n => <Chip key={n} label={String(n)} selected={amount === n} onPress={() => setAmount(n)} colors={colors} />)}
              </View>
            </>
          ), t('map.amount_hint', { max: MAX_GENERATION_AMOUNT }))}

          {section(t('map.mix_difficulty'), { key: 'difficulty', text: `${t('map.mix_hint')}\n\n${t('map.min_moves_hint')}` }, (
            <View style={styles.rows}>
              {GENERATION_DIFFICULTIES.map(d => (
                <React.Fragment key={d}>
                  {partsRow(d, t(`difficulty.${d}`), difficultyParts, setDifficultyParts, countOf(b => b.difficulty === d))}
                  {difficultyParts[d] > 0 && minMovesRow(d)}
                </React.Fragment>
              ))}
            </View>
          ))}

          {section(t('map.mix_grid_size'), { key: 'size', text: t('map.mix_hint') }, (
            <View style={styles.rows}>
              {GENERATION_GRID_SIZES.map((s: number) => (
                <React.Fragment key={s}>
                  {partsRow(s, `${s}x${s}`, sizeParts, setSizeParts, countOf(b => b.gridSize === s))}
                </React.Fragment>
              ))}
            </View>
          ))}

          {slowMix && (
            <View style={[styles.warning, { backgroundColor: colors.warningSoft }]}>
              <IconText icon="warning" color={colors.warning} textStyle={[settingsStyles.settingSub, { color: colors.text, fontWeight: '600' }]}>
                {t('map.generator_warning')}
              </IconText>
            </View>
          )}
        </ScrollView>

        {/* More below: the content fades out under the buttons, and a hint says to scroll (a touch scrolls) */}
        {showScrollHint && (
          <>
            <View style={styles.fade} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="generatorFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.surface} stopOpacity={0} />
                    <Stop offset="1" stopColor={colors.surface} stopOpacity={1} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#generatorFade)" />
              </Svg>
            </View>
            <View style={styles.scrollHintWrap} pointerEvents="box-none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Pressable
                onPress={() => scrollRef.current?.scrollTo({ y: scrollY + viewportHeight * 0.7, animated: true })}
                style={[styles.scrollHint, { backgroundColor: colors.surface, borderColor: colors.border }]}
                hitSlop={8}
              >
                <Text style={[styles.scrollHintText, { color: colors.primaryText }]}>{t('map.scroll_hint')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={[styles.actions, { borderTopColor: showScrollHint ? colors.border : 'transparent' }]}>
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
  card: {
    borderRadius: 18,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  cardAside: {
    fontSize: RFValue(12),
    fontWeight: '600',
  },
  helpText: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  rows: {
    gap: 10,
  },
  round: {
    backgroundColor: fixedColors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partsInfo: {
    flex: 1,
    gap: 6,
  },
  partsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partsName: {
    flexShrink: 1,
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  countText: {
    fontSize: RFValue(12),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 3,
    gap: 4,
  },
  partsValue: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: RFValue(15),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  minMovesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 4,
    paddingLeft: 12,
    paddingVertical: 2,
    borderLeftWidth: 2,
  },
  minMovesLabel: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  minMovesRange: {
    fontSize: RFValue(12),
  },
  minMovesInput: {
    width: 76,
    height: 38,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  warning: {
    borderRadius: 14,
    padding: 12,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  scrollHintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    alignItems: 'center',
  },
  scrollHint: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  scrollHintText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  actions: {
    gap: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
