import React from 'react';
import { Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
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

export default function GameActions({ colors, showUndoAndHint, isHintLoading, onUndo, onHint, onReset }: Props) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.actions}>
      {showUndoAndHint && (
        <>
          <Pressable onPress={onUndo} style={[styles.actionBtn, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('game.undo')}>
            <Ionicons name="arrow-undo" size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>{t('game.undo')}</Text>
          </Pressable>
          <Pressable
            onPress={onHint}
            style={[styles.actionBtn, { backgroundColor: colors.warning + '22' }]}
            disabled={isHintLoading}
            accessibilityRole="button"
            accessibilityLabel={isHintLoading ? t('game.analyzing') : t('game.hint')}
            accessibilityState={{ disabled: isHintLoading, busy: isHintLoading }}
          >
            {isHintLoading ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <>
                <Ionicons name="bulb" size={18} color={colors.warning} />
                <Text style={[styles.actionText, { color: colors.warning }]}>{t('game.hint')}</Text>
              </>
            )}
          </Pressable>
        </>
      )}
      <Pressable onPress={onReset} style={[styles.actionBtn, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('common.reset')}>
        <Ionicons name="refresh" size={18} color={colors.text} />
        <Text style={[styles.actionText, { color: colors.text }]}>{t('common.reset')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 100,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
