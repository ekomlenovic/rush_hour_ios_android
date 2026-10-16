import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import { useTheme } from '@/theme';
import Board from '@/components/Board';
import MultiHeader from '@/components/multi/MultiHeader';
import { multiErrorMessage } from '@/components/multi/errors';
import { reasonsText, verdictBadge } from '@/components/multi/verdict';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import type { Replay } from '@/utils/multi/api';
import { REPLAY_SPEEDS, gapBefore, isLongPause, playbackDelay, timeAt, vehiclesAfter, type ReplaySpeed } from '@/utils/multi/replay';

const noop = () => {};

/**
 * Watch the game of a player (#50): at its real pace with its clock, faster with a
 * speed, move by move. Fun, and how the admin judges a suspicion.
 */
export default function ReplayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ attemptId: string }>();
  const account = useMultiStore(selectActiveAccount);
  const api = useMultiApi(account);

  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api.replay(Number(params.attemptId)).then(async (r) => {
      if (cancelled) return;
      setReplay(r);
      // Plays by itself, except with a screen reader: the player steps through the moves
      setPlaying(!(await AccessibilityInfo.isScreenReaderEnabled()));
    }).catch(e => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [api, params.attemptId]);

  const total = replay?.moves.length ?? 0;

  useEffect(() => {
    if (!replay || !playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), playbackDelay(replay.moves, step + 1, speed));
    return () => clearTimeout(timer);
  }, [replay, playing, step, total, speed]);

  const vehicles = useMemo(() => (replay ? vehiclesAfter(replay.level, replay.moves, step) : []), [replay, step]);

  if (!replay) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.replay_title')} colors={colors} />
      <View style={styles.center}>
        {error ? <Text style={[styles.message, { color: colors.text }]}>{multiErrorMessage(t, error)}</Text>
          : <ActivityIndicator color={colors.primary} />}
      </View>
    </View>
  );

  // The pause before the next move, when it is long: shown while it is shortened
  const nextGap = step < total ? gapBefore(replay.moves, step + 1) : 0;
  const pauseShown = playing && isLongPause(nextGap);

  const goTo = (next: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(total, next)));
  };
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (step >= total) setStep(0);
    setPlaying(true);
  };

  const controls = [
    { icon: '⏮', label: t('solution.first'), onPress: () => goTo(0), disabled: step === 0 },
    { icon: '◀', label: t('solution.prev'), onPress: () => goTo(step - 1), disabled: step === 0 },
    { icon: playing ? '⏸' : '▶', label: playing ? t('solution.pause') : t('solution.play'), onPress: togglePlay, disabled: false, primary: true },
    { icon: '▶▶', label: t('solution.next'), onPress: () => goTo(step + 1), disabled: step >= total },
    { icon: '⏭', label: t('solution.last'), onPress: () => goTo(total), disabled: step >= total },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={t('multi.replay_of', { pseudo: replay.pseudo })} colors={colors} />
      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('multi.challenge_number', { number: replay.number })} · {t('multi.moves', { count: total })} · {formatDuration(replay.timeMs)}
          {replay.level.minMoves ? ` · ${t('multi.optimum', { count: replay.level.minMoves })}` : ''}
        </Text>
        {replay.verdict && (
          <Text style={[styles.verdict, { color: replay.verdict === 'cheater' ? colors.danger : colors.warning }]}>
            {verdictBadge(replay.verdict)} {replay.verdict === 'cheater' ? t('multi.cheater') : `${t('multi.suspect')} : ${reasonsText(t, replay.reasons)}`}
          </Text>
        )}

        <View style={styles.clock} accessible accessibilityLabel={t('multi.time_a11y', { time: formatDuration(timeAt(replay.moves, step)) })}>
          <Text style={[styles.clockText, { color: colors.text }]}>⏱ {formatDuration(timeAt(replay.moves, step))}</Text>
          <Text style={[styles.pause, { color: colors.warning, opacity: pauseShown ? 1 : 0 }]}>⏸ {formatDuration(nextGap)}</Text>
        </View>

        <View style={styles.board}>
          <Board
            gridSize={replay.level.gridSize}
            vehicles={vehicles}
            exitRow={replay.level.exitRow}
            exitCol={replay.level.exitCol}
            onMoveEnd={noop}
            hintVehicleId={step < total ? replay.moves[step].vehicleId : null}
            readOnly
          />
        </View>

        <View style={[styles.track, { backgroundColor: colors.card }]}>
          <View style={[styles.fill, { backgroundColor: colors.primary, width: `${total ? (step / total) * 100 : 0}%` }]} />
        </View>
        <Text style={[styles.step, { color: colors.text }]}>{t('solution.step', { step, total })}</Text>

        <View style={styles.controls}>
          {controls.map((c, i) => (
            <Pressable
              key={i}
              onPress={c.onPress}
              disabled={c.disabled}
              style={[styles.control, { backgroundColor: c.primary ? colors.primary : colors.card, opacity: c.disabled ? 0.35 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityState={{ disabled: c.disabled }}
            >
              <Text style={[styles.controlIcon, { color: c.primary ? colors.onPrimary : colors.text }]}>{c.icon}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.speeds, { backgroundColor: colors.neutralSoft }]} accessibilityRole="radiogroup" accessibilityLabel={t('multi.speed')}>
          {REPLAY_SPEEDS.map(s => (
            <Pressable
              key={s}
              onPress={() => setSpeed(s)}
              style={[styles.speed, s === speed && { backgroundColor: colors.primary }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: s === speed }}
              accessibilityLabel={t('multi.speed_a11y', { speed: s })}
            >
              <Text style={[styles.speedText, { color: s === speed ? colors.onPrimary : colors.text }]}>×{s}</Text>
            </Pressable>
          ))}
        </View>
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
  content: {
    paddingHorizontal: RFValue(16),
    paddingTop: RFValue(10),
  },
  subtitle: {
    fontSize: RFValue(13),
    textAlign: 'center',
  },
  verdict: {
    fontSize: RFValue(13),
    fontWeight: '700',
    textAlign: 'center',
    marginTop: RFValue(6),
  },
  clock: {
    alignItems: 'center',
    marginVertical: RFValue(10),
  },
  clockText: {
    fontSize: RFValue(24),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pause: {
    fontSize: RFValue(13),
    fontWeight: '700',
    marginTop: 2,
  },
  board: {
    alignItems: 'center',
    marginBottom: RFValue(14),
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: RFValue(8),
  },
  fill: {
    height: '100%',
  },
  step: {
    fontSize: RFValue(15),
    fontWeight: '800',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: RFValue(12),
  },
  control: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
  speeds: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 12,
    padding: 3,
    marginTop: RFValue(14),
  },
  speed: {
    paddingVertical: RFValue(7),
    paddingHorizontal: RFValue(18),
    borderRadius: 10,
  },
  speedText: {
    fontSize: RFValue(14),
    fontWeight: '800',
  },
});
