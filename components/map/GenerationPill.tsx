import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { RFValue } from '@/utils/responsive';
import { MapColors } from './colors';

/** Floating generation progress pill, pinned below the header, with a cancel button */
export default function GenerationPill({ colors, isDark }: { colors: MapColors; isDark: boolean }) {
  const { t } = useTranslation();
  const generationState = useGameStore(s => s.generationState);
  const cancelGeneration = useGameStore(s => s.cancelGeneration);

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      accessibilityLiveRegion="polite"
      style={[
        styles.generationPill,
        { backgroundColor: isDark ? 'rgba(22,20,40,0.96)' : 'rgba(255,255,255,0.96)' }
      ]}
    >
      {/* Top row: title + cancel */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={generationState.shouldCancel ? '#EF4444' : colors.accent} size="small" />
          <Text style={[styles.pillTitle, { color: generationState.shouldCancel ? '#EF4444' : colors.text }]}>
            {generationState.shouldCancel ? t('map.canceling') : t('map.generating_levels')}
          </Text>
        </View>
        {!generationState.shouldCancel && (
          <Pressable
            onPress={() => cancelGeneration()}
            hitSlop={15}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={[styles.pillCancelBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.1)' }]}
          >
            <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: RFValue(13) }}>✕ {t('common.cancel')}</Text>
          </Pressable>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.pillBarTrack}>
        <View
          style={[
            styles.pillBarFill,
            {
              backgroundColor: colors.accent,
              width: `${Math.round((generationState.current / Math.max(generationState.total, 1)) * 100)}%`,
            }
          ]}
        />
      </View>

      {/* Count and time */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.pillSub, { color: colors.sub }]}>
          {t('map.generation_progress', { current: generationState.current, total: generationState.total })}
        </Text>
        {generationState.estimatedRemainingSeconds > 0 && !generationState.shouldCancel && (
          <Text style={[styles.pillSub, { color: colors.accent, fontWeight: '600' }]}>
            ~{t('map.time_left', { seconds: generationState.estimatedRemainingSeconds })}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  generationPill: {
    position: 'absolute',
    top: 115, // below the header (which has paddingTop: 60 + paddingBottom: 16 + ~30 content)
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    zIndex: 200,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  pillTitle: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  pillBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
    marginTop: 2,
  },
  pillBarFill: {
    height: 6,
    borderRadius: 3,
  },
  pillSub: {
    fontSize: RFValue(12),
    marginTop: 6,
  },
  pillCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
