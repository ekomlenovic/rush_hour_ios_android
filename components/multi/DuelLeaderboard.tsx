import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { rankingParams, type DuelLeaderboard as Board, type MultiApi, type RankingQuery } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from './errors';
import type { RowPlayer } from './Leaderboard';

interface Props {
  api: MultiApi;
  colors: UiColors;
  myPlayerId: number;
  refreshKey: number;
  /** Players hidden on this phone */
  blocked: number[];
  onRowPress: (player: RowPlayer) => void;
  /** The ranking shown: week, month, two dates or all time */
  query: RankingQuery;
}

/** Duel rankings of a week, a month, two dates or of all time: wins, then fewer losses */
export default function DuelLeaderboard({ api, colors, myPlayerId, refreshKey, blocked, onRowPress, query }: Props) {
  const { t } = useTranslation();
  const params = rankingParams(query);
  // The board with the query it answers: an answer to an older query is not shown
  const [board, setBoard] = useState<{ params: string; data: Board } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBoard({ params, data: await api.duelLeaderboard(query) });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, params]); // params describes the query

  useEffect(() => { void load(); }, [load, refreshKey]);

  const rows = board?.params === params ? board.data.rows.filter(r => !blocked.includes(r.playerId)) : [];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('multi.duel.ranking')}</Text>

      {rows.length > 0 && (
        <View style={styles.head}>
          <View style={styles.rank} />
          <View style={styles.headWide} />
          <Text style={[styles.headText, { color: colors.textMuted }]}>{t('multi.duel.wins_short')}</Text>
          <Text style={[styles.headText, { color: colors.textMuted }]}>{t('multi.duel.losses_short')}</Text>
          <Text style={[styles.headText, { color: colors.textMuted }]}>{t('multi.duel.draws_short')}</Text>
        </View>
      )}

      {loading && <ActivityIndicator color={colors.primary} style={styles.state} />}
      {!loading && !!error && (
        <Pressable onPress={load} accessibilityRole="button" style={styles.state}>
          <Text style={[styles.muted, { color: colors.danger }]}>{multiErrorMessage(t, error)}</Text>
          <Text style={[styles.retry, { color: colors.primaryText }]}>{t('multi.retry')}</Text>
        </Pressable>
      )}
      {!loading && !error && rows.length === 0 && (
        <Text style={[styles.muted, styles.state, { color: colors.textMuted }]}>{t('multi.duel.ranking_empty')}</Text>
      )}

      {!loading && !error && rows.map(row => {
        const mine = row.playerId === myPlayerId;
        return (
          <Pressable
            key={row.playerId}
            onPress={() => onRowPress({ playerId: row.playerId, pseudo: row.pseudo, won: false })}
            style={[styles.row, mine && { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel={[
              t('multi.rank_a11y', { rank: row.rank }), row.pseudo, mine ? t('multi.you') : null,
              t('multi.duel.record_a11y', { wins: row.wins, losses: row.losses, draws: row.draws }),
            ].filter(Boolean).join(', ')}
          >
            <Text style={[styles.rank, { color: colors.textMuted }]}>{row.rank}</Text>
            <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{row.pseudo}</Text>
            <Text style={[styles.cell, styles.wins, { color: colors.success }]}>{row.wins}</Text>
            <Text style={[styles.cell, { color: colors.danger }]}>{row.losses}</Text>
            <Text style={[styles.cell, { color: colors.textMuted }]}>{row.draws}</Text>
          </Pressable>
        );
      })}
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
  head: {
    flexDirection: 'row',
    gap: RFValue(8),
    paddingHorizontal: RFValue(8),
    marginBottom: 2,
  },
  headWide: {
    flex: 1,
  },
  headText: {
    width: RFValue(34),
    textAlign: 'center',
    fontSize: RFValue(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
    paddingVertical: RFValue(9),
    paddingHorizontal: RFValue(8),
    borderRadius: 10,
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
  cell: {
    width: RFValue(34),
    textAlign: 'center',
    fontSize: RFValue(15),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  wins: {
    fontWeight: '900',
  },
});
