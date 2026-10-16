import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { RFValue } from '@/utils/responsive';
import { daysBetween, getLocalDateString, getMonthGrid, parseLocalDateString } from '@/utils/date';
import { countArchiveWins, getArchiveDayStatus, getCalendarMonths, isArchiveDateAvailable } from '@/utils/archives';
import type { UiColors } from '@/theme';

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface Props {
  colors: UiColors;
}

/**
 * Streak calendar of the profile, also the way into the archives (see docs/GAME_DESIGN.md):
 * a day won on the day itself is filled with its stars color, a day won as an archive is outlined,
 * a frozen day is blue. Touching a past day replays it.
 */
export default function StreakCalendar({ colors }: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const dailyChallengeProgress = useGameStore((state) => state.dailyChallengeProgress || {});
  const archiveProgress = useGameStore((state) => state.archiveProgress || {});
  const frozenDates = useGameStore((state) => state.frozenDates);
  const frozenSet = useMemo(() => new Set(frozenDates), [frozenDates]);

  const today = useMemo(() => getLocalDateString(), []);
  const months = useMemo(() => getCalendarMonths(today), [today]);
  const [monthIndex, setMonthIndex] = useState(months.length - 1);
  const month = months[monthIndex];
  const cells = useMemo(() => getMonthGrid(month), [month]);
  const monthTitle = parseLocalDateString(`${month}-01`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const archiveWins = countArchiveWins(archiveProgress);

  const starColor = (stars: number) => colors.dailyStars[stars - 1] ?? colors.dailyStars[2];

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <MonthButton
          colors={colors}
          label="‹"
          a11yLabel={t('archives.prev_month')}
          disabled={monthIndex === 0}
          onPress={() => setMonthIndex(i => i - 1)}
        />
        <Text style={[styles.monthTitle, { color: colors.text }]} accessibilityRole="header">{monthTitle}</Text>
        <MonthButton
          colors={colors}
          label="›"
          a11yLabel={t('archives.next_month')}
          disabled={monthIndex === months.length - 1}
          onPress={() => setMonthIndex(i => i + 1)}
        />
      </View>

      <View style={styles.row}>
        {WEEK_DAYS.map((day) => (
          <Text key={day} style={[styles.weekDay, { color: colors.textMuted }]} importantForAccessibility="no">{t(`profile.${day}`)}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} style={styles.row}>
          {cells.slice(week * 7, week * 7 + 7).map((dateKey, i) => {
            if (!dateKey) return <View key={`empty-${i}`} style={styles.cell} />;
            const dayNumber = Number(dateKey.slice(8));
            const isToday = dateKey === today;
            const daily = dailyChallengeProgress[dateKey];
            const status = getArchiveDayStatus(dateKey, dailyChallengeProgress, archiveProgress);
            const frozen = frozenSet.has(dateKey);
            const playable = isArchiveDateAvailable(dateKey, today);
            // Future days, and past days that can't be replayed with nothing to show: the number alone
            if (daysBetween(dateKey, today) < 0 || (!playable && !isToday && status === 'none' && !frozen)) {
              return (
                <View key={dateKey} style={styles.cell} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Text style={[styles.dayNumber, { color: colors.textMuted, opacity: 0.4 }]}>{dayNumber}</Text>
                </View>
              );
            }

            const filled = status === 'daily' ? starColor(daily?.stars ?? 3) : frozen ? colors.frozen : status === 'archive' ? 'transparent' : colors.border;
            const textColor = status === 'daily' && (daily?.stars ?? 3) === 3 ? colors.onPrimary
              : status === 'daily' || frozen ? colors.onLightFill
              : colors.text;
            const cellStyle = [
              styles.cell,
              styles.dayCell,
              { backgroundColor: filled },
              isToday ? { borderWidth: 3, borderColor: colors.primaryText }
                : status === 'archive' ? { borderWidth: 2, borderColor: colors.dailyStars[1] }
                : null,
            ];
            const label = t(`archives.day_${status === 'none' && frozen ? 'frozen' : status}`, {
              date: parseLocalDateString(dateKey).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
            });
            const content = <Text style={[styles.dayNumber, { color: textColor }]}>{dayNumber}</Text>;

            if (!playable) {
              return <View key={dateKey} style={cellStyle} accessible accessibilityLabel={label}>{content}</View>;
            }
            return (
              <Pressable
                key={dateKey}
                onPress={() => router.push(`/game?levelId=archive&date=${dateKey}`)}
                style={({ pressed }) => [...cellStyle, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={t('archives.day_hint')}
              >
                {content}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        <View style={styles.legendItem}>
          <View style={styles.legendStars}>
            {colors.dailyStars.map(color => <View key={color} style={[styles.legendSwatch, { backgroundColor: color }]} />)}
          </View>
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('archives.legend_stars')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { borderWidth: 2, borderColor: colors.dailyStars[1] }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('archives.legend_archive')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.frozen }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('archives.legend_frozen')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.border }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{t('archives.legend_none')}</Text>
        </View>
      </View>

      <View style={[styles.note, { backgroundColor: colors.card }]}>
        <Text style={[styles.noteTitle, { color: colors.text }]}>{t('profile.calendar_hint')}</Text>
        <Text style={[styles.noteText, { color: colors.textMuted }]}>
          {t('profile.calendar_training')} {t('archives.won_count', { count: archiveWins })}.
        </Text>
      </View>
    </View>
  );
}

function MonthButton({ colors, label, a11yLabel, disabled, onPress }: {
  colors: UiColors; label: string; a11yLabel: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.monthButton, { backgroundColor: colors.card, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.monthButtonText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: RFValue(4),
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
  monthButtonText: {
    fontSize: RFValue(22),
    fontWeight: '600',
    marginTop: -2,
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RFValue(10),
    marginTop: RFValue(8),
    paddingTop: RFValue(12),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(6),
  },
  legendStars: {
    flexDirection: 'row',
    gap: 2,
  },
  legendSwatch: {
    width: RFValue(12),
    height: RFValue(12),
    borderRadius: RFValue(3),
  },
  legendText: {
    fontSize: RFValue(12),
  },
  note: {
    marginTop: RFValue(10),
    padding: RFValue(12),
    borderRadius: RFValue(12),
    gap: RFValue(4),
  },
  noteTitle: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  noteText: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
  },
});
