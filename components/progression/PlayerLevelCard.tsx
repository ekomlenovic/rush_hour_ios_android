import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { PLAYER_TITLES, getLevelInfo, getPlayerTitle } from '@/data/progression';
import { RFValue } from '@/utils/responsive';
import type { UiColors } from '@/theme';
import XpBar from './XpBar';
import XpRing from './XpRing';
import { getLevelRewardLines } from './rewards';

interface Props {
  colors: UiColors;
  /** Shows the rewards of the next level */
  showNext?: boolean;
  /** "See the whole progression" link */
  onSeeAll?: () => void;
  /** Level in an XP ring beside the title (profile) instead of the XP bar */
  ring?: boolean;
  /** Shown under the level (profile: key numbers) */
  children?: React.ReactNode;
}

/** Player level of the profile: title, XP bar and the rewards of the next level */
export default function PlayerLevelCard({ colors, showNext = true, onSeeAll, ring = false, children }: Props) {
  const { t } = useTranslation();
  const xp = useGameStore(s => s.xp);
  const streakFreezes = useGameStore(s => s.streakFreezes);
  const info = getLevelInfo(xp);
  const title = t(`progression.titles.${getPlayerTitle(info.level)}`);
  const nextTier = PLAYER_TITLES.find(tier => tier.minLevel > info.level);

  const a11yLabel = t('progression.a11y_badge', { level: info.level, title, xp: info.xpInLevel, next: info.xpForNext });
  const xpText = (
    <Text style={[styles.xp, { color: colors.textMuted }]}>
      {t('progression.xp_progress', { xp: info.xpInLevel, next: info.xpForNext })}
    </Text>
  );
  const nextTitle = nextTier && (
    <Text style={[styles.nextTitle, { color: colors.textMuted }]}>
      {t('progression.next_title', { title: t(`progression.titles.${nextTier.id}`), level: nextTier.minLevel })}
    </Text>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {ring ? (
        <View style={styles.ringRow}>
          <View accessible accessibilityLabel={a11yLabel}>
            <XpRing colors={colors} level={info.level} ratio={info.ratio} />
          </View>
          <View style={styles.ringText}>
            <Text style={[styles.ringTitle, { color: colors.text }]}>{title}</Text>
            {xpText}
            {nextTitle}
          </View>
        </View>
      ) : (
        <>
          <View accessible accessibilityLabel={a11yLabel}>
            <View style={styles.row}>
              <Text style={[styles.level, { color: colors.primaryText }]}>{t('progression.level', { level: info.level })}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
            <XpBar colors={colors} ratio={info.ratio} height={10} />
            {xpText}
          </View>
          {nextTitle}
        </>
      )}

      {children}

      {showNext && (
        <View style={[styles.next, { borderTopColor: colors.border }]}>
          <Text style={[styles.subTitle, { color: colors.textMuted }]}>{t('progression.next_level', { level: info.level + 1 })}</Text>
          {getLevelRewardLines(t, info.level + 1, streakFreezes).map(line => (
            <Text key={line} style={[styles.reward, { color: colors.text }]}>• {line}</Text>
          ))}
        </View>
      )}
      {onSeeAll && (
        <Pressable
          onPress={onSeeAll}
          style={[styles.seeAll, { backgroundColor: colors.primarySoft }]}
          accessibilityRole="button"
        >
          <Text style={[styles.seeAllText, { color: colors.primaryText }]}>{t('progression.see_all')} →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  level: { fontSize: RFValue(20), fontWeight: '800' },
  title: { fontSize: RFValue(16), fontWeight: '600' },
  xp: { fontSize: RFValue(12), fontWeight: '600', marginTop: 6 },
  nextTitle: { fontSize: RFValue(12), marginTop: 2 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringText: { flex: 1, gap: 2 },
  ringTitle: { fontSize: RFValue(22), fontWeight: '800' },
  next: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 10, gap: 4 },
  subTitle: { fontSize: RFValue(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reward: { fontSize: RFValue(14) },
  seeAll: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  seeAllText: { fontSize: RFValue(14), fontWeight: '700' },
});
