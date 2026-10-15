import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fixedColors, type UiColors } from '@/theme';
import { MapLayout } from './path';
import { MapZone, ZONE_ICONS, ZONE_SCENERY, seeded } from './zones';

const SIDE_MARGIN = 14;
/** The first zone has no gap under it: its banner goes under level 1 */
const FIRST_BANNER_DROP = 95;

interface Props {
  zones: MapZone[];
  /** Stars won in each zone, by zone number */
  zoneStars: Record<number, number>;
  layout: MapLayout;
  width: number;
  /** Only what is between these heights is drawn */
  minY: number;
  maxY: number;
  colors: UiColors;
  isDark: boolean;
}

/** Background of the world map: a tinted band per zone, scenery beside the road and a banner where each zone starts */
const ZoneLayer = React.memo(({ zones, zoneStars, layout, width, minY, maxY, colors, isDark }: Props) => {
  const { xAt, yAt, totalHeight } = layout;
  const { t } = useTranslation();

  return (
    <>
      {zones.map((zone, index) => {
        const isFirst = index === 0;
        const isLast = index === zones.length - 1;
        // A zone spans from half a gap under its first level to half a gap above its last one
        const bottom = isFirst ? totalHeight : yAt(zone.firstId - 1.5);
        const top = isLast ? 0 : yAt(zone.lastId - 0.5);
        if (bottom < minY || top > maxY) return null;

        const accent = colors.mapZoneAccents[zone.colorIndex];
        const scenery = ZONE_SCENERY[zone.theme];

        // Banner across the road, in the wider gap under the first level of the zone
        const signY = isFirst ? yAt(0) + FIRST_BANNER_DROP : yAt(zone.firstId - 1.5);
        const levelCount = zone.lastId - zone.firstId + 1;

        return (
          <React.Fragment key={`zone-${zone.number}`}>
            <View
              pointerEvents="none"
              style={[styles.band, { top, height: bottom - top, backgroundColor: colors.mapZoneTints[zone.colorIndex] }]}
            />

            {Array.from({ length: levelCount }, (_, i) => {
              const id = zone.firstId + i;
              // The gap above the last level holds the banner of the next zone
              if (id === zone.lastId && !isLast) return null;
              const gapT = id - 0.5;
              const y = yAt(gapT);
              if (y < minY || y > maxY) return null;
              const r = seeded(id);
              if (r < 0.2) return null;
              // Keep clear of the road and of the two levels around the gap (their tokens and stars)
              const near = [xAt(gapT - 0.5), xAt(gapT), xAt(gapT + 0.5)];
              const roadLeft = Math.min(...near) - 60;
              const roadRight = Math.max(...near) + 60;
              const onRight = width - roadRight > roadLeft;
              const free = onRight ? width - SIDE_MARGIN - roadRight : roadLeft - SIDE_MARGIN;
              if (free < 34) return null;
              const offset = seeded(id + 0.37) * (free - 34);
              const x = onRight ? width - SIDE_MARGIN - 34 - offset : SIDE_MARGIN + offset;
              const size = 26 + Math.round(seeded(id + 0.71) * 12);
              return (
                <Text
                  key={`s${id}`}
                  pointerEvents="none"
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                  style={[styles.scenery, { left: x, top: y - size / 2 + (r - 0.5) * 20, fontSize: size, opacity: isDark ? 0.5 : 0.65 }]}
                >
                  {scenery[Math.floor(r * scenery.length) % scenery.length]}
                </Text>
              );
            })}

            {signY >= minY && signY <= maxY && (
              <View pointerEvents="box-none" style={[styles.signRow, { top: signY - 26 }]}>
                <View
                  accessible
                  accessibilityRole="header"
                  accessibilityLabel={t('a11y.map_zone', {
                    number: zone.number,
                    name: t(`map.zones.${zone.theme}`),
                    stars: zoneStars[zone.number] ?? 0,
                    total: levelCount * 3,
                  })}
                  style={[styles.sign, { maxWidth: width - SIDE_MARGIN * 2, backgroundColor: colors.floating, borderColor: accent }]}
                >
                  <View style={[styles.signIcon, { backgroundColor: accent }]}>
                    <Text style={styles.signEmoji}>{ZONE_ICONS[zone.theme]}</Text>
                  </View>
                  <View style={styles.signBody}>
                    <Text numberOfLines={1} style={[styles.signKicker, { color: colors.textMuted }]}>
                      {zone.generated ? t('map.zone_generated') : t('map.zone', { number: zone.number })}
                      {'  ·  '}★ {zoneStars[zone.number] ?? 0}/{levelCount * 3}
                    </Text>
                    <Text numberOfLines={1} style={[styles.signTitle, { color: colors.text }]}>
                      {t(`map.zones.${zone.theme}`)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
});

export default ZoneLayer;

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 0,
  },
  scenery: {
    position: 'absolute',
    zIndex: 0,
  },
  signRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  sign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 18,
    borderWidth: 2,
    elevation: 4,
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  signIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signEmoji: {
    fontSize: 18,
  },
  signBody: {
    flexShrink: 1,
  },
  signKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  signTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
});
