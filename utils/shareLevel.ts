import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { TFunction } from 'i18next';
import { useGameStore } from '@/store/gameStore';
import type { Level } from '@/store/types';
import { getShareUrl } from './sharing';

/**
 * Sends a level with the system share sheet: the link is in the message,
 * the only field read on Android too. Counts for the "sharer" achievement.
 */
export async function shareLevel(t: TFunction, level: Level, title: string): Promise<void> {
  const url = getShareUrl(level);
  const message = level.name
    ? t('game.share_message_named', { name: title, moves: level.minMoves, url })
    : t('game.share_message', { moves: level.minMoves, url });
  try {
    const result = await Share.share({ message });
    if (result.action === Share.sharedAction) {
      useGameStore.getState().recordLevelShared();
    }
  } catch (error) {
    console.error('Sharing failed', error);
  }
}

/** Copies the link of a level; counts as a share */
export async function copyLevelLink(level: Level): Promise<void> {
  await Clipboard.setStringAsync(getShareUrl(level));
  useGameStore.getState().recordLevelShared();
}
