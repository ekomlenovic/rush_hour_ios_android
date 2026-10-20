import React from 'react';
import { Text, StyleSheet, Pressable, ActivityIndicator, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { UiColors } from '@/theme';

interface Props {
  colors: UiColors;
  /** Undo and hint are hidden on challenges: only reset is offered (weekly) */
  showUndoAndHint: boolean;
  isHintLoading: boolean;
  onUndo: () => void;
  onHint: () => void;
  onReset: () => void;
}

const ICON_SIZE = 20;

/**
 * Undo, hint and reset under the board. The label is under its icon and the buttons share
 * the width: "Réinitialiser" and its neighbours went past the edges of a 390 pt screen.
 */
export default function GameActions({ colors, showUndoAndHint, isHintLoading, onUndo, onHint, onReset }: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.actions}>
      {showUndoAndHint && (
        <>
          <Pressable onPress={onUndo} style={[styles.actionBtn, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('game.undo')}>
            <Ionicons name="arrow-undo" size={ICON_SIZE} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('game.undo')}</Text>
          </Pressable>
          <Pressable
            onPress={onHint}
            style={[styles.actionBtn, { backgroundColor: colors.warning + '22' }]}
            disabled={isHintLoading}
            accessibilityRole="button"
            accessibilityLabel={isHintLoading ? t('game.analyzing') : t('game.hint')}
            accessibilityState={{ disabled: isHintLoading, busy: isHintLoading }}
          >
            {/* Same height while the hint is computed: the row does not jump */}
            <View style={styles.iconBox}>
              {isHintLoading ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <Ionicons name="bulb" size={ICON_SIZE} color={colors.warning} />
              )}
            </View>
            <Text style={[styles.actionText, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('game.hint')}</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={onReset} style={[styles.actionBtn, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('common.reset')}>
        <Ionicons name="refresh" size={ICON_SIZE} color={colors.text} />
        <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('common.reset')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    maxWidth: 130,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBox: {
    height: ICON_SIZE,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
