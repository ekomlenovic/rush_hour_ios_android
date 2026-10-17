import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Switch, Share, TextInput, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AdminSettings, AdminSettingsPatch, Difficulty, MultiApi, Thresholds } from '@/utils/multi/api';
import { buildInviteLink } from '@/utils/multi/serverUrl';
import { useMultiStore } from '@/store/multiStore';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const GRACE_STEP = 15 * MINUTE;
const GRACE_MAX = 24 * HOUR;
/** Pregeneration goes from one of these to the next */
const PREGENERATE = [1, 6, 12, 24, 48, 72, 96, 120, 144, 168].map(h => h * HOUR);
const SERVER_NAME_MAX = 40;

const pad = (n: number) => String(n).padStart(2, '0');
/** 'HH:MM' moved by a number of minutes, around the clock */
const shiftTime = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

/** '45 min', '1 h 30', '2 days' */
function formatDuration(t: TFunction, ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes >= 1440 && minutes % 1440 === 0) return t('multi.admin_days', { count: minutes / 1440 });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

interface Props { api: MultiApi; colors: UiColors; isDark: boolean; serverUrl: string }

/** Server, schedule, joining, invitations, difficulty, replays and suspicion thresholds, changed at once on the server */
export default function AdminSettingsPanel({ api, colors, isDark, serverUrl }: Props) {
  const { t, i18n } = useTranslation();
  const updateAccount = useMultiStore(s => s.updateAccount);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [releaseTime, setReleaseTime] = useState('12:00');
  const [pickingDay, setPickingDay] = useState<number | null>(null);

  const loaded = (next: AdminSettings) => {
    setSettings(next);
    setName(next.serverName);
    setReleaseTime(next.releaseTime);
  };

  useEffect(() => {
    api.admin.settings().then(loaded).catch(e => Alert.alert(t('common.error'), multiErrorMessage(t, e)));
    api.invite().then(r => setInviteCode(r.inviteCode)).catch(() => {});
  }, [api, t]);

  /** The new settings, or null when refused (already told) */
  const update = async (patch: AdminSettingsPatch) => {
    try {
      const next = await api.admin.updateSettings(patch);
      setSettings(next);
      return next;
    } catch (e) {
      Alert.alert(t('common.error'), multiErrorMessage(t, e));
      return null;
    }
  };
  const save = (patch: AdminSettingsPatch) => { void update(patch); };

  const saveName = async () => {
    const next = await update({ serverName: name.trim() });
    if (next) {
      setName(next.serverName);
      updateAccount(serverUrl, { name: next.serverName });
    }
  };

  const applyReleaseTime = () => Alert.alert(
    t('multi.admin_release_confirm_title', { time: releaseTime }),
    t('multi.admin_release_confirm_body'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('multi.admin_apply'), onPress: () => save({ releaseTime }) },
    ],
  );

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

  const reset = () => Alert.alert(t('multi.admin_reset_title'), t('multi.admin_reset_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('multi.admin_reset'), style: 'destructive', onPress: async () => {
        try {
          const next = await api.admin.resetSettings();
          loaded(next);
          updateAccount(serverUrl, { name: next.serverName });
        } catch (e) {
          Alert.alert(t('common.error'), multiErrorMessage(t, e));
        }
      },
    },
  ]);

  if (!settings) return <ActivityIndicator color={colors.primary} />;

  const dayName = (day: number) => new Date(2026, 9, 18 + day).toLocaleDateString(i18n.language, { weekday: 'long' });
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const inZone = (ms: number) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
    try {
      return new Date(ms).toLocaleString(i18n.language, { ...options, timeZone: settings.timeZone });
    } catch {
      return new Date(ms).toLocaleString(i18n.language, options);
    }
  };
  const nameChanged = name.trim() !== settings.serverName && name.trim().length > 0;
  const pregenerateIndex = PREGENERATE.findIndex(v => v >= settings.pregenerateAheadMs);

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_section_server')}</Text>
      <View style={card}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_server_name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={SERVER_NAME_MAX}
          returnKeyType="done"
          onSubmitEditing={() => nameChanged && void saveName()}
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: RFValue(8), marginTop: RFValue(8), color: colors.text, fontSize: RFValue(15) }}
          accessibilityLabel={t('multi.admin_server_name')}
        />
        {nameChanged && (
          <View style={styles.actions}>
            <AdminButton label={t('common.ok')} onPress={saveName} background={colors.primary} color={colors.onPrimary} />
            <AdminButton label={t('common.cancel')} onPress={() => setName(settings.serverName)} background={colors.neutralSoft} color={colors.text} />
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('multi.admin_section_schedule')}</Text>
      <View style={card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('multi.admin_release_time')}</Text>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: RFValue(20) }}>{releaseTime}</Text>
        </View>
        <Stepper
          label={t('multi.admin_hours')}
          value={releaseTime.slice(0, 2)}
          onMinus={() => setReleaseTime(shiftTime(releaseTime, -60))}
          onPlus={() => setReleaseTime(shiftTime(releaseTime, 60))}
          colors={colors}
        />
        <Stepper
          label={t('multi.admin_minutes')}
          value={releaseTime.slice(3)}
          // Back on a multiple of 5 first
          onMinus={() => setReleaseTime(shiftTime(releaseTime, -(Number(releaseTime.slice(3)) % 5 || 5)))}
          onPlus={() => setReleaseTime(shiftTime(releaseTime, 5 - (Number(releaseTime.slice(3)) % 5)))}
          colors={colors}
        />
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_release_help', { zone: settings.timeZone })}</Text>
        <Text style={[styles.muted, { color: colors.text, fontWeight: '700' }]}>{t('multi.admin_next_release', { date: inZone(settings.nextReleaseAt) })}</Text>
        {releaseTime !== settings.releaseTime && (
          <View style={styles.actions}>
            <AdminButton label={t('multi.admin_apply')} onPress={applyReleaseTime} background={colors.primary} color={colors.onPrimary} />
            <AdminButton label={t('common.cancel')} onPress={() => setReleaseTime(settings.releaseTime)} background={colors.neutralSoft} color={colors.text} />
          </View>
        )}
      </View>
      <View style={card}>
        <Stepper
          label={t('multi.admin_grace')}
          value={formatDuration(t, settings.gracePeriodMs)}
          onMinus={() => save({ gracePeriodMs: Math.max(0, Math.ceil(settings.gracePeriodMs / GRACE_STEP) * GRACE_STEP - GRACE_STEP) })}
          onPlus={() => save({ gracePeriodMs: Math.min(GRACE_MAX, Math.floor(settings.gracePeriodMs / GRACE_STEP) * GRACE_STEP + GRACE_STEP) })}
          colors={colors}
        />
        <Stepper
          label={t('multi.admin_pregenerate')}
          value={formatDuration(t, settings.pregenerateAheadMs)}
          onMinus={() => save({ pregenerateAheadMs: PREGENERATE[Math.max(0, (pregenerateIndex === -1 ? PREGENERATE.length : pregenerateIndex) - 1)] })}
          onPlus={() => save({
            pregenerateAheadMs: PREGENERATE[Math.min(PREGENERATE.length - 1,
              pregenerateIndex === -1 ? PREGENERATE.length - 1
                : PREGENERATE[pregenerateIndex] === settings.pregenerateAheadMs ? pregenerateIndex + 1 : pregenerateIndex)],
          })}
          colors={colors}
        />
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_schedule_help')}</Text>
      </View>

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
              label={`${t(`difficulty.${settings.difficultyByWeekday[day]}`)} ▾`}
              onPress={() => setPickingDay(day)}
              background={colors.primarySoft}
              color={colors.primaryText}
              accessibilityLabel={`${dayName(day)}, ${t(`difficulty.${settings.difficultyByWeekday[day]}`)}`}
            />
          </View>
        ))}
      </View>
      <BottomSheet
        visible={pickingDay !== null}
        title={pickingDay !== null ? dayName(pickingDay) : ''}
        colors={colors}
        isDark={isDark}
        onClose={() => setPickingDay(null)}
        onRequestClose={() => setPickingDay(null)}
      >
        {pickingDay !== null && DIFFICULTIES.map(difficulty => {
          const selected = settings.difficultyByWeekday[pickingDay] === difficulty;
          return (
            <Pressable
              key={difficulty}
              onPress={() => {
                const days = [...settings.difficultyByWeekday];
                days[pickingDay] = difficulty;
                setPickingDay(null);
                if (!selected) save({ difficultyByWeekday: days });
              }}
              style={{
                borderWidth: 1.5, borderRadius: 14, paddingVertical: RFValue(13), paddingHorizontal: RFValue(14), marginBottom: RFValue(10),
                borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : 'transparent',
                flexDirection: 'row', justifyContent: 'space-between',
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={{ fontSize: RFValue(16), fontWeight: '700', color: selected ? colors.primaryText : colors.text }}>{t(`difficulty.${difficulty}`)}</Text>
              {selected && <Ionicons name="checkmark" size={RFValue(18)} color={colors.primaryText} />}
            </Pressable>
          );
        })}
      </BottomSheet>

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

      <View style={card}>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.admin_reset_help')}</Text>
        <View style={styles.actions}>
          <AdminButton label={t('multi.admin_reset')} onPress={reset} background={colors.dangerSoft} color={colors.danger} />
        </View>
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
