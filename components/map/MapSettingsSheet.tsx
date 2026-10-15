import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, Switch, Alert, Linking } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { sampleLevels } from '@/data/sampleLevels';
import { useAudio } from '@/context/AudioProvider';
import { DIFFICULTY_LEVELS } from '@/utils/generator';
import { haptics, Haptics } from '@/utils/haptics';
import i18n, { changeLanguage } from '@/utils/i18n';
import { RFValue } from '@/utils/responsive';
import { useLevelGenerator, GENERATION_TIME_MAP, DifficultyKey } from '@/hooks/useLevelGenerator';
import { fixedColors, type UiColors } from '@/theme';
import ThemeModeSetting from '../ThemeModeSetting';

const REQUEST_LEVELS_URL = 'https://github.com/ekomlenovic/rush_hour_ios_android/issues/new?title=Request:%20New%20Complex%20Levels&body=I%20would%20like%20to%20see%20more%20high-difficulty%20levels%21';

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
}

/** Map options: language, music, haptics, level generator, community levels, unlock all, hard reset */
export default function MapSettingsSheet({ visible, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHapticsEnabled = useGameStore(s => s.isHapticsEnabled);
  const toggleHapticsEnabled = useGameStore(s => s.toggleHapticsEnabled);
  const generatedLevels = useGameStore(s => s.generatedLevels);
  const isGenerating = useGameStore(s => s.generationState.isRunning);
  const purgeCustomLevels = useGameStore(s => s.purgeCustomLevels);
  const unlockAllLevels = useGameStore(s => s.unlockAllLevels);
  const hardReset = useGameStore(s => s.hardReset);
  const { toggleMusic, isPlaying: isMusicEnabled } = useAudio();
  const startGeneration = useLevelGenerator();

  const [genAmount, setGenAmount] = useState<number>(3);
  const [genDifficulty, setGenDifficulty] = useState<DifficultyKey>('NORMAL');
  const [genGridSize, setGenGridSize] = useState<number>(6);
  const [settingsScrolledToBottom, setSettingsScrolledToBottom] = useState(false);

  const handleGenerateCustomLevels = () => {
    startGeneration({ amount: genAmount, difficulty: genDifficulty, gridSize: genGridSize });
    // Close modal so user can browse the map in background
    onClose();
  };

  const handleResetLevels = () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    purgeCustomLevels(sampleLevels.length);
  };

  const handleUnlockAll = () => {
    Alert.alert(
      t('home.unlock_all'),
      t('home.unlock_all_confirm'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('common.ok'),
          onPress: () => {
            unlockAllLevels();
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(t('common.success'), t('home.unlock_all_success'));
          }
        }
      ]
    );
  };

  const handleHardReset = () => {
    Alert.alert(
      t('common.hard_reset'),
      t('home.hard_reset_confirm_desc'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('home.hard_reset_confirm_btn'),
          style: "destructive",
          onPress: () => {
            hardReset();
            onClose();
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: Math.max(40, insets.bottom + 24) }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]} accessibilityRole="header">{t('home.options')}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8}>
              <Text style={{ fontSize: RFValue(20), color: colors.textMuted, padding: 8 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            indicatorStyle={isDark ? 'white' : 'black'}
            contentContainerStyle={{ paddingBottom: 60 }}
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
              setSettingsScrolledToBottom(isCloseToBottom);
            }}
            scrollEventThrottle={16}
          >
            {/* Language Switcher */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('common.language')}</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>{i18n.language === 'en' ? t('common.en') : t('common.fr')}</Text>
              </View>
              <View style={styles.languageBtns}>
                <Pressable
                  onPress={() => changeLanguage('en')}
                  style={[styles.langBtn, i18n.language === 'en' && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.en')}
                  accessibilityState={{ selected: i18n.language === 'en' }}
                >
                  <Text style={[styles.langBtnText, { color: i18n.language === 'en' ? colors.onPrimary : colors.text }]}>EN</Text>
                </Pressable>
                <Pressable
                  onPress={() => changeLanguage('fr')}
                  style={[styles.langBtn, i18n.language === 'fr' && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.fr')}
                  accessibilityState={{ selected: i18n.language === 'fr' }}
                >
                  <Text style={[styles.langBtnText, { color: i18n.language === 'fr' ? colors.onPrimary : colors.text }]}>FR</Text>
                </Pressable>
              </View>
            </View>

            <ThemeModeSetting colors={colors} labelStyle={styles.settingLabel} />

            {/* Music Toggle */}
            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.background_music')}</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('map.music_name')}</Text>
              </View>
              <Switch
                value={isMusicEnabled}
                onValueChange={toggleMusic}
                trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
                accessibilityLabel={t('map.background_music')}
              />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.haptic_feedback')}</Text>
                <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('map.vibrate_interactions')}</Text>
              </View>
              <Switch
                value={isHapticsEnabled}
                onValueChange={() => {
                  toggleHapticsEnabled();
                  haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
                accessibilityLabel={t('map.haptic_feedback')}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />

            {/* Generator Setttings */}
            <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{t('map.level_generator')}</Text>

            <Text style={[styles.settingSub, { color: colors.warning, marginBottom: 16, fontWeight: '600' }]}>
              {t('map.generator_warning')}
            </Text>

            <View style={styles.settingBlock}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{t('creator.difficulty')}: {t(`difficulty.${genDifficulty}`)}</Text>
              <View style={styles.buttonSegmentGroup}>
                {(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const).map(diff => (
                  <Pressable
                    key={diff}
                    onPress={() => {
                      setGenDifficulty(diff);
                      setGenGridSize(DIFFICULTY_LEVELS[diff].gridSize);
                    }}
                    style={[styles.segmentBtn, genDifficulty === diff && { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: genDifficulty === diff }}
                  >
                    <Text
                      style={[styles.segmentText, { color: genDifficulty === diff ? colors.onPrimary : colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t(`difficulty.${diff}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.settingBlock}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.grid_size', { size: genGridSize })}</Text>
              <View style={styles.buttonSegmentGroup}>
                {[6, 7, 8].map(size => (
                  <Pressable
                    key={size}
                    onPress={() => setGenGridSize(size)}
                    style={[styles.segmentBtn, genGridSize === size && { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: genGridSize === size }}
                  >
                    <Text style={[styles.segmentText, { color: genGridSize === size ? colors.onPrimary : colors.text }]}>
                      {size}x{size}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.settingBlock}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{t('map.amount_to_create', { amount: genAmount })}</Text>
              <View style={styles.buttonSegmentGroup}>
                {[1, 5, 10, 20].map(amt => (
                  <Pressable
                    key={amt}
                    onPress={() => setGenAmount(amt)}
                    style={[styles.segmentBtn, genAmount === amt && { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: genAmount === amt }}
                  >
                    <Text style={[styles.segmentText, { color: genAmount === amt ? colors.onPrimary : colors.text }]}>
                      {amt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Generation Actions */}
            <View style={{ marginTop: 24, gap: 12 }}>
              <Pressable
                style={[styles.mainBtn, { backgroundColor: colors.primary, opacity: isGenerating ? 0.5 : 1 }]}
                onPress={handleGenerateCustomLevels}
                disabled={isGenerating}
                accessibilityRole="button"
                accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
              >
                <Text style={styles.mainBtnText}>
                  {isGenerating ? t('map.generating') : t('map.generate_btn', { amount: genAmount, time: Math.ceil((genAmount * (GENERATION_TIME_MAP[genDifficulty] || 2000)) / 1000) })}
                </Text>
              </Pressable>

              {!isGenerating && generatedLevels.length > 0 && (
                <Pressable
                  style={[styles.resetBtn, { borderColor: colors.danger }]}
                  onPress={handleResetLevels}
                  accessibilityRole="button"
                >
                  <Text style={[styles.resetBtnText, { color: colors.danger }]}>{t('map.reset_custom')}</Text>
                </Pressable>
              )}

              <View style={[styles.divider, { backgroundColor: colors.textMuted, marginVertical: 12 }]} />

              <Text style={[styles.sectionTitle, { color: colors.primaryText, marginBottom: 8 }]}>{t('map.community_levels')}</Text>
              <Pressable
                style={[styles.mainBtn, { backgroundColor: colors.github, marginBottom: 12 }]}
                onPress={() => Linking.openURL(REQUEST_LEVELS_URL)}
                accessibilityRole="link"
              >
                <Text style={styles.mainBtnText}>{t('map.request_github')}</Text>
              </Pressable>

              <Pressable
                style={[styles.resetBtn, { borderColor: colors.primary, backgroundColor: colors.background, marginTop: 12 }]}
                onPress={handleUnlockAll}
                accessibilityRole="button"
                accessibilityLabel={t('home.unlock_all')}
              >
                <Text style={[styles.resetBtnText, { color: colors.primaryText, fontWeight: '700' }]}>🔓 {t('home.unlock_all')}</Text>
              </Pressable>

              <Pressable
                style={[styles.resetBtn, { borderColor: colors.textMuted, borderStyle: 'dotted', marginTop: 12 }]}
                onPress={handleHardReset}
                accessibilityRole="button"
              >
                <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>{t('map.hard_reset_progress')}</Text>
              </Pressable>
            </View>
          </ScrollView>

          {!settingsScrolledToBottom && (
            <Animated.View entering={FadeInDown} style={styles.scrollHint} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={{ color: colors.primaryText, fontWeight: '700', fontSize: RFValue(12) }}>{t('map.scroll_hint')}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: fixedColors.overlayStrong,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: RFValue(24),
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSub: {
    fontSize: RFValue(13),
  },
  languageBtns: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: fixedColors.neutralSoft,
    padding: 4,
    borderRadius: 12
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  langBtnText: {
    fontSize: RFValue(14),
    fontWeight: '700'
  },
  divider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: RFValue(14),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  settingBlock: {
    marginBottom: 20,
  },
  buttonSegmentGroup: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: fixedColors.neutralSoft,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: RFValue(12),
    fontWeight: '700',
  },
  mainBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    color: fixedColors.onPrimary,
    fontSize: RFValue(16),
    fontWeight: '800',
  },
  resetBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: RFValue(15),
    fontWeight: '700',
  },
  scrollHint: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
});
