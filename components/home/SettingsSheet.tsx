import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/store/gameStore';
import { useAudio } from '@/context/AudioProvider';
import { haptics, Haptics } from '@/utils/haptics';
import { checkForUpdate } from '@/utils/updateChecker';
import i18n, { changeLanguage } from '@/utils/i18n';
import { RFValue } from '@/utils/responsive';
import { requestReminderPermission } from '@/utils/notifications';
import BottomSheet from './BottomSheet';
import ThemeModeSetting from '../ThemeModeSetting';
import { fixedColors, type UiColors } from '@/theme';

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

interface Props {
  visible: boolean;
  colors: UiColors;
  isDark: boolean;
  onClose: () => void;
}

/** Options: language, music, haptics, reminders, version and update, unlock all, hard reset */
export default function SettingsSheet({ visible, colors, isDark, onClose }: Props) {
  const { t } = useTranslation();
  const isHapticsEnabled = useGameStore(s => s.isHapticsEnabled);
  const showVehicleLetters = useGameStore(s => s.showVehicleLetters);
  const toggleVehicleLetters = useGameStore(s => s.toggleVehicleLetters);
  const toggleHapticsEnabled = useGameStore(s => s.toggleHapticsEnabled);
  const notificationsEnabled = useGameStore(s => s.notificationsEnabled);
  const setNotificationsEnabled = useGameStore(s => s.setNotificationsEnabled);
  const reminderHour = useGameStore(s => s.reminderHour);
  const setReminderHour = useGameStore(s => s.setReminderHour);
  const unlockAllLevels = useGameStore(s => s.unlockAllLevels);
  const hardReset = useGameStore(s => s.hardReset);
  const { toggleMusic, isPlaying: isMusicEnabled } = useAudio();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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
          { text: t('common.later'), style: "cancel" },
          {
            text: info.isStoreUpdate ? t('common.update') : t('common.download'),
            onPress: () => info.downloadURL && Linking.openURL(info.downloadURL)
          }
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
    <BottomSheet visible={visible} title={t('home.options')} colors={colors} isDark={isDark} onClose={onClose}>
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

      <View style={styles.settingRow}>
        <View>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('home.background_music')}</Text>
          <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('home.music_desc')}</Text>
        </View>
        <Switch
          value={isMusicEnabled}
          onValueChange={() => {
            toggleMusic();
            haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
          accessibilityLabel={t('home.background_music')}
        />
      </View>

      <View style={styles.settingRow}>
        <View>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('home.haptic_feedback')}</Text>
          <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('home.haptic_desc')}</Text>
        </View>
        <Switch
          value={isHapticsEnabled}
          onValueChange={() => {
            toggleHapticsEnabled();
            haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
          accessibilityLabel={t('home.haptic_feedback')}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('a11y.vehicle_letters')}</Text>
          <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('a11y.vehicle_letters_desc')}</Text>
        </View>
        <Switch
          value={showVehicleLetters}
          onValueChange={() => {
            toggleVehicleLetters();
            haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
          accessibilityLabel={t('a11y.vehicle_letters')}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('reminders.setting')}</Text>
          <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('reminders.setting_desc')}</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleRemindersToggle}
          trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
          accessibilityLabel={t('reminders.setting')}
        />
      </View>

      {notificationsEnabled && (
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{t('reminders.hour')}</Text>
            <Text style={[styles.settingSub, { color: colors.textMuted }]}>{t('reminders.hour_desc')}</Text>
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

      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />

      <View style={styles.versionRow}>
        <View>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('home.version')}</Text>
          <Text style={[styles.settingSub, { color: colors.textMuted }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
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

      <View style={[styles.divider, { backgroundColor: colors.textMuted }]} />

      <Pressable
        style={[styles.resetBtn, { borderColor: colors.primary, backgroundColor: colors.card, marginBottom: 12 }]}
        onPress={handleUnlockAll}
        accessibilityRole="button"
        accessibilityLabel={t('home.unlock_all')}
      >
        <Text style={[styles.resetBtnText, { color: colors.primaryText, fontWeight: '700' }]}>🔓 {t('home.unlock_all')}</Text>
      </Pressable>

      <Pressable
        style={[styles.resetBtn, { borderColor: colors.textMuted, borderStyle: 'dotted', marginBottom: 24 }]}
        onPress={handleHardReset}
        accessibilityRole="button"
      >
        <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>{t('home.hard_reset_progress')}</Text>
      </Pressable>

      <Pressable
        style={[styles.closeButton, { backgroundColor: colors.primary }]}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={styles.closeButtonText}>{t('common.done')}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  settingText: {
    flexShrink: 1,
    marginRight: 12,
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
  settingLabel: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSub: {
    fontSize: RFValue(14),
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
  closeButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: fixedColors.onPrimary,
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  divider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 20,
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
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  updateButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  updateButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
});
