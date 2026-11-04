import { AppState, Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useGameStore } from '../store/gameStore';

/**
 * Sound effects (issue 319): short sounds on top of the visuals, the screen reader and the haptics,
 * never in their place. Their own setting (isSoundEnabled), apart from the music; same audio session
 * as the music (context/AudioProvider.tsx): mixed with the player's audio, silent in silent mode.
 * Files written by scripts/sounds/generate.mjs.
 */
const SOURCES = {
  slide: require('../assets/sounds/slide.wav'),
  bump: require('../assets/sounds/bump.wav'),
  exit: require('../assets/sounds/exit.wav'),
  win: require('../assets/sounds/win.wav'),
  star1: require('../assets/sounds/star1.wav'),
  star2: require('../assets/sounds/star2.wav'),
  star3: require('../assets/sounds/star3.wav'),
  unlock: require('../assets/sounds/unlock.wav'),
  tick: require('../assets/sounds/tick.wav'),
  go: require('../assets/sounds/go.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;
export const SOUND_NAMES = Object.keys(SOURCES) as SoundName[];

// Under the music (0.4): the moves come often, they stay discreet
const VOLUME: Record<SoundName, number> = {
  slide: 0.35, bump: 0.4, exit: 0.5, win: 0.6, star1: 0.45, star2: 0.45, star3: 0.45, unlock: 0.55, tick: 0.4, go: 0.5,
};

// The same sound played again within this time (ms) is dropped: a burst of moves does not crackle
const MIN_GAP_MS = 60;

const players = new Map<SoundName, AudioPlayer>();
const lastPlayed = new Map<SoundName, number>();
// Set by AudioProvider once the audio session is ambient: a sound before it would stop the player's music
let sessionReady = false;
// Web: the browser plays nothing before a first touch (autoplay policy). Nothing is tried before it,
// and a refused sound is never tried again
let touched = Platform.OS !== 'web';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const onTouch = () => {
    touched = true;
    document.removeEventListener('pointerdown', onTouch, true);
    document.removeEventListener('keydown', onTouch, true);
  };
  document.addEventListener('pointerdown', onTouch, true);
  document.addEventListener('keydown', onTouch, true);
}

function playerOf(name: SoundName): AudioPlayer | null {
  let player = players.get(name);
  if (!player) {
    try {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = VOLUME[name];
    } catch {
      return null;
    }
    players.set(name, player);
  }
  return player;
}

/** Called by AudioProvider when the audio session is set up: loads the sounds, so the first one is on time */
export function setSoundSessionReady(ready: boolean) {
  sessionReady = ready;
  if (ready && useGameStore.getState().isSoundEnabled) preloadSounds();
}

export function preloadSounds() {
  for (const name of SOUND_NAMES) playerOf(name);
}

/** Plays a sound, fire and forget: nothing when sounds are off, the app is in the background or the page untouched */
export function playSound(name: SoundName, now: number = Date.now()) {
  if (!sessionReady || !touched || !useGameStore.getState().isSoundEnabled) return;
  if (AppState.currentState !== 'active') return;
  const last = lastPlayed.get(name);
  if (last !== undefined && now - last < MIN_GAP_MS) return;
  lastPlayed.set(name, now);
  const player = playerOf(name);
  if (!player) return;
  try {
    // From the start: the player keeps its position at the end of the last play.
    // Not awaited: play() right after the seek is what the native players expect
    player.seekTo(0).catch(() => { });
    player.play();
  } catch { }
}

/** The ping of the n-th star (1 to 3) */
export const starSound = (n: number): SoundName => (n <= 1 ? 'star1' : n === 2 ? 'star2' : 'star3');

/**
 * The sounds of the win screen, in ms from its opening: the jingle once the car is out, a ping per star
 * won, each higher, then a chime if the win unlocked something (achievement, style, player level)
 */
export function winSoundPlan(stars: number, unlocked: boolean): { at: number; sound: SoundName }[] {
  const plan: { at: number; sound: SoundName }[] = [{ at: 250, sound: 'win' }];
  const count = Math.max(0, Math.min(3, Math.floor(stars)));
  for (let i = 1; i <= count; i++) plan.push({ at: 850 + (i - 1) * 220, sound: starSound(i) });
  if (unlocked) plan.push({ at: 850 + count * 220 + 250, sound: 'unlock' });
  return plan;
}

/** Plays a plan of sounds; returns what cancels the ones not played yet */
export function playSoundPlan(plan: { at: number; sound: SoundName }[]): () => void {
  const timers = plan.map(({ at, sound }) => setTimeout(() => playSound(sound), at));
  return () => timers.forEach(clearTimeout);
}

/** For the tests: back to a fresh launch */
export function resetSoundsForTests() {
  for (const player of players.values()) {
    try { player.remove(); } catch { }
  }
  players.clear();
  lastPlayed.clear();
  sessionReady = false;
  touched = Platform.OS !== 'web';
}
