import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MultiApi, Thresholds } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import Stepper from './Stepper';
import { useAdminSettings } from './useAdminSettings';
import { adminStyles as styles } from './styles';
import LoadingIndicator from '@/components/LoadingIndicator';

/** Each threshold, its step and how it is shown */
const THRESHOLDS: { key: keyof Thresholds; step: number; min: number; max: number; format: (v: number) => string }[] = [
  { key: 'minMsPerMove', step: 100, min: 0, max: 5000, format: v => `${v} ms` },
  { key: 'copyMinMoves', step: 1, min: 1, max: 100, format: v => `${v}` },
  { key: 'copyPauseRatio', step: 0.05, min: 0, max: 1, format: v => `${Math.round(v * 100)} %` },
  { key: 'copyMaxRhythmVariation', step: 0.05, min: 0, max: 2, format: v => v.toFixed(2) },
  { key: 'clockToleranceMs', step: 5000, min: 0, max: 600_000, format: v => `${Math.round(v / 1000)} s` },
  { key: 'clockToleranceRatio', step: 0.05, min: 0, max: 1, format: v => `${Math.round(v * 100)} %` },
];

const round = (v: number) => Math.round(v * 100) / 100;

interface Props { api: MultiApi; colors: UiColors }

/** The suspicion thresholds, and how long the moves are kept for the replays */
export default function AdminAntiCheat({ api, colors }: Props) {
  const { t } = useTranslation();
  const { settings, save } = useAdminSettings(api);

  if (!settings) return <LoadingIndicator />;

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_section_thresholds')}</Text>
      <View style={card}>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_thresholds_help')}</Text>
        {THRESHOLDS.map(({ key, step, min, max, format }) => (
          <Stepper
            key={key}
            label={t(`multi.threshold.${key}`)}
            value={format(settings.thresholds[key])}
            onMinus={() => save({ thresholds: { [key]: round(Math.max(min, settings.thresholds[key] - step)) } })}
            onPlus={() => save({ thresholds: { [key]: round(Math.min(max, settings.thresholds[key] + step)) } })}
            colors={colors}
          />
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_section_replays')}</Text>
      <View style={card}>
        <Stepper
          label={t('multi.admin_retention')}
          value={t('multi.admin_days', { count: settings.replayRetentionDays })}
          onMinus={() => save({ replayRetentionDays: Math.max(0, settings.replayRetentionDays - 1) })}
          onPlus={() => save({ replayRetentionDays: Math.min(365, settings.replayRetentionDays + 1) })}
          colors={colors}
        />
      </View>
    </View>
  );
}
