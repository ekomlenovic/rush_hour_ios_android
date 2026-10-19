import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { addDays, parseLocalDateString } from '@/utils/date';
import type { MultiApi, PeriodRow } from '@/utils/multi/api';
import { mondayOf } from '@/utils/multi/week';
import type { UiColors } from '@/theme';
import type { RowPlayer } from './Leaderboard';

interface Props {
  api: MultiApi;
  colors: UiColors;
  myPlayerId: number;
  refreshKey: number;
  /** Players hidden on this phone */
  blocked: number[];
  /** The challenge being played: the recap is of the week before its own */
  currentDate: string;
  onRowPress: (player: RowPlayer) => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** The final ranking of the challenges of last week: its podium, and my place */
export default function WeekRecap({ api, colors, myPlayerId, refreshKey, blocked, currentDate, onRowPress }: Props) {
  const { t, i18n } = useTranslation();
  const lastWeek = addDays(mondayOf(currentDate), -7);
  const [week, setWeek] = useState<{ from: string; to: string; rows: PeriodRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A bonus: nothing is shown while it loads or if it fails
    api.leaderboard('week', lastWeek)
      .then(board => { if (!cancelled && board.period === 'week') setWeek(board); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [api, lastWeek, refreshKey]);

  if (!week || week.from !== lastWeek) return null;
  const rows = week.rows.filter(r => !blocked.includes(r.playerId));
  if (rows.length === 0) return null;

  const podium = rows.filter(r => r.rank <= MEDALS.length);
  const me = rows.find(r => r.playerId === myPlayerId);
  const date = (d: string) => parseLocalDateString(d).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={RFValue(18)} color={colors.warning} />
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('multi.recap_title')}</Text>
      </View>
      <Text style={[styles.dates, { color: colors.textMuted }]}>{t('multi.recap_dates', { from: date(week.from), to: date(week.to) })}</Text>

      {podium.map(row => (
        <Pressable
          key={row.playerId}
          onPress={() => onRowPress({ playerId: row.playerId, pseudo: row.pseudo, won: false })}
          style={[styles.row, row.playerId === myPlayerId && { backgroundColor: colors.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel={[
            t('multi.rank_a11y', { rank: row.rank }), row.pseudo, row.playerId === myPlayerId ? t('multi.you') : null,
            t('multi.points', { count: row.points }), t('multi.wins', { count: row.wins }),
          ].filter(Boolean).join(', ')}
        >
          <Text style={styles.medal}>{MEDALS[row.rank - 1]}</Text>
          <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{row.pseudo}</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>{t('multi.wins', { count: row.wins })}</Text>
          <Text style={[styles.score, { color: colors.primaryText }]}>{t('multi.points_short', { count: row.points })}</Text>
        </Pressable>
      ))}

      <Text style={[styles.me, { color: me ? colors.text : colors.textMuted }]}>
        {me
          ? t('multi.recap_me', { rank: me.rank, points: t('multi.points', { count: me.points }), wins: t('multi.wins', { count: me.wins }) })
          : t('multi.recap_absent')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: RFValue(14),
    marginTop: RFValue(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  title: {
    fontSize: RFValue(17),
    fontWeight: '800',
  },
  dates: {
    fontSize: RFValue(13),
    fontWeight: '600',
    marginTop: 2,
    marginBottom: RFValue(8),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
    paddingVertical: RFValue(7),
    paddingHorizontal: RFValue(8),
    borderRadius: 10,
  },
  medal: {
    width: RFValue(24),
    fontSize: RFValue(16),
    textAlign: 'center',
  },
  pseudo: {
    flex: 1,
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  detail: {
    fontSize: RFValue(13),
    fontWeight: '600',
  },
  score: {
    minWidth: RFValue(44),
    textAlign: 'right',
    fontSize: RFValue(14),
    fontWeight: '800',
  },
  me: {
    fontSize: RFValue(14),
    fontWeight: '700',
    marginTop: RFValue(8),
    textAlign: 'center',
  },
});
