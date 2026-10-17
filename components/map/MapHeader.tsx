import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { UiColors } from '@/theme';
import { MapZone, ZONE_ICONS } from './zones';

interface Props {
  colors: UiColors;
  isDark: boolean;
  /** Zone shown in the middle of the screen */
  zone: MapZone | undefined;
  stars: number;
  maxStars: number;
  onBack: () => void;
  onSettings: () => void;
}

/** Blurred header of the world map: back, the zone being browsed with the stars won, options */
export default function MapHeader({ colors, isDark, zone, stars, maxStars, onBack, onSettings }: Props) {
  const { t } = useTranslation();
  const progress = maxStars > 0 ? Math.min(1, stars / maxStars) : 0;

  return (
    <Animated.View
      entering={FadeInUp.delay(100).springify()}
      style={[styles.header, { backgroundColor: colors.backgroundTranslucent, borderBottomColor: colors.divider }]}
    >
      <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          style={[styles.roundButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
          hitSlop={8}
        >
          <Text style={[styles.chevron, { color: colors.text }]}>‹</Text>
        </Pressable>

        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
            {zone ? `${ZONE_ICONS[zone.theme]}  ${t(`map.zones.${zone.theme}`)}` : t('map.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {zone ? (zone.generated ? t('map.zone_generated') : t('map.zone', { number: zone.number })) : ''}
          </Text>
        </View>

        <Pressable
          onPress={onSettings}
          style={[styles.roundButton, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.settings')}
          hitSlop={8}
        >
          <Ionicons name="settings-sharp" size={20} color={colors.primaryText} />
        </Pressable>
      </View>

      <View
        style={styles.progressRow}
        accessible
        accessibilityLabel={t('a11y.map_progress', { stars, total: maxStars })}
      >
        <Text style={[styles.progressStar, { color: colors.star }]}>★</Text>
        <View style={[styles.track, { backgroundColor: colors.neutralSoft }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.star }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>{stars} / {maxStars}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 32,
    fontWeight: '500',
    lineHeight: 36,
    marginTop: -3,
    marginLeft: -2,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  progressStar: {
    fontSize: 15,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 64,
    textAlign: 'right',
  },
});
