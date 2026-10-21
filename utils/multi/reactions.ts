/**
 * Reactions of the spectators of a duel, aimed at one of its two players: a closed list,
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

/** Reactions of one spectator in REACTIONS_WINDOW_MS at most, on the server: the others are dropped */
export const MAX_REACTIONS = 5;
export const REACTIONS_WINDOW_MS = 10_000;
/** One encouragement of a spectator to a player in this time at most: it stays a real word of support */
export const ENCOURAGE_COOLDOWN_MS = 30_000;
/** Between two reactions of the phone: under the limit of the server, whatever the delays of the network */
export const REACTION_COOLDOWN_MS = 2500;
