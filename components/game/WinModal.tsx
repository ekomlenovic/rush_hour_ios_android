import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, AccessibilityInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { formatDuration } from '@/utils/date';
import { fixedColors, type UiColors } from '@/theme';

interface Props {
  visible: boolean;
  colors: UiColors;
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
  onShowSolution: () => void;
  /** Map and custom levels only, when not optimal: replay the level for 3 stars */
  onRetry?: () => void;
  onContinue: () => void;
  onRequestClose: () => void;
}

export default function WinModal({
  visible, colors, stars, moveCount, minMoves, score, timeMs, unlocks, missionReward,
  canShareResult, onShareResult, onShowSolution, onRetry, onContinue, onRequestClose,
}: Props) {
  const isOptimal = moveCount <= minMoves;
  const { t } = useTranslation();

  // Screen readers: the win is announced at once, before the player explores the card
  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility(t('a11y.win', {
      title: t('game.level_complete'),
      stars,
      stats: t('game.win_stats', { moves: moveCount, best: minMoves, score }),
    }));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.winOverlay}>
        <View
          style={[styles.winCard, { backgroundColor: colors.surface }]}
        >
          <Text style={styles.winStars} accessibilityLabel={t('a11y.level_stars', { count: stars })}>
            {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </Text>
          <Text style={[styles.winTitle, { color: colors.primaryText }]} accessibilityRole="header">{t('game.level_complete')}</Text>
          <Text style={[styles.winScore, { color: colors.text }]}>
            {t('game.win_stats', { moves: moveCount, best: minMoves, score: score })}
          </Text>
          {!isOptimal && (
            <Text style={[styles.notOptimal, { color: colors.warning }]}>
              {t('solution.not_optimal', { best: minMoves, moves: moveCount })}
            </Text>
          )}
          {timeMs !== null && timeMs > 0 && (
            <Text style={[styles.winTime, { color: colors.textMuted }]}>
              ⏱️ {formatDuration(timeMs)}
            </Text>
          )}
          {unlocks.length > 0 && (
            <View style={[styles.winUnlocks, { backgroundColor: colors.card }]}>
              <Text style={[styles.winUnlocksTitle, { color: colors.warning }]}>{t('achievements.unlocked')}</Text>
              {unlocks.map((id) => (
                <Text key={id} style={[styles.winUnlockItem, { color: colors.text }]}>
                  {ACHIEVEMENTS_BY_ID[id]?.icon} {t(`achievements.${id}`)}
                </Text>
              ))}
            </View>
          )}
          {missionReward && (
            <View style={[styles.winUnlocks, { backgroundColor: colors.card }]}>
              <Text style={[styles.winUnlocksTitle, { color: colors.warning }]}>🎯 {t('missions.completed')}</Text>
              <Text style={[styles.winUnlockItem, { color: colors.text }]}>
                {missionReward.freezeGranted ? t('missions.reward_freeze') : t('missions.reward_full')}
              </Text>
            </View>
          )}
          <View style={styles.solutionRow}>
            <Pressable
              style={[styles.smallButton, { backgroundColor: colors.card }]}
              onPress={onShowSolution}
              accessibilityRole="button"
            >
              <Text style={[styles.smallButtonText, { color: colors.primaryText }]}>🎬 {t('solution.show')}</Text>
            </Pressable>
            {onRetry && !isOptimal && (
              <Pressable
                style={[styles.smallButton, { backgroundColor: colors.card }]}
                onPress={onRetry}
                accessibilityRole="button"
              >
                <Text style={[styles.smallButtonText, { color: colors.primaryText }]}>↻ {t('solution.retry')}</Text>
              </Pressable>
            )}
          </View>
          {canShareResult && (
            <Pressable
              style={[styles.winButton, styles.winShareButton, { borderColor: colors.primary }]}
              onPress={onShareResult}
              accessibilityRole="button"
            >
              <Text style={[styles.winButtonText, { color: colors.primaryText }]}>📤 {t('share.share_result')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.winButton, { backgroundColor: colors.primary }]}
            onPress={onContinue}
            accessibilityRole="button"
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
    backgroundColor: fixedColors.overlay,
  },
  winCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: fixedColors.shadow,
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
  notOptimal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: -16,
    marginBottom: 20,
    textAlign: 'center',
  },
  solutionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
    color: fixedColors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
