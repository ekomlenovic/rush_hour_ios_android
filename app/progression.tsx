import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useRouter } from '@/hooks/useRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import {
  PLAYER_TITLES, getFreezeCapacity, getLevelInfo, getLevelUpReward, totalXpForLevel,
} from '@/data/progression';
import { COSMETICS, getLevelCosmetics, isCosmeticUnlocked, unlockProgress, type CosmeticDef } from '@/data/cosmetics';
import { useCosmetics } from '@/hooks/useCosmetics';
import { RFValue } from '@/utils/responsive';
import { useTheme, type UiColors, type ColorScheme } from '@/theme';
import PlayerLevelCard from '@/components/progression/PlayerLevelCard';
import ScreenHeader from '@/components/ScreenHeader';
import XpBar from '@/components/progression/XpBar';
import CosmeticThumb from '@/components/garage/CosmeticThumb';
import { describeUnlock } from '@/components/garage/describeUnlock';

/** Levels listed at least up to the last title */
const LAST_LISTED_LEVEL = PLAYER_TITLES[PLAYER_TITLES.length - 1].minLevel;

function CosmeticRow({ def, colors, scheme, locked, detail, onPress }: {
  def: CosmeticDef; colors: UiColors; scheme: ColorScheme; locked: boolean; detail?: React.ReactNode; onPress: () => void;
}) {
  const { t } = useTranslation();
  const name = t(`cosmetics.${def.kind}.${def.id}`);
  return (
    <Pressable
      onPress={onPress}
      style={styles.cosmeticRow}
      accessibilityRole="button"
      accessibilityLabel={`${t(`cosmetics.kinds.${def.kind}`)} : ${name}${locked ? `, ${t('cosmetics.locked')}` : ''}`}
    >
      <CosmeticThumb def={def} scheme={scheme} size={44} locked={locked} />
      <View style={styles.cosmeticText}>
        <Text style={[styles.cosmeticKind, { color: colors.textMuted }]}>{t(`cosmetics.kinds.${def.kind}`)}</Text>
        <Text style={[styles.cosmeticName, { color: colors.text }]}>{name}</Text>
        {detail}
      </View>
    </Pressable>
  );
}

/** Every player level with its rewards, and the cosmetics unlocked otherwise */
export default function ProgressionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const xp = useGameStore(s => s.xp);
  const { context } = useCosmetics();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);

  const current = getLevelInfo(xp).level;
  const lastLevel = Math.max(LAST_LISTED_LEVEL, current + 5);
  const levels = Array.from({ length: lastLevel - 1 }, (_, i) => i + 2);
  const otherCosmetics = COSMETICS.filter(def => def.unlock.type !== 'default' && def.unlock.type !== 'level');
  const openGarage = () => router.push('/garage');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader colors={colors} title={t('progression.screen_title')} backLabel={t('profile.title')} divider />

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <PlayerLevelCard colors={colors} showNext={false} />

        <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">{t('progression.levels_title')}</Text>
        {levels.map((level, index) => {
          const reached = level <= current;
          const isNext = level === current + 1;
          const title = PLAYER_TITLES.find(tier => tier.minLevel === level);
          const slot = getLevelUpReward(level).freezeSlot;
          const cosmetics = getLevelCosmetics(level);
          const state = reached ? t('progression.reached') : isNext ? t('progression.next_level', { level }) : t('progression.locked');
          const isLast = index === levels.length - 1;

          return (
            <View
              key={level}
              style={styles.levelRow}
              onLayout={isNext ? e => {
                // Open on the next level to reach, once
                if (scrolled.current) return;
                scrolled.current = true;
                scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 160), animated: false });
              } : undefined}
            >
              {/* Timeline */}
              <View style={styles.timeline}>
                <View style={[
                  styles.dot,
                  reached
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: isNext ? colors.primary : colors.border },
                ]}>
                  <Text style={[styles.dotText, { color: reached ? colors.onPrimary : isNext ? colors.primaryText : colors.textMuted }]}>{level}</Text>
                </View>
                {!isLast && <View style={[styles.line, { backgroundColor: reached ? colors.primary : colors.border }]} />}
              </View>

              <View
                style={[
                  styles.levelCard,
                  { backgroundColor: colors.surface, borderColor: isNext ? colors.primary : colors.border },
                  !reached && !isNext && styles.future,
                ]}
              >
                <View
                  accessible
                  accessibilityLabel={t('progression.a11y_level_row', {
                    level,
                    state,
                    rewards: [
                      title ? t('progression.new_title', { title: t(`progression.titles.${title.id}`) }) : null,
                      t('progression.reward_freeze'),
                      slot ? t('progression.reward_slot', { count: getFreezeCapacity(level) }) : null,
                    ].filter(Boolean).join('. '),
                  })}
                >
                  <View style={styles.levelHeader}>
                    <Text style={[styles.levelName, { color: colors.text }]}>{t('progression.level', { level })}</Text>
                    <Text style={[styles.levelState, { color: reached ? colors.success : isNext ? colors.primaryText : colors.textMuted }]}>
                      {reached ? `✓ ${t('progression.reached')}` : isNext ? t('progression.next_in', { xp: Math.max(0, totalXpForLevel(level) - xp).toLocaleString() }) : t('progression.from_xp', { xp: totalXpForLevel(level).toLocaleString() })}
                    </Text>
                  </View>
                  {title && (
                    <Text style={[styles.titleBadge, { color: colors.primaryText, backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="pricetag" size={RFValue(12)} color={colors.primaryText} /> {t('progression.new_title', { title: t(`progression.titles.${title.id}`) })}
                    </Text>
                  )}
                  <Text style={[styles.reward, { color: colors.text }]}>{t('progression.reward_freeze')}</Text>
                  {slot && (
                    <Text style={[styles.reward, styles.rewardStrong, { color: colors.text }]}>
                      {t('progression.reward_slot', { count: getFreezeCapacity(level) })}
                    </Text>
                  )}
                </View>
                {cosmetics.map(def => (
                  <CosmeticRow key={def.id} def={def} colors={colors} scheme={scheme} locked={!reached} onPress={openGarage} />
                ))}
              </View>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">{t('progression.other_unlocks')}</Text>
        <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>{t('progression.other_unlocks_desc')}</Text>
        <View style={[styles.otherCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {otherCosmetics.map(def => {
            const unlocked = isCosmeticUnlocked(def, context);
            return (
              <CosmeticRow
                key={`${def.kind}:${def.id}`}
                def={def}
                colors={colors}
                scheme={scheme}
                locked={!unlocked}
                onPress={openGarage}
                detail={unlocked ? (
                  <Text style={[styles.condition, { color: colors.success }]}>✓ {t('progression.reached')}</Text>
                ) : (
                  <View style={styles.conditionBlock}>
                    <Text style={[styles.condition, { color: colors.textMuted }]}>{describeUnlock(t, def, context)}</Text>
                    <XpBar colors={colors} ratio={unlockProgress(def, context)} height={4} />
                  </View>
                )}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  sectionTitle: { fontSize: RFValue(18), fontWeight: '800', marginTop: 28, marginBottom: 12 },
  sectionDesc: { fontSize: RFValue(13), marginTop: -6, marginBottom: 12 },
  levelRow: { flexDirection: 'row', gap: 12 },
  timeline: { width: 36, alignItems: 'center' },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: RFValue(13), fontWeight: '800' },
  line: { width: 2, flex: 1, marginVertical: 2 },
  levelCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4, marginBottom: 12 },
  future: { opacity: 0.75 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 2 },
  levelName: { fontSize: RFValue(15), fontWeight: '800' },
  levelState: { fontSize: RFValue(11), fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  titleBadge: { alignSelf: 'flex-start', fontSize: RFValue(12), fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', marginVertical: 2 },
  reward: { fontSize: RFValue(13) },
  rewardStrong: { fontWeight: '700' },
  cosmeticRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  cosmeticText: { flex: 1, gap: 1 },
  cosmeticKind: { fontSize: RFValue(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cosmeticName: { fontSize: RFValue(14), fontWeight: '700' },
  otherCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  conditionBlock: { gap: 4, marginTop: 2 },
  condition: { fontSize: RFValue(12), fontWeight: '600' },
});
