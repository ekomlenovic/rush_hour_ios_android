import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { RFValue } from '@/utils/responsive';
import { formatDuration } from '@/utils/date';
import type { DuelListing } from '@/utils/multi/api';
import type { UiColors } from '@/theme';

interface Props {
  duels: DuelListing[] | null;
  /** When the list was last loaded (phone clock), for the time of the duels being played */
  loadedAt: number;
  colors: UiColors;
  myPlayerId: number;
  /** Server clock minus phone clock */
  clockOffset: number;
  disabled: boolean;
  onCreate: () => void;
  onCode: () => void;
  /** Join an open duel, or go back to mine (null code: the one I am in) */
  onOpen: (code: string | null) => void;
  /** Watch a duel being played by others */
  onWatch: (code: string) => void;
}

/** A dot that beats: the list is live */
function LiveDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.25, { duration: 900 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.liveDot, { backgroundColor: color }, style]} />;
}

/**
 * The duels of the server, live: the open ones, joined in one tap (no code needed),
 * and the ones being played, watched in one tap. The list grows with the duels.
 */
export default function DuelsCard({ duels, loadedAt, colors, myPlayerId, clockOffset, disabled, onCreate, onCode, onOpen, onWatch }: Props) {
  const { t } = useTranslation();
  const open = duels?.filter(d => d.status === 'waiting') ?? [];
  const playing = duels?.filter(d => d.status !== 'waiting') ?? [];

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('multi.duel.live_title')}</Text>
        <View style={[styles.live, { backgroundColor: colors.successSoft }]} accessible accessibilityLabel={t('multi.duel.live_a11y')}>
          <LiveDot color={colors.success} />
          <Text style={[styles.liveText, { color: colors.success }]}>{t('multi.duel.live')}</Text>
        </View>
        <Pressable
          onPress={onCode}
          disabled={disabled}
          style={[styles.iconButton, { backgroundColor: colors.neutralSoft }]}
          accessibilityRole="button"
          accessibilityLabel={t('multi.duel.have_code')}
          hitSlop={6}
        >
          <Ionicons name="keypad" size={18} color={colors.text} />
        </Pressable>
      </View>

      {duels === null && <ActivityIndicator color={colors.primary} style={styles.state} />}

      {duels !== null && duels.length === 0 && (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="flash" size={RFValue(28)} color={colors.primaryText} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('multi.duel.none_open')}</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('multi.duel.card_desc')}</Text>
        </View>
      )}

      {open.length > 0 && <Text style={[styles.section, { color: colors.textMuted }]}>{t('multi.duel.section_open')}</Text>}
      {open.map(duel => (
        <Animated.View key={`${duel.createdAt}-${duel.players[0]?.id}`} entering={FadeInDown.springify()} exiting={FadeOut} layout={LinearTransition}>
          <OpenRow duel={duel} colors={colors} disabled={disabled} onOpen={onOpen} />
        </Animated.View>
      ))}

      {playing.length > 0 && <Text style={[styles.section, { color: colors.textMuted }]}>{t('multi.duel.section_playing')}</Text>}
      {playing.map(duel => (
        <Animated.View key={`${duel.createdAt}-${duel.players[0]?.id}`} entering={FadeInDown.springify()} exiting={FadeOut} layout={LinearTransition}>
          <PlayingRow duel={duel} colors={colors} myPlayerId={myPlayerId} serverNow={loadedAt + clockOffset} disabled={disabled} onOpen={onOpen} onWatch={onWatch} />
        </Animated.View>
      ))}

      <Pressable
        onPress={onCreate}
        disabled={disabled}
        style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
        accessibilityRole="button"
        accessibilityHint={t('multi.duel.button_hint')}
      >
        <Ionicons name="add-circle" size={RFValue(20)} color={colors.onPrimary} />
        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>{t('multi.duel.create')}</Text>
      </Pressable>
    </View>
  );
}

/** The initial of a player in a round */
function Avatar({ pseudo, colors, mine = false }: { pseudo: string; colors: UiColors; mine?: boolean }) {
  return (
    <View style={[styles.avatar, { backgroundColor: mine ? colors.primary : colors.neutralSoft }]}>
      <Text style={[styles.avatarText, { color: mine ? colors.onPrimary : colors.text }]}>{pseudo.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function OpenRow({ duel, colors, disabled, onOpen }: { duel: DuelListing; colors: UiColors; disabled: boolean; onOpen: (code: string | null) => void }) {
  const { t } = useTranslation();
  const creator = duel.players[0];
  const label = duel.mine ? t('multi.duel.my_open') : creator.pseudo;
  const action = duel.mine ? t('multi.duel.back_to_it') : t('multi.duel.fight');
  const difficulty = `${t(`difficulty.${duel.difficulty}`)} · ${t(`multi.duel.metric_${duel.metric ?? 'time'}`)}`;
  return (
    <Pressable
      onPress={() => onOpen(duel.mine ? null : duel.code)}
      disabled={disabled}
      style={[styles.row, { backgroundColor: duel.mine ? colors.primarySoft : colors.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${difficulty}${duel.private ? `, ${t('multi.duel.private')}` : ''}, ${action}`}
    >
      <Avatar pseudo={creator.pseudo} colors={colors} mine={duel.mine} />
      <View style={styles.rowMain}>
        <View style={styles.rowTitle}>
          {duel.private && <Ionicons name="lock-closed" size={13} color={colors.textMuted} />}
          <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={[styles.detail, { color: colors.textMuted }]}>{difficulty} · {t('multi.duel.waiting_short')}</Text>
      </View>
      <View style={[styles.action, { backgroundColor: duel.mine ? colors.neutralSoft : colors.primary }]}>
        <Text style={[styles.actionText, { color: duel.mine ? colors.text : colors.onPrimary }]}>{action}</Text>
      </View>
    </Pressable>
  );
}

interface PlayingRowProps {
  duel: DuelListing;
  colors: UiColors;
  myPlayerId: number;
  serverNow: number;
  disabled: boolean;
  onOpen: (code: string | null) => void;
  onWatch: (code: string) => void;
}

function PlayingRow({ duel, colors, myPlayerId, serverNow, disabled, onOpen, onWatch }: PlayingRowProps) {
  const { t } = useTranslation();
  const [first, second] = duel.players;
  const name = (p: { id: number; pseudo: string }) => (p.id === myPlayerId ? t('multi.duel.me') : p.pseudo);
  const versus = second ? t('multi.duel.vs', { a: name(first), b: name(second) }) : name(first);
  // Mine, finished while I was away: its result waits for me
  const over = duel.status === 'over';
  const time = !over && duel.startsAt !== null && serverNow > duel.startsAt ? formatDuration(serverNow - duel.startsAt) : null;
  const back = over ? t('multi.duel.see_result') : t('multi.duel.back_to_it');
  const difficulty = `${t(`difficulty.${duel.difficulty}`)} · ${t(`multi.duel.metric_${duel.metric ?? 'time'}`)}`;
  // Someone else's duel: watched (a server older than the spectators gives no code)
  const watchable = !duel.mine && duel.code !== null;
  const spectators = duel.spectators ?? 0;
  const action = duel.mine ? `, ${back}` : watchable ? `, ${t('multi.duel.watch')}` : '';
  return (
    <Pressable
      onPress={() => (duel.mine ? onOpen(null) : duel.code && onWatch(duel.code))}
      disabled={!(duel.mine || watchable) || disabled}
      style={[styles.row, { backgroundColor: duel.mine ? (over ? colors.successSoft : colors.warningSoft) : 'transparent' }]}
      accessibilityRole={duel.mine || watchable ? 'button' : 'text'}
      accessibilityLabel={`${versus}, ${difficulty}, ${over ? t('multi.duel.over_short') : t('multi.duel.playing_short')}${spectators > 0 ? `, ${t('multi.duel.spectators', { count: spectators })}` : ''}${action}`}
    >
      <View style={styles.pair}>
        <Avatar pseudo={first.pseudo} colors={colors} mine={first.id === myPlayerId} />
        {second && <View style={styles.pairSecond}><Avatar pseudo={second.pseudo} colors={colors} mine={second.id === myPlayerId} /></View>}
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.pseudo, { color: colors.text }]} numberOfLines={1}>{versus}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>{difficulty}{over ? ` · ${t('multi.duel.over_short')}` : ''}{time ? ` · ${time}` : ''}{spectators > 0 && <> · <Ionicons name="eye-outline" size={13} color={colors.textMuted} /> {spectators}</>}</Text>
      </View>
      {duel.mine ? (
        <View style={[styles.action, { backgroundColor: over ? colors.success : colors.warning }]}>
          <Text style={[styles.actionText, { color: colors.onPrimary }]}>{back}</Text>
        </View>
      ) : watchable ? (
        <View style={[styles.action, styles.watch, { backgroundColor: colors.neutralSoft }]}>
          <Ionicons name="eye" size={14} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>{t('multi.duel.watch')}</Text>
        </View>
      ) : (
        <Ionicons name="flash" size={18} color={colors.warning} />
      )}
    </Pressable>
  );
}

const AVATAR = RFValue(34);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: RFValue(18),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  title: {
    flex: 1,
    fontSize: RFValue(22),
    fontWeight: '800',
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: RFValue(12),
    fontWeight: '800',
  },
  iconButton: {
    width: RFValue(34),
    height: RFValue(34),
    borderRadius: RFValue(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: {
    paddingVertical: RFValue(20),
  },
  empty: {
    alignItems: 'center',
    paddingVertical: RFValue(16),
    gap: RFValue(6),
  },
  emptyIcon: {
    width: RFValue(56),
    height: RFValue(56),
    borderRadius: RFValue(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: RFValue(4),
  },
  emptyTitle: {
    fontSize: RFValue(16),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: RFValue(13),
    lineHeight: RFValue(19),
    textAlign: 'center',
  },
  section: {
    fontSize: RFValue(12),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: RFValue(14),
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(10),
    paddingVertical: RFValue(10),
    paddingHorizontal: RFValue(10),
    borderRadius: 12,
    marginTop: RFValue(6),
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: RFValue(15),
    fontWeight: '900',
  },
  pair: {
    flexDirection: 'row',
  },
  pairSecond: {
    marginLeft: -AVATAR / 3,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pseudo: {
    flexShrink: 1,
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  detail: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: 2,
  },
  action: {
    paddingVertical: RFValue(8),
    paddingHorizontal: RFValue(12),
    borderRadius: 10,
  },
  actionText: {
    fontSize: RFValue(13),
    fontWeight: '800',
  },
  watch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: RFValue(16),
    paddingVertical: RFValue(15),
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: RFValue(17),
    fontWeight: '800',
  },
});
