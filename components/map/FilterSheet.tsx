import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_MAP_FILTER, MOVE_RANGES, STARS_UNDER_THREE, toggled,
  type MapFilter, type MapFilterSource,
} from '@/utils/mapFilter';
import { GENERATION_GRID_SIZES } from '@/utils/generationPlan';
import type { UiColors } from '@/theme';
import BottomSheet from '../home/BottomSheet';
import { settingsStyles } from '../settings/styles';
import Chip from './Chip';

const SOURCES: MapFilterSource[] = ['all', 'campaign', 'generated'];
const MOVE_LABELS = { short: '≤ 14', medium: '15 – 24', long: '25 – 39', epic: '40 +' } as const;

const sameValues = (a: readonly number[], b: readonly number[]) => a.length === b.length && b.every(v => a.includes(v));

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  /** The search going on, null when the map shows every level */
  filter: MapFilter | null;
  /** Levels of the map a search would find */
  countMatches: (filter: MapFilter) => number;
  onApply: (filter: MapFilter) => void;
  /** Back to the whole map */
  onClear: () => void;
  onClose: () => void;
}

/** Search of the world map: the criteria of the levels to find, with the number of levels they match */
export default function FilterSheet({ visible, colors, isDark, filter, countMatches, onApply, onClear, onClose }: Props) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<MapFilter>(filter ?? DEFAULT_MAP_FILTER);

  // Opens on the search going on
  useEffect(() => {
    if (visible) setDraft(filter ?? DEFAULT_MAP_FILTER);
  }, [visible, filter]);

  const count = visible ? countMatches(draft) : 0;
  const underThree = sameValues(draft.stars, STARS_UNDER_THREE);

  const section = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[settingsStyles.settingLabel, { color: colors.text }]} accessibilityRole="header">{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );

  const switchRow = (label: string, sub: string | null, value: boolean, onChange: (value: boolean) => void) => (
    <View style={styles.switchRow}>
      <View style={settingsStyles.settingText}>
        <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{label}</Text>
        {sub && <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{sub}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.switchTrackOff, true: colors.primary }} accessibilityLabel={label} />
    </View>
  );

  return (
    <BottomSheet visible={visible} title={t('map.filter_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.6, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
        {section(t('map.filter_stars'), (
          <>
            <Chip
              label={t('map.filter_under_three')}
              selected={underThree}
              onPress={() => setDraft({ ...draft, stars: underThree ? [] : STARS_UNDER_THREE })}
              colors={colors}
            />
            <View style={styles.lineBreak} />
            {[0, 1, 2, 3].map(stars => (
              <Chip
                key={stars}
                label={stars === 0 ? t('map.filter_not_won') : `${stars} ★`}
                accessibilityLabel={stars === 0 ? undefined : t('a11y.level_stars', { count: stars })}
                selected={draft.stars.includes(stars)}
                onPress={() => setDraft({ ...draft, stars: toggled(draft.stars, stars) })}
                colors={colors}
              />
            ))}
          </>
        ))}

        {section(t('map.mix_grid_size'), GENERATION_GRID_SIZES.map(size => (
          <Chip
            key={size}
            label={`${size}x${size}`}
            selected={draft.gridSizes.includes(size)}
            onPress={() => setDraft({ ...draft, gridSizes: toggled(draft.gridSizes, size) })}
            colors={colors}
          />
        )))}

        {section(t('map.filter_moves'), MOVE_RANGES.map(({ key }) => (
          <Chip
            key={key}
            label={MOVE_LABELS[key]}
            selected={draft.moves.includes(key)}
            onPress={() => setDraft({ ...draft, moves: toggled(draft.moves, key) })}
            colors={colors}
          />
        )))}

        {section(t('map.filter_source'), SOURCES.map(source => (
          <Chip
            key={source}
            label={t(`map.filter_sources.${source}`)}
            selected={draft.source === source}
            onPress={() => setDraft({ ...draft, source })}
            colors={colors}
          />
        )))}

        {switchRow(t('map.filter_boss'), null, draft.bossOnly, bossOnly => setDraft({ ...draft, bossOnly }))}
        {switchRow(t('map.filter_playable'), t('map.filter_playable_desc'), draft.playableOnly, playableOnly => setDraft({ ...draft, playableOnly }))}
      </ScrollView>

      <View style={{ gap: 12, marginTop: 16 }}>
        <Pressable
          style={[settingsStyles.mainBtn, { backgroundColor: colors.primary, opacity: count === 0 ? 0.5 : 1 }]}
          onPress={() => onApply(draft)}
          disabled={count === 0}
          accessibilityRole="button"
          accessibilityState={{ disabled: count === 0 }}
          accessibilityLiveRegion="polite"
        >
          <Text style={settingsStyles.mainBtnText}>{count === 0 ? t('map.filter_none') : t('map.filter_show', { count })}</Text>
        </Pressable>
        {filter && (
          <Pressable style={[settingsStyles.outlineBtn, { borderColor: colors.primary }]} onPress={onClear} accessibilityRole="button">
            <Text style={[settingsStyles.outlineBtnText, { color: colors.primaryText }]}>{t('map.filter_clear')}</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  /** Ends the line of chips: the shortcut stays above the choices it sets */
  lineBreak: {
    width: '100%',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
});
