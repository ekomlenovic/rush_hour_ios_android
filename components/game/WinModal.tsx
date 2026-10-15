import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { formatDuration } from '@/utils/date';
import { GameColors } from './colors';

interface Props {
  visible: boolean;
  colors: GameColors;
  isDark: boolean;
  stars: number;
  moveCount: number;
  minMoves: number;
  score: number;
  timeMs: number | null;
  /** Achievements unlocked by this win (shown here instead of the global toast) */
  unlocks: string[];
  missionReward: { freezeGranted: boolean } | null;
  /** Daily / weekly challenge: the result can be shared */
  canShareResult: boolean;
  onShareResult: () => void;
  onContinue: () => void;
  onRequestClose: () => void;
}

export default function WinModal({
  visible, colors, isDark, stars, moveCount, minMoves, score, timeMs, unlocks, missionReward,
  canShareResult, onShareResult, onContinue, onRequestClose,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.winOverlay}>
        <View
          style={[styles.winCard, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}
        >
          <Text style={styles.winStars}>
            {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </Text>
          <Text style={[styles.winTitle, { color: colors.accent }]}>{t('game.level_complete')}</Text>
          <Text style={[styles.winScore, { color: colors.text }]}>
            {t('game.win_stats', { moves: moveCount, best: minMoves, score: score })}
          </Text>
          {timeMs !== null && timeMs > 0 && (
            <Text style={[styles.winTime, { color: colors.sub }]}>
              ⏱️ {formatDuration(timeMs)}
            </Text>
          )}
          {unlocks.length > 0 && (
            <View style={[styles.winUnlocks, { backgroundColor: colors.card }]}>
              <Text style={styles.winUnlocksTitle}>{t('achievements.unlocked')}</Text>
              {unlocks.map((id) => (
                <Text key={id} style={[styles.winUnlockItem, { color: colors.text }]}>
                  {ACHIEVEMENTS_BY_ID[id]?.icon} {t(`achievements.${id}`)}
                </Text>
              ))}
            </View>
          )}
          {missionReward && (
            <View style={[styles.winUnlocks, { backgroundColor: colors.card }]}>
              <Text style={styles.winUnlocksTitle}>🎯 {t('missions.completed')}</Text>
              <Text style={[styles.winUnlockItem, { color: colors.text }]}>
                {missionReward.freezeGranted ? t('missions.reward_freeze') : t('missions.reward_full')}
              </Text>
            </View>
          )}
          {canShareResult && (
            <Pressable
              style={[styles.winButton, styles.winShareButton, { borderColor: colors.accent }]}
              onPress={onShareResult}
            >
              <Text style={[styles.winButtonText, { color: colors.accent }]}>📤 {t('share.share_result')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.winButton, { backgroundColor: colors.accent }]}
            onPress={onContinue}
          >
           <Text style={styles.winButtonText}>{t('common.continue')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  winOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  winCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 280,
  },
  winStars: {
    fontSize: 36,
    marginBottom: 8,
  },
  winTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  winScore: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  winShareButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    marginBottom: 12,
  },
  winTime: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -16,
    marginBottom: 20,
    textAlign: 'center',
  },
  winUnlocks: {
    alignSelf: 'stretch',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  winUnlocksTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  winUnlockItem: {
    fontSize: 15,
    fontWeight: '700',
    marginVertical: 2,
  },
  winButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  winButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
