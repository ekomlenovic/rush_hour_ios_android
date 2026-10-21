import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, FadeOut, Keyframe } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import type { DuelReaction, DuelSide } from '@/utils/multi/duel';
import {
  ENCOURAGE_COOLDOWN_MS, REACTION_BURST, reactionOf, reactionPauseMs, reactionsLeft, recentReactions, type ReactionId,
} from '@/utils/multi/reactions';

/** Room the reactions of a spectator take under the boards */
export const REACTION_TRAY_HEIGHT = RFValue(108);
/** Height of the row of reactions a player opens over the board of the other one */
export const REACTION_PICKER_HEIGHT = 52;

/** Where the emojis rise over the board, in turn (% of its width): never all at the same place */
const LANES = [14, 58, 34, 78, 46, 22, 68, 40];
/** Width of the emoji, centered on its lane */
const EMOJI_BOX = RFValue(44);

/** An emoji comes up from the bottom of the board and rises a little; without the animations, it is just there */
const RISE = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 36 }] },
  35: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 1, transform: [{ translateY: -24 }] },
}).duration(1100);

interface OverlayProps {
  /** The reactions to show now over this board (reactionsFor) */
  reactions: DuelReaction[];
  /** Side of the board: the emojis and the whole pseudos stay inside it */
  size: number;
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
export function ReactionOverlay({ reactions, size, target, myId, colors }: OverlayProps) {
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
        <Bubble key={r.seq} reaction={r} label={sender(r)} size={size} colors={colors} />
      ))}
      {encouragement && (
        <Animated.View key={encouragement.seq} entering={FadeInDown.springify()} exiting={FadeOut.duration(300)} style={[styles.cheer, { backgroundColor: colors.primary }]}>
          <Ionicons name="megaphone" size={RFValue(16)} color={colors.onPrimary} />
          <Text style={[styles.cheerText, { color: colors.onPrimary }]} numberOfLines={2}>{encouraged(encouragement)}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/** An emoji at its lane, with the whole pseudo of who sent it centered under it, both kept inside the board */
function Bubble({ reaction, label, size, colors }: { reaction: DuelReaction; label: string; size: number; colors: UiColors }) {
  const x = (LANES[reaction.seq % LANES.length] / 100) * size;
  // The pseudo is measured once drawn, then centered under the emoji
  const [labelWidth, setLabelWidth] = useState(0);
  const around = (width: number) => Math.max(2, Math.min(x - width / 2, size - width - 2));
  return (
    <Animated.View entering={RISE} exiting={FadeOut.duration(300)} style={[styles.bubble, { width: size }]}>
      <Text style={[styles.emoji, { marginLeft: around(EMOJI_BOX) }]}>{reactionOf(reaction.reaction).emoji}</Text>
      {/* A little smaller on a small board rather than cut */}
      <Text
        onLayout={e => setLabelWidth(e.nativeEvent.layout.width)}
        style={[styles.sender, {
          marginLeft: around(labelWidth), maxWidth: size - 4, opacity: labelWidth > 0 ? 1 : 0, backgroundColor: colors.surface, color: colors.text,
        }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * Sends the reactions of the phone: a few in a row, then a pause (the server drops the extra
 * ones), and a longer wait between two encouragements of the same player. Kept by the screen
 * of the duel, through the rematches, as the server keeps its own waits; a reaction not sent
 * (offline) counts for nothing.
 */
export function useReactionSender(onReact: (playerId: number, reaction: ReactionId) => boolean, now: number) {
  // Read at once by the next touch, before the screen is drawn again
  const sentAt = useRef<number[]>([]);
  const encouragedAt = useRef<Record<number, number>>({});
  const [, redraw] = useState(0);
  const isEncouraged = (playerId: number, at = now) => at - (encouragedAt.current[playerId] ?? -Infinity) < ENCOURAGE_COOLDOWN_MS;

  /** False if it has to wait */
  const send = (playerId: number, reaction: ReactionId) => {
    const at = Date.now();
    if (reactionsLeft(sentAt.current, at) === 0 || (reaction === 'encourage' && isEncouraged(playerId, at))) return false;
    if (!onReact(playerId, reaction)) return false;
    sentAt.current = [...recentReactions(sentAt.current, at), at];
    if (reaction === 'encourage') encouragedAt.current = { ...encouragedAt.current, [playerId]: at };
    redraw(n => n + 1);
    haptics.selectionAsync();
    return true;
  };

  // The clock of the screen, a little late: never more left than really are
  const left = Math.min(reactionsLeft(sentAt.current, now), reactionsLeft(sentAt.current, Date.now()));
  return { send, left, waiting: left === 0, pauseMs: reactionPauseMs(sentAt.current, now), isEncouraged };
}

export type ReactionSender = ReturnType<typeof useReactionSender>;

/** Seconds of the pause, shown on the buttons */
export const pauseSeconds = (sender: ReactionSender) => Math.max(1, Math.ceil(sender.pauseMs / 1000));

/** What is left before the pause: a dot for each reaction, or the time of the pause */
function ReactionCharges({ sender, colors }: { sender: ReactionSender; colors: UiColors }) {
  const { t } = useTranslation();
  if (sender.waiting) {
    return (
      <View style={styles.charges} accessible accessibilityLabel={t('multi.reactions.pause_a11y', { count: pauseSeconds(sender) })}>
        <Ionicons name="hourglass-outline" size={RFValue(13)} color={colors.warning} />
        <Text style={[styles.pauseText, { color: colors.warning }]}>{t('multi.reactions.pause', { count: pauseSeconds(sender) })}</Text>
      </View>
    );
  }
  return (
    <View style={styles.charges} accessible accessibilityLabel={t('multi.reactions.left_a11y', { count: sender.left })}>
      {Array.from({ length: REACTION_BURST }, (_, i) => (
        <View key={i} style={[styles.charge, { backgroundColor: i < sender.left ? colors.primary : colors.neutralSoft }]} />
      ))}
    </View>
  );
}

/** The emoji buttons, the teasing ones then the cheering ones */
function EmojiButtons({ available, target, sender, colors }: {
  available: ReactionId[]; target: DuelSide; sender: ReactionSender; colors: UiColors;
}) {
  const { t } = useTranslation();
  const emojis = available.map(reactionOf).filter(r => r.emoji);
  return (
    <>
      {emojis.map((reaction, i) => (
        <React.Fragment key={reaction.id}>
          {i > 0 && emojis[i - 1].kind !== reaction.kind && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          <Pressable
            onPress={() => sender.send(target.id, reaction.id)}
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
 * tease or cheer them, or a word of encouragement; a few in a row, then a short pause.
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
        <ReactionCharges sender={sender} colors={colors} />
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
 * (mine stays free to play): a few in a row; the row closes at the pause (the screen does).
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
              onPress={() => sender.send(opponent.id, 'encourage')}
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
        <EmojiButtons available={available} target={opponent} sender={sender} colors={colors} />
      </ScrollView>
      <ReactionCharges sender={sender} colors={colors} />
      <Pressable onPress={onClose} style={styles.emojiButton} accessibilityRole="button" accessibilityLabel={t('multi.reactions.close_a11y')}>
        <Ionicons name="close" size={RFValue(20)} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 0,
    bottom: '16%',
    alignItems: 'flex-start',
  },
  emoji: {
    width: EMOJI_BOX,
    textAlign: 'center',
    fontSize: RFValue(34),
  },
  sender: {
    marginTop: -RFValue(4),
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: RFValue(11),
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
    borderRadius: 18,
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
  charges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  charge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pauseText: {
    fontSize: RFValue(12),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
