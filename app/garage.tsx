import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import {
  COSMETICS, cosmeticKey, isCosmeticUnlocked, unlockProgress,
  type CosmeticDef, type CosmeticKind, type CosmeticSelection,
} from '@/data/cosmetics';
import { useCosmetics } from '@/hooks/useCosmetics';
import { haptics, Haptics } from '@/utils/haptics';
import { RFValue } from '@/utils/responsive';
import { fixedColors, useTheme } from '@/theme';
import BoardPreview from '@/components/garage/BoardPreview';
import WinEffect from '@/components/effects/WinEffect';
import XpBar from '@/components/progression/XpBar';
import CosmeticThumb from '@/components/garage/CosmeticThumb';
import { describeUnlock, describeUnlockShort } from '@/components/garage/describeUnlock';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { IoniconName } from '@/utils/icons';
import IconText from '@/components/IconText';
import ScreenHeader from '@/components/ScreenHeader';

const KINDS: CosmeticKind[] = ['board', 'skin', 'palette', 'effect'];
const KIND_ICONS: Record<CosmeticKind, IoniconName> = { board: 'grid', skin: 'car-sport', palette: 'color-palette', effect: 'sparkles' };

/** Customization: board themes, target car skins, vehicle palettes and win effects (#7) */
export default function GarageScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors, scheme, board } = useTheme();
  const selection = useGameStore(s => s.cosmetics);
  const selectCosmetic = useGameStore(s => s.selectCosmetic);
  const markCosmeticsSeen = useGameStore(s => s.markCosmeticsSeen);
  const { context, unlocked, unseen } = useCosmetics();

  const [kind, setKind] = useState<CosmeticKind>('board');
  // Item shown in the preview, even locked; the selection otherwise
  const [previewed, setPreviewed] = useState<CosmeticDef | null>(null);
  const [effectKey, setEffectKey] = useState(0);

  // A new item keeps its badge until it is touched
  const newKeys = new Set(unseen);

  const previewSelection: CosmeticSelection = previewed
    ? { ...selection, [previewed.kind]: previewed.id }
    : selection;
  // The preview and the tabs stay above the list, so the chosen style is always seen, even from the bottom of the list:
  // smaller on a short screen to leave room for the items
  const previewSize = Math.max(120, Math.min(width - 96, 210, Math.round(height * 0.24)));
  const selectedDef = COSMETICS.find(def => def.kind === kind && def.id === selection[kind]);

  const handlePress = (def: CosmeticDef) => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isCosmeticUnlocked(def, context)) {
      selectCosmetic(def.kind, def.id);
      markCosmeticsSeen([cosmeticKey(def)]);
      setPreviewed(null);
    } else {
      setPreviewed(def);
    }
    if (def.kind === 'effect') setEffectKey(k => k + 1);
  };

  const items = COSMETICS.filter(def => def.kind === kind);

  const tabs = (
    <View style={[styles.tabs, { backgroundColor: colors.neutralSoft }]} accessibilityRole="tablist">
      {KINDS.map(k => {
        const active = k === kind;
        const newCount = COSMETICS.filter(def => def.kind === k && newKeys.has(cosmeticKey(def))).length;
        return (
          <Pressable
            key={k}
            onPress={() => { setKind(k); setPreviewed(null); }}
            style={[styles.tab, active && { backgroundColor: colors.primary }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={newCount > 0
              ? `${t(`cosmetics.kinds.${k}`)}, ${t('cosmetics.new_count', { count: newCount })}`
              : t(`cosmetics.kinds.${k}`)}
          >
            <Ionicons name={KIND_ICONS[k]} size={20} color={active ? colors.onPrimary : colors.primaryText} />
            <Text
              style={[styles.tabText, { color: active ? colors.onPrimary : colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t(`cosmetics.tabs.${k}`)}
            </Text>
            {newCount > 0 && (
              <View style={[styles.tabCount, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                <Text style={[styles.tabCountText, { color: colors.onPrimary }]}>{newCount}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Also opened from the win screen: back then leads to the map or the challenge, not home */}
      <ScreenHeader
        colors={colors}
        title={t('cosmetics.garage')}
        backLabel={t('a11y.back')}
        subtitle={t('cosmetics.unlocked_count', { unlocked: unlocked.length, total: COSMETICS.length })}
      />

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
        {/* Always the same height: the list does not move when a locked style is previewed */}
        <View style={styles.previewNoteWrap} accessibilityLiveRegion="polite">
          {previewed ? (
            <IconText icon="lock-closed" color={colors.warning} textStyle={styles.previewNote} numberOfLines={2}>
              {t(`cosmetics.${previewed.kind}.${previewed.id}`)} : {describeUnlock(t, previewed, context)}
            </IconText>
          ) : selectedDef && (
            <IconText icon="checkmark-circle" color={colors.primaryText} textStyle={styles.previewNote} numberOfLines={2}>
              {t(`cosmetics.${selectedDef.kind}.${selectedDef.id}`)}
            </IconText>
          )}
        </View>
      </View>

      <View style={styles.tabsWrap}>{tabs}</View>

      <ScrollView style={styles.list} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.grid}>
          {items.map(def => {
            const key = cosmeticKey(def);
            const isUnlocked = isCosmeticUnlocked(def, context);
            const isSelected = selection[def.kind] === def.id;
            const name = t(`cosmetics.${def.kind}.${def.id}`);
            const condition = describeUnlock(t, def, context);
            const shortCondition = describeUnlockShort(t, def, context);
            const isNew = newKeys.has(key);
            const state = isSelected ? t('cosmetics.selected')
              : isUnlocked ? (isNew ? `${t('cosmetics.new')}, ${t('cosmetics.unlock.default')}` : t('cosmetics.unlock.default'))
              : `${t('cosmetics.locked')}, ${condition}`;
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
                <CosmeticThumb def={def} scheme={scheme} size={56} locked={!isUnlocked} />
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                {isSelected ? (
                  <Text style={[styles.itemState, { color: colors.primaryText }]}>✓ {t('cosmetics.selected')}</Text>
                ) : isUnlocked ? (
                  isNew && <Text style={[styles.itemState, { color: colors.success }]}>{t('cosmetics.new')}</Text>
                ) : (
                  <>
                    <Text style={[styles.itemCondition, { color: colors.textMuted }]} numberOfLines={3}>{shortCondition}</Text>
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
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  previewWrap: { alignItems: 'center', paddingHorizontal: 20, gap: 6 },
  previewNoteWrap: { minHeight: RFValue(18) * 2, justifyContent: 'center' },
  previewNote: { fontSize: RFValue(13), lineHeight: RFValue(18), fontWeight: '700', textAlign: 'center' },
  tabsWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4 },
  tab: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabText: { fontSize: RFValue(12), fontWeight: '700', textAlign: 'center' },
  tabCount: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: { fontSize: 10, fontWeight: '800' },
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
  itemName: { fontSize: RFValue(14), fontWeight: '700' },
  itemState: { fontSize: RFValue(12), fontWeight: '700' },
  itemCondition: { fontSize: RFValue(12), fontWeight: '600' },
});
