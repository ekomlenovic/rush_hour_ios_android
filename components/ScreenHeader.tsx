import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  title: string;
  /** Where back leads, after the arrow: "Accueil", "Profil", or "Retour" when it depends */
  backLabel: string;
  /** Small line under the title (e.g. the count of the garage) */
  subtitle?: string;
  /** Action on the right (e.g. a "+" button), as wide as the back button */
  right?: React.ReactNode;
  /** Line under the header, for a list scrolling under it */
  divider?: boolean;
}

/** Width of each side: the title stays centered whatever the length of the back label */
const SIDE_WIDTH = 92;

/**
 * Header of the screens of the game: "← where back leads" on the left, the title centered,
 * an optional action on the right; the same layout as the game screen. Back goes home when
 * there is nothing under the screen (opened by a link at launch).
 */
export default function ScreenHeader({ colors, title, backLabel, subtitle, right, divider = false }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 12 },
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.side}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.back')}
        hitSlop={8}
      >
        <Text style={[styles.backText, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>← {backLabel}</Text>
      </Pressable>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  side: {
    width: SIDE_WIDTH,
    minHeight: 44,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
