import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeOut, Keyframe } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import type { DuelReaction, DuelSide } from '@/utils/multi/duel';
import { ENCOURAGE_COOLDOWN_MS, REACTION_COOLDOWN_MS, reactionOf, type ReactionId } from '@/utils/multi/reactions';

/** Room the reactions of a spectator take under the boards */
export const REACTION_TRAY_HEIGHT = RFValue(108);

/** Where the emojis rise over the board, in turn (% of its width): never all at the same place */
const LANES = [14, 58, 34, 78, 46, 22, 68, 40];

/** An emoji pops up from the bottom of the board and rises a little; without the animations, it is just there */
const RISE = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 36 }, { scale: 0.4 }] },
  35: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1.25 }] },
  100: { opacity: 1, transform: [{ translateY: -24 }, { scale: 1 }] },
}).duration(1100);

interface OverlayProps {
  /** The reactions to show now over this board (reactionsFor) */
  reactions: DuelReaction[];
  /** The player of the board; null: my own board */
  target: string | null;
  /** Me, when I watch: my own reactions say "you" */
  myId: number | null;
  colors: UiColors;
}

/**
 * The reactions of the spectators aimed at the player of a board, over it: the emojis
 * rise with who sent them, the last encouragement is said at the top. Nothing to touch:
 * the board under it is played as usual, and the screen reader reads the board, not this.
 */
export function ReactionOverlay({ reactions, target, myId, colors }: OverlayProps) {
  const { t } = useTranslation();
  const emojis = reactions.filter(r => reactionOf(r.reaction).emoji);
  const encouragement = [...reactions].reverse().find(r => r.reaction === 'encourage');
  const sender = (r: DuelReaction) => (r.from.id === myId ? t('multi.duel.me') : r.from.pseudo);
  const encouraged = (r: DuelReaction) => (target === null
    ? t('multi.reactions.encourages_you', { pseudo: r.from.pseudo })
    : r.from.id === myId
      ? t('multi.reactions.you_encourage', { pseudo: target })
      : t('multi.reactions.encourages', { from: r.from.pseudo, pseudo: target }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {emojis.map(r => (
        <Animated.View key={r.seq} entering={RISE} exiting={FadeOut.duration(300)} style={[styles.bubble, { left: `${LANES[r.seq % LANES.length]}%` }]}>
          <Text style={styles.emoji}>{reactionOf(r.reaction).emoji}</Text>
          <Text style={[styles.sender, { backgroundColor: colors.surface, color: colors.text }]} numberOfLines={1}>{sender(r)}</Text>
        </Animated.View>
      ))}
      {encouragement && (
        <Animated.View key={encouragement.seq} entering={FadeInDown.springify()} exiting={FadeOut.duration(300)} style={[styles.cheer, { backgroundColor: colors.primary }]}>
          <Ionicons name="megaphone" size={RFValue(16)} color={colors.onPrimary} />
          <Text style={[styles.cheerText, { color: colors.onPrimary }]} numberOfLines={1}>{encouraged(encouragement)}</Text>
        </Animated.View>
      )}
    </View>
  );
}

interface TrayProps {
  /** The two players, the one of the board at the top first */
  players: [DuelSide, DuelSide];
  /** What the server relays */
  available: ReactionId[];
  colors: UiColors;
  width: number;
  /** The clock of the screen, for the waits between two reactions */
  now: number;
  onReact: (playerId: number, reaction: ReactionId) => void;
}

/**
 * What a spectator sends to a player: who (the board at the top or at the bottom), then
 * an emoji to tease or cheer them, or a word of encouragement. A short wait between two
 * reactions (the server drops the extra ones), a longer one between two encouragements
 * of the same player.
 */
export function ReactionTray({ players, available, colors, width, now, onReact }: TrayProps) {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState(players[0].id);
  const [waitUntil, setWaitUntil] = useState(0);
  const [encouragedAt, setEncouragedAt] = useState<Record<number, number>>({});
  const target = players.find(p => p.id === targetId) ?? players[0];
  const waiting = now < waitUntil;
  const encouraged = now - (encouragedAt[target.id] ?? -Infinity) < ENCOURAGE_COOLDOWN_MS;
  const emojis = available.map(reactionOf).filter(r => r.emoji);
  const canEncourage = available.includes('encourage');

  const send = (reaction: ReactionId) => {
    const at = Date.now();
    if (at < waitUntil) return;
    if (reaction === 'encourage') {
      if (at - (encouragedAt[target.id] ?? -Infinity) < ENCOURAGE_COOLDOWN_MS) return;
      setEncouragedAt(previous => ({ ...previous, [target.id]: at }));
    }
    setWaitUntil(at + REACTION_COOLDOWN_MS);
    haptics.selectionAsync();
    onReact(target.id, reaction);
  };

  return (
    <View style={[styles.tray, { width, backgroundColor: colors.card }]}>
      <View style={styles.trayRow}>
        {players.map((player, i) => {
          const selected = player.id === target.id;
          return (
            <Pressable
              key={player.id}
              onPress={() => setTargetId(player.id)}
              style={[styles.target, { backgroundColor: selected ? colors.primary : colors.neutralSoft }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t('multi.reactions.target_a11y', { pseudo: player.pseudo })}
            >
              <Ionicons name={i === 0 ? 'arrow-up' : 'arrow-down'} size={RFValue(13)} color={selected ? colors.onPrimary : colors.textMuted} />
              <Text style={[styles.targetText, { color: selected ? colors.onPrimary : colors.text }]} numberOfLines={1}>{player.pseudo}</Text>
            </Pressable>
          );
        })}
        {canEncourage && (
          <Pressable
            onPress={() => send('encourage')}
            disabled={waiting || encouraged}
            style={[styles.encourage, { backgroundColor: colors.primarySoft, opacity: waiting || encouraged ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: waiting || encouraged }}
            accessibilityLabel={t(encouraged ? 'multi.reactions.encouraged_a11y' : 'multi.reactions.encourage_a11y', { pseudo: target.pseudo })}
          >
            <Ionicons name={encouraged ? 'checkmark' : 'megaphone-outline'} size={RFValue(15)} color={colors.primaryText} />
            <Text style={[styles.encourageText, { color: colors.primaryText }]} numberOfLines={1}>
              {t(encouraged ? 'multi.reactions.encouraged' : 'multi.reactions.encourage')}
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
        {emojis.map((reaction, i) => (
          <React.Fragment key={reaction.id}>
            {i > 0 && emojis[i - 1].kind !== reaction.kind && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
            <Pressable
              onPress={() => send(reaction.id)}
              disabled={waiting}
              style={({ pressed }) => [styles.emojiButton, { backgroundColor: pressed ? colors.neutralSoft : 'transparent', opacity: waiting ? 0.4 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: waiting }}
              accessibilityLabel={t('multi.reactions.send_a11y', { reaction: t(`multi.reactions.names.${reaction.id}`), pseudo: target.pseudo })}
            >
              <Text style={styles.emojiButtonText}>{reaction.emoji}</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    bottom: '16%',
    width: RFValue(64),
    marginLeft: -RFValue(32),
    alignItems: 'center',
  },
  emoji: {
    fontSize: RFValue(34),
  },
  sender: {
    maxWidth: RFValue(64),
    marginTop: -RFValue(4),
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: RFValue(10),
    fontWeight: '800',
  },
  cheer: {
    position: 'absolute',
    top: RFValue(8),
    alignSelf: 'center',
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(12),
  },
  cheerText: {
    flexShrink: 1,
    fontSize: RFValue(14),
    fontWeight: '800',
  },
  tray: {
    borderRadius: 14,
    paddingVertical: RFValue(8),
    paddingHorizontal: RFValue(8),
    marginTop: RFValue(10),
    gap: RFValue(6),
  },
  trayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(6),
  },
  target: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(10),
  },
  targetText: {
    flexShrink: 1,
    fontSize: RFValue(13),
    fontWeight: '800',
  },
  encourage: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: RFValue(6),
    paddingHorizontal: RFValue(10),
  },
  encourageText: {
    fontSize: RFValue(13),
    fontWeight: '800',
  },
  emojiRow: {
    alignItems: 'center',
    gap: 2,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonText: {
    fontSize: RFValue(24),
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
});
