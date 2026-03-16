import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Modal, Switch, Alert } from 'react-native';


import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useGameStore } from '@/store/gameStore';
import { useAudio } from '@/context/AudioProvider';
import { haptics, Haptics } from '@/utils/haptics';
import { checkForUpdate, UpdateInfo } from '@/utils/updateChecker';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import i18n, { changeLanguage } from '@/utils/i18n';
import { RFValue } from '@/utils/responsive';


const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { maxUnlockedLevel, dailyChallengeProgress, hardReset, isHapticsEnabled, toggleHapticsEnabled } = useGameStore();

  const { toggleMusic, isPlaying: isMusicEnabled } = useAudio();
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const handleUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    const info = await checkForUpdate();
    setUpdateInfo(info);
    setIsCheckingUpdate(false);
    haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (info.isUpdateAvailable) {
      Alert.alert(
        t('common.update_available'),
        t('home.update_desc', { version: info.latestVersion, defaultValue: `A new version (${info.latestVersion}) is available. Would you like to download it?` }),
        [
          { text: t('common.later'), style: "cancel" },
          { 
            text: t('common.download'), 
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

  useEffect(() => {
    // Silent check on launch
    const autoCheck = async () => {
      const info = await checkForUpdate();
      if (info.isUpdateAvailable) {
        Alert.alert(
          t('common.update_available'),
          t('home.update_desc', { version: info.latestVersion, defaultValue: `A new version (${info.latestVersion}) is available. Would you like to download it?` }),
          [
            { text: t('common.later'), style: "cancel" },
            { 
              text: t('common.download'), 
              onPress: () => info.downloadURL && Linking.openURL(info.downloadURL) 
            }
          ]
        );
      }
    };
    autoCheck();
  }, []);

  const handleHardReset = () => {
    Alert.alert(
      t('common.hard_reset'),
      t('home.hard_reset_confirm_desc', { defaultValue: "This will erase EVERYTHING: all your progress, stars, and custom levels. Are you sure?" }),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: t('home.hard_reset_confirm_btn', { defaultValue: "Yes, Reset Everything" }),
          style: "destructive",
          onPress: () => {
            hardReset();
            setSettingsVisible(false);
            haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };



  const dateStr = new Date().toISOString().split('T')[0];

  const dailyStatus = dailyChallengeProgress[dateStr];

  const colors = isDark
    ? { text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: 'rgba(255,255,255,0.06)', success: '#10B981' }
    : { text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: 'rgba(0,0,0,0.04)', success: '#059669' };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0F0F1A' : '#F5F5FA' }]}>
      <Animated.Text
        entering={FadeInUp.delay(200).springify()}
        style={[styles.title, { color: colors.text }]}
      >
        Rush Hours
      </Animated.Text>

      <Animated.Text
        entering={FadeInUp.delay(400).springify()}
        style={[styles.subtitle, { color: colors.sub }]}
      >
        {t('home.subtitle', { defaultValue: 'Slide. Think. Escape.' })}
      </Animated.Text>

      <AnimatedPressable
        entering={FadeInDown.delay(600).springify()}
        style={[styles.playButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          router.push('/map');
        }}
      >
        <Text style={styles.playText}>{t('home.world_map')}</Text>
      </AnimatedPressable>

      <AnimatedPressable
        entering={FadeInDown.delay(750).springify()}
        style={[
          styles.secondaryButton,
          { borderColor: dailyStatus?.completed ? colors.success : colors.accent, borderWidth: 2 }
        ]}
        onPress={() => {
          router.push(`/game?levelId=daily&date=${dateStr}`);
        }}
      >
        <Text style={[styles.secondaryText, { color: dailyStatus?.completed ? colors.success : colors.accent }]}>
          {dailyStatus?.completed ? t('home.daily_done', { stars: dailyStatus.stars, defaultValue: `Daily Done! ⭐${dailyStatus.stars}` }) : t('home.daily_challenge', { defaultValue: 'Daily Challenge' })}
        </Text>

      </AnimatedPressable>

      <View style={styles.footerLinks}>
        <AnimatedPressable
          entering={FadeInDown.delay(900).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/custom-levels')}
        >
          <Text style={[styles.linkText, { color: colors.accent }]}>{t('home.my_levels')}</Text>
        </AnimatedPressable>

        <AnimatedPressable
          entering={FadeInDown.delay(1000).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/creator')}
        >
          <Text style={[styles.linkText, { color: colors.accent }]}>{t('home.level_creator')}</Text>
        </AnimatedPressable>
      </View>

      <View style={[styles.footerLinks, { marginTop: -10 }]}>
        <AnimatedPressable
          entering={FadeInDown.delay(1100).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/tutorial')}
        >
          <Text style={[styles.linkText, { color: colors.sub }]}>{t('home.how_to_play')}</Text>
        </AnimatedPressable>

      </View>

      {/* Settings Button */}
      <Animated.View entering={FadeIn.delay(1200)} style={styles.headerRight}>
        <Pressable
          onPress={() => {
            haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSettingsVisible(true);
          }}
          style={[styles.settingsButton, { backgroundColor: colors.card }]}
        >
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </Pressable>
      </Animated.View>

      {/* Simple Settings Modal */}
      <Modal visible={isSettingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('home.options')}</Text>
              <Pressable onPress={() => setSettingsVisible(false)}>
                <Text style={{ fontSize: RFValue(20), color: colors.sub, padding: 8 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('common.language')}</Text>
                <Text style={[styles.settingSub, { color: colors.sub }]}>{i18n.language === 'en' ? t('common.en') : t('common.fr')}</Text>
              </View>
              <View style={styles.languageBtns}>
                <Pressable
                  onPress={() => changeLanguage('en')}
                  style={[styles.langBtn, i18n.language === 'en' && { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.langBtnText, { color: i18n.language === 'en' ? '#FFF' : colors.text }]}>EN</Text>
                </Pressable>
                <Pressable
                  onPress={() => changeLanguage('fr')}
                  style={[styles.langBtn, i18n.language === 'fr' && { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.langBtnText, { color: i18n.language === 'fr' ? '#FFF' : colors.text }]}>FR</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('home.background_music')}</Text>
                <Text style={[styles.settingSub, { color: colors.sub }]}>{t('home.music_desc')}</Text>
              </View>
              <Switch
                value={isMusicEnabled}
                onValueChange={() => {
                  toggleMusic();
                  haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: '#767577', true: colors.accent }}
              />
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>{t('home.haptic_feedback')}</Text>
                <Text style={[styles.settingSub, { color: colors.sub }]}>{t('home.haptic_desc')}</Text>
              </View>
              <Switch
                value={isHapticsEnabled}
                onValueChange={() => {
                  toggleHapticsEnabled();
                  haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: '#767577', true: colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.sub } ]} />

            <View style={styles.versionRow}>
              <View>
                 <Text style={[styles.settingLabel, { color: colors.text }]}>{t('home.version')}</Text>
                <Text style={[styles.settingSub, { color: colors.sub }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
              </View>
              <Pressable 
                onPress={handleUpdateCheck}
                disabled={isCheckingUpdate}
                style={[styles.updateButton, { backgroundColor: colors.card }]}
              >
                <Text style={[styles.updateButtonText, { color: colors.accent }]}>
                  {isCheckingUpdate ? t('common.checking', { defaultValue: 'Checking...' }) : t('home.check_for_update', { defaultValue: 'Check for Update' })}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.sub }]} />
            <Pressable
              style={[styles.resetBtn, { borderColor: colors.sub, borderStyle: 'dotted', marginBottom: 24 }]}
              onPress={handleHardReset}
            >
              <Text style={[styles.resetBtnText, { color: colors.sub }]}>{t('home.hard_reset_progress')}</Text>
            </Pressable>

            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.accent }]}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={styles.closeButtonText}>{t('common.done', { defaultValue: 'Done' })}</Text>
            </Pressable>

          </View>
        </View>
      </Modal>
    </View>




  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 48,
  },
  playButton: {
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  playText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  linkButton: {

    marginTop: 24,
    padding: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  headerRight: {
    position: 'absolute',
    top: 60,
    right: 24,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
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
    marginBottom: 32,
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
    backgroundColor: 'rgba(0,0,0,0.05)', 
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
    color: '#FFFFFF',
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




