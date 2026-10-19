import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration, parseLocalDateString } from '@/utils/date';
import type { DayRow, Leaderboard as Board, MultiApi, Period, PeriodRow } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { weekCells, type DayCell } from '@/utils/multi/week';
import { multiErrorMessage } from './errors';
import { reasonsText, verdictIcon } from './verdict';

/** The player of a row, for the actions on them (watch the game, report, block) */
export interface RowPlayer { playerId: number; pseudo: string; attemptId?: number; won: boolean }

interface Props {
  api: MultiApi;
  colors: UiColors;
  myPlayerId: number;
  /** Changes when the results may have changed (a game just ended, the screen came back) */
  refreshKey: number;
  /** Players hidden on this phone */
  blocked: number[];
  onRowPress: (player: RowPlayer) => void;
  /** The periods offered, the first one shown first */
  periods?: readonly Period[];
  /** Shown instead of the default title */
  title?: string;
  /** The challenge being played: the week shows each day up to it */
  currentDate?: string;
}

const PERIODS: Period[] = ['day', 'week', 'month'];

/** Rankings of the day (moves then time), of the week and of the month (points) */
export default function Leaderboard({ api, colors, myPlayerId, refreshKey, blocked, onRowPress, periods = PERIODS, title, currentDate }: Props) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<Period>(periods[0]);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBoard(await api.leaderboard(period));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, period]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const statusText = (row: DayRow) =>
    row.status === 'won' ? `${t('multi.moves', { count: row.moves ?? 0 })} · ${formatDuration(row.timeMs ?? 0)}`
      : t(`multi.status.${row.status}`);

  const dayLabel = (row: DayRow) => [
    row.rank ? t('multi.rank_a11y', { rank: row.rank }) : null,
    row.pseudo,
    row.playerId === myPlayerId ? t('multi.you') : null,
    statusText(row),
    row.status === 'won' ? t('multi.points', { count: row.points }) : null,
    row.verdict === 'cheater' ? t('multi.cheater') : null,
    row.verdict === 'suspect' ? `${t('multi.suspect')} : ${reasonsText(t, row.reasons)}` : null,
  ].filter(Boolean).join(', ');

  const initials = t('multi.weekday_initials').split(' ');
  const cellText = (cell: DayCell) =>
    cell.kind === 'points' ? String(cell.points) : cell.kind === 'playing' ? '…' : cell.kind === 'missed' ? '–' : '·';
  /** The days of the week of a row, when the server sends them */
  const cellsOf = (row: PeriodRow) =>
    board?.period === 'week' && row.days && currentDate ? weekCells(board.from, row.days, currentDate) : null;
  const cellLabel = (cell: DayCell) => {
    const day = parseLocalDateString(cell.date).toLocaleDateString(i18n.language, { weekday: 'long' });
    if (cell.kind === 'upcoming') return null;
    const value = cell.kind === 'points' ? t('multi.points', { count: cell.points })
      : cell.kind === 'playing' ? t('multi.status.playing') : t('multi.not_played');
    return t('multi.week_day_a11y', { day, value });
  };

  const periodLabel = (row: PeriodRow) => [
    t('multi.rank_a11y', { rank: row.rank }), row.pseudo, row.playerId === myPlayerId ? t('multi.you') : null,
    t('multi.points', { count: row.points }), t('multi.wins', { count: row.wins }),
    ...(cellsOf(row)?.map(cellLabel) ?? []),
  ].filter(Boolean).join(', ');

  const visible = <T extends { playerId: number }>(list: T[]) => list.filter(r => !blocked.includes(r.playerId));
  const rows = board && board.period === period ? visible(board.rows as { playerId: number }[]) : [];
  const hidden = board && board.period === period ? board.rows.length - rows.length : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title ?? t('multi.leaderboard')}</Text>
      {periods.length > 1 && <View style={[styles.tabs, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
        {periods.map(p => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.tab, p === period && { backgroundColor: colors.primary }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: p === period }}
          >
            <Text style={[styles.tabText, { color: p === period ? colors.onPrimary : colors.text }]}>{t(`multi.period.${p}`)}</Text>
          </Pressable>
        ))}
      </View>}

      {loading && <ActivityIndicator color={colors.primary} style={styles.state} />}
      {!loading && !!error && (
        <Pressable onPress={load} accessibilityRole="button" style={styles.state}>
          <Text style={[styles.muted, { color: colors.danger }]}>{multiErrorMessage(t, error)}</Text>
          <Text style={[styles.retry, { color: colors.primaryText }]}>{t('multi.retry')}</Text>
        </Pressable>
      )}
      {!loading && !error && rows.length === 0 && (
        <Text style={[styles.muted, styles.state, { color: colors.textMuted }]}>{t('multi.leaderboard_empty')}</Text>
      )}

      {!loading && !error && board?.period === 'day' && visible(board.rows as DayRow[]).map(row => {
        const mine = row.playerId === myPlayerId;
        const cheater = row.verdict === 'cheater';
        return (
          <Pressable
            key={row.playerId}
            onPress={() => onRowPress({ playerId: row.playerId, pseudo: row.pseudo, attemptId: row.attemptId, won: row.status === 'won' })}
            style={[styles.rowWrap, mine && { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel={dayLabel(row)}
          >
            <View style={styles.row}>
              <Text style={[styles.rank, { color: colors.textMuted }]}>{row.rank ?? '–'}</Text>
              {row.verdict && <Ionicons name={verdictIcon(row.verdict)} size={RFValue(15)} color={cheater ? colors.danger : colors.warning} />}
              <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{row.pseudo}</Text>
              <Text style={[styles.detail, { color: row.status === 'won' ? colors.text : colors.textMuted }, cheater && styles.struck]}>{statusText(row)}</Text>
              <Text style={[styles.score, { color: cheater ? colors.danger : colors.primaryText }]}>{row.status === 'won' ? `+${row.points}` : ''}</Text>
            </View>
            {row.verdict === 'suspect' && (
              <Text style={[styles.reason, { color: colors.warning }]} numberOfLines={2}>{reasonsText(t, row.reasons)}</Text>
            )}
            {cheater && <Text style={[styles.reason, { color: colors.danger }]}>{t('multi.cheater_note')}</Text>}
          </Pressable>
        );
      })}

      {!loading && !error && board && board.period !== 'day' && visible(board.rows as PeriodRow[]).map(row => {
        const mine = row.playerId === myPlayerId;
        const cells = cellsOf(row);
        return (
          <Pressable
            key={row.playerId}
            onPress={() => onRowPress({ playerId: row.playerId, pseudo: row.pseudo, won: false })}
            style={[styles.rowWrap, mine && { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel={periodLabel(row)}
          >
            <View style={styles.row}>
              <Text style={[styles.rank, { color: colors.textMuted }]}>{row.rank}</Text>
              <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{row.pseudo}</Text>
              <Text style={[styles.detail, { color: colors.textMuted }]}>{t('multi.wins', { count: row.wins })}</Text>
              <Text style={[styles.score, { color: colors.primaryText }]}>{t('multi.points_short', { count: row.points })}</Text>
            </View>
            {cells && (
              <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {cells.map((cell, i) => (
                  <View key={cell.date} style={styles.weekDay}>
                    <Text style={[styles.weekInitial, { color: colors.textMuted }]}>{initials[i]}</Text>
                    <Text style={[styles.weekPoints, { color: cell.kind === 'points' && cell.points > 0 ? colors.primaryText : colors.textMuted }]}>
                      {cellText(cell)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}

      {hidden > 0 && <Text style={[styles.hidden, { color: colors.textMuted }]}>{t('multi.blocked_hidden', { count: hidden })}</Text>}
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
  title: {
    fontSize: RFValue(17),
    fontWeight: '800',
    marginBottom: RFValue(10),
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: RFValue(10),
  },
  tab: {
    flex: 1,
    paddingVertical: RFValue(7),
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: RFValue(13),
    fontWeight: '700',
  },
  state: {
    paddingVertical: RFValue(16),
    alignItems: 'center',
  },
  muted: {
    fontSize: RFValue(14),
    textAlign: 'center',
  },
  retry: {
    fontSize: RFValue(14),
    fontWeight: '700',
    marginTop: 6,
  },
  rowWrap: {
    paddingVertical: RFValue(9),
    paddingHorizontal: RFValue(8),
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  reason: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: 2,
    marginLeft: RFValue(32),
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  hidden: {
    fontSize: RFValue(12),
    textAlign: 'center',
    marginTop: RFValue(8),
  },
  week: {
    flexDirection: 'row',
    marginTop: RFValue(4),
    marginLeft: RFValue(32),
    marginRight: RFValue(4),
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekInitial: {
    fontSize: RFValue(10),
    fontWeight: '700',
  },
  weekPoints: {
    fontSize: RFValue(13),
    fontWeight: '800',
  },
  rank: {
    width: RFValue(24),
    fontSize: RFValue(14),
    fontWeight: '800',
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
});
