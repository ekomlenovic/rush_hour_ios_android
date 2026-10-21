import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, FadeOut, Keyframe } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import type { DuelReaction, DuelSide } from '@/utils/multi/duel';
import { ENCOURAGE_COOLDOWN_MS, REACTION_COOLDOWN_MS, reactionOf, type ReactionId } from '@/utils/multi/reactions';

/** Room the reactions of a spectator take under the boards */
export const REACTION_TRAY_HEIGHT = RFValue(108);
/** Height of the row of reactions a player opens over the board of the other one */
export const REACTION_PICKER_HEIGHT = 52;

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
  /** Me: my own reactions say "you" */
  myId: number | null;
  colors: UiColors;
}

/**
 * The reactions aimed at the player of a board, over it: the emojis rise with who sent
 * them, the last encouragement is said at the top. Nothing to touch: the board under it is
 * played as usual, and the screen reader reads the board, not this.
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

/**
 * Sends the reactions of the phone: a short wait between two of them (the server drops the
 * extra ones), a longer one between two encouragements of the same player. Kept by the
 * screen of the duel, through the rematches, as the server keeps its own waits; a reaction
 * not sent (offline) starts no wait.
 */
export function useReactionSender(onReact: (playerId: number, reaction: ReactionId) => boolean, now: number) {
  const [waitUntil, setWaitUntil] = useState(0);
  const [encouragedAt, setEncouragedAt] = useState<Record<number, number>>({});
  const isEncouraged = (playerId: number, at = now) => at - (encouragedAt[playerId] ?? -Infinity) < ENCOURAGE_COOLDOWN_MS;

  /** False if it has to wait */
  const send = (playerId: number, reaction: ReactionId) => {
    const at = Date.now();
    if (at < waitUntil || (reaction === 'encourage' && isEncouraged(playerId, at))) return false;
    if (!onReact(playerId, reaction)) return false;
    if (reaction === 'encourage') setEncouragedAt(previous => ({ ...previous, [playerId]: at }));
    setWaitUntil(at + REACTION_COOLDOWN_MS);
    haptics.selectionAsync();
    return true;
  };

  return { send, waiting: now < waitUntil, isEncouraged };
}

export type ReactionSender = ReturnType<typeof useReactionSender>;

/** The emoji buttons, the teasing ones then the cheering ones */
function EmojiButtons({ available, target, sender, colors, onSent }: {
  available: ReactionId[]; target: DuelSide; sender: ReactionSender; colors: UiColors; onSent?: () => void;
}) {
  const { t } = useTranslation();
  const emojis = available.map(reactionOf).filter(r => r.emoji);
  return (
    <>
      {emojis.map((reaction, i) => (
        <React.Fragment key={reaction.id}>
          {i > 0 && emojis[i - 1].kind !== reaction.kind && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          <Pressable
            onPress={() => sender.send(target.id, reaction.id) && onSent?.()}
            disabled={sender.waiting}
            style={({ pressed }) => [styles.emojiButton, { backgroundColor: pressed ? colors.neutralSoft : 'transparent', opacity: sender.waiting ? 0.4 : 1 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: sender.waiting }}
            accessibilityLabel={t('multi.reactions.send_a11y', { reaction: t(`multi.reactions.names.${reaction.id}`), pseudo: target.pseudo })}
          >
            <Text style={styles.emojiButtonText}>{reaction.emoji}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </>
  );
}

interface TrayProps {
  /** Who the reactions go to: chosen by touching their board or their bar */
  target: DuelSide;
  /** Their board is the one at the top */
  targetOnTop: boolean;
  /** What the server relays */
  available: ReactionId[];
  sender: ReactionSender;
  colors: UiColors;
  width: number;
}

/**
 * What a spectator sends to the player chosen above (their board is framed): an emoji to
 * tease or cheer them, or a word of encouragement.
 */
export function ReactionTray({ target, targetOnTop, available, sender, colors, width }: TrayProps) {
  const { t } = useTranslation();
  const encouraged = sender.isEncouraged(target.id);
  const canEncourage = available.includes('encourage');

  return (
    <View style={[styles.tray, { width, backgroundColor: colors.card }]}>
      <View style={styles.trayRow}>
        <View style={styles.trayTarget} accessible accessibilityLiveRegion="polite" accessibilityLabel={t('multi.reactions.to', { pseudo: target.pseudo })}>
          <Ionicons name={targetOnTop ? 'arrow-up' : 'arrow-down'} size={RFValue(15)} color={colors.primaryText} />
          <View style={styles.trayTargetText}>
            <Text style={[styles.trayTargetName, { color: colors.text }]} numberOfLines={1}>{t('multi.reactions.to', { pseudo: target.pseudo })}</Text>
            <Text style={[styles.trayHint, { color: colors.textMuted }]} numberOfLines={1}>{t('multi.reactions.change_hint')}</Text>
          </View>
        </View>
        {canEncourage && (
          <Pressable
            onPress={() => sender.send(target.id, 'encourage')}
            disabled={sender.waiting || encouraged}
            style={[styles.encourage, { backgroundColor: colors.primarySoft, opacity: sender.waiting || encouraged ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: sender.waiting || encouraged }}
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
        <EmojiButtons available={available} target={target} sender={sender} colors={colors} />
      </ScrollView>
    </View>
  );
}

interface PickerProps {
  /** The other player: the reactions go to them */
  opponent: DuelSide;
  available: ReactionId[];
  sender: ReactionSender;
  colors: UiColors;
  onClose: () => void;
}

/**
 * The reactions of a player for the other one, in a row over the board of the other one
 * (mine stays free to play): one touch sends it and closes the row.
 */
export function ReactionPicker({ opponent, available, sender, colors, onClose }: PickerProps) {
  const { t } = useTranslation();
  const encouraged = sender.isEncouraged(opponent.id);
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow} style={styles.pickerScroll}>
        {available.includes('encourage') && (
          <>
            <Pressable
              onPress={() => sender.send(opponent.id, 'encourage') && onClose()}
              disabled={sender.waiting || encouraged}
              style={[styles.emojiButton, { opacity: sender.waiting || encouraged ? 0.4 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: sender.waiting || encouraged }}
              accessibilityLabel={t(encouraged ? 'multi.reactions.encouraged_a11y' : 'multi.reactions.encourage_a11y', { pseudo: opponent.pseudo })}
            >
              <Ionicons name={encouraged ? 'checkmark' : 'megaphone-outline'} size={RFValue(22)} color={colors.primaryText} />
            </Pressable>
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          </>
        )}
        <EmojiButtons available={available} target={opponent} sender={sender} colors={colors} onSent={onClose} />
      </ScrollView>
      <Pressable onPress={onClose} style={styles.emojiButton} accessibilityRole="button" accessibilityLabel={t('multi.reactions.close_a11y')}>
        <Ionicons name="close" size={RFValue(20)} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
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
    gap: RFValue(8),
  },
  trayTarget: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: RFValue(4),
  },
  trayTargetText: {
    flex: 1,
  },
  trayTargetName: {
    fontSize: RFValue(14),
    fontWeight: '800',
  },
  trayHint: {
    fontSize: RFValue(11),
    fontWeight: '600',
  },
  encourage: {
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
  picker: {
    height: REACTION_PICKER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  pickerScroll: {
    flex: 1,
  },
});
