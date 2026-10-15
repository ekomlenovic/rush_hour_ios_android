import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useGameStore } from '@/store/gameStore';
import {
  COSMETICS, cosmeticKey, isCosmeticUnlocked, unlockProgress,
  type CosmeticContext, type CosmeticDef, type CosmeticKind, type CosmeticSelection,
} from '@/data/cosmetics';
import { ACHIEVEMENTS_BY_ID } from '@/data/achievements';
import { useCosmetics } from '@/hooks/useCosmetics';
import { haptics, Haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import { fixedColors, useTheme } from '@/theme';
import BoardPreview from '@/components/garage/BoardPreview';
import WinEffect from '@/components/effects/WinEffect';
import XpBar from '@/components/progression/XpBar';

const KINDS: CosmeticKind[] = ['board', 'skin', 'palette', 'effect'];

/** How to unlock a cosmetic, with the current progress */
function describeUnlock(t: TFunction, def: CosmeticDef, c: CosmeticContext): string {
  const rule = def.unlock;
  switch (rule.type) {
    case 'default': return t('cosmetics.unlock.default');
    case 'level': return t('cosmetics.unlock.level', { level: rule.level });
    case 'stars': return t('cosmetics.unlock.stars', { count: rule.count, current: c.totalStars });
    case 'weeklies': return t('cosmetics.unlock.weeklies', { count: rule.count, current: c.weeklies });
    case 'achievement': {
      const achievement = ACHIEVEMENTS_BY_ID[rule.id];
      return t('cosmetics.unlock.achievement', { name: `${achievement?.icon ?? ''} ${t(`achievements.${rule.id}`)}` });
    }
    case 'winter': return t('cosmetics.unlock.winter');
  }
}

/** Customization: board themes, target car skins, vehicle palettes and win effects (#7) */
export default function GarageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, scheme, board } = useTheme();
  const selection = useGameStore(s => s.cosmetics);
  const selectCosmetic = useGameStore(s => s.selectCosmetic);
  const markCosmeticsSeen = useGameStore(s => s.markCosmeticsSeen);
  const { context, unlocked, unseen } = useCosmetics();

  const [kind, setKind] = useState<CosmeticKind>('board');
  // Item shown in the preview, even locked; the selection otherwise
  const [previewed, setPreviewed] = useState<CosmeticDef | null>(null);
  const [effectKey, setEffectKey] = useState(0);

  // "New" badges stay visible during the visit, they are cleared when leaving
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const [newKeys] = useState(() => new Set(unseen));
  useEffect(() => () => markCosmeticsSeen(unlockedRef.current), []);

  const previewSelection: CosmeticSelection = previewed
    ? { ...selection, [previewed.kind]: previewed.id }
    : selection;
  const previewSize = Math.min(width - 96, 260);

  const handlePress = (def: CosmeticDef) => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isCosmeticUnlocked(def, context)) {
      selectCosmetic(def.kind, def.id);
      setPreviewed(null);
    } else {
      setPreviewed(def);
    }
    if (def.kind === 'effect') setEffectKey(k => k + 1);
  };

  const items = COSMETICS.filter(def => def.kind === kind);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={8}>
          <Text style={[styles.backText, { color: colors.textMuted }]}>← {t('common.home')}</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">🚘 {t('cosmetics.garage')}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {t('cosmetics.unlocked_count', { unlocked: unlocked.length, total: COSMETICS.length })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.desc, { color: colors.textMuted }]}>{t('cosmetics.garage_desc')}</Text>

        <View style={styles.previewWrap}>
          <View>
            <BoardPreview selection={previewSelection} scheme={scheme} size={previewSize} />
            <WinEffect
              effect={previewSelection.effect}
              width={previewSize}
              height={previewSize}
              colors={[board.targetCar, ...board.vehicles.slice(0, 6)]}
              playKey={effectKey}
            />
          </View>
          {previewed && (
            <Text style={[styles.previewNote, { color: colors.warning }]}>
              🔒 {t('cosmetics.preview')} : {t(`cosmetics.${previewed.kind}.${previewed.id}`)}
            </Text>
          )}
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
          {KINDS.map(k => {
            const active = k === kind;
            const hasNew = COSMETICS.some(def => def.kind === k && newKeys.has(cosmeticKey(def)));
            return (
              <Pressable
                key={k}
                onPress={() => { setKind(k); setPreviewed(null); }}
                style={[styles.tab, active && { backgroundColor: colors.primary }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, { color: active ? colors.onPrimary : colors.text }]} numberOfLines={2}>
                  {t(`cosmetics.kinds.${k}`)}{hasNew ? ' •' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.grid}>
          {items.map(def => {
            const key = cosmeticKey(def);
            const isUnlocked = isCosmeticUnlocked(def, context);
            const isSelected = selection[def.kind] === def.id;
            const name = t(`cosmetics.${def.kind}.${def.id}`);
            const condition = describeUnlock(t, def, context);
            const state = isSelected ? t('cosmetics.selected') : isUnlocked ? t('cosmetics.unlock.default') : `${t('cosmetics.locked')}, ${condition}`;
            return (
              <Pressable
                key={key}
                onPress={() => handlePress(def)}
                style={[
                  styles.item,
                  { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                  isSelected && styles.itemSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('cosmetics.a11y_item', { name, state })}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.itemIcon, !isUnlocked && styles.itemLocked]}>{def.icon}</Text>
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                {isSelected ? (
                  <Text style={[styles.itemState, { color: colors.primaryText }]}>✓ {t('cosmetics.selected')}</Text>
                ) : isUnlocked ? (
                  newKeys.has(key) && <Text style={[styles.itemState, { color: colors.success }]}>{t('cosmetics.new')}</Text>
                ) : (
                  <>
                    <Text style={[styles.itemCondition, { color: colors.textMuted }]} numberOfLines={3}>🔒 {condition}</Text>
                    <XpBar colors={colors} ratio={unlockProgress(def, context)} height={4} />
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 8 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { fontSize: RFValue(15), fontWeight: '600' },
  title: { fontSize: RFValue(28), fontWeight: '800' },
  count: { fontSize: RFValue(13), fontWeight: '600', marginTop: 2 },
  content: { paddingHorizontal: 20 },
  desc: { fontSize: RFValue(14), marginBottom: 16 },
  previewWrap: { alignItems: 'center', marginBottom: 20, gap: 8 },
  previewNote: { fontSize: RFValue(13), fontWeight: '700', textAlign: 'center' },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: RFValue(12), fontWeight: '700', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
    shadowColor: fixedColors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  itemSelected: { borderWidth: 2.5 },
  itemIcon: { fontSize: 28 },
  itemLocked: { opacity: 0.35 },
  itemName: { fontSize: RFValue(14), fontWeight: '700' },
  itemState: { fontSize: RFValue(12), fontWeight: '700' },
  itemCondition: { fontSize: RFValue(11), fontWeight: '500' },
});
