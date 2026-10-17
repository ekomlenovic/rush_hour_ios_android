import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Modal, Share,
  AccessibilityInfo, useWindowDimensions, type LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics, Haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import { fixedColors, useTheme, type UiColors } from '@/theme';
import Board from '@/components/Board';
import MultiHeader from '@/components/multi/MultiHeader';
import { multiErrorMessage } from '@/components/multi/errors';
import { selectActiveAccount, useMultiStore } from '@/store/multiStore';
import { useDuel } from '@/hooks/useDuel';
import {
  DUEL_DIFFICULTIES, countdownMs, duelElapsedMs, iHaveWon, normalizeDuelCode, outcome,
  type Duel, type DuelDifficulty, type DuelSide,
} from '@/utils/multi/duel';

/** Room for the two player bars and the clock around the boards */
const BARS_HEIGHT = RFValue(150);

/**
 * Duel 1v1 in real time: two players of the server on the same puzzle, the board of
 * the opponent at the top, mine at the bottom. The first red car out wins.
 * Opened from the multiplayer screen to create a duel (?create=HARD&private=1), to
 * join one (?join=CODE), or to go back to mine.
 */
export default function DuelScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ create?: string; private?: string; join?: string }>();
  const account = useMultiStore(selectActiveAccount);
  const { state, unreachable, create, join, move, leave, rematch } = useDuel(account);
  const duel = state.duel;
  const [now, setNow] = useState(Date.now());

  // What the screen was opened for, asked once connected (unless a duel is already going on)
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (asked || state.connection !== 'online') return;
    setAsked(true);
    if (duel) return;
    if (params.join) join(normalizeDuelCode(params.join));
    else if (params.create) {
      const difficulty = DUEL_DIFFICULTIES.includes(params.create as DuelDifficulty) ? params.create as DuelDifficulty : 'NORMAL';
      create(difficulty, params.private === '1');
    }
  }, [asked, state.connection, duel, params.join, params.create, params.private, join, create]);

  // The clock and the countdown
  const running = duel?.status === 'playing';
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);

  // Leaving the screen during a game is losing it: asked first
  const duelRef = useRef(duel);
  duelRef.current = duel;
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    const current = duelRef.current;
    if (!current || current.status === 'over') return;
    if (current.status === 'waiting') {
      leave();
      return;
    }
    event.preventDefault();
    Alert.alert(t('multi.duel.leave_title'), t('multi.duel.leave_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('multi.duel.leave'), style: 'destructive', onPress: () => {
          leave();
          navigation.dispatch(event.data.action);
        },
      },
    ]);
  }), [navigation, leave, t]);

  // The end, felt and said
  const result = duel ? outcome(duel) : null;
  const opponentPseudo = duel?.opponent?.pseudo ?? '';
  useEffect(() => {
    if (!result) return;
    haptics.notificationAsync(result === 'win' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    AccessibilityInfo.announceForAccessibility(t(`multi.duel.result_${result}`, { pseudo: opponentPseudo }));
  }, [result, opponentPseudo, t]);

  const goBack = () => navigation.goBack();
  const title = duel?.opponent && duel.status !== 'waiting'
    ? t('multi.duel.versus', { pseudo: duel.opponent.pseudo })
    : t('multi.duel.title');

  let body: React.ReactNode;
  if (!account) {
    body = <Notice emoji="🔌" text={multiErrorMessage(t, 'unauthorized')} colors={colors} onBack={goBack} />;
  } else if (unreachable && state.connection !== 'online') {
    body = <Notice emoji="🔌" text={multiErrorMessage(t, unreachable)} colors={colors} onBack={goBack} />;
  } else if (!duel && state.error) {
    body = <Notice emoji="🤷" text={multiErrorMessage(t, state.error)} colors={colors} onBack={goBack} />;
  } else if (!duel && asked && state.connection === 'online' && !params.join && !params.create) {
    // Opened to go back to my duel, which ended meanwhile
    body = <Notice emoji="🏁" text={multiErrorMessage(t, 'no_duel')} colors={colors} onBack={goBack} />;
  } else if (!duel) {
    body = <ActivityIndicator color={colors.primary} style={styles.center} />;
  } else if (duel.status === 'waiting') {
    body = <Waiting duel={duel} colors={colors} serverName={account.name} onCancel={goBack} />;
  } else if (duel.status === 'preparing') {
    body = (
      <View style={styles.center}>
        <Versus me={duel.me} opponent={duel.opponent} colors={colors} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: RFValue(28) }} />
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.duel.preparing')}</Text>
      </View>
    );
  } else {
    body = <Arena duel={duel} now={now} colors={colors} offline={state.connection !== 'online'} onMove={move} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MultiHeader title={title} colors={colors} />
      {body}
      {duel?.status === 'over' && <ResultModal duel={duel} colors={colors} onRematch={rematch} onQuit={goBack} />}
    </View>
  );
}

function Notice({ emoji, text, colors, onBack }: { emoji: string; text: string; colors: UiColors; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Animated.View entering={FadeInDown.springify()} style={[styles.card, styles.noticeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.bigEmoji}>{emoji}</Text>
        <Text style={[styles.noticeText, { color: colors.text }]}>{text}</Text>
        <Pressable onPress={onBack} style={[styles.primaryButton, styles.wide, { backgroundColor: colors.primary }]} accessibilityRole="button">
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>{t('multi.back_to_multi')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Me against the opponent (or an empty seat) */
function Versus({ me, opponent, colors }: { me: DuelSide; opponent: DuelSide | null; colors: UiColors }) {
  const { t } = useTranslation();
  const seat = (player: DuelSide | null, mine: boolean) => (
    <View style={styles.seat}>
      <View style={[styles.avatar, { backgroundColor: mine ? colors.primary : player ? colors.neutralSoft : 'transparent', borderColor: colors.border }]}>
        <Text style={[styles.avatarText, { color: mine ? colors.onPrimary : colors.text }]}>{player ? player.pseudo.slice(0, 1).toUpperCase() : '?'}</Text>
      </View>
      <Text style={[styles.seatName, { color: player ? colors.text : colors.textMuted }]} numberOfLines={1}>
        {mine ? t('multi.duel.me') : player?.pseudo ?? t('multi.duel.empty_seat')}
      </Text>
    </View>
  );
  return (
    <View style={styles.versus} accessible accessibilityLabel={opponent ? t('multi.duel.vs', { a: t('multi.duel.me'), b: opponent.pseudo }) : t('multi.duel.waiting')}>
      {seat(me, true)}
      <Animated.Text entering={ZoomIn.springify()} style={[styles.vs, { color: colors.primaryText }]}>VS</Animated.Text>
      {seat(opponent, false)}
    </View>
  );
}

/** The duel is open: everyone on the server sees it (or, private, whoever has its code) */
function Waiting({ duel, colors, serverName, onCancel }: { duel: Duel; colors: UiColors; serverName: string; onCancel: () => void }) {
  const { t } = useTranslation();
  const share = () => Share.share({ message: t('multi.duel.share_message', { code: duel.code, server: serverName }) });
  return (
    <View style={styles.center}>
      <Animated.View entering={FadeInDown.springify()} style={[styles.card, styles.waitingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Versus me={duel.me} opponent={null} colors={colors} />
        <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.chipText, { color: colors.primaryText }]}>
            {duel.private ? '🔒 ' : ''}{t(`difficulty.${duel.difficulty}`)}
          </Text>
        </View>

        <Text style={[styles.waitingHelp, { color: colors.textMuted }]}>
          {duel.private ? t('multi.duel.give_code') : t('multi.duel.listed', { server: serverName })}
        </Text>
        <View
          style={styles.codeTiles}
          accessible
          accessibilityLabel={t('multi.duel.code_a11y', { code: duel.code.split('').join(' ') })}
        >
          {duel.code.split('').map((char, i) => (
            <Animated.View key={i} entering={FadeIn.delay(80 * i)} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.tileText, { color: colors.text }]}>{char}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.waitingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.muted, styles.noMargin, { color: colors.textMuted }]}>{t('multi.duel.waiting')}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={share} style={[styles.actionButton, { backgroundColor: colors.primary }]} accessibilityRole="button">
            <Text style={[styles.actionText, { color: colors.onPrimary }]}>{t('multi.duel.share')}</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={[styles.actionButton, { backgroundColor: colors.dangerSoft }]} accessibilityRole="button">
            <Text style={[styles.actionText, { color: colors.danger }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/** The bar above a board: who, connected or not, how many moves */
function PlayerBar({ player, moves, colors, isMe, width }: { player: DuelSide; moves: number; colors: UiColors; isMe: boolean; width: number }) {
  const { t } = useTranslation();
  const name = isMe ? t('multi.duel.me') : player.pseudo;
  const away = !isMe && !player.connected;
  return (
    <View
      style={[styles.playerBar, { width, backgroundColor: isMe ? colors.primarySoft : colors.card }]}
      accessible
      accessibilityLabel={`${name}${away ? `, ${t('multi.duel.away')}` : ''}, ${t('multi.moves', { count: moves })}`}
    >
      <View style={[styles.dot, { backgroundColor: away ? colors.danger : colors.success }]} />
      <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
      {away && <Text style={[styles.away, { color: colors.danger }]}>{t('multi.duel.away')}</Text>}
      <View style={styles.moves}>
        <Text style={[styles.movesLabel, { color: colors.textMuted }]}>{t('game.moves')}</Text>
        <Text style={[styles.movesValue, { color: colors.text }]}>{moves}</Text>
      </View>
    </View>
  );
}

interface ArenaProps {
  duel: Duel;
  now: number;
  colors: UiColors;
  offline: boolean;
  onMove: (vehicleId: string, row: number, col: number) => void;
}

/** The game: the opponent at the top (small, read only), me at the bottom */
function Arena({ duel, now, colors, offline, onMove }: ArenaProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  const level = duel.level!;
  const countdown = countdownMs(duel, now);
  const won = iHaveWon(duel);
  const space = Math.max(0, height - BARS_HEIGHT - insets.bottom);
  const mySize = Math.min(width - RFValue(32), space * 0.62);
  const opponentSize = Math.min(width * 0.62, space - mySize);
  const time = formatDuration(duelElapsedMs(duel, now));

  return (
    <View style={styles.arena} onLayout={onLayout}>
      {height > 0 && duel.opponent && (
        <>
          <PlayerBar player={duel.opponent} moves={duel.opponent.moves.length} colors={colors} isMe={false} width={opponentSize} />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: duel.opponent.connected ? 1 : 0.5 }}>
            <Board
              gridSize={level.gridSize}
              vehicles={duel.opponent.vehicles}
              exitRow={level.exitRow}
              exitCol={level.exitCol}
              onMoveEnd={noop}
              readOnly
              size={opponentSize}
            />
          </View>

          <View
            style={[styles.clock, { backgroundColor: offline ? colors.dangerSoft : colors.card }]}
            accessible
            accessibilityLabel={offline ? t('multi.duel.reconnecting') : t('multi.time_a11y', { time })}
          >
            <Text style={[styles.clockText, { color: offline ? colors.danger : colors.text }]}>
              {offline ? `📡 ${t('multi.duel.reconnecting')}` : `⏱ ${time}`}
            </Text>
          </View>

          <PlayerBar player={duel.me} moves={duel.me.moves.length + duel.pending.length} colors={colors} isMe width={mySize} />
          <View>
            <Board
              gridSize={level.gridSize}
              vehicles={duel.me.vehicles}
              exitRow={level.exitRow}
              exitCol={level.exitCol}
              onMoveEnd={onMove}
              readOnly={countdown > 0 || won || duel.status !== 'playing'}
              size={mySize}
            />
            {countdown > 0 && (
              <View style={[StyleSheet.absoluteFill, styles.countdown]} pointerEvents="none">
                <Animated.Text
                  key={Math.ceil(countdown / 1000)}
                  entering={ZoomIn.springify()}
                  style={[styles.countdownText, { color: fixedColors.onPrimary }]}
                  accessibilityLiveRegion="assertive"
                >
                  {Math.ceil(countdown / 1000)}
                </Animated.Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const noop = () => {};

function Stat({ label, value, colors }: { label: string; value: string; colors: UiColors }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ResultModal({ duel, colors, onRematch, onQuit }: { duel: Duel; colors: UiColors; onRematch: () => void; onQuit: () => void }) {
  const { t } = useTranslation();
  const result = outcome(duel);
  if (!result || !duel.result) return null;
  const pseudo = duel.opponent?.pseudo ?? '';
  const emoji = result === 'win' ? '🏆' : result === 'draw' ? '🤝' : '🏁';
  const reason = duel.result.reason;
  const canRematch = !duel.opponentLeft && !!duel.opponent;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onQuit}>
      <View style={styles.overlay}>
        <Animated.View entering={ZoomIn.springify()} style={[styles.resultCard, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <Text style={styles.bigEmoji}>{emoji}</Text>
          <Text style={[styles.resultTitle, { color: colors.text }]} accessibilityRole="header">{t(`multi.duel.result_${result}`, { pseudo })}</Text>
          {reason !== 'won' && (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t(`multi.duel.reason_${reason}`, { pseudo })}</Text>
          )}

          <View style={[styles.stats, { backgroundColor: colors.card }]}>
            <Stat label={t('multi.duel.me')} value={String(duel.me.moves.length)} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />
            <Stat label={pseudo} value={String(duel.opponent?.moves.length ?? 0)} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />
            <Stat label={t('multi.duel.optimum')} value={duel.result.minMoves > 0 ? String(duel.result.minMoves) : '–'} colors={colors} />
          </View>
          {duel.result.timeMs !== null && (
            <Text style={[styles.resultTime, { color: colors.text }]}>⏱ {formatDuration(duel.result.timeMs)}</Text>
          )}

          {canRematch && duel.opponent?.wantsRematch && !duel.me.wantsRematch && (
            <Text style={[styles.muted, { color: colors.primaryText, fontWeight: '700' }]}>{t('multi.duel.rematch_asked', { pseudo })}</Text>
          )}
          {duel.opponentLeft && reason !== 'forfeit' && (
            <Text style={[styles.muted, { color: colors.textMuted }]}>{t('multi.duel.opponent_left', { pseudo })}</Text>
          )}
          {canRematch && (
            <Pressable
              onPress={onRematch}
              disabled={duel.me.wantsRematch}
              style={[styles.primaryButton, styles.wide, { backgroundColor: colors.primary, opacity: duel.me.wantsRematch ? 0.6 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {duel.me.wantsRematch ? t('multi.duel.rematch_waiting', { pseudo }) : `🔁 ${t('multi.duel.rematch')}`}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={onQuit} style={styles.link} accessibilityRole="button">
            <Text style={[styles.linkText, { color: colors.primaryText }]}>{t('multi.duel.quit')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
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
    padding: RFValue(20),
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: RFValue(20),
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  noticeCard: {
    gap: RFValue(8),
  },
  noticeText: {
    fontSize: RFValue(16),
    lineHeight: RFValue(22),
    textAlign: 'center',
  },
  bigEmoji: {
    fontSize: RFValue(48),
  },
  muted: {
    fontSize: RFValue(14),
    textAlign: 'center',
    marginTop: RFValue(8),
  },
  noMargin: {
    marginTop: 0,
  },
  primaryButton: {
    marginTop: RFValue(16),
    paddingVertical: RFValue(15),
    paddingHorizontal: RFValue(24),
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: RFValue(17),
    fontWeight: '800',
  },
  wide: {
    alignSelf: 'stretch',
  },
  link: {
    alignItems: 'center',
    padding: RFValue(14),
  },
  linkText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: RFValue(14),
  },
  seat: {
    alignItems: 'center',
    width: RFValue(96),
  },
  avatar: {
    width: RFValue(60),
    height: RFValue(60),
    borderRadius: RFValue(30),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: RFValue(24),
    fontWeight: '900',
  },
  seatName: {
    fontSize: RFValue(15),
    fontWeight: '800',
    marginTop: RFValue(6),
  },
  vs: {
    fontSize: RFValue(22),
    fontWeight: '900',
    fontStyle: 'italic',
  },
  waitingCard: {
    paddingVertical: RFValue(24),
  },
  chip: {
    borderRadius: 999,
    paddingVertical: RFValue(5),
    paddingHorizontal: RFValue(14),
    marginTop: RFValue(14),
  },
  chipText: {
    fontSize: RFValue(13),
    fontWeight: '800',
  },
  waitingHelp: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    textAlign: 'center',
    marginTop: RFValue(18),
  },
  codeTiles: {
    flexDirection: 'row',
    gap: RFValue(6),
    marginTop: RFValue(12),
  },
  tile: {
    width: RFValue(44),
    height: RFValue(54),
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    fontSize: RFValue(26),
    fontWeight: '900',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
    marginTop: RFValue(20),
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    marginTop: RFValue(20),
  },
  actionButton: {
    flex: 1,
    paddingVertical: RFValue(13),
    borderRadius: 14,
    alignItems: 'center',
  },
  actionText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  arena: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: RFValue(10),
  },
  playerBar: {
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
  playerName: {
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
  clock: {
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
  countdown: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: fixedColors.overlay,
    borderRadius: 12,
  },
  countdownText: {
    fontSize: RFValue(80),
    fontWeight: '900',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: fixedColors.overlay,
  },
  resultCard: {
    width: '86%',
    maxWidth: 400,
    borderRadius: 20,
    padding: RFValue(24),
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: RFValue(24),
    fontWeight: '800',
    marginTop: RFValue(6),
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: RFValue(16),
  },
  stat: {
    flex: 1,
    alignItems: 'center',
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
  resultTime: {
    fontSize: RFValue(17),
    fontWeight: '800',
    marginTop: RFValue(12),
    fontVariant: ['tabular-nums'],
  },
});
