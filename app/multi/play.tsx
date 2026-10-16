import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, AppState, Modal, AccessibilityInfo } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics, Haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import { fixedColors, useTheme } from '@/theme';
import Board from '@/components/Board';
import MultiHeader from '@/components/multi/MultiHeader';
import { errorCode, multiErrorMessage } from '@/components/multi/errors';
import { gameKey, selectActiveAccount, useMultiStore, type MultiGame } from '@/store/multiStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import { elapsedMs, gameFromStart, playMove, submission } from '@/utils/multi/game';
import type { SubmitResult } from '@/utils/multi/api';

type Phase = 'loading' | 'playing' | 'sending' | 'send_failed' | 'won' | 'error';

/**
 * The multiplayer challenge (#46): one try, no hint, undo nor reset. The clock is the
 * one of the server and keeps running when the screen is left; the game is resumed
 * where it was. A win is sent as the list of moves, which the server replays.
 */
export default function MultiPlayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const account = useMultiStore(selectActiveAccount);
  const saveGame = useMultiStore(s => s.saveGame);
  const removeGame = useMultiStore(s => s.removeGame);
  const api = useMultiApi(account);

  const [game, setGame] = useState<MultiGame | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const gameRef = useRef<MultiGame | null>(null);

  const update = useCallback((next: MultiGame) => {
    gameRef.current = next;
    setGame(next);
    saveGame(next);
  }, [saveGame]);

  // Start the challenge, or resume the game: the server gives the puzzle and its start
  useEffect(() => {
    if (!api || !account) return;
    let cancelled = false;
    api.start(params.date).then(start => {
      if (cancelled) return;
      const saved = useMultiStore.getState().games[gameKey(account.url, start.date)];
      update(gameFromStart(account.url, start, saved, Date.now()));
      setPhase('playing');
    }).catch(e => {
      if (cancelled) return;
      setError(e);
      setPhase('error');
    });
    return () => { cancelled = true; };
  }, [api, account?.url, params.date, update]);

  // The clock on screen
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Time out of the app: sent to the server (a signal for the admin, never a penalty)
  useEffect(() => {
    if (phase !== 'playing') return;
    let leftAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        leftAt ??= Date.now();
      } else if (leftAt !== null && gameRef.current) {
        update({ ...gameRef.current, backgroundMs: gameRef.current.backgroundMs + (Date.now() - leftAt) });
        leftAt = null;
      }
    });
    return () => subscription.remove();
  }, [phase, update]);

  const send = useCallback(async (finished: MultiGame) => {
    if (!api) return;
    setPhase('sending');
    setError(null);
    const { moves, clientMs, backgroundMs } = submission(finished, Date.now());
    try {
      const res = await api.submit(finished.date, moves, clientMs, backgroundMs);
      removeGame(finished.serverUrl, finished.date);
      setResult(res);
      setPhase('won');
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(t('multi.win_a11y', { moves: res.moves, time: formatDuration(res.timeMs), rank: res.rank }));
    } catch (e) {
      setError(e);
      // Network trouble: the win is kept, it can be sent again; otherwise it was refused
      setPhase(['network', 'timeout', 'internal', 'rate_limited', 'bad_response'].includes(errorCode(e)) ? 'send_failed' : 'error');
    }
  }, [api, removeGame, t]);

  const handleMoveEnd = useCallback((vehicleId: string, row: number, col: number) => {
    const current = gameRef.current;
    if (!current) return;
    const played = playMove(current, vehicleId, row, col, Date.now());
    if (!played) return;
    update(played.game);
    if (played.won) void send(played.game);
  }, [update, send]);

  const abandon = () => {
    if (!api || !game) return;
    Alert.alert(t('multi.abandon_title'), t('multi.abandon_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('multi.abandon'), style: 'destructive', onPress: async () => {
          try {
            await api.abandon(game.date);
            removeGame(game.serverUrl, game.date);
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), multiErrorMessage(t, e));
          }
        },
      },
    ]);
  };

  const title = game ? t('multi.challenge_number', { number: game.number }) : t('multi.title');
  const timeOver = !!game && Date.now() + game.clockOffset > game.deadline;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={title} colors={colors} />

      {phase === 'loading' && <ActivityIndicator color={colors.primary} style={styles.center} />}

      {phase === 'error' && (
        <View style={styles.center}>
          <Text style={[styles.message, { color: colors.text }]}>{multiErrorMessage(t, error)}</Text>
          <Pressable onPress={() => router.back()} style={[styles.button, { backgroundColor: colors.primary }]} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.back_to_multi')}</Text>
          </Pressable>
          {!!game && (
            <Pressable onPress={abandon} style={styles.link} accessibilityRole="button">
              <Text style={[styles.linkText, { color: colors.danger }]}>{t('multi.abandon')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {game && phase !== 'error' && phase !== 'loading' && (
        <>
          <View style={styles.stats}>
            <View style={styles.stat} accessible accessibilityLabel={t('multi.moves', { count: game.moveLog.length })}>
              <Text style={[styles.statValue, { color: colors.text }]}>{game.moveLog.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('multi.moves_label')}</Text>
            </View>
            <View style={styles.stat} accessible accessibilityLabel={t('multi.time_a11y', { time: formatDuration(elapsedMs(game, now)) })}>
              <Text style={[styles.statValue, { color: colors.text }]}>⏱ {formatDuration(elapsedMs(game, now))}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('multi.server_clock')}</Text>
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.board}>
            <Board
              gridSize={game.level.gridSize}
              vehicles={game.vehicles}
              exitRow={game.level.exitRow}
              exitCol={game.level.exitCol}
              onMoveEnd={handleMoveEnd}
              disabled={phase !== 'playing' || timeOver}
            />
          </Animated.View>

          {phase === 'playing' && (
            <>
              <Text style={[styles.note, { color: timeOver ? colors.danger : colors.textMuted }]}>
                {timeOver ? t('multi.errors.too_late') : t('multi.clock_runs')}
              </Text>
              <Pressable onPress={abandon} style={styles.link} accessibilityRole="button">
                <Text style={[styles.linkText, { color: colors.danger }]}>{t('multi.abandon')}</Text>
              </Pressable>
            </>
          )}

          {phase === 'sending' && (
            <View style={styles.sending}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.note, { color: colors.textMuted }]}>{t('multi.sending')}</Text>
            </View>
          )}

          {phase === 'send_failed' && (
            <View style={styles.sending}>
              <Text style={[styles.note, { color: colors.danger }]}>{multiErrorMessage(t, error)}</Text>
              <Pressable onPress={() => gameRef.current && send(gameRef.current)} style={[styles.button, { backgroundColor: colors.primary }]} accessibilityRole="button">
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.send_again')}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      <Modal visible={phase === 'won' && !!result} transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={styles.overlay}>
          <View style={[styles.winCard, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
            <Text style={styles.winEmoji}>{result?.rank === 1 ? '🏆' : '🏁'}</Text>
            <Text style={[styles.winTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.win_title')}</Text>
            {result && (
              <>
                <Text style={[styles.winLine, { color: colors.text }]}>
                  {t('multi.moves', { count: result.moves })} · ⏱ {formatDuration(result.timeMs)}
                </Text>
                <Text style={[styles.winMuted, { color: colors.textMuted }]}>
                  {result.moves === result.minMoves ? t('multi.optimal') : t('multi.optimum', { count: result.minMoves })}
                </Text>
                <Text style={[styles.winRank, { color: colors.primaryText }]}>
                  {t('multi.provisional_rank', { rank: result.rank })} · {t('multi.points', { count: result.points })}
                </Text>
              </>
            )}
            <Pressable onPress={() => router.back()} style={[styles.button, { backgroundColor: colors.primary, alignSelf: 'stretch' }]} accessibilityRole="button">
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('multi.see_leaderboard')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    lineHeight: RFValue(22),
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: RFValue(14),
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: RFValue(22),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: 2,
  },
  board: {
    alignItems: 'center',
  },
  note: {
    fontSize: RFValue(13),
    textAlign: 'center',
    marginTop: RFValue(16),
    paddingHorizontal: RFValue(24),
  },
  link: {
    alignItems: 'center',
    padding: RFValue(14),
  },
  linkText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  sending: {
    alignItems: 'center',
    marginTop: RFValue(16),
    paddingHorizontal: RFValue(24),
  },
  button: {
    marginTop: RFValue(18),
    paddingVertical: RFValue(14),
    paddingHorizontal: RFValue(28),
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: fixedColors.overlay,
  },
  winCard: {
    width: '86%',
    maxWidth: 400,
    borderRadius: 20,
    padding: RFValue(28),
    alignItems: 'center',
  },
  winEmoji: {
    fontSize: RFValue(48),
  },
  winTitle: {
    fontSize: RFValue(24),
    fontWeight: '800',
    marginTop: RFValue(6),
  },
  winLine: {
    fontSize: RFValue(18),
    fontWeight: '700',
    marginTop: RFValue(12),
  },
  winMuted: {
    fontSize: RFValue(14),
    marginTop: 4,
  },
  winRank: {
    fontSize: RFValue(17),
    fontWeight: '800',
    marginTop: RFValue(12),
  },
});
