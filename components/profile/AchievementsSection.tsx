import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import AchievementIcon from './AchievementIcon';
import { useGameStore } from '@/store/gameStore';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, AchievementCategory, AchievementContext, AchievementDef } from '@/data/achievements';
import { RFValue } from '@/utils/responsive';
import { useNewAchievements } from '@/hooks/useNewAchievements';
import type { UiColors } from '@/theme';

/** Locked achievements shown first, by share of their target already done */
const CLOSEST_COUNT = 3;
/** Longest word that fits the width of a medal on a small phone: a longer one ("Perfectionniste") was cut in two, it gets a smaller font */
const LONGEST_FITTING_WORD = 12;
const hasLongWord = (name: string) => name.split(/\s+/).some(word => word.length > LONGEST_FITTING_WORD);

interface Props {
  colors: UiColors;
  context: AchievementContext;
  /** Achievement whose detail is shown (see AchievementSheet) */
  selected: string | null;
  /** `badge`: the medal touched, so the screen can keep it in view above the sheet */
  onSelect: (id: string | null, badge?: View | null) => void;
}

/** Achievements of the profile: the closest ones, then a grid of badges per category */
export default function AchievementsSection({ colors, context, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const unlocked = useGameStore((state) => state.achievements || []);
  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const newAchievements = useNewAchievements();
  const newSet = useMemo(() => new Set(newAchievements), [newAchievements]);
  const markAchievementSeen = useGameStore((state) => state.markAchievementSeen);
  // The first category, and those with something new to see
  const badgeRefs = useRef(new Map<string, View | null>());
  const [openCategories, setOpenCategories] = useState<Set<AchievementCategory>>(() => new Set([
    ACHIEVEMENT_CATEGORIES[0],
    ...ACHIEVEMENTS.filter(a => newSet.has(a.id)).map(a => a.category),
  ]));

  const progressOf = (ach: AchievementDef) => Math.min(ach.value(context), ach.target);
  const closest = useMemo(() => ACHIEVEMENTS
    .filter(a => !unlockedSet.has(a.id) && !a.hidden && a.target > 1 && progressOf(a) > 0)
    .sort((a, b) => progressOf(b) / b.target - progressOf(a) / a.target)
    .slice(0, CLOSEST_COUNT), [unlockedSet, context]);

  const toggle = (category: AchievementCategory) => setOpenCategories(prev => {
    const next = new Set(prev);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    return next;
  });

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('profile.achievements')}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {t('profile.achievements_count', { count: unlocked.length, total: ACHIEVEMENTS.length })}
        </Text>
      </View>

      {closest.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overline, { color: colors.textMuted }]}>{t('profile.achievements_closest')}</Text>
          {closest.map(ach => (
            <ProgressRow key={ach.id} colors={colors} ach={ach} current={progressOf(ach)} />
          ))}
        </View>
      )}

      {ACHIEVEMENT_CATEGORIES.map(category => {
        const list = ACHIEVEMENTS.filter(a => a.category === category);
        const done = list.filter(a => unlockedSet.has(a.id)).length;
        const newCount = list.filter(a => newSet.has(a.id)).length;
        const open = openCategories.has(category);
        return (
          <View key={category} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => toggle(category)}
              style={styles.categoryHeader}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={newCount > 0
                ? `${t(`achievements.categories.${category}`)}, ${t('profile.new_achievements', { count: newCount })}`
                : undefined}
            >
              <View style={styles.categoryTitleLine}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>{t(`achievements.categories.${category}`)}</Text>
                {newCount > 0 && (
                  <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.countPillText, { color: colors.onPrimary }]}>{newCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.categoryCount, { color: colors.textMuted }]}>{done}/{list.length}  {open ? '⌃' : '⌄'}</Text>
            </Pressable>

            {open && (
              <View style={styles.grid}>
                {list.map(ach => {
                  const isUnlocked = unlockedSet.has(ach.id);
                  const isSecret = !!ach.hidden && !isUnlocked;
                  const name = isSecret ? '???' : t(`achievements.${ach.id}`);
                  const desc = isSecret ? t('achievements.secret_desc') : t(`achievements.${ach.id}_desc`);
                  const isNew = newSet.has(ach.id);
                  return (
                    <Pressable
                      key={ach.id}
                      ref={(node) => { badgeRefs.current.set(ach.id, node); }}
                      onPress={() => {
                        if (isNew) markAchievementSeen(ach.id);
                        onSelect(selected === ach.id ? null : ach.id, badgeRefs.current.get(ach.id));
                      }}
                      style={styles.badge}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selected === ach.id }}
                      accessibilityLabel={`${isNew ? `${t('cosmetics.new')}, ` : ''}${t(isUnlocked ? 'profile.achievement_a11y_unlocked' : 'profile.achievement_a11y_locked', { name, desc })}`}
                    >
                      <View style={[
                        styles.badgeCircle,
                        isUnlocked
                          ? { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                        selected === ach.id && { borderColor: colors.primaryText },
                      ]}>
                        <AchievementIcon icon={isSecret ? 'lock-closed' : ach.icon} count={isSecret ? 1 : ach.iconCount} size={RFValue(24)} color={isUnlocked ? colors.primaryText : colors.textMuted} style={!isUnlocked && styles.locked} />
                        {isNew && <View style={[styles.newDot, { backgroundColor: colors.primary, borderColor: colors.surface }]} />}
                      </View>
                      <Text style={[styles.badgeName, hasLongWord(name) && styles.badgeNameLong, { color: isUnlocked ? colors.text : colors.textMuted }]} numberOfLines={2}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

          </View>
        );
      })}
    </View>
  );
}

/** Name, description and progress bar of one achievement */
function ProgressRow({ colors, ach, current, unlocked = false }: {
  colors: UiColors; ach: AchievementDef; current: number; unlocked?: boolean;
}) {
  const { t } = useTranslation();
  const showBar = !unlocked && ach.target > 1;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: colors.card }]}>
        <AchievementIcon icon={ach.icon} count={ach.iconCount} size={RFValue(20)} color={unlocked ? colors.primaryText : colors.textMuted} style={!unlocked && styles.locked} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowName, { color: colors.text }]}>{t(`achievements.${ach.id}`)}</Text>
          {showBar && <Text style={[styles.rowCount, { color: colors.textMuted }]}>{current}/{ach.target}</Text>}
        </View>
        {showBar && (
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { width: `${Math.max(3, (current / ach.target) * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
        )}
        <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{t(`achievements.${ach.id}_desc`)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: RFValue(12),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  count: {
    fontSize: RFValue(14),
  },
  card: {
    borderRadius: RFValue(16),
    borderWidth: 1,
    padding: RFValue(14),
    gap: RFValue(12),
  },
  overline: {
    fontSize: RFValue(12),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginVertical: RFValue(-8),
  },
  categoryTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(8),
  },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  newDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: RFValue(14),
    height: RFValue(14),
    borderRadius: RFValue(7),
    borderWidth: 2,
  },
  categoryTitle: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
  categoryCount: {
    fontSize: RFValue(14),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: RFValue(12),
  },
  badge: {
    width: '25%',
    alignItems: 'center',
    gap: RFValue(6),
  },
  badgeCircle: {
    width: RFValue(54),
    height: RFValue(54),
    borderRadius: RFValue(27),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    opacity: 0.35,
  },
  badgeName: {
    fontSize: RFValue(11),
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  badgeNameLong: {
    fontSize: RFValue(9.5),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RFValue(12),
  },
  rowIcon: {
    width: RFValue(40),
    height: RFValue(40),
    borderRadius: RFValue(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: RFValue(5),
  },
  rowTitleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  rowName: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  rowCount: {
    fontSize: RFValue(13),
    fontWeight: '600',
  },
  track: {
    height: RFValue(6),
    borderRadius: RFValue(3),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: RFValue(3),
  },
  rowDesc: {
    fontSize: RFValue(13),
  },
});
