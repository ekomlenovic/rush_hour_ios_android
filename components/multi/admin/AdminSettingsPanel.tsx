import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Switch, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdminSettings, Difficulty, MultiApi, Thresholds } from '@/utils/multi/api';
import { buildInviteLink } from '@/utils/multi/serverUrl';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from '../errors';
import AdminButton from './AdminButton';
import { adminStyles as styles } from './styles';

const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];
/** Monday first; the server counts from Sunday (0) */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

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

interface Props { api: MultiApi; colors: UiColors; serverUrl: string }

/** Joining, invitations, difficulty, replays and suspicion thresholds, changed at once on the server */
export default function AdminSettingsPanel({ api, colors, serverUrl }: Props) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    api.admin.settings().then(setSettings).catch(e => Alert.alert(t('common.error'), multiErrorMessage(t, e)));
    api.invite().then(r => setInviteCode(r.inviteCode)).catch(() => {});
  }, [api, t]);

  const save = async (patch: Parameters<MultiApi['admin']['updateSettings']>[0]) => {
    try {
      setSettings(await api.admin.updateSettings(patch));
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
    }
  };

  const regenerate = () => Alert.alert(t('multi.admin_new_invite_title'), t('multi.admin_new_invite_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('multi.renew_code'), style: 'destructive', onPress: async () => {
        try {
          setInviteCode((await api.admin.newInviteCode()).inviteCode);
        } catch (e) {
          Alert.alert(t('common.error'), multiErrorMessage(t, e));
        }
      },
    },
  ]);

  if (!settings) return <ActivityIndicator color={colors.primary} />;

  const dayName = (day: number) => new Date(2026, 9, 18 + day).toLocaleDateString(i18n.language, { weekday: 'long' });
  const nextDifficulty = (d: Difficulty) => DIFFICULTIES[(DIFFICULTIES.indexOf(d) + 1) % DIFFICULTIES.length];
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_section_invites')}</Text>
      <View style={card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_join_open')}</Text>
          <Switch value={settings.joinOpen} onValueChange={v => save({ joinOpen: v })} accessibilityLabel={t('multi.admin_join_open')} />
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_invites_admin_only')}</Text>
          <Switch value={settings.invitesAdminOnly} onValueChange={v => save({ invitesAdminOnly: v })} accessibilityLabel={t('multi.admin_invites_admin_only')} />
        </View>
        {inviteCode && <Text style={[styles.muted, { color: colors.textMuted }]} selectable>{t('multi.invite_code')} : {inviteCode}</Text>}
        <View style={styles.actions}>
          {inviteCode && (
            <AdminButton
              label={t('multi.invite_share')}
              onPress={() => Share.share({ message: buildInviteLink(serverUrl, inviteCode) })}
              background={colors.neutralSoft}
              color={colors.text}
            />
          )}
          <AdminButton label={t('multi.admin_new_invite')} onPress={regenerate} background={colors.dangerSoft} color={colors.danger} />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_section_difficulty')}</Text>
      <View style={card}>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_difficulty_help')}</Text>
        {WEEK.map(day => (
          <View key={day} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{dayName(day)}</Text>
            <AdminButton
              label={t(`difficulty.${settings.difficultyByWeekday[day]}`)}
              onPress={() => {
                const days = [...settings.difficultyByWeekday];
                days[day] = nextDifficulty(days[day]);
                void save({ difficultyByWeekday: days });
              }}
              background={colors.primarySoft}
              color={colors.primaryText}
              accessibilityLabel={`${dayName(day)}, ${t(`difficulty.${settings.difficultyByWeekday[day]}`)}`}
            />
          </View>
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
    </View>
  );
}

function Stepper({ label, value, onMinus, onPlus, colors }: { label: string; value: string; onMinus: () => void; onPlus: () => void; colors: UiColors }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessible={false}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <AdminButton label="−" onPress={onMinus} background={colors.neutralSoft} color={colors.text} accessibilityLabel={`${t('multi.admin_less')}, ${label}`} />
      <Text style={{ color: colors.text, fontWeight: '800', minWidth: 64, textAlign: 'center' }} accessibilityLabel={`${label} : ${value}`}>{value}</Text>
      <AdminButton label="+" onPress={onPlus} background={colors.neutralSoft} color={colors.text} accessibilityLabel={`${t('multi.admin_more')}, ${label}`} />
    </View>
  );
}
