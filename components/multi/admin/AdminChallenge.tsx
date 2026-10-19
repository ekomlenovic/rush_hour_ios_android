import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Difficulty, MultiApi } from '@/utils/multi/api';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import AdminButton from './AdminButton';
import Stepper from './Stepper';
import { useAdminSettings } from './useAdminSettings';
import { adminStyles as styles } from './styles';

const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];
/** Monday first; the server counts from Sunday (0) */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const GRACE_STEP = 15 * MINUTE;
const GRACE_MAX = 24 * HOUR;
/** Pregeneration goes from one of these to the next */
const PREGENERATE = [1, 6, 12, 24, 48, 72, 96, 120, 144, 168].map(h => h * HOUR);

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

interface Props { api: MultiApi; colors: UiColors; isDark: boolean }

/** The daily challenge: when it comes out, how long to finish it, its difficulty each day */
export default function AdminChallenge({ api, colors, isDark }: Props) {
  const { t, i18n } = useTranslation();
  const { settings, save } = useAdminSettings(api);
  const [releaseTime, setReleaseTime] = useState('12:00');
  const [pickingDay, setPickingDay] = useState<number | null>(null);

  useEffect(() => { if (settings) setReleaseTime(settings.releaseTime); }, [settings?.releaseTime]);

  if (!settings) return <ActivityIndicator color={colors.primary} />;

  const applyReleaseTime = () => Alert.alert(
    t('multi.admin_release_confirm_title', { time: releaseTime }),
    t('multi.admin_release_confirm_body'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('multi.admin_apply'), onPress: () => save({ releaseTime }) },
    ],
  );

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
  const pregenerateIndex = PREGENERATE.findIndex(v => v >= settings.pregenerateAheadMs);

  return (
    <View>
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
    </View>
  );
}
