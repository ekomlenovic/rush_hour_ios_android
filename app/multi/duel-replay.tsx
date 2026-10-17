import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, AccessibilityInfo, useWindowDimensions, type LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import { useTheme } from '@/theme';
import Board from '@/components/Board';
import MultiHeader from '@/components/multi/MultiHeader';
import DuelPlayerBar from '@/components/multi/DuelPlayerBar';
import { multiErrorMessage } from '@/components/multi/errors';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import type { DuelReplay } from '@/utils/multi/api';
import { REPLAY_SPEEDS, isLongPause, gapBefore, playbackDelay, timeAt, vehiclesAfter, type ReplaySpeed } from '@/utils/multi/replay';
import { mergeDuelMoves, movesPlayedAt } from '@/utils/multi/duelReplay';

const noop = () => {};
/** Room for the player bars, the clock and the controls around the boards */
const CHROME_HEIGHT = RFValue(230);

/** Replay of a duel: both boards at the real pace, the opponent at the top, me at the bottom */
export default function DuelReplayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ duelId: string }>();
  const account = useMultiStore(selectActiveAccount);
  const api = useMultiApi(account);

  const [replay, setReplay] = useState<DuelReplay | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api.duelReplay(Number(params.duelId)).then(async (r) => {
      if (cancelled) return;
      setReplay(r);
      // Plays by itself, except with a screen reader: the player steps through the moves
      setPlaying(!(await AccessibilityInfo.isScreenReaderEnabled()));
    }).catch(e => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [api, params.duelId]);

  // Me at the bottom; the other one (or the second player, for the admin) at the top
  const players = useMemo(() => {
    if (!replay) return [];
    const mine = replay.players.findIndex(p => p.id === account?.playerId);
    return mine === 0 ? [replay.players[1], replay.players[0]] : replay.players;
  }, [replay, account?.playerId]);
  const steps = useMemo(() => mergeDuelMoves(players), [players]);
  const timeline = useMemo(() => steps.map(s => s.move), [steps]);
  const total = steps.length;

  useEffect(() => {
    if (!replay || !playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), playbackDelay(timeline, step + 1, speed));
    return () => clearTimeout(timer);
  }, [replay, playing, step, total, speed, timeline]);

  const counts = movesPlayedAt(steps, step, players.length);
  const boards = replay ? players.map((p, i) => vehiclesAfter(replay.level, p.moves, counts[i])) : [];

  if (!replay || players.length < 2) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.duel.replay_title')} colors={colors} />
      <View style={styles.center}>
        {error ? <Text style={[styles.message, { color: colors.text }]}>{multiErrorMessage(t, error)}</Text>
          : <ActivityIndicator color={colors.primary} />}
      </View>
    </View>
  );

  const [top, bottom] = players;
  const name = (p: { id: number; pseudo: string }) => (p.id === account?.playerId ? t('multi.duel.me') : p.pseudo);
  const space = Math.max(0, height - CHROME_HEIGHT - insets.bottom);
  const bottomSize = Math.min(width - RFValue(32), space * 0.58);
  const topSize = Math.min(width * 0.6, space - bottomSize);
  const nextGap = step < total ? gapBefore(timeline, step + 1) : 0;
  const pauseShown = playing && isLongPause(nextGap);
  const finished = step >= total;

  const goTo = (next: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(total, next)));
  };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (finished) setStep(0);
    setPlaying(true);
  };
  const controls = [
    { icon: 'play-skip-back', label: t('solution.first'), onPress: () => goTo(0), disabled: step === 0 },
    { icon: 'play-back', label: t('solution.prev'), onPress: () => goTo(step - 1), disabled: step === 0 },
    { icon: playing ? 'pause' : 'play', label: playing ? t('solution.pause') : t('solution.play'), onPress: togglePlay, disabled: false, primary: true },
    { icon: 'play-forward', label: t('solution.next'), onPress: () => goTo(step + 1), disabled: finished },
    { icon: 'play-skip-forward', label: t('solution.last'), onPress: () => goTo(total), disabled: finished },
  ] as const;
  const nextSpeed = REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(speed) + 1) % REPLAY_SPEEDS.length];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.duel.vs', { a: name(bottom), b: name(top) })} colors={colors} />
      {/* Its own view (key): reusing the one of the loading state, of the same size, would never measure it */}
      <View key="arena" style={[styles.arena, { paddingBottom: insets.bottom + RFValue(8) }]} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 && (
          <>
            <DuelPlayerBar name={name(top)} moves={counts[0]} colors={colors} width={topSize} winner={finished && replay.winnerId === top.id} />
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Board gridSize={replay.level.gridSize} vehicles={boards[0]} exitRow={replay.level.exitRow} exitCol={replay.level.exitCol} onMoveEnd={noop} readOnly size={topSize} />
            </View>

            <View style={[styles.clock, { backgroundColor: colors.card }]} accessible accessibilityLabel={t('multi.time_a11y', { time: formatDuration(timeAt(timeline, step)) })}>
              <Text style={[styles.clockText, { color: colors.text }]}>{formatDuration(timeAt(timeline, step))}</Text>
              {pauseShown && <Text style={[styles.pause, { color: colors.warning }]}>⏸ {formatDuration(nextGap)}</Text>}
            </View>

            <DuelPlayerBar name={name(bottom)} moves={counts[1]} colors={colors} width={bottomSize} isMe={bottom.id === account?.playerId} winner={finished && replay.winnerId === bottom.id} />
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Board gridSize={replay.level.gridSize} vehicles={boards[1]} exitRow={replay.level.exitRow} exitCol={replay.level.exitCol} onMoveEnd={noop} readOnly size={bottomSize} />
            </View>

            <View style={[styles.track, { width: bottomSize, backgroundColor: colors.card }]}>
              <View style={[styles.fill, { backgroundColor: colors.primary, width: `${total ? (step / total) * 100 : 0}%` }]} />
            </View>
            <View style={styles.controls}>
              {controls.map((c, i) => (
                <Pressable
                  key={i}
                  onPress={c.onPress}
                  disabled={c.disabled}
                  style={[styles.control, { backgroundColor: 'primary' in c ? colors.primary : colors.card, opacity: c.disabled ? 0.35 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  accessibilityState={{ disabled: c.disabled }}
                >
                  <Ionicons name={c.icon} size={20} color={'primary' in c ? colors.onPrimary : colors.text} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => setSpeed(nextSpeed)}
                style={[styles.control, { backgroundColor: colors.neutralSoft }]}
                accessibilityRole="button"
                accessibilityLabel={t('multi.speed_a11y', { speed })}
                accessibilityHint={t('multi.speed')}
              >
                <Text style={[styles.speedText, { color: colors.text }]}>×{speed}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: RFValue(24),
  },
  message: {
    fontSize: RFValue(16),
    textAlign: 'center',
  },
  arena: {
    flex: 1,
    alignItems: 'center',
    paddingTop: RFValue(10),
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(16),
    marginVertical: RFValue(10),
  },
  clockText: {
    fontSize: RFValue(17),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pause: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: RFValue(12),
  },
  fill: {
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: RFValue(10),
  },
  control: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    fontSize: RFValue(14),
    fontWeight: '800',
  },
});
