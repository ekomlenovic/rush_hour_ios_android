import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Board from '@/components/Board';
import { Level } from '@/store/gameStore';
import type { MoveRecord } from '@/store/types';
import { Move } from '@/utils/solver';
import { solvePuzzleAsync } from '@/utils/solver.background';
import { movesFromLog, vehiclesAtStep } from '@/utils/solutionReplay';
import { REPLAY_SPEEDS, type ReplaySpeed } from '@/utils/multi/replay';
import { describeVehicle, getMoveDirection, getVehicleLetters } from '@/utils/accessibility';
import type { UiColors } from '@/theme';

/** Time between two moves while the solution plays at ×1 */
const STEP_MS = 900;

const noop = () => {};

export type SolutionSource = 'mine' | 'optimal';
type Source = SolutionSource;

interface Props {
  visible: boolean;
  level: Level;
  colors: UiColors;
  /** The player's own winning moves: both solutions can then be watched */
  playerMoves?: MoveRecord[];
  /** The solution shown first: the player's own when they have one */
  startWith?: Source;
  onClose: () => void;
}

/**
 * Replays the optimal solution of a level from its starting position: it plays by itself,
 * and the player can go back and forth move by move (see docs/GAME_DESIGN.md).
 * With the player's own moves, a switch shows either their solution or the optimal one.
 */
export default function SolutionPlayer({ visible, level, colors, playerMoves, startWith, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [optimalMoves, setOptimalMoves] = useState<Move[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<Source>('optimal');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);

  const myMoves = useMemo(
    () => (playerMoves && playerMoves.length > 0 ? movesFromLog(level.vehicles, playerMoves) : null),
    [level.vehicles, playerMoves],
  );

  // Plays by itself, except with a screen reader: each move is announced, the player steps through them
  const startPlayback = useCallback(async () => {
    setStep(0);
    setPlaying(!(await AccessibilityInfo.isScreenReaderEnabled()));
  }, []);

  // Solve from the starting position each time the player opens it
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setOptimalMoves(null);
    setFailed(false);
    const first = myMoves && startWith !== 'optimal' ? 'mine' : 'optimal';
    setSource(first);
    setStep(0);
    setPlaying(false);
    if (first === 'mine') startPlayback();
    (async () => {
      const result = await solvePuzzleAsync(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
      if (cancelled) return;
      if (!result.solvable || result.moves.length === 0) {
        setFailed(true);
        return;
      }
      setOptimalMoves(result.moves);
      if (first === 'optimal') startPlayback();
    })();
    return () => { cancelled = true; };
  }, [visible, level, myMoves, startWith]);

  const moves = source === 'mine' ? myMoves : optimalMoves;

  const switchSource = (next: Source) => {
    if (next === source) return;
    setSource(next);
    setPlaying(false);
    // The optimal solution may still be computing: it plays as soon as it is there
    startPlayback();
  };

  const total = moves?.length ?? 0;

  // Autoplay, stopping on the last move
  useEffect(() => {
    if (!visible || !playing || !moves) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), STEP_MS / speed);
    return () => clearTimeout(timer);
  }, [visible, playing, step, moves, total, speed]);

  const vehicles = useMemo(
    () => (moves ? vehiclesAtStep(level.vehicles, moves, step) : level.vehicles),
    [level.vehicles, moves, step],
  );

  /** "Car B (blue), to the right" for the move number `index` (0-based) */
  const describeMoveAt = useCallback((index: number) => {
    if (!moves) return '';
    const before = vehiclesAtStep(level.vehicles, moves, index);
    const vehicle = before.find(v => v.id === moves[index].vehicleId);
    if (!vehicle) return '';
    return t('solution.move', {
      vehicle: describeVehicle(t, vehicle, getVehicleLetters(before)[vehicle.id]),
      direction: t(`a11y.dir_${getMoveDirection(vehicle, moves[index])}`),
    });
  }, [moves, level.vehicles, t]);

  const lastMove = step > 0 ? describeMoveAt(step - 1) : t('solution.start');

  useEffect(() => {
    if (!visible || !moves) return;
    AccessibilityInfo.announceForAccessibility(
      step > 0 ? t('solution.step_announce', { step, total, move: lastMove }) : lastMove,
    );
  }, [step, moves]);

  const goTo = (next: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(total, next)));
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Replay from the start once the end is reached
    if (step >= total) setStep(0);
    setPlaying(true);
  };

  const controls: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled: boolean; primary?: boolean }[] = [
    { icon: 'play-skip-back', label: t('solution.first'), onPress: () => goTo(0), disabled: step === 0 },
    { icon: 'chevron-back', label: t('solution.prev'), onPress: () => goTo(step - 1), disabled: step === 0 },
    { icon: playing ? 'pause' : 'play', label: playing ? t('solution.pause') : t('solution.play'), onPress: togglePlay, disabled: false, primary: true },
    { icon: 'chevron-forward', label: t('solution.next'), onPress: () => goTo(step + 1), disabled: step >= total },
    { icon: 'play-skip-forward', label: t('solution.last'), onPress: () => goTo(total), disabled: step >= total },
  ];

  const sources: { id: Source; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
    { id: 'mine', icon: 'person', label: t('solution.mine', { count: myMoves?.length ?? 0 }) },
    { id: 'optimal', icon: 'trophy', label: t('solution.optimal', { count: optimalMoves?.length ?? level.minMoves }) },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A modal is a new root on Android: the board's gesture detectors need their own root view */}
      <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t(source === 'mine' ? 'solution.title_mine' : 'solution.title')}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        {myMoves && (
          <View style={[styles.speeds, styles.sources, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
            {sources.map(s => {
              const selected = s.id === source;
              const tint = selected ? colors.onPrimary : colors.text;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => switchSource(s.id)}
                  style={[styles.speed, styles.source, selected && { backgroundColor: colors.primary }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Ionicons name={s.icon} size={15} color={tint} />
                  <Text style={[styles.speedText, { color: tint }]} numberOfLines={1}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.boardWrapper}>
          <Board
            gridSize={level.gridSize}
            vehicles={vehicles}
            exitRow={level.exitRow}
            exitCol={level.exitCol}
            onMoveEnd={noop}
            hintVehicleId={moves && step < total ? moves[step].vehicleId : null}
            readOnly
          />
        </View>

        {failed && source === 'optimal' ? (
          <Text style={[styles.status, { color: colors.textMuted }]}>{t('solution.unsolvable')}</Text>
        ) : !moves ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.status, { color: colors.textMuted }]}>{t('solution.computing')}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${(step / total) * 100}%` }]} />
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>{t('solution.step', { step, total })}</Text>
            <Text style={[styles.moveText, { color: colors.textMuted }]} numberOfLines={2}>{lastMove}</Text>

            <View style={styles.controls}>
              {controls.map((c, i) => (
                <Pressable
                  key={i}
                  onPress={c.onPress}
                  disabled={c.disabled}
                  style={[styles.controlBtn, { backgroundColor: c.primary ? colors.primary : colors.card, opacity: c.disabled ? 0.35 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  accessibilityState={{ disabled: c.disabled }}
                >
                  <Ionicons name={c.icon} size={22} color={c.primary ? colors.onPrimary : colors.text} />
                </Pressable>
              ))}
            </View>

            <View style={[styles.speeds, { backgroundColor: colors.neutralSoft }]} accessibilityRole="radiogroup" accessibilityLabel={t('solution.speed')}>
              {REPLAY_SPEEDS.map(s => (
                <Pressable
                  key={s}
                  onPress={() => setSpeed(s)}
                  style={[styles.speed, s === speed && { backgroundColor: colors.primary }]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: s === speed }}
                  accessibilityLabel={t('solution.speed_a11y', { speed: s })}
                >
                  <Text style={[styles.speedText, { color: s === speed ? colors.onPrimary : colors.text }]}>×{s}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loading: {
    alignItems: 'center',
    gap: 8,
  },
  status: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  moveText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    minHeight: 40,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speeds: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 12,
    padding: 3,
    marginTop: 16,
  },
  speed: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  sources: {
    marginTop: 0,
    marginBottom: 20,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  speedText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
