import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, useColorScheme, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, Layout, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import { Vehicle } from '@/store/gameStore';

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

  const colors = isDark
    ? { bg: '#0F0F1A', text: '#FFFFFF', sub: '#8E8EA0', accent: '#6C63FF', card: 'rgba(255,255,255,0.06)' }
    : { bg: '#F5F5FA', text: '#1A1A2E', sub: '#6B6B80', accent: '#5A4FE0', card: 'rgba(0,0,0,0.04)' };

  const handleMoveEnd = useCallback((vehicleId: string, newRow: number, newCol: number) => {
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, row: newRow, col: newCol } : v));
    
    // Simple logic to advance steps
    if (step === 1 && vehicleId === 'v1' && newRow >= 1) {
      setStep(2);
    } else if (step === 2 && vehicleId === 'target' && newCol >= 4) {
      setCompleted(true);
    }
  }, [step]);

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

      {/* Board */}
      <Animated.View layout={Layout.springify()} style={styles.boardWrapper}>
        <Board
          gridSize={6}
          vehicles={vehicles}
          exitRow={2}
          exitCol={6}
           onMoveEnd={handleMoveEnd}
          hintVehicleId={t(`tutorial.step${step}.highlight`, { defaultValue: step === 1 ? 'v1' : 'target' })}
        />
      </Animated.View>

      {/* Instruction Card */}
      <Animated.View 
        key={step}
        entering={FadeInDown.springify()} 
        style={[styles.card, { backgroundColor: colors.card }]}
      >
         <Text style={[styles.cardTitle, { color: colors.accent }]}>
          {t(`tutorial.step${step}_title`)}
        </Text>
         <Text style={[styles.cardDesc, { color: colors.text }]}>
          {t(`tutorial.step${step}_desc`)}
        </Text>
        
        {step === 0 && (
          <Pressable 
            style={[styles.nextBtn, { backgroundColor: colors.accent }]}
             onPress={() => setStep(1)}
          >
            <Text style={styles.nextBtnText}>{t('common.got_it')}</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* Completion Overlay */}
      {completed && (
        <Animated.View entering={FadeIn} style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify()} style={[styles.winCard, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
             <Text style={styles.emoji}>🎉</Text>
            <Text style={[styles.winTitle, { color: colors.accent }]}>{t('common.excellent')}</Text>
            <Text style={[styles.winDesc, { color: colors.text }]}>{t('tutorial.ready_desc')}</Text>
            <Pressable 
              style={[styles.playBtn, { backgroundColor: colors.accent }]}
               onPress={() => router.replace('/map')}
            >
              <Text style={styles.playBtnText}>{t('tutorial.start_playing')}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
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
    marginBottom: 40,
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
    marginBottom: 40,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  nextBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 100,
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
