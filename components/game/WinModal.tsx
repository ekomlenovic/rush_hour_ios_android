import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, AccessibilityInfo, ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { formatDuration } from '@/utils/date';
import { fixedColors, type UiColors } from '@/theme';
import { getLevelInfo } from '@/data/progression';
import type { WinEffectId } from '@/data/cosmetics';
import type { MissionReward } from '@/data/missions';
import XpBar from '@/components/progression/XpBar';
import { getLevelRewardLines, missionRewardText } from '@/components/progression/rewards';
import WinEffect from '@/components/effects/WinEffect';
import ShareIcon from '@/components/share/ShareIcon';
import IconText from '@/components/multi/IconText';

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
  missionReward: MissionReward | null;
  /** XP before and after this win (level, missions and achievements included) */
  xpGain: { from: number; to: number } | null;
  /** Player levels reached with this win */
  levelUps: number[];
  /** Cosmetic win effect and its particle colors */
  effect: WinEffectId;
  effectColors: string[];
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
  visible, colors, stars, moveCount, minMoves, score, timeMs, unlocks, missionReward, xpGain, levelUps, effect, effectColors,
  canShareResult, onShareResult, onShowSolution, onRetry, onContinue, onRequestClose,
}: Props) {
  const isOptimal = moveCount <= minMoves;
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const xpAfter = xpGain ? getLevelInfo(xpGain.to) : null;
  const xpBefore = xpGain ? getLevelInfo(xpGain.from) : null;
  const gained = xpGain ? xpGain.to - xpGain.from : 0;

  // Screen readers: the win is announced at once, before the player explores the card
  useEffect(() => {
    if (!visible) return;
    AccessibilityInfo.announceForAccessibility(t('a11y.win', {
      title: t('game.level_complete'),
      stars,
      stats: t('game.win_stats', { moves: moveCount, best: minMoves, score }),
    }));
    for (const level of levelUps) AccessibilityInfo.announceForAccessibility(t('progression.level_up', { level }));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.winOverlay}>
        <View
          style={[styles.winCard, { backgroundColor: colors.surface }]}
        >
          <ScrollView style={styles.winScroll} contentContainerStyle={styles.winContent} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.winStars} accessible accessibilityLabel={t('a11y.level_stars', { count: stars })}>
            {[1, 2, 3].map(i => (
              <Ionicons key={i} name={i <= stars ? 'star' : 'star-outline'} size={36} color={i <= stars ? colors.star : colors.textMuted} />
            ))}
          </View>
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
            <IconText icon="time-outline" color={colors.textMuted} style={styles.winTime} textStyle={styles.winTimeText}>
              {formatDuration(timeMs)}
            </IconText>
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
          {xpAfter && xpBefore && gained > 0 && (
            <View style={styles.xpBlock} accessible accessibilityLabel={`${t('progression.xp_gain', { xp: gained })}, ${t('progression.level', { level: xpAfter.level })}, ${t('progression.xp_progress', { xp: xpAfter.xpInLevel, next: xpAfter.xpForNext })}`}>
              <View style={styles.xpRow}>
                <Text style={[styles.xpGain, { color: colors.primaryText }]}>{t('progression.xp_gain', { xp: gained })}</Text>
                <Text style={[styles.xpLevel, { color: colors.textMuted }]}>{t('progression.level', { level: xpAfter.level })}</Text>
              </View>
              <XpBar
                colors={colors}
                ratio={xpAfter.ratio}
                from={xpAfter.level > xpBefore.level ? 0 : xpBefore.ratio}
              />
            </View>
          )}
          {levelUps.map(level => (
            <View key={level} style={[styles.winUnlocks, { backgroundColor: colors.primarySoft }]}>
              <IconText icon="arrow-up-circle" color={colors.primaryText} textStyle={styles.winUnlocksTitle}>{t('progression.level_up', { level })}</IconText>
              {getLevelRewardLines(t, level).map(line => (
                <Text key={line} style={[styles.winRewardItem, { color: colors.text }]}>{line}</Text>
              ))}
            </View>
          ))}
          {missionReward && (
            <View style={[styles.winUnlocks, { backgroundColor: colors.card }]}>
              <IconText icon="flag" color={colors.warning} textStyle={styles.winUnlocksTitle}>{t('missions.completed')}</IconText>
              <Text style={[styles.winUnlockItem, { color: colors.text }]}>
                {missionRewardText(t, missionReward)}
              </Text>
            </View>
          )}
          <View style={styles.solutionRow}>
            <Pressable
              style={[styles.smallButton, { backgroundColor: colors.card }]}
              onPress={onShowSolution}
              accessibilityRole="button"
            >
              <IconText icon="play-circle-outline" color={colors.primaryText} textStyle={styles.smallButtonText}>{t('solution.show')}</IconText>
            </Pressable>
            {onRetry && !isOptimal && (
              <Pressable
                style={[styles.smallButton, { backgroundColor: colors.card }]}
                onPress={onRetry}
                accessibilityRole="button"
              >
                <IconText icon="refresh" color={colors.primaryText} textStyle={styles.smallButtonText}>{t('solution.retry')}</IconText>
              </Pressable>
            )}
          </View>
          {canShareResult && (
            <Pressable
              style={[styles.winButton, styles.winShareButton, styles.withIcon, { borderColor: colors.primary }]}
              onPress={onShareResult}
              accessibilityRole="button"
            >
              <ShareIcon size={18} color={colors.primaryText} />
              <Text style={[styles.winButtonText, { color: colors.primaryText }]}>{t('share.share_result')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.winButton, { backgroundColor: colors.primary }]}
            onPress={onContinue}
            accessibilityRole="button"
          >
           <Text style={styles.winButtonText}>{t('common.continue')}</Text>
          </Pressable>
          </ScrollView>
        </View>
        {visible && <WinEffect effect={effect} width={width} height={height} colors={effectColors} />}
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
    borderRadius: 20,
    maxHeight: '88%',
    width: '88%',
    maxWidth: 420,
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 280,
  },
  // A ScrollView grows by default: it would stretch the card to its max height
  winScroll: {
    flexGrow: 0,
  },
  winContent: {
    padding: 32,
    alignItems: 'center',
  },
  xpBlock: {
    alignSelf: 'stretch',
    marginBottom: 20,
    gap: 6,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  xpGain: {
    fontSize: 16,
    fontWeight: '800',
  },
  xpLevel: {
    fontSize: 13,
    fontWeight: '700',
  },
  winRewardItem: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 2,
    textAlign: 'center',
  },
  winStars: {
    flexDirection: 'row',
    gap: 6,
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
    marginTop: -16,
    marginBottom: 20,
  },
  winTimeText: {
    fontSize: 14,
    fontWeight: '600',
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
  withIcon: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
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
