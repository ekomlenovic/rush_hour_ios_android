import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert, Modal, ScrollView, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useRouter } from '@/hooks/useRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGameStore } from '@/store/gameStore';
import { useAudio } from '@/context/AudioProvider';
import { haptics, Haptics } from '@/utils/haptics';
import { checkForUpdate } from '@/utils/updateChecker';
import i18n, { changeLanguage } from '@/utils/i18n';
import { RFValue } from '@/utils/responsive';
import { requestReminderPermission, sendTestReminder, TEST_REMINDER_DELAY_SECONDS } from '@/utils/notifications';
import { fixedColors, type UiColors } from '@/theme';
import ThemeModeSetting from '../ThemeModeSetting';
import MapLevelsSection from './MapLevelsSection';
import SaveSection from './SaveSection';
import { settingsStyles } from './styles';

const SPONSOR_URL = 'https://github.com/sponsors/ekomlenovic';
/**
 * Donation link only outside Google Play, which refuses links to an outside payment: the iOS build
 * (SideStore) and the APK of the GitHub releases (EXPO_PUBLIC_DONATION_LINK set by build.yml)
 */
const SHOW_SUPPORT = Platform.OS === 'ios' || process.env.EXPO_PUBLIC_DONATION_LINK === '1';

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

interface Props {
  visible: boolean;
  colors: UiColors;
  /** World map: adds the level generator, community levels and unlock all */
  showMapLevels?: boolean;
  onClose: () => void;
}

/**
 * Options of the home screen and the world map (one sheet for both): language, appearance,
 * music, haptics, vehicle letters, reminders, save export / import, version and update, hard reset.
 */
export default function OptionsSheet({ visible, colors, showMapLevels = false, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isHapticsEnabled = useGameStore(s => s.isHapticsEnabled);
  const toggleHapticsEnabled = useGameStore(s => s.toggleHapticsEnabled);
  const showVehicleLetters = useGameStore(s => s.showVehicleLetters);
  const toggleVehicleLetters = useGameStore(s => s.toggleVehicleLetters);
  const notificationsEnabled = useGameStore(s => s.notificationsEnabled);
  const setNotificationsEnabled = useGameStore(s => s.setNotificationsEnabled);
  const reminderHour = useGameStore(s => s.reminderHour);
  const setReminderHour = useGameStore(s => s.setReminderHour);
  const hardReset = useGameStore(s => s.hardReset);
  const { toggleMusic, isPlaying: isMusicEnabled } = useAudio();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // "Scroll for more" hint while the content overflows and the end is not reached
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [atBottom, setAtBottom] = useState(false);
  const showScrollHint = contentHeight > viewportHeight + 20 && !atBottom;

  const handleUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    const info = await checkForUpdate();
    setIsCheckingUpdate(false);
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (info.isUpdateAvailable) {
      Alert.alert(
        t('common.update_available'),
        t('home.update_desc', { version: info.latestVersion }),
        [
          { text: t('common.later'), style: 'cancel' },
          {
            text: info.isStoreUpdate ? t('common.update') : t('common.download'),
            onPress: () => info.downloadURL && Linking.openURL(info.downloadURL),
          },
        ]
      );
    } else if (!info.error) {
      Alert.alert(t('common.up_to_date'), t('common.already_latest'));
    } else {
      Alert.alert(t('common.check_failed'), t('common.could_not_check'));
    }
  };

  const handleRemindersToggle = async (value: boolean) => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value && !(await requestReminderPermission())) {
      Alert.alert(t('reminders.denied_title'), t('reminders.denied_body'));
      setNotificationsEnabled(false);
      return;
    }
    setNotificationsEnabled(value);
  };

  const handleTestReminder = async () => {
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (await sendTestReminder()) {
      Alert.alert(t('reminders.test_sent_title'), t('reminders.test_sent_body', { count: TEST_REMINDER_DELAY_SECONDS }));
    } else {
      Alert.alert(t('reminders.denied_title'), t('reminders.test_failed_body'));
    }
  };

  const handleHardReset = () => {
    Alert.alert(
      t('common.hard_reset'),
      t('home.hard_reset_confirm_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('home.hard_reset_confirm_btn'),
          style: 'destructive',
          onPress: () => {
            hardReset();
            onClose();
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const toggleRow = (label: string, sub: string, value: boolean, onChange: (value: boolean) => void) => (
    <View style={settingsStyles.settingRow}>
      <View style={settingsStyles.settingText}>
        <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
        accessibilityLabel={label}
      />
    </View>
  );

  const languageButton = (lang: 'en' | 'fr' | 'sr') => {
    const selected = i18n.language === lang;
    return (
      <Pressable
        onPress={() => changeLanguage(lang)}
        style={[styles.langBtn, selected && { backgroundColor: colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel={t(`common.${lang}`)}
        accessibilityState={{ selected }}
      >
        <Text style={[styles.langBtnText, { color: selected ? colors.onPrimary : colors.text }]}>{lang.toUpperCase()}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('a11y.close')} accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{t('home.options')}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('a11y.close')} hitSlop={8}>
              <Ionicons name="close" size={RFValue(22)} color={colors.textMuted} style={{ padding: 8 }} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            onLayout={e => setViewportHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_, height) => setContentHeight(height)}
            onScroll={e => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              setAtBottom(layoutMeasurement.height + contentOffset.y >= contentSize.height - 20);
            }}
            scrollEventThrottle={16}
          >
            <View style={settingsStyles.settingRow}>
              <View style={settingsStyles.settingText}>
                <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('home.how_to_play')}</Text>
                <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{t('home.how_to_play_desc')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/tutorial');
                }}
                accessibilityRole="button"
                style={[styles.updateButton, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.updateButtonText, { color: colors.primaryText }]}>{t('home.open')}</Text>
              </Pressable>
            </View>

            {SHOW_SUPPORT && (
              <View style={settingsStyles.settingRow}>
                <View style={settingsStyles.settingText}>
                  <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('home.support')}</Text>
                  <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{t('home.support_desc')}</Text>
                </View>
                <Pressable
                  onPress={() => Linking.openURL(SPONSOR_URL)}
                  accessibilityRole="link"
                  style={[styles.updateButton, styles.supportButton, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="heart" size={RFValue(14)} color={colors.onPrimary} />
                  <Text style={[styles.updateButtonText, { color: colors.onPrimary }]}>{t('home.support_button')}</Text>
                </Pressable>
              </View>
            )}

            <View style={settingsStyles.settingRow}>
              <View style={settingsStyles.settingText}>
                <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('common.language')}</Text>
                <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{t(`common.${i18n.language === 'fr' || i18n.language === 'sr' ? i18n.language : 'en'}`)}</Text>
              </View>
              <View style={styles.languageBtns}>
                {languageButton('en')}
                {languageButton('fr')}
                {languageButton('sr')}
              </View>
            </View>

            <ThemeModeSetting colors={colors} labelStyle={settingsStyles.settingLabel} />

            {toggleRow(t('home.background_music'), t('home.music_desc'), isMusicEnabled, () => {
              toggleMusic();
              haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            })}
            {toggleRow(t('home.haptic_feedback'), t('home.haptic_desc'), isHapticsEnabled, () => {
              toggleHapticsEnabled();
              haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            })}
            {toggleRow(t('a11y.vehicle_letters'), t('a11y.vehicle_letters_desc'), showVehicleLetters, () => {
              toggleVehicleLetters();
              haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            })}
            {toggleRow(t('reminders.setting'), t('reminders.setting_desc'), notificationsEnabled, handleRemindersToggle)}

            {notificationsEnabled && (
              <View style={settingsStyles.settingRow}>
                <View style={settingsStyles.settingText}>
                  <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('reminders.hour')}</Text>
                  <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{t('reminders.hour_desc')}</Text>
                </View>
                <View style={styles.hourStepper}>
                  <Pressable onPress={() => setReminderHour(reminderHour - 1)} style={[styles.hourBtn, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('a11y.hour_less')} hitSlop={4}>
                    <Text style={[styles.hourBtnText, { color: colors.text }]}>−</Text>
                  </Pressable>
                  <Text style={[styles.hourValue, { color: colors.text }]}>{formatHour(reminderHour)}</Text>
                  <Pressable onPress={() => setReminderHour(reminderHour + 1)} style={[styles.hourBtn, { backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel={t('a11y.hour_more')} hitSlop={4}>
                    <Text style={[styles.hourBtnText, { color: colors.text }]}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {notificationsEnabled && (
              <View style={settingsStyles.settingRow}>
                <View style={settingsStyles.settingText}>
                  <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('reminders.test')}</Text>
                  <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{t('reminders.test_desc')}</Text>
                </View>
                <Pressable onPress={handleTestReminder} accessibilityRole="button" style={[styles.updateButton, { backgroundColor: colors.card }]}>
                  <Text style={[styles.updateButtonText, { color: colors.primaryText }]}>{t('reminders.test_button')}</Text>
                </Pressable>
              </View>
            )}

            <View style={[settingsStyles.divider, { backgroundColor: colors.textMuted }]} />

            {showMapLevels && <MapLevelsSection colors={colors} onClose={onClose} />}

            <SaveSection colors={colors} onClose={onClose} />

            <View style={settingsStyles.settingRow}>
              <View style={settingsStyles.settingText}>
                <Text style={[settingsStyles.settingLabel, { color: colors.text }]}>{t('home.version')}</Text>
                <Text style={[settingsStyles.settingSub, { color: colors.textMuted }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
              </View>
              <Pressable
                onPress={handleUpdateCheck}
                disabled={isCheckingUpdate}
                accessibilityRole="button"
                accessibilityState={{ disabled: isCheckingUpdate, busy: isCheckingUpdate }}
                style={[styles.updateButton, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.updateButtonText, { color: colors.primaryText }]}>
                  {isCheckingUpdate ? t('common.checking') : t('home.check_for_update')}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[settingsStyles.outlineBtn, { borderColor: colors.textMuted, borderStyle: 'dotted', marginBottom: 16 }]}
              onPress={handleHardReset}
              accessibilityRole="button"
            >
              <Text style={[settingsStyles.outlineBtnText, { color: colors.textMuted }]}>{t('home.hard_reset_progress')}</Text>
            </Pressable>

            <Pressable style={[settingsStyles.mainBtn, { backgroundColor: colors.primary }]} onPress={onClose} accessibilityRole="button">
              <Text style={settingsStyles.mainBtnText}>{t('common.done')}</Text>
            </Pressable>
          </ScrollView>

          {showScrollHint && (
            <View style={[styles.scrollHint, { bottom: Math.max(24, insets.bottom + 12) }]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={[styles.scrollHintText, { color: colors.primaryText, backgroundColor: colors.surface }]}>{t('map.scroll_hint')}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: fixedColors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: '90%',
    shadowColor: fixedColors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: RFValue(24),
    fontWeight: '800',
  },
  // A ScrollView grows by default: the sheet keeps the height of its content up to its max
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  languageBtns: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: fixedColors.neutralSoft,
    padding: 4,
    borderRadius: 12,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langBtnText: {
    fontSize: RFValue(14),
    fontWeight: '700',
  },
  hourStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hourBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourBtnText: {
    fontSize: 20,
    fontWeight: '700',
  },
  hourValue: {
    fontSize: RFValue(16),
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'center',
  },
  updateButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  scrollHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollHintText: {
    fontWeight: '700',
    fontSize: RFValue(12),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
