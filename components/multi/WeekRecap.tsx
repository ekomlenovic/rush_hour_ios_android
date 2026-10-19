import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { addDays } from '@/utils/date';
import type { MultiApi } from '@/utils/multi/api';
import { mondayOf } from '@/utils/multi/week';
import type { UiColors } from '@/theme';

interface Props {
  api: MultiApi;
  colors: UiColors;
  myPlayerId: number;
  refreshKey: number;
  /** Players hidden on this phone */
  blocked: number[];
  /** The ranking of the challenges or of the duels */
  kind: 'challenges' | 'duels';
  /** Today (the challenge being played, or the day of the duels): the recap is of the week before */
  currentDate: string;
  /** Shows the final ranking of last week */
  onOpen: () => void;
}

/** A player's place in the final ranking of last week */
interface Place { playerId: number; pseudo: string; rank: number }

/**
 * Last week is over: its winner and my place, in one line that opens its final ranking.
 * The same for the challenges and for the duels.
 */
export default function WeekRecap({ api, colors, myPlayerId, refreshKey, blocked, kind, currentDate, onOpen }: Props) {
  const { t } = useTranslation();
  const lastWeek = addDays(mondayOf(currentDate), -7);
  const [week, setWeek] = useState<{ kind: string; from: string; rows: Place[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = { period: 'week' as const, date: lastWeek };
    // A bonus: nothing is shown while it loads or if it fails
    (kind === 'challenges' ? api.leaderboard(query) : api.duelLeaderboard(query))
      .then(board => { if (!cancelled && board.period === 'week') setWeek({ kind, from: board.from, rows: board.rows }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [api, kind, lastWeek, refreshKey]);

  if (!week || week.kind !== kind || week.from !== lastWeek) return null;
  const rows = week.rows.filter(r => !blocked.includes(r.playerId));
  if (rows.length === 0) return null;

  const winners = rows.filter(r => r.rank === 1).map(r => r.pseudo).join(', ');
  const me = rows.find(r => r.playerId === myPlayerId);
  const detail = [
    t('multi.recap_winner', { pseudo: winners }),
    me ? t('multi.recap_me_short', { rank: me.rank }) : t('multi.recap_absent_short'),
  ].join(' · ');

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.banner, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${t('multi.recap_title')}. ${detail}`}
      accessibilityHint={t('multi.recap_open')}
    >
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="trophy" size={RFValue(18)} color={colors.warning} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{t('multi.recap_title')}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>{detail}</Text>
      </View>
      <Text style={[styles.open, { color: colors.primaryText }]}>{t('multi.recap_open')}</Text>
      <Ionicons name="chevron-forward" size={RFValue(16)} color={colors.primaryText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    borderRadius: 16,
    borderWidth: 1,
    padding: RFValue(12),
    marginTop: RFValue(16),
  },
  icon: {
    width: RFValue(36),
    height: RFValue(36),
    borderRadius: RFValue(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  title: {
    fontSize: RFValue(15),
    fontWeight: '800',
  },
  detail: {
    fontSize: RFValue(13),
    fontWeight: '600',
    marginTop: 2,
  },
  open: {
    fontSize: RFValue(14),
    fontWeight: '800',
  },
});
