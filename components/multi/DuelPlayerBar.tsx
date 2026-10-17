import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';

interface Props {
  name: string;
  moves: number;
  colors: UiColors;
  width: number;
  /** My bar stands out */
  isMe?: boolean;
  /** Lost the connection (live duel) */
  away?: boolean;
  /** Won the duel (replay) */
  winner?: boolean;
}

/** The bar above a board of a duel: who, connected or not, how many moves */
export default function DuelPlayerBar({ name, moves, colors, width, isMe = false, away = false, winner = false }: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.bar, { width, backgroundColor: isMe ? colors.primarySoft : colors.card }]}
      accessible
      accessibilityLabel={[name, away ? t('multi.duel.away') : null, winner ? t('multi.duel.winner') : null, t('multi.moves', { count: moves })].filter(Boolean).join(', ')}
    >
      {winner
        ? <Ionicons name="trophy" size={14} color={colors.warning} />
        : <View style={[styles.dot, { backgroundColor: away ? colors.danger : colors.success }]} />}
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
      {away && <Text style={[styles.away, { color: colors.danger }]}>{t('multi.duel.away')}</Text>}
      <View style={styles.moves}>
        <Text style={[styles.movesLabel, { color: colors.textMuted }]}>{t('game.moves')}</Text>
        <Text style={[styles.movesValue, { color: colors.text }]}>{moves}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
    borderRadius: 12,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(10),
    marginBottom: RFValue(8),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flexShrink: 1,
    fontSize: RFValue(15),
    fontWeight: '800',
  },
  away: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  moves: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  movesLabel: {
    fontSize: RFValue(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  movesValue: {
    fontSize: RFValue(18),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
