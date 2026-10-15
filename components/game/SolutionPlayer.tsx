import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, AccessibilityInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Board from '@/components/Board';
import { Level } from '@/store/gameStore';
import { Move } from '@/utils/solver';
import { solvePuzzleAsync } from '@/utils/solver.background';
import { vehiclesAtStep } from '@/utils/solutionReplay';
import { describeVehicle, getMoveDirection, getVehicleLetters } from '@/utils/accessibility';
import { GameColors } from './colors';

/** Time between two moves while the solution plays */
const STEP_MS = 900;

const noop = () => {};

interface Props {
  visible: boolean;
  level: Level;
  colors: GameColors;
  isDark: boolean;
  onClose: () => void;
}

/**
 * Replays the optimal solution of a level from its starting position: it plays by itself,
 * and the player can go back and forth move by move (see docs/GAME_DESIGN.md).
 */
export default function SolutionPlayer({ visible, level, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Solve from the starting position each time the player opens it
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setMoves(null);
    setFailed(false);
    setStep(0);
    setPlaying(false);
    (async () => {
      const result = await solvePuzzleAsync(level.vehicles, level.gridSize, level.exitRow, level.exitCol);
      if (cancelled) return;
      if (!result.solvable || result.moves.length === 0) {
        setFailed(true);
        return;
      }
      setMoves(result.moves);
      // Plays by itself, except with a screen reader: each move is announced, the player steps through them
      setPlaying(!(await AccessibilityInfo.isScreenReaderEnabled()));
    })();
    return () => { cancelled = true; };
  }, [visible, level]);

  const total = moves?.length ?? 0;

  // Autoplay, stopping on the last move
  useEffect(() => {
    if (!visible || !playing || !moves) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [visible, playing, step, moves, total]);

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

  const controls: { icon: string; label: string; onPress: () => void; disabled: boolean; primary?: boolean }[] = [
    { icon: '⏮', label: t('solution.first'), onPress: () => goTo(0), disabled: step === 0 },
    { icon: '◀', label: t('solution.prev'), onPress: () => goTo(step - 1), disabled: step === 0 },
    { icon: playing ? '⏸' : '▶', label: playing ? t('solution.pause') : t('solution.play'), onPress: togglePlay, disabled: false, primary: true },
    { icon: '▶▶', label: t('solution.next'), onPress: () => goTo(step + 1), disabled: step >= total },
    { icon: '⏭', label: t('solution.last'), onPress: () => goTo(total), disabled: step >= total },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A modal is a new root on Android: the board's gesture detectors need their own root view */}
      <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('solution.title')}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8}>
            <Text style={{ fontSize: 22, color: colors.sub }}>✕</Text>
          </Pressable>
        </View>

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

        {failed ? (
          <Text style={[styles.status, { color: colors.sub }]}>{t('solution.unsolvable')}</Text>
        ) : !moves ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.status, { color: colors.sub }]}>{t('solution.computing')}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${(step / total) * 100}%` }]} />
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>{t('solution.step', { step, total })}</Text>
            <Text style={[styles.moveText, { color: colors.sub }]} numberOfLines={2}>{lastMove}</Text>

            <View style={styles.controls}>
              {controls.map((c, i) => (
                <Pressable
                  key={i}
                  onPress={c.onPress}
                  disabled={c.disabled}
                  style={[styles.controlBtn, { backgroundColor: c.primary ? colors.accent : colors.card, opacity: c.disabled ? 0.35 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={c.label}
                  accessibilityState={{ disabled: c.disabled }}
                >
                  <Text style={[styles.controlIcon, { color: c.primary ? '#FFFFFF' : colors.text }]}>{c.icon}</Text>
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
    paddingTop: 60,
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
  controlIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
});
