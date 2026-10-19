import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { addDays, getMonthGrid, parseLocalDateString } from '@/utils/date';
import {
  MAX_MONTHS_BACK, MAX_WEEKS_BACK, orderedDates, rankingDays, shiftMonth, type RankingMode, type RankingView,
} from '@/utils/multi/rankingPeriod';
import type { UiColors } from '@/theme';

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface Props {
  colors: UiColors;
  isDark: boolean;
  /** The day of the current challenge on the server */
  today: string;
  modes: readonly RankingMode[];
  view: RankingView;
  onView: (view: RankingView) => void;
  /** The server can rank between two dates */
  datesSupported: boolean;
}

/**
 * The period of the weekly rankings, at the top of their card: week, month, two dates or
 * all time; a week or a month is stepped back one at a time (‹ ›), two dates are picked on
 * a calendar.
 */
export default function RankingPeriodPicker({ colors, isDark, today, modes, view, onView, datesSupported }: Props) {
  const { t, i18n } = useTranslation();
  const [isSheetVisible, setSheetVisible] = useState(false);

  const day = (date: string, withYear = false) => parseLocalDateString(date).toLocaleDateString(i18n.language, {
    weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  });
  const days = rankingDays(view, today);
  // The year only when it is not this one
  const withYear = !!days && days.from.slice(0, 4) !== today.slice(0, 4);
  const daysText = !days ? '' : days.from === days.to ? day(days.from, withYear)
    : t('multi.ranking_days', { from: day(days.from, withYear), to: day(days.to, withYear) });

  const stepped = view.mode === 'week' || view.mode === 'month';
  const maxBack = view.mode === 'week' ? MAX_WEEKS_BACK : MAX_MONTHS_BACK;
  const title = view.mode === 'week'
    ? view.offset === 0 ? t('multi.ranking_week_this') : view.offset === -1 ? t('multi.ranking_week_last') : t('multi.ranking_weeks_ago', { count: -view.offset })
    : view.mode === 'month'
      ? parseLocalDateString(shiftMonth(today, view.offset)).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
      : '';
  // A month is named by its name: its days are not needed, how far back it is helps
  const subtitle = view.mode === 'month'
    ? view.offset === 0 ? t('multi.ranking_month_this') : view.offset === -1 ? t('multi.ranking_month_last') : null
    : daysText;

  const pickMode = (mode: RankingMode) => {
    onView({ ...view, mode, offset: 0 });
    if (mode === 'dates' && datesSupported && mode !== view.mode) setSheetVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.segment, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
        {modes.map(mode => {
          const active = mode === view.mode;
          return (
            <Pressable
              key={mode}
              onPress={() => pickMode(mode)}
              style={[styles.segmentItem, active && { backgroundColor: colors.primary }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, { color: active ? colors.onPrimary : colors.text }]} numberOfLines={1}>{t(`multi.ranking_mode.${mode}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      {stepped && (
        <View style={styles.stepper}>
          <StepButton
            colors={colors}
            icon="chevron-back"
            label={t(view.mode === 'week' ? 'multi.ranking_prev_week' : 'archives.prev_month')}
            disabled={view.offset <= -maxBack}
            onPress={() => onView({ ...view, offset: view.offset - 1 })}
          />
          <View style={styles.stepperTexts} accessible accessibilityLiveRegion="polite" accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}>
            <Text style={[styles.stepperTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
            {!!subtitle && <Text style={[styles.stepperSubtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>}
          </View>
          <StepButton
            colors={colors}
            icon="chevron-forward"
            label={t(view.mode === 'week' ? 'multi.ranking_next_week' : 'archives.next_month')}
            disabled={view.offset >= 0}
            onPress={() => onView({ ...view, offset: view.offset + 1 })}
          />
        </View>
      )}

      {view.mode === 'dates' && (datesSupported ? (
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={({ pressed }) => [styles.datesButton, { borderColor: colors.primary, backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`${daysText}, ${t('multi.ranking_dates_change')}`}
        >
          <Ionicons name="calendar-outline" size={RFValue(18)} color={colors.primaryText} />
          <Text style={[styles.datesText, { color: colors.text }]} numberOfLines={2}>{daysText}</Text>
          <Text style={[styles.change, { color: colors.primaryText }]}>{t('multi.ranking_dates_change')}</Text>
        </Pressable>
      ) : (
        <View style={[styles.unsupported, { backgroundColor: colors.neutralSoft }]}>
          <Ionicons name="cloud-offline-outline" size={RFValue(18)} color={colors.textMuted} />
          <Text style={[styles.unsupportedText, { color: colors.textMuted }]}>{t('multi.ranking_dates_unsupported')}</Text>
        </View>
      ))}

      <DateRangeSheet
        visible={isSheetVisible}
        colors={colors}
        isDark={isDark}
        today={today}
        dates={view.dates}
        onClose={() => setSheetVisible(false)}
        onApply={(dates) => { onView({ ...view, dates }); setSheetVisible(false); }}
      />
    </View>
  );
}

function StepButton({ colors, icon, label, disabled, onPress }: {
  colors: UiColors; icon: 'chevron-back' | 'chevron-forward'; label: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.stepButton, { backgroundColor: colors.neutralSoft, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={RFValue(20)} color={colors.text} />
    </Pressable>
  );
}

/** Two dates on a calendar: the first day touched, then the last one */
function DateRangeSheet({ visible, colors, isDark, today, dates, onClose, onApply }: {
  visible: boolean; colors: UiColors; isDark: boolean; today: string;
  dates: { from: string; to: string };
  onClose: () => void;
  onApply: (dates: { from: string; to: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const [from, setFrom] = useState(dates.from);
  const [to, setTo] = useState<string | null>(dates.to);
  const [month, setMonth] = useState(dates.to.slice(0, 7));

  // Opened again: the dates shown are the ones in use
  useEffect(() => {
    if (!visible) return;
    setFrom(dates.from);
    setTo(dates.to);
    setMonth(dates.to.slice(0, 7));
  }, [visible, dates.from, dates.to]);

  const thisMonth = today.slice(0, 7);
  const firstMonth = shiftMonth(today, -MAX_MONTHS_BACK).slice(0, 7);
  const shiftShown = (by: number) => setMonth(shiftMonth(`${month}-01`, by).slice(0, 7));

  const cells = useMemo(() => getMonthGrid(month), [month]);
  const monthTitle = parseLocalDateString(`${month}-01`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const range = to ? orderedDates({ from, to }) : { from, to: from };
  const longDay = (date: string) => parseLocalDateString(date).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const touch = (date: string) => {
    // A new range starts on the first touch, ends on the second
    if (to) {
      setFrom(date);
      setTo(null);
    } else {
      setTo(date);
    }
  };

  const shortDay = (date: string) => parseLocalDateString(date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const summary = range.from === range.to ? shortDay(range.from) : t('multi.ranking_days', { from: shortDay(range.from), to: shortDay(range.to) });

  return (
    <BottomSheet visible={visible} title={t('multi.ranking_dates_title')} colors={colors} isDark={isDark} onClose={onClose} onRequestClose={onClose}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t(to ? 'multi.ranking_dates_hint_start' : 'multi.ranking_dates_hint_end')}</Text>
      <View style={styles.monthRow}>
        <StepButton colors={colors} icon="chevron-back" label={t('archives.prev_month')} disabled={month <= firstMonth} onPress={() => shiftShown(-1)} />
        <Text style={[styles.monthTitle, { color: colors.text }]} accessibilityRole="header">{monthTitle}</Text>
        <StepButton colors={colors} icon="chevron-forward" label={t('archives.next_month')} disabled={month >= thisMonth} onPress={() => shiftShown(1)} />
      </View>
      <View style={styles.row}>
        {WEEK_DAYS.map(d => (
          <Text key={d} style={[styles.weekDay, { color: colors.textMuted }]} importantForAccessibility="no">{t(`profile.${d}`)}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} style={styles.row}>
          {cells.slice(week * 7, week * 7 + 7).map((date, i) => {
            if (!date) return <View key={`empty-${i}`} style={styles.cell} />;
            const future = date > today;
            const edge = date === range.from || date === range.to;
            const inside = date > range.from && date < range.to;
            return (
              <Pressable
                key={date}
                onPress={() => touch(date)}
                disabled={future}
                style={[styles.cell, styles.dayCell, edge ? { backgroundColor: colors.primary } : inside ? { backgroundColor: colors.primarySoft } : null]}
                accessibilityRole="button"
                accessibilityLabel={longDay(date)}
                accessibilityState={{ selected: edge || inside, disabled: future }}
              >
                <Text style={[styles.dayNumber, { color: edge ? colors.onPrimary : colors.text, opacity: future ? 0.3 : 1 }]}>{Number(date.slice(8))}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={[styles.summary, { color: colors.text }]}>{summary}</Text>
      <View style={styles.shortcuts}>
        {[7, 30].map(n => (
          <Pressable
            key={n}
            onPress={() => { setFrom(addDays(today, -(n - 1))); setTo(today); setMonth(thisMonth); }}
            style={[styles.chip, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, { color: colors.text }]}>{t('multi.ranking_dates_last_days', { count: n })}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => onApply(range)}
        style={[styles.apply, { backgroundColor: colors.primary }]}
        accessibilityRole="button"
      >
        <Text style={[styles.applyText, { color: colors.onPrimary }]}>{t('multi.ranking_dates_apply')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: RFValue(8),
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: RFValue(7),
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    marginTop: RFValue(12),
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperTexts: {
    flex: 1,
    alignItems: 'center',
  },
  stepperTitle: {
    fontSize: RFValue(16),
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  stepperSubtitle: {
    fontSize: RFValue(13),
    fontWeight: '600',
    marginTop: 2,
  },
  datesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    marginTop: RFValue(12),
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(12),
  },
  datesText: {
    flex: 1,
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  change: {
    fontSize: RFValue(13),
    fontWeight: '800',
  },
  unsupported: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    marginTop: RFValue(12),
    borderRadius: 12,
    padding: RFValue(12),
  },
  unsupportedText: {
    flex: 1,
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(12),
  },
  chipText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  hint: {
    fontSize: RFValue(14),
    marginBottom: RFValue(10),
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: RFValue(6),
  },
  monthTitle: {
    fontSize: RFValue(16),
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  row: {
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: RFValue(11),
    fontWeight: '600',
    paddingVertical: RFValue(4),
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: RFValue(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    borderRadius: RFValue(8),
  },
  dayNumber: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  summary: {
    fontSize: RFValue(15),
    fontWeight: '800',
    textAlign: 'center',
    marginTop: RFValue(10),
  },
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: RFValue(10),
  },
  apply: {
    marginTop: RFValue(14),
    paddingVertical: RFValue(13),
    borderRadius: 14,
    alignItems: 'center',
  },
  applyText: {
    fontSize: RFValue(16),
    fontWeight: '800',
  },
});
