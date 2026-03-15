import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useGameStore } from '@/store/gameStore';

interface AudioContextType {
  toggleMusic: () => void;
  isPlaying: boolean;
}

const AudioContext = createContext<AudioContextType>({
  toggleMusic: () => {},
  isPlaying: false,
});

export function useAudio() {
  return useContext(AudioContext);
}

const BACKGROUND_MUSIC_SOURCE = require('@/assets/Whispers_of_the_Verdant_Stream.mp3');

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isMusicEnabled, toggleMusicEnabled } = useGameStore();
  
  // useAudioPlayer handles the loading and provides a player instance
  const player = useAudioPlayer(BACKGROUND_MUSIC_SOURCE);
  const appState = useRef(AppState.currentState);
  const fadeTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize player settings
  useEffect(() => {
    if (player) {
      player.loop = true;
      player.volume = 0; // Start at 0 for fade in
    }
  }, [player]);

  // Unified Volume Ramping & Looping logic
  useEffect(() => {
    if (!player) return;

    fadeTimer.current = setInterval(() => {
      const { duration, currentTime } = player;
      const isEnabled = isMusicEnabled;
      
      // Base goal based on toggle
      const baseGoal = isEnabled ? 0.4 : 0;
      let finalGoal = baseGoal;

      // Soft Loop Logic: Fade out at end, fade in at start
      if (isEnabled && duration > 0) {
        const FADE_DURATION = 3; // 3 seconds fade for maximum smoothness
        if (currentTime < FADE_DURATION) {
          finalGoal = (currentTime / FADE_DURATION) * baseGoal;
        } else if (currentTime > duration - FADE_DURATION) {
          finalGoal = ((duration - currentTime) / FADE_DURATION) * baseGoal;
        }
      }

      // Smoothly interpolate volume
      const step = 0.01; // Small step for very smooth transition
      if (player.volume < finalGoal) {
        player.volume = Math.min(finalGoal, player.volume + step);
        if (player.volume > 0 && isEnabled && !player.playing) {
          player.play();
        }
      } else if (player.volume > finalGoal) {
        player.volume = Math.max(finalGoal, player.volume - step);
        // If we were fading out for a toggle off
        if (player.volume <= 0.01 && !isEnabled && player.playing) {
          player.pause();
        }
      } else if (player.volume <= 0 && !isEnabled && player.playing) {
        player.pause();
      }
    }, 50);

    return () => {
      if (fadeTimer.current) clearInterval(fadeTimer.current);
    };
  }, [player, isMusicEnabled]);

  // Handle App backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isMusicEnabled && player) {
          player.play();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        if (player) {
          player.pause();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isMusicEnabled, player]);

  const toggleMusic = () => {
    toggleMusicEnabled();
    // Actual play/pause is handled by the useEffect watching isMusicEnabled
  };

  return (
    <AudioContext.Provider value={{ toggleMusic, isPlaying: isMusicEnabled }}>
      {children}
    </AudioContext.Provider>
  );
}
