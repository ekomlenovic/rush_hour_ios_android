import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Dimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, Layout, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import { Vehicle, useGameStore } from '@/store/gameStore';
import { checkWin } from '@/utils/collision';

const { width } = Dimensions.get('window');

const TUTORIAL_STEPS = [
  { highlight: "target" },
  { highlight: "v1" },
  { highlight: "target" },
];

const TUTORIAL_VEHICLES: Vehicle[] = [
  {
    id: 'target',
    row: 2,
    col: 0,
    length: 2,
    orientation: 'horizontal',
    isTarget: true,
    color: '#EF4444',
  },
  {
    id: 'v1',
    row: 0,
    col: 2,
    length: 3,
    orientation: 'vertical',
    isTarget: false,
    color: '#10B981',
  },
];

export default function TutorialScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [vehicles, setVehicles] = useState<Vehicle[]>(TUTORIAL_VEHICLES);
  const [completed, setCompleted] = useState(false);

  // Whether the current step's dialog has been acknowledged (for step 1 and 2)
  const [dialogDismissed, setDialogDismissed] = useState(false);

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: '#1A1A2E' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: '#FFFFFF' };

  // Board is disabled (grayed) until the dialog for the current step is dismissed
  // At step 0, it is ALWAYS locked because step 0 is pure presentation
  const isBoardLocked = step === 0 || !dialogDismissed;

  const handleDismissDialog = () => {
    if (step === 0) {
      setStep(1);
      setDialogDismissed(false); // Step 1 will show its explanation first
    } else {
      setDialogDismissed(true); // Unlock board for the player to perform the move
    }
  };

  const handleMoveEnd = useCallback((vehicleId: string, newRow: number, newCol: number) => {
    const updatedVehicles = vehicles.map(v => v.id === vehicleId ? { ...v, row: newRow, col: newCol } : v);
    setVehicles(updatedVehicles);
    
    // Always check if the target car reached the exit
    if (checkWin(updatedVehicles, 2, 6, 6)) {
      setCompleted(true);
      useGameStore.getState().completeLevel(0, 300, 3);
      return;
    }

    // Step 1: v1 (green bus) must move down enough to clear row 2
    // v1 is length 3 vertical at col 2, so row >= 3 frees row 2
    if (step === 1 && vehicleId === 'v1' && newRow >= 3) {
      setStep(2);
      setDialogDismissed(false); // Lock board again for step 2 dialog
    }
  }, [step, vehicles]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
       <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.sub }]}>{t('tutorial.skip')}</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{t('tutorial.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Board with gray overlay when locked */}
      <Animated.View layout={Layout.springify()} style={styles.boardWrapper}>
        <View style={isBoardLocked ? styles.boardLocked : undefined}>
          <Board
            gridSize={6}
            vehicles={vehicles}
            exitRow={2}
            exitCol={6}
            onMoveEnd={handleMoveEnd}
            hintVehicleId={dialogDismissed ? TUTORIAL_STEPS[step]?.highlight : null}
            disabled={isBoardLocked}
          />
          {/* Semi-transparent overlay to visually gray out the board */}
          {isBoardLocked && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={[
                styles.boardOverlay,
                { backgroundColor: isDark ? 'rgba(15,15,26,0.6)' : 'rgba(245,245,250,0.6)' }
              ]}
              pointerEvents="none"
            />
          )}
        </View>
      </Animated.View>

      {/* Instruction Card — prominent styling */}
      <Animated.View 
        key={`step-${step}-${dialogDismissed ? 'dismissed' : 'active'}`}
        entering={FadeInDown.springify()} 
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            shadowColor: isDark ? '#6C63FF' : '#000',
            borderColor: isBoardLocked ? colors.accent : 'transparent',
          }
        ]}
      >
        {/* Step indicator dots */}
        <View style={styles.stepDots}>
          {TUTORIAL_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= step ? colors.accent : (isDark ? '#2A2A3A' : '#D0D0D8'),
                  width: i === step ? 24 : 8,
                }
              ]}
            />
          ))}
        </View>

        <Text style={[styles.cardTitle, { color: colors.accent }]}>
          {t(`tutorial.step${step}_title`)}
        </Text>
        <Text style={[styles.cardDesc, { color: colors.text }]}>
          {t(`tutorial.step${step}_desc`)}
        </Text>
        
        {/* Show "Got it" button until dialog is dismissed */}
        {isBoardLocked && (
          <Pressable 
            style={[styles.nextBtn, { backgroundColor: colors.accent }]}
            onPress={handleDismissDialog}
          >
            <Text style={styles.nextBtnText}>{t('common.got_it')}</Text>
          </Pressable>
        )}

        {/* After dismissal, show a subtle reminder of what to do */}
        {dialogDismissed && !completed && (
          <View style={[styles.actionHint, { backgroundColor: isDark ? 'rgba(108,99,255,0.1)' : 'rgba(90,79,224,0.08)' }]}>
            <Text style={[styles.actionHintText, { color: colors.accent }]}>
              👆 {step === 1 ? t('tutorial.step1_desc') : t('tutorial.step2_desc')}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Completion Overlay */}
      <Modal visible={completed} transparent animationType="fade" statusBarTranslucent onRequestClose={() => router.replace('/map')}>
        <View style={styles.overlay}>
          <View style={[styles.winCard, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={[styles.winTitle, { color: colors.accent }]}>{t('common.excellent')}</Text>
            <Text style={[styles.winDesc, { color: colors.text }]}>{t('tutorial.ready_desc')}</Text>
            <Pressable 
              style={[styles.playBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.replace('/map')}
            >
              <Text style={styles.playBtnText}>{t('tutorial.start_playing')}</Text>
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
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  boardWrapper: {
    alignItems: 'center',
    marginBottom: 32,
  },
  boardLocked: {
    opacity: 0.45,
  },
  boardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  card: {
    padding: 28,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20,
    fontWeight: '500',
  },
  nextBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  actionHint: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionHintText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  winCard: {
    width: '100%',
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  winTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  winDesc: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
  },
  playBtn: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
  },
  playBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
