import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@/components/home/BottomSheet';
import { RFValue } from '@/utils/responsive';
import { addDays, getMonthGrid, parseLocalDateString } from '@/utils/date';
import { orderedDates, rankingDays, type RankingChoice } from '@/utils/multi/rankingPeriod';
import type { UiColors } from '@/theme';

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
/** How far back the calendar of the dates goes */
const MAX_MONTHS_BACK = 36;

interface Props {
  colors: UiColors;
  isDark: boolean;
  /** The day of the current challenge on the server */
  today: string;
  choices: readonly RankingChoice[];
  choice: RankingChoice;
  onChoice: (choice: RankingChoice) => void;
  dates: { from: string; to: string };
  onDates: (dates: { from: string; to: string }) => void;
}

/** The period of the weekly rankings: this week, last week, this month, last month, two dates, all time */
export default function RankingPeriodPicker({ colors, isDark, today, choices, choice, onChoice, dates, onDates }: Props) {
  const { t, i18n } = useTranslation();
  const [isSheetVisible, setSheetVisible] = useState(false);

  const day = (date: string) => parseLocalDateString(date).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
  const days = rankingDays(choice, today, dates);
  const daysText = !days ? t('multi.ranking_period.all')
    : days.from === days.to ? day(days.from) : t('multi.ranking_days', { from: day(days.from), to: day(days.to) });

  const pick = (next: RankingChoice) => {
    onChoice(next);
    if (next === 'dates') setSheetVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {choices.map(c => {
          const active = c === choice;
          return (
            <Pressable
              key={c}
              onPress={() => pick(c)}
              style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : 'transparent' }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              {c === 'dates' && <Ionicons name="calendar-outline" size={RFValue(13)} color={active ? colors.primaryText : colors.text} />}
              <Text style={[styles.chipText, { color: active ? colors.primaryText : colors.text }]}>{t(`multi.ranking_period.${c}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {choice === 'dates' ? (
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={[styles.datesButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`${daysText}, ${t('multi.ranking_dates_change')}`}
        >
          <Text style={[styles.daysText, { color: colors.text }]}>{daysText}</Text>
          <Text style={[styles.change, { color: colors.primaryText }]}>{t('multi.ranking_dates_change')}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.daysText, styles.daysLine, { color: colors.textMuted }]}>{daysText}</Text>
      )}
      <DateRangeSheet
        visible={isSheetVisible}
        colors={colors}
        isDark={isDark}
        today={today}
        dates={dates}
        onClose={() => setSheetVisible(false)}
        onApply={(next) => { onDates(next); setSheetVisible(false); }}
      />
    </View>
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
  const firstMonth = useMemo(() => {
    const d = parseLocalDateString(`${thisMonth}-01`);
    d.setMonth(d.getMonth() - MAX_MONTHS_BACK);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [thisMonth]);
  const shiftMonth = (by: number) => {
    const d = parseLocalDateString(`${month}-01`);
    d.setMonth(d.getMonth() + by);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

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
        <MonthButton colors={colors} icon="chevron-back" label={t('archives.prev_month')} disabled={month <= firstMonth} onPress={() => shiftMonth(-1)} />
        <Text style={[styles.monthTitle, { color: colors.text }]} accessibilityRole="header">{monthTitle}</Text>
        <MonthButton colors={colors} icon="chevron-forward" label={t('archives.next_month')} disabled={month >= thisMonth} onPress={() => shiftMonth(1)} />
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

function MonthButton({ colors, icon, label, disabled, onPress }: {
  colors: UiColors; icon: 'chevron-back' | 'chevron-forward'; label: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.monthButton, { backgroundColor: colors.neutralSoft, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={RFValue(20)} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: RFValue(14),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(12),
  },
  chipText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  daysLine: {
    marginTop: RFValue(8),
    textAlign: 'center',
  },
  daysText: {
    fontSize: RFValue(13),
    fontWeight: '600',
  },
  datesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: RFValue(8),
    marginTop: RFValue(10),
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(12),
  },
  change: {
    fontSize: RFValue(13),
    fontWeight: '800',
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
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
