import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { GameColors } from './colors';

interface Props {
  colors: GameColors;
  moveCount: number;
  minMoves: number;
  score: number;
  /** Moves left to the optimum, shown after a hint */
  hintRemainingMoves: number | null;
}

export default function GameStatsBar({ colors, moveCount, minMoves, score, hintRemainingMoves }: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.delay(200).springify()} style={[styles.statsBar, { backgroundColor: colors.card }]}>
      <View style={styles.statsPanel}>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.sub }]}>{t('game.moves')}</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{moveCount}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.sub }]}>{t('game.best')}</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {minMoves}
            {hintRemainingMoves ? <Text style={{ color: colors.hint, fontSize: 13 }}> ({t('game.hint_left', { count: hintRemainingMoves })})</Text> : null}
          </Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.sub }]} />
      <View style={styles.stat}>
        <Text style={[styles.statLabel, { color: colors.sub }]}>{t('game.score')}</Text>
        <Text style={[styles.statValue, { color: score > 0 ? '#10B981' : colors.sub }]}>{score}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statsPanel: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    opacity: 0.2,
  },
});
