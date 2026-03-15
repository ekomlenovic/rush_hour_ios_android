import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useGameStore } from '@/store/gameStore';

interface AudioContextType {
  toggleMusic: () => void;
  isPlaying: boolean;
}

const AudioContext = createContext<AudioContextType>({
  toggleMusic: () => { },
  isPlaying: false,
});

export function useAudio() {
  return useContext(AudioContext);
}

const BACKGROUND_MUSIC_SOURCE = require('@/assets/Whispers_of_the_Verdant_Stream.mp3');

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isMusicEnabled, toggleMusicEnabled } = useGameStore();

  const player = useAudioPlayer(BACKGROUND_MUSIC_SOURCE);
  const fadeTimer = useRef<NodeJS.Timeout | null>(null);

  // OPTIMIZATION: Track AppState in React state so effects can react to backgrounding
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // 1. Keep appState completely in sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  // 2. Initialize player settings
  useEffect(() => {
    if (player) {
      player.loop = true;
      player.volume = 0; // Start at 0 for fade in
    }
  }, [player]);

  // 3. Immediately pause audio when backgrounded
  useEffect(() => {
    if (player && appState.match(/inactive|background/)) {
      player.pause();
    }
  }, [appState, player]);

  // 4. Unified Volume Ramping & Looping logic
  useEffect(() => {
    if (!player) return;

    // OPTIMIZATION: If the app is not active, do not start the interval at all.
    // This entirely prevents the Swift crash and saves device battery.
    if (appState !== 'active') {
      return;
    }

    fadeTimer.current = setInterval(() => {
      const { duration, currentTime } = player;
      const isEnabled = isMusicEnabled;

      // Base goal based on toggle
      const baseGoal = isEnabled ? 0.4 : 0;
      let finalGoal = baseGoal;

      // Soft Loop Logic: Fade out at end, fade in at start
      if (isEnabled && duration > 0) {
        const FADE_DURATION = 3;
        if (currentTime < FADE_DURATION) {
          finalGoal = (currentTime / FADE_DURATION) * baseGoal;
        } else if (currentTime > duration - FADE_DURATION) {
          finalGoal = ((duration - currentTime) / FADE_DURATION) * baseGoal;
        }
      }

      // Smoothly interpolate volume
      const step = 0.02;
      const currentVol = player.volume;

      const newVol = Math.abs(currentVol - finalGoal) < step
        ? finalGoal
        : (currentVol < finalGoal ? currentVol + step : currentVol - step);

      player.volume = newVol;

      // Handle play/pause with safety checks. 
      // We no longer need the isActive check here because the interval 
      // is guaranteed to be destroyed when the app is backgrounded.
      if (isEnabled && player.volume > 0 && !player.playing) {
        player.play();
      } else if (!isEnabled && player.playing && player.volume <= 0.01) {
        player.pause();
      }
    }, 50);

    return () => {
      if (fadeTimer.current) clearInterval(fadeTimer.current);
    };
  }, [player, isMusicEnabled, appState]); // Adding appState here is the magic trick

  const toggleMusic = () => {
    toggleMusicEnabled();
  };

  return (
    <AudioContext.Provider value={{ toggleMusic, isPlaying: isMusicEnabled }}>
      {children}
    </AudioContext.Provider>
  );
}