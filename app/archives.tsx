import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { RFValue } from '@/utils/responsive';
import { getLocalDateString, parseLocalDateString } from '@/utils/date';
import {
  ArchiveDayStatus, countArchiveWins, getArchiveDates, getArchiveDayStatus, groupArchiveDatesByMonth, isArchiveDateAvailable,
} from '@/utils/archives';
import { useTheme } from '@/theme';

/** Past dailies, replayed as training (see docs/GAME_DESIGN.md) */
export default function ArchivesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const dailyChallengeProgress = useGameStore((state) => state.dailyChallengeProgress || {});
  const archiveProgress = useGameStore((state) => state.archiveProgress || {});

  const today = useMemo(() => getLocalDateString(), []);
  const months = useMemo(() => groupArchiveDatesByMonth(getArchiveDates(today)), [today]);
  const archiveWins = countArchiveWins(archiveProgress);

  const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => t(`profile.${d}`));
  const statusColor = (status: ArchiveDayStatus, dateKey: string) => {
    if (status === 'daily') return colors.dailyStars[(dailyChallengeProgress[dateKey]?.stars ?? 3) - 1] ?? colors.dailyStars[2];
    if (status === 'archive') return colors.success;
    return colors.border;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('archives.title')}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.primaryText, fontSize: RFValue(16), fontWeight: '600' }}>{t('common.close')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('archives.subtitle')}</Text>
        <Text style={[styles.count, { color: colors.text }]}>🗄️ {t('archives.won_count', { count: archiveWins })}</Text>

        <View style={styles.legend}>
          {(['daily', 'archive', 'none'] as const).map(status => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColor(status, '') }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>{t(`archives.legend_${status}`)}</Text>
            </View>
          ))}
        </View>

        {months.length === 0 && (
          <Text style={[styles.empty, { color: colors.textMuted }]}>{t('archives.empty')}</Text>
        )}

        {months.map(({ month }, index) => {
          const [year, monthIndex] = month.split('-').map(Number);
          const first = new Date(year, monthIndex - 1, 1);
          const daysInMonth = new Date(year, monthIndex, 0).getDate();
          // Monday-first offset of the 1st of the month
          const offset = (first.getDay() + 6) % 7;
          const cells: (string | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
          ];
          while (cells.length % 7 !== 0) cells.push(null);
          const monthTitle = first.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

          return (
            <Animated.View
              key={month}
              entering={FadeInDown.delay(50 + index * 50).duration(400)}
              style={[styles.monthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.monthTitle, { color: colors.text }]} accessibilityRole="header">{monthTitle}</Text>
              <View style={styles.row}>
                {weekDays.map((day, i) => (
                  <Text key={i} style={[styles.weekDay, { color: colors.textMuted }]}>{day}</Text>
                ))}
              </View>
              {Array.from({ length: cells.length / 7 }, (_, week) => (
                <View key={week} style={styles.row}>
                  {cells.slice(week * 7, week * 7 + 7).map((dateKey, i) => {
                    if (!dateKey) return <View key={`empty-${i}`} style={styles.cell} />;
                    const dayNumber = Number(dateKey.slice(8));
                    if (!isArchiveDateAvailable(dateKey, today)) {
                      return (
                        <View key={dateKey} style={styles.cell} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                          <Text style={[styles.dayNumber, { color: colors.textMuted, opacity: 0.35 }]}>{dayNumber}</Text>
                        </View>
                      );
                    }
                    const status = getArchiveDayStatus(dateKey, dailyChallengeProgress, archiveProgress);
                    const label = parseLocalDateString(dateKey).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
                    return (
                      <Pressable
                        key={dateKey}
                        onPress={() => router.push(`/game?levelId=archive&date=${dateKey}`)}
                        style={({ pressed }) => [styles.cell, styles.dayCell, { backgroundColor: statusColor(status, dateKey), opacity: pressed ? 0.6 : 1 }]}
                        accessibilityRole="button"
                        accessibilityLabel={t(`archives.day_${status}`, { date: label })}
                        accessibilityHint={t('archives.day_hint')}
                      >
                        <Text style={[styles.dayNumber, { color: status === 'none' ? colors.text : colors.onPrimary }]}>{dayNumber}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: RFValue(50),
    paddingBottom: RFValue(15),
    borderBottomWidth: 1,
    position: 'relative',
  },
  title: {
    fontSize: RFValue(20),
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: RFValue(20),
    bottom: RFValue(15),
    padding: RFValue(5),
  },
  scrollContent: {
    padding: RFValue(20),
    paddingBottom: RFValue(40),
  },
  subtitle: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    marginBottom: RFValue(12),
  },
  count: {
    fontSize: RFValue(16),
    fontWeight: '700',
    marginBottom: RFValue(12),
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RFValue(12),
    marginBottom: RFValue(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: RFValue(12),
    height: RFValue(12),
    borderRadius: RFValue(3),
    marginRight: RFValue(6),
  },
  legendText: {
    fontSize: RFValue(12),
  },
  empty: {
    fontSize: RFValue(14),
    textAlign: 'center',
    marginTop: RFValue(24),
  },
  monthCard: {
    padding: RFValue(12),
    borderRadius: RFValue(12),
    borderWidth: 1,
    marginBottom: RFValue(16),
  },
  monthTitle: {
    fontSize: RFValue(16),
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: RFValue(8),
  },
  row: {
    flexDirection: 'row',
    marginBottom: RFValue(4),
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: RFValue(11),
    fontWeight: '600',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: RFValue(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    borderRadius: RFValue(6),
  },
  dayNumber: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
});
