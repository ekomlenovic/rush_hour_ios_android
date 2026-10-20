import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Share, Alert, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type Svg from 'react-native-svg';
import { useGameStore } from '@/store/gameStore';
import { useTheme, fixedColors, type UiColors } from '@/theme';
import { formatPlayTime, parseLocalDateString } from '@/utils/date';
import { buildRecap, buildRecapShareText, isInProgress, periodLabel, recapHighlights, type Recap } from '@/utils/recap';
import { APP_URL } from '@/utils/shareResult';
import RecapShareImage, { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/components/recap/RecapShareImage';
import type { IoniconName } from '@/utils/icons';

/** Width of the shared image in the last card */
const PREVIEW_WIDTH = 150;
/** Achievement names listed on their card, the rest counted */
const MAX_LISTED_ACHIEVEMENTS = 6;

interface RecapCardContent {
  key: string;
  icon: IoniconName;
  title: string;
  /** Big text of the card (the profile on the first one) */
  headline?: string;
  lines: string[];
  rows: [string, string][];
}

/**
 * Monthly or yearly recap (issue 125, see docs/GAME_DESIGN.md, Récap): a few cards swiped one
 * after the other, then sharing as a vertical image or a text. Opened from the home screen
 * when it is ready, or from the profile for the past ones.
 */
export default function RecapScreen() {
  const { period = '' } = useLocalSearchParams<{ period: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const svgRef = useRef<Svg>(null);
  const [page, setPage] = useState(0);

  const monthlyStats = useGameStore(s => s.monthlyStats);
  const yearlyStats = useGameStore(s => s.yearlyStats);
  const achievementMonths = useGameStore(s => s.achievementMonths);
  const recapSince = useGameStore(s => s.recapSince);
  const dailyChallengeProgress = useGameStore(s => s.dailyChallengeProgress);
  const weeklyChallengeProgress = useGameStore(s => s.weeklyChallengeProgress);
  const frozenDates = useGameStore(s => s.frozenDates);
  const markRecapSeen = useGameStore(s => s.markRecapSeen);

  const isValidKey = /^\d{4}(-\d{2})?$/.test(period);
  const recap = useMemo(
    () => (isValidKey
      ? buildRecap({ monthlyStats, yearlyStats, achievementMonths, recapSince, dailyChallengeProgress, weeklyChallengeProgress, frozenDates }, period)
      : null),
    [isValidKey, period, monthlyStats, yearlyStats, achievementMonths, recapSince, dailyChallengeProgress, weeklyChallengeProgress, frozenDates],
  );

  // Opened: the home screen stops announcing it
  useEffect(() => {
    if (isValidKey) markRecapSeen(period);
  }, [isValidKey, period, markRecapSeen]);

  if (!recap) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t('game.load_error')}</Text>
      </View>
    );
  }

  const label = periodLabel(recap.key, i18n.language);
  const cards = buildCards(t, recap, label, i18n.language);
  const pageWidth = width;
  const highlights = recapHighlights(t, recap);
  const comparison = comparisonLines(t, recap, i18n.language);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(cards.length, index));
    scrollRef.current?.scrollTo({ x: next * pageWidth, animated: true });
    setPage(next);
  };
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  const shareText = async () => {
    try {
      const shared = await Share.share({ message: buildRecapShareText(t, recap, i18n.language) });
      if (shared.action === Share.sharedAction) useGameStore.getState().recordResultShared();
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  // The image drawn on the phone, exported at its full size: nothing goes to an online service
  const shareImage = () => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.toDataURL(async (data: string) => {
      try {
        if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable');
        const file = new File(Paths.cache, `rush-hours-recap-${recap.key}.png`);
        file.create({ overwrite: true });
        file.write(data.replace(/^data:image\/png;base64,/, ''), { encoding: 'base64' });
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('recap.share_image') });
        useGameStore.getState().recordResultShared();
      } catch (error) {
        console.error('Sharing failed', error);
        Alert.alert(t('common.error'), t('recap.share_image_error'));
      }
    }, { width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT });
  };

  const total = cards.length + 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>
          {recap.kind === 'year' ? t('recap.title_year', { period: label }) : t('recap.title_month', { period: label })}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.closeButton} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.closeText, { color: colors.primaryText }]}>{t('common.close')}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pages}
      >
        {cards.map((card, index) => (
          <View key={card.key} style={[styles.page, { width: pageWidth }]}>
            <Animated.View
              entering={FadeIn.delay(index === 0 ? 150 : 0).duration(400)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessible
              accessibilityLabel={[card.title, card.headline, ...card.lines, ...card.rows.map(([l, v]) => `${l} : ${v}`)].filter(Boolean).join('. ')}
            >
              <CardBody card={card} colors={colors} />
            </Animated.View>
          </View>
        ))}

        {/* Last card: comparison and sharing */}
        <View style={[styles.page, { width: pageWidth }]}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardTitleRow} accessible accessibilityRole="header">
              <Ionicons name="share-social" size={22} color={colors.primaryText} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('recap.card_share')}</Text>
            </View>
            {comparison.map(line => (
              <Text key={line} style={[styles.line, { color: colors.text }]}>{line}</Text>
            ))}
            <View style={styles.preview} accessible accessibilityRole="image" accessibilityLabel={t('a11y.recap_image')}>
              <RecapShareImage
                svgRef={svgRef}
                width={PREVIEW_WIDTH}
                title={recap.kind === 'year' ? t('recap.image_title_year') : t('recap.image_title_month')}
                period={label}
                profile={t(`recap.profile_${recap.profile}`)}
                highlights={highlights}
                footer={APP_URL.replace(/^https:\/\//, '')}
              />
            </View>
            <Pressable style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={shareImage} accessibilityRole="button">
              <Ionicons name="image" size={18} color={fixedColors.onPrimary} />
              <Text style={styles.shareButtonText}>{t('recap.share_image')}</Text>
            </Pressable>
            <Pressable style={[styles.shareButton, { backgroundColor: colors.primarySoft }]} onPress={shareText} accessibilityRole="button">
              <Ionicons name="text" size={18} color={colors.primaryText} />
              <Text style={[styles.shareButtonText, { color: colors.primaryText }]}>{t('recap.share_text')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => goTo(page - 1)}
          disabled={page === 0}
          style={[styles.navButton, page === 0 && styles.navDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.recap_previous')}
          accessibilityState={{ disabled: page === 0 }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primaryText} />
        </Pressable>
        <View style={styles.dots} accessible accessibilityLabel={t('a11y.recap_page', { page: page + 1, total })}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === page ? colors.primary : colors.inactive }]} />
          ))}
        </View>
        <Pressable
          onPress={() => goTo(page + 1)}
          disabled={page === total - 1}
          style={[styles.navButton, page === total - 1 && styles.navDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.recap_next')}
          accessibilityState={{ disabled: page === total - 1 }}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.primaryText} />
        </Pressable>
      </View>
    </View>
  );
}

function CardBody({ card, colors }: { card: RecapCardContent; colors: UiColors }) {
  return (
    <>
      <View style={styles.cardTitleRow}>
        <Ionicons name={card.icon} size={22} color={colors.primaryText} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
      </View>
      {card.headline ? <Text style={[styles.headline, { color: colors.primaryText }]}>{card.headline}</Text> : null}
      {card.lines.map(line => (
        <Text key={line} style={[styles.line, { color: colors.textMuted }]}>{line}</Text>
      ))}
      {card.rows.map(([rowLabel, value], i) => (
        <View key={rowLabel} style={[styles.row, i < card.rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{rowLabel}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
        </View>
      ))}
    </>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

/** The cards of the recap, before the sharing one */
function buildCards(t: T, recap: Recap, label: string, language: string): RecapCardContent[] {
  const { stats } = recap;
  const intro: string[] = [t(`recap.profile_${recap.profile}_desc`)];
  if (isInProgress(recap)) intro.push(recap.kind === 'year' ? t('recap.in_progress_year') : t('recap.in_progress_month'));
  if (recap.partialSince) {
    const since = parseLocalDateString(recap.partialSince).toLocaleDateString(language, { day: 'numeric', month: 'long' });
    intro.push(t('recap.partial', { date: since }));
  }

  // Before the update that added them, the unlocks were not dated: only the count since is known
  const achievementCount = recap.partialSince ? stats.achievements : recap.achievementIds.length;
  const listed = recap.partialSince ? [] : recap.achievementIds;
  const names = listed.slice(0, MAX_LISTED_ACHIEVEMENTS).map(id => `✓ ${t(`achievements.${id}`)}`);
  if (listed.length > MAX_LISTED_ACHIEVEMENTS) names.push(t('recap.more', { count: listed.length - MAX_LISTED_ACHIEVEMENTS }));

  return [
    {
      key: 'intro',
      icon: 'gift',
      title: recap.kind === 'year' ? t('recap.title_year', { period: label }) : t('recap.title_month', { period: label }),
      headline: t(`recap.profile_${recap.profile}`),
      lines: intro,
      rows: [],
    },
    {
      key: 'levels',
      icon: 'flag',
      title: t('recap.card_levels'),
      lines: [],
      rows: [
        [t('recap.wins'), String(stats.wins)],
        [t('recap.new_levels'), String(stats.newLevels)],
        [t('recap.stars_gained'), `+${stats.starsGained}`],
        [t('recap.perfect_wins'), String(stats.perfectWins)],
      ],
    },
    {
      key: 'time',
      icon: 'time',
      title: t('recap.card_time'),
      lines: [],
      rows: [
        [t('recap.play_time'), formatPlayTime(stats.playTimeMs)],
        [t('recap.moves'), String(stats.moves)],
      ],
    },
    {
      key: 'challenges',
      icon: 'calendar',
      title: t('recap.card_challenges'),
      lines: [],
      rows: [
        [t('recap.dailies'), String(recap.dailies)],
        [t('recap.perfect_dailies'), String(recap.perfectDailies)],
        [t('recap.best_run'), t('recap.days', { count: recap.bestDailyRun })],
        [t('recap.freezes_used'), String(recap.freezesUsed)],
        [t('recap.weeklies'), String(recap.weeklies)],
      ],
    },
    {
      key: 'feats',
      icon: 'trophy',
      title: t('recap.card_feats'),
      lines: [],
      rows: [
        [t('recap.hardest_win'), stats.hardestWinMoves > 0 ? t('recap.min_moves', { count: stats.hardestWinMoves }) : '—'],
        [t('recap.boss_wins'), String(stats.bossWins)],
      ],
    },
    {
      key: 'unlocks',
      icon: 'ribbon',
      title: t('recap.card_unlocks'),
      lines: names,
      rows: [
        [t('recap.achievements'), String(achievementCount)],
        [t('recap.styles'), String(stats.cosmetics)],
      ],
    },
  ];
}

/** "+12 levels compared with September": only with a period fully counted */
function comparisonLines(t: T, recap: Recap, language: string): string[] {
  const { previous } = recap;
  if (!previous) return [t('recap.no_comparison')];
  const period = recap.kind === 'year' ? previous.key : parseLocalDateString(`${previous.key}-01`).toLocaleDateString(language, { month: 'long' });
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const lines: string[] = [];
  if (previous.wins !== null) lines.push(t('recap.compare_wins', { diff: signed(recap.stats.wins - previous.wins), period }));
  lines.push(t('recap.compare_dailies', { diff: signed(recap.dailies - previous.dailies), period }));
  return lines;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingHorizontal: 90,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    bottom: 15,
    padding: 5,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pages: {
    flex: 1,
  },
  page: {
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  line: {
    fontSize: 15,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  rowValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  preview: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
  },
  shareButtonText: {
    color: fixedColors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    opacity: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
