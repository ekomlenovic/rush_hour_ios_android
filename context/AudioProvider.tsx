import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, type AudioMode, type AudioStatus } from 'expo-audio';
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

const MUSIC_VOLUME = 0.4;
// Fade in at the start of the track and out at its end (s), for a soft loop
const FADE_DURATION = 3;
// Volume ramp: one step per tick, ticks only while the volume moves or during a fade
const VOLUME_STEP = 0.02;
const TICK_MS = 50;
// The player sends its status (position, duration, playing) at this rate, and only while playing
const STATUS_UPDATE_MS = 1000;

// Background music mixes with the player's own audio (music, podcast) and never stops it:
// ambient category on iOS, no audio focus requested on Android. Silent like the phone:
// muted by the silent switch (iOS) and in silent or vibrate mode (Android)
export const MUSIC_AUDIO_MODE: Partial<AudioMode> = {
  interruptionMode: 'mixWithOthers',
  playsInSilentMode: false,
  shouldPlayInBackground: false,
};

// What we know of the player, kept in JS: on Android every getter of the native player
// (playing, currentTime, duration, volume) blocks the JS thread on the main thread
interface PlayerState {
  currentTime: number;
  duration: number;
  playing: boolean;
  // Date.now() at currentTime, to extrapolate the position between two status updates
  at: number;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { isMusicEnabled, toggleMusicEnabled } = useGameStore();

  const player = useAudioPlayer(BACKGROUND_MUSIC_SOURCE, { updateInterval: STATUS_UPDATE_MS });
  const playerState = useRef<PlayerState>({ currentTime: 0, duration: 0, playing: false, at: Date.now() });
  const volume = useRef(0);
  // Runs the volume logic again right away (set by the effect 5, a no-op when it is not running)
  const wake = useRef(() => { });
  // The browser refused to play: it only plays after the player touches the page (autoplay
  // policy). Tried again at the next touch or key, never in a loop: each refusal sends a status
  // event, which played again right away and froze the page
  const playRefused = useRef(false);

  // The audio session is set up before the first play(): left as is, it is exclusive
  // (soloAmbient on iOS, transient audio focus on Android) and stops the player's audio
  const [audioModeReady, setAudioModeReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Safari (16.4+) has the same session: ambient, else its <audio> stops the player's music
    // and plays in silent mode. Its volume cannot be set by a page on iOS: the fades do nothing there
    const audioSession = Platform.OS === 'web' ? (navigator as { audioSession?: { type: string } }).audioSession : undefined;
    if (audioSession) audioSession.type = 'ambient';
    setAudioModeAsync(MUSIC_AUDIO_MODE)
      .catch(() => { })
      .finally(() => { if (!cancelled) setAudioModeReady(true); });
    return () => { cancelled = true; };
  }, []);

  // OPTIMIZATION: Track AppState in React state so effects can react to backgrounding
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState as AppStateStatus);

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
      volume.current = 0;
    }
  }, [player]);

  // 3. Follow the player through its status events rather than reading its properties
  useEffect(() => {
    if (!player) return;
    const retryOnGesture = () => {
      const retry = () => {
        document.removeEventListener('pointerdown', retry, true);
        document.removeEventListener('keydown', retry, true);
        playRefused.current = false;
        // Within the touch: the browser lets it play
        wake.current();
      };
      document.addEventListener('pointerdown', retry, true);
      document.addEventListener('keydown', retry, true);
    };
    const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (Platform.OS === 'web' && status.error && !status.playing) {
        playerState.current = { ...playerState.current, playing: false, at: Date.now() };
        if (!playRefused.current) {
          playRefused.current = true;
          retryOnGesture();
        }
        return;
      }
      const previous = playerState.current;
      playerState.current = {
        currentTime: status.currentTime ?? previous.currentTime,
        duration: status.duration || previous.duration,
        playing: status.playing ?? previous.playing,
        at: Date.now(),
      };
      wake.current();
    });
    return () => subscription.remove();
  }, [player]);

  // 4. Immediately pause audio when backgrounded
  useEffect(() => {
    if (player && appState.match(/inactive|background/)) {
      player.pause();
      playerState.current = { ...playerState.current, playing: false };
    }
  }, [appState, player]);

  // 5. Unified Volume Ramping & Looping logic. No timer at all once the volume has reached
  // its goal: a single timeout up to the next end-of-track fade while the music plays,
  // nothing once it is paused (music off)
  useEffect(() => {
    if (!player || !audioModeReady) return;

    // OPTIMIZATION: If the app is not active, do not start the timer at all.
    // This entirely prevents the Swift crash and saves device battery.
    if (appState !== 'active') {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      timer = null;
      const now = Date.now();
      const state = playerState.current;
      const { duration } = state;
      let position = state.playing ? state.currentTime + (now - state.at) / 1000 : state.currentTime;
      // The track loops: past its end, the position starts again from 0
      if (duration > 0) position %= duration;

      // Base goal based on toggle
      const baseGoal = isMusicEnabled ? MUSIC_VOLUME : 0;
      let finalGoal = baseGoal;
      let fading = false;
      // ms until the end-of-track fade, when the music plays outside the fades
      let untilFade: number | null = null;

      // Soft Loop Logic: Fade out at end, fade in at start. Only while playing: before it
      // plays, the volume rises to its goal (the start of the track then sets it back on
      // the fade in)
      if (isMusicEnabled && state.playing) {
        if (position < FADE_DURATION) {
          finalGoal = (position / FADE_DURATION) * baseGoal;
          fading = true;
        } else if (duration > 0 && position > duration - FADE_DURATION) {
          finalGoal = ((duration - position) / FADE_DURATION) * baseGoal;
          fading = true;
        } else if (duration > 0) {
          untilFade = (duration - FADE_DURATION - position) * 1000;
        }
      }

      // Smoothly interpolate volume, writing it only when it changes
      const currentVol = volume.current;
      const newVol = Math.abs(currentVol - finalGoal) < VOLUME_STEP
        ? finalGoal
        : (currentVol < finalGoal ? currentVol + VOLUME_STEP : currentVol - VOLUME_STEP);
      if (newVol !== currentVol) {
        player.volume = newVol;
        volume.current = newVol;
      }

      // Handle play/pause with safety checks.
      // We no longer need the isActive check here because the timer
      // is guaranteed to be destroyed when the app is backgrounded.
      if (isMusicEnabled && !state.playing && !playRefused.current) {
        player.play();
        playerState.current = { ...state, currentTime: position, playing: true, at: now };
      } else if (!isMusicEnabled && state.playing && newVol <= 0.01) {
        player.pause();
        playerState.current = { ...state, currentTime: position, playing: false, at: now };
      }

      if (fading || newVol !== finalGoal || (!isMusicEnabled && playerState.current.playing)) {
        timer = setTimeout(tick, TICK_MS);
      } else if (untilFade !== null) {
        timer = setTimeout(tick, Math.max(untilFade, TICK_MS));
      }
      // Otherwise the volume is at its goal: idle until a status event or a change of setting
    };

    wake.current = () => {
      if (timer) clearTimeout(timer);
      tick();
    };
    tick();

    return () => {
      if (timer) clearTimeout(timer);
      timer = null;
      wake.current = () => { };
    };
  }, [player, isMusicEnabled, appState, audioModeReady]); // Adding appState here is the magic trick

  const toggleMusic = () => {
    toggleMusicEnabled();
  };

  return (
    <AudioContext.Provider value={{ toggleMusic, isPlaying: isMusicEnabled }}>
      {children}
    </AudioContext.Provider>
  );
}
