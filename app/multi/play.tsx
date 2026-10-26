import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, AppState, Modal, AccessibilityInfo } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from '@/hooks/useRouter';
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
import { useGameStore } from '@/store/gameStore';
import { useMultiApi } from '@/hooks/useMultiApi';
import { elapsedMs, gameFromStart, isWon, playMove, submission, wonResult } from '@/utils/multi/game';
import { MultiApiError, type SubmitResult } from '@/utils/multi/api';
import IconText from '@/components/IconText';
import LoadingIndicator from '@/components/LoadingIndicator';

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
  /** Sends a win (set below): a game resumed already won is sent again at once */
  const sendRef = useRef<(finished: MultiGame) => Promise<void>>(async () => {});

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
      const resumed = gameFromStart(account.url, start, saved, Date.now());
      update(resumed);
      // Won on this phone but never received by the server (network, app closed): sent again
      if (isWon(resumed)) void sendRef.current(resumed);
      else setPhase('playing');
    }).catch(async e => {
      // Already won: the server took the win but its answer was lost, its result is shown
      const today = errorCode(e) === 'already_finished' ? await api.today().catch(() => null) : null;
      const taken = today && wonResult(today, params.date ?? today.date, account.playerId);
      if (cancelled) return;
      if (taken) {
        removeGame(account.url, params.date ?? today.date);
        setResult(taken);
        setPhase('won');
        return;
      }
      setError(e);
      setPhase('error');
    });
    return () => { cancelled = true; };
  }, [api, account?.url, params.date, update, removeGame]);

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
    const won = (res: SubmitResult) => {
      removeGame(finished.serverUrl, finished.date);
      setResult(res);
      setPhase('won');
      haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(t('multi.win_a11y', { moves: res.moves, time: formatDuration(res.timeMs), rank: res.rank }));
    };
    try {
      // My look, for the replays of the others
      const { board, skin, palette } = useGameStore.getState().cosmetics;
      won(await api.submit(finished.date, moves, clientMs, backgroundMs, { board, skin, palette }));
    } catch (e) {
      setError(e);
      // Taken by the server, but its answer was lost: the win it has
      const taken = errorCode(e) === 'already_finished' && account
        ? await api.today().then(today => wonResult(today, finished.date, account.playerId)).catch(() => null)
        : null;
      if (taken) return won(taken);
      // Network trouble: the win is kept, it can be sent again; otherwise it was refused
      setPhase(['network', 'timeout', 'internal', 'rate_limited', 'bad_response'].includes(errorCode(e)) ? 'send_failed' : 'error');
    }
  }, [api, account, removeGame, t]);
  sendRef.current = send;

  const handleMoveEnd = useCallback((vehicleId: string, row: number, col: number) => {
    const current = gameRef.current;
    if (!current) return false;
    const played = playMove(current, vehicleId, row, col, Date.now());
    // Refused (a move through a vehicle): the block goes back
    if (!played) return false;
    update(played.game);
    if (played.won) void send(played.game);
    return true;
  }, [update, send]);

  const abandon = () => {
    if (!api || !game) return;
    Alert.alert(t('multi.abandon_title'), t('multi.abandon_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('multi.abandon'), style: 'destructive', onPress: async () => {
          try {
            await api.abandon(game.date);
          } catch (e) {
            // Past its deadline the game is already over (unfinished): nothing left to abandon
            if (!(e instanceof MultiApiError && e.code === 'too_late')) {
              Alert.alert(t('common.error'), multiErrorMessage(t, e));
              return;
            }
          }
          removeGame(game.serverUrl, game.date);
          router.back();
        },
      },
    ]);
  };

  const title = game ? t('multi.challenge_number', { number: game.number }) : t('multi.title');
  const timeOver = !!game && Date.now() + game.clockOffset > game.deadline;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={title} colors={colors} />

      {phase === 'loading' && <LoadingIndicator fill />}

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
              <IconText icon="timer-outline" color={colors.text} textStyle={styles.statValue}>{formatDuration(elapsedMs(game, now))}</IconText>
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
            <View style={[styles.winIcon, { backgroundColor: result?.rank === 1 ? colors.successSoft : colors.primarySoft }]}>
              <Ionicons name={result?.rank === 1 ? 'trophy' : 'flag'} size={RFValue(34)} color={result?.rank === 1 ? colors.success : colors.primaryText} />
            </View>
            <Text style={[styles.winTitle, { color: colors.text }]} accessibilityRole="header">{t('multi.win_title')}</Text>
            {result && (
              <>
                <IconText icon="timer-outline" color={colors.text} style={styles.winLineRow} textStyle={[styles.winLine, styles.noMargin]}>
                  {t('multi.moves', { count: result.moves })} · {formatDuration(result.timeMs)}
                </IconText>
                <Text style={[styles.winMuted, { color: colors.textMuted }]}>
                  {result.moves === result.minMoves ? t('multi.optimal') : t('multi.optimum', { count: result.minMoves })}
                </Text>
                <Text style={[styles.winRank, { color: colors.primaryText }]}>
                  {t('multi.provisional_rank', { rank: result.rank })} · {t('multi.points', { count: result.points })}
                </Text>
                {result.verdict === 'suspect' && (
                  <IconText icon="warning" color={colors.warning} style={styles.winSuspect} textStyle={[styles.winMuted, styles.noMargin, { textAlign: 'center' }]}>{t('multi.win_suspect')}</IconText>
                )}
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
  winIcon: {
    width: RFValue(64),
    height: RFValue(64),
    borderRadius: RFValue(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: RFValue(10),
  },
  winLineRow: {
    marginTop: RFValue(12),
  },
  winSuspect: {
    justifyContent: 'center',
    marginTop: 4,
  },
  noMargin: {
    marginTop: 0,
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
