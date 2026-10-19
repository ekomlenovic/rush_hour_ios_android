import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { addDays, daysBetween, getMonthGrid, parseLocalDateString } from '@/utils/date';
import {
  MAX_MONTHS_BACK, isPeriodOver, orderedDates, rankingDays, shiftMonth, stripOffsets, type RankingMode, type RankingView,
} from '@/utils/multi/rankingPeriod';
import type { UiColors } from '@/theme';

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface Props {
  colors: UiColors;
  isDark: boolean;
  /** The day of the current challenge on the server */
  today: string;
  view: RankingView;
  onView: (view: RankingView) => void;
  /** The server can rank between two dates */
  datesSupported: boolean;
}

/**
 * The period of the weekly rankings, at the top of their card (the kind of period, week,
 * month, two dates or all time, is chosen by the RankingModeButton next to its title).
 * Weeks and months are a strip of chips, the current one first: a past one is a touch away,
 * and so is the way back. Under it, whether the ranking is still going or final, and its
 * days. Two dates are picked on a calendar.
 */
export default function RankingPeriodPicker({ colors, isDark, today, view, onView, datesSupported }: Props) {
  const { t, i18n } = useTranslation();
  const [isSheetVisible, setSheetVisible] = useState(false);
  const strip = useRef<ScrollView>(null);
  const chipX = useRef<Record<number, number>>({});

  const locale = i18n.language;
  const day = (date: string, withYear = false) => parseLocalDateString(date).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
  });
  const days = rankingDays(view, today);
  // The year only when it is not this one
  const withYear = !!days && days.from.slice(0, 4) !== today.slice(0, 4);
  const daysText = !days ? '' : days.from === days.to ? day(days.from, withYear)
    : t('multi.ranking_days', { from: day(days.from, withYear), to: day(days.to, withYear) });

  const stepped = view.mode === 'week' || view.mode === 'month';
  const offsets = stepped ? stripOffsets(view.mode as 'week' | 'month') : [];
  const chipLabel = (offset: number) => {
    const chip = { ...view, offset };
    if (view.mode === 'week') {
      if (offset === 0) return t('multi.ranking_week_this');
      if (offset === -1) return t('multi.ranking_week_last');
      return spanLabel(rankingDays(chip, today)!, today, locale);
    }
    if (offset === 0) return t('multi.ranking_month_this');
    const first = shiftMonth(today, offset);
    const name = parseLocalDateString(first).toLocaleDateString(locale, first.slice(0, 4) === today.slice(0, 4) ? { month: 'long' } : { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // The chip chosen stays in sight, wherever it was chosen from (the recap banner, a touch)
  useEffect(() => {
    if (!stepped) return;
    const x = view.offset === 0 ? 0 : chipX.current[view.offset];
    if (x !== undefined) strip.current?.scrollTo({ x: Math.max(0, x - RFValue(40)), animated: true });
  }, [stepped, view.mode, view.offset]);

  // Dates just chosen: straight to the calendar
  const previousMode = useRef(view.mode);
  useEffect(() => {
    if (view.mode === 'dates' && previousMode.current !== 'dates' && datesSupported) setSheetVisible(true);
    previousMode.current = view.mode;
  }, [view.mode, datesSupported]);

  const over = isPeriodOver(view, today);
  const daysLeft = days ? daysBetween(today, days.to) + 1 : 0;
  const showStatus = !!days && (view.mode !== 'dates' || datesSupported);

  return (
    <View style={styles.container}>
      {stepped && (
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          accessibilityRole="radiogroup"
        >
          {offsets.map(offset => {
            const active = offset === view.offset;
            return (
              <Pressable
                key={offset}
                onLayout={e => { chipX.current[offset] = e.nativeEvent.layout.x; }}
                onPress={() => onView({ ...view, offset })}
                style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.text }]}>{chipLabel(offset)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
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

      {showStatus && (
        <View style={styles.status}>
          <View style={styles.statusTexts} accessible accessibilityLiveRegion="polite">
            <View style={[styles.badge, { backgroundColor: over ? colors.neutralSoft : colors.primarySoft }]}>
              <Ionicons name={over ? 'flag' : 'time-outline'} size={RFValue(12)} color={over ? colors.textMuted : colors.primaryText} />
              <Text style={[styles.badgeText, { color: over ? colors.textMuted : colors.primaryText }]} numberOfLines={1}>
                {over ? t('multi.ranking_final') : t('multi.ranking_live', { count: daysLeft })}
              </Text>
            </View>
            {stepped && <Text style={[styles.statusDays, { color: colors.textMuted }]} numberOfLines={1}>{spanLabel(days!, today, locale)}</Text>}
          </View>
          {stepped && view.offset !== 0 && (
            <Pressable
              onPress={() => onView({ ...view, offset: 0 })}
              hitSlop={8}
              style={({ pressed }) => [styles.back, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t(view.mode === 'week' ? 'multi.ranking_back_week' : 'multi.ranking_back_month')}
            >
              <Ionicons name="arrow-undo" size={RFValue(14)} color={colors.primaryText} />
              <Text style={[styles.backText, { color: colors.primaryText }]}>{t(view.mode === 'week' ? 'multi.ranking_week_this' : 'multi.ranking_month_this')}</Text>
            </Pressable>
          )}
        </View>
      )}

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

/** The kind of period, next to the title of the ranking: a button that opens the choices */
export function RankingModeButton({ colors, isDark, modes, mode, onMode }: {
  colors: UiColors; isDark: boolean;
  modes: readonly RankingMode[];
  mode: RankingMode;
  onMode: (mode: RankingMode) => void;
}) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.modeButton, { backgroundColor: colors.neutralSoft, opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={t('multi.ranking_mode_a11y', { mode: t(`multi.ranking_mode.${mode}`) })}
      >
        <Ionicons name={MODE_ICONS[mode]} size={RFValue(14)} color={colors.text} />
        <Text style={[styles.modeButtonText, { color: colors.text }]}>{t(`multi.ranking_mode.${mode}`)}</Text>
        <Ionicons name="chevron-down" size={RFValue(14)} color={colors.textMuted} />
      </Pressable>
      <BottomSheet visible={isOpen} title={t('multi.ranking_mode_title')} colors={colors} isDark={isDark} onClose={() => setOpen(false)} onRequestClose={() => setOpen(false)}>
        {modes.map(m => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              onPress={() => { onMode(m); setOpen(false); }}
              style={({ pressed }) => [styles.modeRow, { backgroundColor: active ? colors.primarySoft : 'transparent', opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <View style={[styles.modeIcon, { backgroundColor: active ? colors.primary : colors.neutralSoft }]}>
                <Ionicons name={MODE_ICONS[m]} size={RFValue(18)} color={active ? colors.onPrimary : colors.text} />
              </View>
              <View style={styles.modeTexts}>
                <Text style={[styles.modeLabel, { color: colors.text }]}>{t(`multi.ranking_mode.${m}`)}</Text>
                <Text style={[styles.modeDesc, { color: colors.textMuted }]}>{t(`multi.ranking_mode_desc.${m}`)}</Text>
              </View>
              {active && <Ionicons name="checkmark" size={RFValue(20)} color={colors.primaryText} />}
            </Pressable>
          );
        })}
      </BottomSheet>
    </>
  );
}

const MODE_ICONS: Record<RankingMode, 'calendar-outline' | 'calendar-number-outline' | 'options-outline' | 'infinite-outline'> = {
  week: 'calendar-outline',
  month: 'calendar-number-outline',
  dates: 'options-outline',
  all: 'infinite-outline',
};

/** Days in short: '12–18 oct.', '28 sept. – 4 oct.', with the year when not this one */
function spanLabel(days: { from: string; to: string }, today: string, locale: string): string {
  const from = parseLocalDateString(days.from);
  const to = parseLocalDateString(days.to);
  const year = days.to.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' as const } : {};
  const end = to.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...year });
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${end}`
    : `${from.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${end}`;
}

/** Previous or next month of the calendar */
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
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    marginHorizontal: -RFValue(14),
  },
  stripContent: {
    paddingHorizontal: RFValue(14),
    gap: 8,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    marginTop: RFValue(12),
  },
  statusTexts: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  statusDays: {
    flexShrink: 1,
    fontSize: RFValue(13),
    fontWeight: '600',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(10),
  },
  modeButtonText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(12),
    borderRadius: 14,
    padding: RFValue(10),
    marginBottom: RFValue(4),
  },
  modeIcon: {
    width: RFValue(38),
    height: RFValue(38),
    borderRadius: RFValue(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTexts: {
    flex: 1,
  },
  modeLabel: {
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  modeDesc: {
    fontSize: RFValue(13),
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: RFValue(8),
  },
  badgeText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: RFValue(7),
    paddingHorizontal: RFValue(11),
  },
  backText: {
    fontSize: RFValue(13),
    fontWeight: '800',
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
