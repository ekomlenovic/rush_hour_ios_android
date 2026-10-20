import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Share, Alert, useWindowDimensions,
  type AccessibilityActionEvent, type GestureResponderEvent, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useGameStore } from '@/store/gameStore';
import { recapSlideColors, recapSlideText } from '@/theme';
import { formatPlayTime, parseLocalDateString } from '@/utils/date';
import {
  buildRecap, buildRecapShareText, isInProgress, periodLabel, recapHighlights, recapSlides,
  type Recap, type RecapFigure, type RecapSlide,
} from '@/utils/recap';
import { APP_URL } from '@/utils/shareResult';
import RecapShareImage, { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/components/recap/RecapShareImage';
import type { IoniconName } from '@/utils/icons';

/** Achievement names listed on their slide, the rest counted */
const MAX_LISTED_ACHIEVEMENTS = 4;
/** Room taken by the progress bars at the top of the screen */
const TOP_BAR_HEIGHT = 56;
/** Room left under the share image for the title and the buttons */
const SHARE_CONTROLS_HEIGHT = 230;

type PageId = RecapSlide['id'] | 'share';

const SLIDE_ICONS: Record<PageId, IoniconName> = {
  intro: 'gift',
  levels: 'flag',
  time: 'time',
  challenges: 'calendar',
  feats: 'trophy',
  unlocks: 'ribbon',
  share: 'share-social',
};

type T = ReturnType<typeof useTranslation>['t'];

/**
 * Monthly or yearly recap (issue 125, see docs/GAME_DESIGN.md, Récap), shown like stories: full-screen
 * slides with one big number each, swiped or touched (right: next, left: back), then the sharing one.
 * Opened from the home screen when it is ready, or from the profile for the past ones.
 */
export default function RecapScreen() {
  const { period = '' } = useLocalSearchParams<{ period: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width, height } = useWindowDimensions();
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
  const cosmetics = useGameStore(s => s.cosmetics);

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
      <View style={[styles.screen, styles.centered, { backgroundColor: recapSlideColors.intro[0] }]}>
        <Text style={styles.body}>{t('game.load_error')}</Text>
      </View>
    );
  }

  const label = periodLabel(recap.key, i18n.language);
  const slides = recapSlides(recap);
  const pages: PageId[] = [...slides.map(slide => slide.id), 'share'];
  const total = pages.length;

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(total - 1, index));
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };
  // Like the stories: the left third goes back, the rest goes on
  const onTap = (event: GestureResponderEvent) => goTo(page + (event.nativeEvent.locationX < width / 3 ? -1 : 1));
  // Screen reader: the slide is adjustable, swiping up or down changes it
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') goTo(page + 1);
    if (event.nativeEvent.actionName === 'decrement') goTo(page - 1);
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

  // The share image as big as the screen allows, under the bars and above the buttons
  const previewHeight = Math.max(200, height - insets.top - insets.bottom - TOP_BAR_HEIGHT - SHARE_CONTROLS_HEIGHT);
  const previewWidth = Math.min(width - 64, (previewHeight * SHARE_IMAGE_WIDTH) / SHARE_IMAGE_HEIGHT);
  const comparison = comparisonLine(t, recap, i18n.language);
  const pagePosition = (index: number) => t('a11y.recap_page', { page: index + 1, total });

  return (
    <View style={[styles.screen, { backgroundColor: recapSlideColors[pages[page]][0] }]}>
      {/* Light text on the dark slides, in light mode too */}
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {slides.map((slide, index) => (
          <Pressable
            key={slide.id}
            onPress={onTap}
            style={{ width, height }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={describeSlide(t, slide, recap, label, i18n.language)}
            accessibilityValue={{ text: pagePosition(index) }}
            accessibilityHint={t('a11y.recap_hint')}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={onAccessibilityAction}
          >
            <Gradient id={slide.id} />
            <View style={[styles.slide, { paddingTop: insets.top + TOP_BAR_HEIGHT, paddingBottom: insets.bottom + 32 }]}>
              <SlideContent t={t} slide={slide} recap={recap} label={label} language={i18n.language} />
            </View>
          </Pressable>
        ))}

        {/* Last page: the image to share, as big as possible */}
        <Pressable onPress={onTap} style={{ width, height }} accessible={false}>
          <Gradient id="share" />
          <View style={[styles.slide, styles.sharePage, { paddingTop: insets.top + TOP_BAR_HEIGHT, paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.kicker} accessibilityRole="header">{t('recap.share_heading')}</Text>
            {comparison ? <Text style={styles.comparison}>{comparison}</Text> : null}
            <View style={styles.preview} accessible accessibilityRole="image" accessibilityLabel={t('a11y.recap_image')}>
              <RecapShareImage
                svgRef={svgRef}
                width={previewWidth}
                title={recap.kind === 'year' ? t('recap.image_title_year') : t('recap.image_title_month')}
                period={label}
                profile={t(`recap.profile_${recap.profile}`)}
                highlights={recapHighlights(t, recap)}
                footer={APP_URL.replace(/^https:\/\//, '')}
                cosmetics={cosmetics}
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={shareImage} accessibilityRole="button">
              <Ionicons name="image" size={20} color={recapSlideColors.share[0]} />
              <Text style={styles.primaryButtonText}>{t('recap.share_image')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={shareText} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.secondaryButtonText}>{t('recap.share_text')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </ScrollView>

      {/* Story bars and close, over the slides */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.bars} accessible accessibilityLabel={pagePosition(page)}>
          {pages.map((id, i) => (
            <View key={id} style={[styles.bar, { backgroundColor: i <= page ? recapSlideText.text : recapSlideText.track }]} />
          ))}
        </View>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={12}>
          <Ionicons name="close" size={28} color={recapSlideText.text} />
        </Pressable>
      </View>
    </View>
  );
}

/** Background of a page, drawn so that it scrolls with it */
function Gradient({ id }: { id: PageId }) {
  const [top, bottom] = recapSlideColors[id];
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={`recap-${id}`} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#recap-${id})`} />
    </Svg>
  );
}

function formatFigure(t: T, figure: RecapFigure): string {
  if (figure.format === 'time') return formatPlayTime(figure.value);
  if (figure.format === 'days') return t('recap.days', { count: figure.value });
  if (figure.format === 'plus') return `+${figure.value}`;
  return String(figure.value);
}

const slideTitle = (t: T, slide: RecapSlide) => t(`recap.card_${slide.id}`);

/** Short notes of the first slide: the period still going on, the counters started late */
function introNotes(t: T, recap: Recap, language: string): string[] {
  const notes: string[] = [];
  if (isInProgress(recap)) notes.push(t('recap.in_progress'));
  if (recap.partialSince) {
    const since = parseLocalDateString(recap.partialSince).toLocaleDateString(language, { day: 'numeric', month: 'short' });
    notes.push(t('recap.counted_since', { date: since }));
  }
  return notes;
}

function achievementNames(t: T, recap: Recap): string[] {
  if (recap.partialSince) return [];
  const names = recap.achievementIds.slice(0, MAX_LISTED_ACHIEVEMENTS).map(id => `✓ ${t(`achievements.${id}`)}`);
  if (recap.achievementIds.length > MAX_LISTED_ACHIEVEMENTS) names.push(t('recap.more', { count: recap.achievementIds.length - MAX_LISTED_ACHIEVEMENTS }));
  return names;
}

/** What the screen reader reads for a slide, in one go */
function describeSlide(t: T, slide: RecapSlide, recap: Recap, label: string, language: string): string {
  if (slide.id === 'intro') {
    return [label, t(`recap.profile_${recap.profile}`), t(`recap.profile_${recap.profile}_desc`), ...introNotes(t, recap, language)].join('. ');
  }
  const parts = [slideTitle(t, slide)];
  if (slide.hero) parts.push(`${formatFigure(t, slide.hero)} ${t(`recap.hero_${slide.hero.key}`, { count: slide.hero.value })}`);
  for (const figure of slide.details) parts.push(`${t(`recap.${figure.key}`)} : ${formatFigure(t, figure)}`);
  if (slide.id === 'unlocks') parts.push(...achievementNames(t, recap));
  return parts.join('. ');
}

interface SlideProps {
  t: T;
  slide: RecapSlide;
  recap: Recap;
  label: string;
  language: string;
}

function SlideContent({ t, slide, recap, label, language }: SlideProps) {
  if (slide.id === 'intro') {
    return (
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.kickerRow}>
          <Ionicons name={SLIDE_ICONS.intro} size={20} color={recapSlideText.text} />
          <Text style={styles.kicker}>{recap.kind === 'year' ? t('recap.image_title_year') : t('recap.image_title_month')}</Text>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).duration(500)} style={styles.period}>{label}</Animated.Text>
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.profileBlock}>
          <Text style={styles.profileLabel}>{t('recap.your_profile')}</Text>
          <Text style={styles.profile} numberOfLines={2} adjustsFontSizeToFit>{t(`recap.profile_${recap.profile}`)}</Text>
          <Text style={styles.body}>{t(`recap.profile_${recap.profile}_desc`)}</Text>
        </Animated.View>
        <View style={styles.chips}>
          {introNotes(t, recap, language).map(note => (
            <View key={note} style={styles.noteChip}><Text style={styles.noteText}>{note}</Text></View>
          ))}
        </View>
        <Text style={styles.hint}>{t('recap.tap_hint')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.kickerRow}>
        <Ionicons name={SLIDE_ICONS[slide.id]} size={20} color={recapSlideText.text} />
        <Text style={styles.kicker}>{slideTitle(t, slide)}</Text>
      </Animated.View>
      {slide.hero ? (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.hero} numberOfLines={1} adjustsFontSizeToFit>{formatFigure(t, slide.hero)}</Text>
          <Text style={styles.heroLabel}>{t(`recap.hero_${slide.hero.key}`, { count: slide.hero.value })}</Text>
        </Animated.View>
      ) : null}
      <View style={styles.chips}>
        {slide.details.map(figure => (
          <View key={figure.key} style={styles.chip}>
            <Text style={styles.chipValue}>{formatFigure(t, figure)}</Text>
            <Text style={styles.chipLabel}>{t(`recap.${figure.key}`)}</Text>
          </View>
        ))}
      </View>
      {slide.id === 'unlocks' ? achievementNames(t, recap).map(name => (
        <Text key={name} style={styles.body}>{name}</Text>
      )) : null}
    </View>
  );
}

/** "Wins: +12 compared with September": only with a period fully counted */
function comparisonLine(t: T, recap: Recap, language: string): string | null {
  const { previous } = recap;
  if (!previous) return null;
  const period = recap.kind === 'year' ? previous.key : parseLocalDateString(`${previous.key}-01`).toLocaleDateString(language, { month: 'long' });
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  if (previous.wins !== null) return t('recap.compare_wins', { diff: signed(recap.stats.wins - previous.wins), period });
  return t('recap.compare_dailies', { diff: signed(recap.dailies - previous.dailies), period });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slide: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    gap: 14,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    color: recapSlideText.text,
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  period: {
    color: recapSlideText.text,
    fontSize: 44,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  profileBlock: {
    gap: 6,
    marginTop: 24,
  },
  profileLabel: {
    color: recapSlideText.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  profile: {
    color: recapSlideText.text,
    fontSize: 38,
    fontWeight: '900',
  },
  body: {
    color: recapSlideText.muted,
    fontSize: 18,
    lineHeight: 25,
  },
  hint: {
    color: recapSlideText.muted,
    fontSize: 14,
    marginTop: 32,
  },
  hero: {
    color: recapSlideText.text,
    fontSize: 104,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 8,
  },
  heroLabel: {
    color: recapSlideText.text,
    fontSize: 24,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  chip: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: recapSlideText.chip,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  chipValue: {
    color: recapSlideText.text,
    fontSize: 26,
    fontWeight: '800',
  },
  chipLabel: {
    color: recapSlideText.muted,
    fontSize: 14,
  },
  noteChip: {
    backgroundColor: recapSlideText.chip,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  noteText: {
    color: recapSlideText.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sharePage: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  comparison: {
    color: recapSlideText.muted,
    fontSize: 15,
    textAlign: 'center',
  },
  preview: {
    borderRadius: 18,
    overflow: 'hidden',
    marginVertical: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    maxWidth: 460,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: recapSlideText.text,
  },
  primaryButtonText: {
    color: recapSlideColors.share[0],
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: recapSlideText.text,
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
