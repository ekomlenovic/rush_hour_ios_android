import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Switch, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { addDays, dateLocale, getLocalDateString, parseLocalDateString } from '@/utils/date';
import { RESET_PRESETS, resetRange, type ResetPreset } from '@/utils/multi/reset';
import type { AdminPlayer, MultiApi, ResetResult } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from '../errors';
import AdminButton from './AdminButton';
import { useAdminRefresh } from './AdminPage';
import { adminStyles as styles } from './styles';
import LoadingIndicator from '@/components/LoadingIndicator';

interface Props { api: MultiApi; colors: UiColors }

/**
 * Back to zero: the games of the daily challenges (rankings of the day, week, month)
 * and/or the duels (history, scores, duel rankings), for some days and some players.
 * What would go is counted first, then confirmed.
 */
export default function AdminReset({ api, colors }: Props) {
  const { t, i18n } = useTranslation();
  const today = getLocalDateString();
  const [challenges, setChallenges] = useState(true);
  const [duels, setDuels] = useState(true);
  const [preset, setPreset] = useState<ResetPreset>('week');
  const [dates, setDates] = useState({ from: addDays(today, -7), to: today });
  const [everyone, setEveryone] = useState(true);
  const [chosen, setChosen] = useState<number[]>([]);
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [preview, setPreview] = useState<ResetResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    await api.admin.players().then(r => setPlayers(r.players)).catch(() => setPlayers(p => p ?? []));
    // The count of what would be deleted, again
    setVersion(v => v + 1);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  useAdminRefresh(load);

  const range = resetRange(preset, today, dates);
  const request = useMemo(() => ({
    from: range.from, to: range.to, challenges, duels,
    playerIds: everyone ? [] : chosen,
  }), [range.from, range.to, challenges, duels, everyone, chosen]);
  const nothing = (!challenges && !duels) || (!everyone && chosen.length === 0);

  // What would be deleted, counted by the server as the choices change
  useEffect(() => {
    if (nothing) return setPreview(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      api.admin.reset({ ...request, dryRun: true }).then(r => { if (!cancelled) setPreview(r); }).catch(() => { if (!cancelled) setPreview(null); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [api, request, nothing, version]);

  const day = (date: string) => parseLocalDateString(date).toLocaleDateString(dateLocale(i18n.language), { weekday: 'short', day: 'numeric', month: 'short' });
  const rangeText = range.from === null ? t('multi.admin_reset_all_time')
    : range.from === range.to ? day(range.from) : t('multi.admin_reset_range', { from: day(range.from), to: day(range.to!) });
  const total = (preview?.challenges ?? 0) + (preview?.duels ?? 0);

  const run = () => {
    const who = everyone ? t('multi.admin_reset_everyone') : t('multi.admin_reset_players_count', { count: chosen.length });
    Alert.alert(
      t('multi.admin_reset_confirm_title'),
      t('multi.admin_reset_confirm_body', {
        who, when: rangeText,
        challenges: t('multi.admin_reset_games', { count: preview?.challenges ?? 0 }),
        duels: t('multi.admin_reset_duels', { count: preview?.duels ?? 0 }),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('multi.admin_reset_go'), style: 'destructive', onPress: async () => {
            setBusy(true);
            try {
              const done = await api.admin.reset(request);
              Alert.alert(t('multi.admin_reset_done_title'), [
                challenges ? t('multi.admin_reset_games', { count: done.challenges }) : null,
                duels ? t('multi.admin_reset_duels', { count: done.duels }) : null,
              ].filter(Boolean).join('\n'));
              setVersion(v => v + 1);
            } catch (e) {
              Alert.alert(t('common.error'), multiErrorMessage(t, e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const chip = (active: boolean) => ({
    borderWidth: 1.5, borderRadius: 999, paddingVertical: RFValue(6), paddingHorizontal: RFValue(12),
    borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : 'transparent',
  });

  return (
    <View>
      <Text style={[styles.muted, { color: colors.textMuted, marginBottom: RFValue(4) }]}>{t('multi.admin_reset_help')}</Text>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_reset_what')}</Text>
      <View style={card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_reset_challenges')}</Text>
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_reset_challenges_help')}</Text>
          </View>
          <Switch value={challenges} onValueChange={setChallenges} accessibilityLabel={t('multi.admin_reset_challenges')} />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_reset_duels_label')}</Text>
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_reset_duels_help')}</Text>
          </View>
          <Switch value={duels} onValueChange={setDuels} accessibilityLabel={t('multi.admin_reset_duels_label')} />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_reset_when')}</Text>
      <View style={card}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
          {RESET_PRESETS.map(p => (
            <Pressable key={p} onPress={() => setPreset(p)} style={chip(p === preset)} accessibilityRole="radio" accessibilityState={{ checked: p === preset }}>
              <Text style={{ fontSize: RFValue(13), fontWeight: '700', color: p === preset ? colors.primaryText : colors.text }}>{t(`multi.admin_reset_preset.${p}`)}</Text>
            </Pressable>
          ))}
        </View>
        {preset === 'dates' && (['from', 'to'] as const).map(bound => (
          <View key={bound} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t(`multi.admin_reset_${bound}`)}</Text>
            <AdminButton label="−" onPress={() => setDates(d => ({ ...d, [bound]: addDays(d[bound], -1) }))} background={colors.neutralSoft} color={colors.text} accessibilityLabel={`${t(`multi.admin_reset_${bound}`)}, ${t('multi.admin_reset_day_before')}`} />
            <Text style={{ color: colors.text, fontWeight: '800', minWidth: RFValue(110), textAlign: 'center' }}>{day(dates[bound])}</Text>
            <AdminButton label="+" onPress={() => setDates(d => ({ ...d, [bound]: addDays(d[bound], 1) }))} background={colors.neutralSoft} color={colors.text} accessibilityLabel={`${t(`multi.admin_reset_${bound}`)}, ${t('multi.admin_reset_day_after')}`} />
          </View>
        ))}
        <Text style={[styles.muted, { color: colors.textMuted, marginTop: RFValue(10) }]}>{rangeText}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_reset_who')}</Text>
      <View style={card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_reset_everyone')}</Text>
          <Switch value={everyone} onValueChange={setEveryone} accessibilityLabel={t('multi.admin_reset_everyone')} />
        </View>
        {!everyone && !players && <LoadingIndicator />}
        {!everyone && players?.map(p => {
          const selected = chosen.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => setChosen(c => (selected ? c.filter(id => id !== p.id) : [...c, p.id]))}
              style={[styles.row, { paddingVertical: RFValue(6) }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? colors.primary : colors.textMuted} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{p.pseudo}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[...card, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {nothing ? t('multi.admin_reset_nothing')
            : !preview ? '…'
            : total === 0 ? t('multi.admin_reset_none')
            : t('multi.admin_reset_preview', {
              games: t('multi.admin_reset_games', { count: preview.challenges }),
              duels: t('multi.admin_reset_duels', { count: preview.duels }),
            })}
        </Text>
        {challenges && <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_reset_replay_note')}</Text>}
        {duels && !everyone && <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_reset_duel_note')}</Text>}
        <View style={styles.actions}>
          <AdminButton
            label={busy ? '…' : t('multi.admin_reset_go')}
            onPress={run}
            disabled={busy || nothing || total === 0}
            background={colors.danger}
            color={colors.onPrimary}
          />
        </View>
      </View>
    </View>
  );
}
