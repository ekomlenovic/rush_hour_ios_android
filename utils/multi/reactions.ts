/**
 * Reactions in a duel, of a spectator to one of its two players or of a player to the other one: a closed list,
 * shared with the server (server/src/core.ts), which relays only these. No free text, so
 * nothing to moderate. Teasing ones annoy a little, always kindly; the others cheer.
 * `encourage` is a word of support, not an emoji: the player reads who encourages them.
 * The ids go over the WebSocket: never rename one, only add at the end. An app that does
 * not know a reaction does not show it; the server says which ones it relays (`DuelView.reactions`).
 */

export type ReactionKind = 'tease' | 'cheer' | 'encourage';

export interface Reaction {
  id: string;
  kind: ReactionKind;
  /** What floats over the board; none for the encouragement, said in words */
  emoji: string | null;
}

export const REACTIONS = [
  { id: 'snail', kind: 'tease', emoji: '🐌' },
  { id: 'yawn', kind: 'tease', emoji: '🥱' },
  { id: 'sleep', kind: 'tease', emoji: '😴' },
  { id: 'popcorn', kind: 'tease', emoji: '🍿' },
  { id: 'eyes', kind: 'tease', emoji: '👀' },
  { id: 'monocle', kind: 'tease', emoji: '🧐' },
  { id: 'grimace', kind: 'tease', emoji: '😬' },
  { id: 'pinch', kind: 'tease', emoji: '🤏' },
  { id: 'hourglass', kind: 'tease', emoji: '⏳' },
  { id: 'peek', kind: 'tease', emoji: '🙈' },
  { id: 'clap', kind: 'cheer', emoji: '👏' },
  { id: 'fire', kind: 'cheer', emoji: '🔥' },
  { id: 'muscle', kind: 'cheer', emoji: '💪' },
  { id: 'rocket', kind: 'cheer', emoji: '🚀' },
  { id: 'encourage', kind: 'encourage', emoji: null },
] as const satisfies readonly Reaction[];

export type ReactionId = typeof REACTIONS[number]['id'];

export const REACTION_IDS: readonly ReactionId[] = REACTIONS.map(r => r.id);

export const isReactionId = (id: unknown): id is ReactionId => typeof id === 'string' && (REACTION_IDS as readonly string[]).includes(id);

export const reactionOf = (id: ReactionId): typeof REACTIONS[number] => REACTIONS.find(r => r.id === id)!;

/**
 * The phone sends REACTION_BURST reactions in a row, then pauses: one more each time the
 * first of them is REACTION_BURST_WINDOW_MS old. One every 2 s never waits.
 */
export const REACTION_BURST = 3;
export const REACTION_BURST_WINDOW_MS = 6000;
/**
 * Reactions of one person (spectator or player) in REACTIONS_WINDOW_MS at most, on the server:
 * the others are dropped. Above what the phone sends, whatever the delays of the network
 * (REACTION_BURST in REACTION_BURST_WINDOW_MS: 6 in 10 s at most)
 */
export const MAX_REACTIONS = 8;
export const REACTIONS_WINDOW_MS = 10_000;
/** One encouragement of a person to a same player in this time at most: it stays a real word of support */
export const ENCOURAGE_COOLDOWN_MS = 30_000;

/** The reactions sent lately by the phone (times, oldest first) that still count for the pause */
export const recentReactions = (sentAt: readonly number[], now: number) => sentAt.filter(at => now - at < REACTION_BURST_WINDOW_MS);

/** How many the phone may still send before the pause */
export const reactionsLeft = (sentAt: readonly number[], now: number) => Math.max(0, REACTION_BURST - recentReactions(sentAt, now).length);

/** Time before the next one may be sent: 0 if one is left */
export function reactionPauseMs(sentAt: readonly number[], now: number): number {
  const recent = recentReactions(sentAt, now);
  return recent.length < REACTION_BURST ? 0 : recent[recent.length - REACTION_BURST] + REACTION_BURST_WINDOW_MS - now;
}
