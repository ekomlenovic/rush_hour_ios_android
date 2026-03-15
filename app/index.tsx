import React, { useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Modal, Switch, Alert } from 'react-native';


import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useGameStore } from '@/store/gameStore';
import { useAudio } from '@/context/AudioProvider';
import * as Haptics from 'expo-haptics';


const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { maxUnlockedLevel, dailyChallengeProgress, hardReset } = useGameStore();
  
  const { toggleMusic, isPlaying: isMusicEnabled } = useAudio();
  const [isSettingsVisible, setSettingsVisible] = useState(false);

  const handleHardReset = () => {
    Alert.alert(
      "Hard Reset",
      "This will erase EVERYTHING: all your progress, stars, and custom levels. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Reset Everything",
          style: "destructive",
          onPress: () => {
            hardReset();
            setSettingsVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        Slide. Think. Escape.
      </Animated.Text>

      <AnimatedPressable
        entering={FadeInDown.delay(600).springify()}
        style={[styles.playButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          router.push('/map');
        }}
      >
        <Text style={styles.playText}>World Map</Text>
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
          {dailyStatus?.completed ? `Daily Done! ⭐${dailyStatus.stars}` : 'Daily Challenge'}
        </Text>

      </AnimatedPressable>

      <View style={styles.footerLinks}>
        <AnimatedPressable
          entering={FadeInDown.delay(900).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/custom-levels')}
        >
          <Text style={[styles.linkText, { color: colors.accent }]}>My Levels</Text>
        </AnimatedPressable>

        <AnimatedPressable
          entering={FadeInDown.delay(1000).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/creator')}
        >
          <Text style={[styles.linkText, { color: colors.accent }]}>Level Creator</Text>
        </AnimatedPressable>
      </View>

      <View style={[styles.footerLinks, { marginTop: -10 }]}>
        <AnimatedPressable
          entering={FadeInDown.delay(1100).springify()}
          style={[styles.linkButton]}
          onPress={() => router.push('/tutorial')}
        >
          <Text style={[styles.linkText, { color: colors.sub }]}>How to Play?</Text>
        </AnimatedPressable>

      </View>

      {/* Settings Button */}
      <Animated.View entering={FadeIn.delay(1200)} style={styles.headerRight}>
        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Options</Text>
              <Pressable onPress={() => setSettingsVisible(false)}>
                <Text style={{ fontSize: 20, color: colors.sub, padding: 8 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Background Music</Text>
                <Text style={[styles.settingSub, { color: colors.sub }]}>Smooth melody during gameplay</Text>
              </View>
              <Switch
                value={isMusicEnabled}
                onValueChange={() => {
                  toggleMusic();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                trackColor={{ false: '#767577', true: colors.accent }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.sub }]} />


            <Pressable
              style={[styles.resetBtn, { borderColor: colors.sub, borderStyle: 'dotted', marginBottom: 24 }]}
              onPress={handleHardReset}
            >
              <Text style={[styles.resetBtnText, { color: colors.sub }]}>🔥 Hard Reset Progress</Text>
            </Pressable>

            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.accent }]}
              onPress={() => setSettingsVisible(false)}
            >
              <Text style={styles.closeButtonText}>Done</Text>
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
    fontSize: 24,
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  settingLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSub: {
    fontSize: 14,
  },
  closeButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
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
    fontSize: 15,
    fontWeight: '700',
  },
});




