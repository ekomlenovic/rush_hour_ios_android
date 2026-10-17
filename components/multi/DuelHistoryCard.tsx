import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import type { DuelHistoryItem, DuelRecordLine, MultiApi } from '@/utils/multi/api';
import type { UiColors } from '@/theme';
import { multiErrorMessage } from './errors';

/** Duels shown before "show more" */
const SHORT_LIST = 5;

interface Props {
  api: MultiApi;
  colors: UiColors;
  myPlayerId: number;
  /** Changes when the screen comes back (a duel may just have ended) */
  refreshKey: number;
  onReplay: (duelId: number) => void;
}

/** My duels: my score against each opponent, and the last duels with their replay */
export default function DuelHistoryCard({ api, colors, myPlayerId, refreshKey, onReplay }: Props) {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<{ duels: DuelHistoryItem[]; records: DuelRecordLine[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await api.duelHistory());
    } catch (e) {
      setError(e);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const when = (at: number) => new Date(at).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const shown = history ? (expanded ? history.duels : history.duels.slice(0, SHORT_LIST)) : [];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('multi.duel.history_title')}</Text>

      {!history && !error && <ActivityIndicator color={colors.primary} style={styles.state} />}
      {!!error && (
        <Pressable onPress={load} accessibilityRole="button" style={styles.state}>
          <Text style={[styles.muted, { color: colors.danger }]}>{multiErrorMessage(t, error)}</Text>
          <Text style={[styles.retry, { color: colors.primaryText }]}>{t('multi.retry')}</Text>
        </Pressable>
      )}
      {history && history.duels.length === 0 && (
        <Text style={[styles.muted, styles.state, { color: colors.textMuted }]}>{t('multi.duel.history_empty')}</Text>
      )}

      {history && history.records.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.records}>
          {history.records.map(r => {
            const ahead = r.wins > r.losses ? colors.success : r.wins < r.losses ? colors.danger : colors.textMuted;
            return (
              <View
                key={r.opponent.id}
                style={[styles.record, { backgroundColor: colors.card }]}
                accessible
                accessibilityLabel={`${r.opponent.pseudo}, ${t('multi.duel.record_a11y', { wins: r.wins, losses: r.losses, draws: r.draws })}`}
              >
                <Text style={[styles.recordName, { color: colors.textMuted }]} numberOfLines={1}>{t('multi.duel.against', { pseudo: r.opponent.pseudo })}</Text>
                <Text style={[styles.recordScore, { color: ahead }]}>{r.wins} – {r.losses}</Text>
                {r.draws > 0 && <Text style={[styles.recordDraws, { color: colors.textMuted }]}>{t('multi.duel.draws', { count: r.draws })}</Text>}
              </View>
            );
          })}
        </ScrollView>
      )}

      {shown.map(d => {
        const outcome = d.winnerId === null ? 'draw' : d.winnerId === myPlayerId ? 'win' : 'loss';
        const icon = outcome === 'win' ? 'trophy' : outcome === 'loss' ? 'close-circle' : 'remove-circle';
        const tint = outcome === 'win' ? colors.success : outcome === 'loss' ? colors.danger : colors.textMuted;
        const detail = [
          when(d.endedAt),
          t(`difficulty.${d.difficulty}`),
          t(`multi.duel.metric_${d.metric ?? 'time'}`),
          t('multi.duel.moves_pair', { me: d.myMoves, them: d.theirMoves }),
          d.timeMs !== null ? formatDuration(d.timeMs) : t(`multi.duel.reason_short_${d.reason}`),
        ].join(' · ');
        return (
          <View key={d.id} style={styles.row}>
            <Ionicons name={icon} size={RFValue(22)} color={tint} />
            <View style={styles.rowMain} accessible accessibilityLabel={`${t(`multi.duel.outcome_${outcome}`, { pseudo: d.opponent.pseudo })}, ${detail}`}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{t(`multi.duel.outcome_${outcome}`, { pseudo: d.opponent.pseudo })}</Text>
              <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={2}>{detail}</Text>
            </View>
            {d.hasReplay && (
              <Pressable
                onPress={() => onReplay(d.id)}
                style={[styles.replay, { backgroundColor: colors.primarySoft }]}
                accessibilityRole="button"
                accessibilityLabel={t('multi.duel.watch_replay')}
                hitSlop={6}
              >
                <Ionicons name="play" size={22} color={colors.primaryText} />
              </Pressable>
            )}
          </View>
        );
      })}

      {history && history.duels.length > SHORT_LIST && (
        <Pressable onPress={() => setExpanded(e => !e)} style={styles.more} accessibilityRole="button">
          <Text style={[styles.moreText, { color: colors.primaryText }]}>{expanded ? t('multi.duel.show_less') : t('multi.duel.show_more')}</Text>
        </Pressable>
      )}
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
  records: {
    gap: RFValue(8),
    paddingBottom: RFValue(8),
  },
  record: {
    borderRadius: 12,
    paddingVertical: RFValue(8),
    paddingHorizontal: RFValue(12),
    minWidth: RFValue(92),
    alignItems: 'center',
  },
  recordName: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  recordScore: {
    fontSize: RFValue(20),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  recordDraws: {
    fontSize: RFValue(11),
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    paddingVertical: RFValue(9),
    paddingHorizontal: RFValue(4),
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  detail: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: 2,
  },
  // The icons of the home screen (ChallengeCard)
  replay: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    alignItems: 'center',
    paddingTop: RFValue(8),
  },
  moreText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
});
