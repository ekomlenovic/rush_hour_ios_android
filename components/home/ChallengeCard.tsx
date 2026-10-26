import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { UiColors } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  colors: UiColors;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** Line under the title: what it is, or the result once won */
  subtitle: string;
  /** Reward shown on the right while the challenge is still to do */
  reward: string;
  done: boolean;
  enteringDelay: number;
  onPress: () => void;
}

/**
 * Daily / weekly challenge of the home screen: a secondary card under the Play button.
 * Once won it is dimmed and shows when the next one comes, so it no longer calls for a tap.
 */
export default function ChallengeCard({ colors, icon, title, subtitle, reward, done, enteringDelay, onPress }: Props) {
  return (
    <AnimatedPressable
      entering={FadeInDown.delay(enteringDelay).springify()}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: done ? colors.border : colors.primaryBorder },
        done && styles.done,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}${done ? '' : `, ${reward}`}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: done ? colors.successSoft : colors.primarySoft }]}>
        <Ionicons name={done ? 'checkmark' : icon} size={22} color={done ? colors.success : colors.primaryText} />
      </View>

      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{subtitle}</Text>
      </View>

      {done ? null : (
        <View style={[styles.reward, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.rewardText, { color: colors.primaryText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{reward}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  done: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  reward: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    maxWidth: 110,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
