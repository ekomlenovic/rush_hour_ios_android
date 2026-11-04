import { AppState } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { playSound, playSoundPlan, resetSoundsForTests, setSoundSessionReady, winSoundPlan } from '../utils/sounds';

// One native player per sound: counts what the game asks of it
const mockPlayers: { source: unknown; volume: number; play: jest.Mock; seekTo: jest.Mock; remove: jest.Mock }[] = [];
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn((source: unknown) => {
    const player = { source, volume: 1, play: jest.fn(), seekTo: jest.fn(async () => { }), remove: jest.fn() };
    mockPlayers.push(player);
    return player;
  }),
}));

const plays = () => mockPlayers.reduce((n, p) => n + p.play.mock.calls.length, 0);

beforeEach(() => {
  resetSoundsForTests();
  mockPlayers.length = 0;
  (AppState as any).currentState = 'active';
  useGameStore.setState({ isSoundEnabled: true, isMusicEnabled: true });
});

describe('sound effects (issue 319)', () => {
  it('plays nothing before the audio session is set up: it would stop the player\'s music', () => {
    playSound('slide');
    expect(mockPlayers).toHaveLength(0);
  });

  it('loads every sound once the session is ready, then plays from the start', () => {
    setSoundSessionReady(true);
    expect(mockPlayers).toHaveLength(10);
    playSound('win', 1000);
    expect(plays()).toBe(1);
    const win = mockPlayers.find(p => p.play.mock.calls.length === 1)!;
    expect(win.seekTo).toHaveBeenCalledWith(0);
    // Under the music (0.4 and over for the jingles, the moves stay discreet)
    expect(win.volume).toBeLessThanOrEqual(0.6);
  });

  it('has its own setting, apart from the music', () => {
    setSoundSessionReady(true);
    useGameStore.setState({ isSoundEnabled: false, isMusicEnabled: true });
    playSound('bump', 1000);
    expect(plays()).toBe(0);
    useGameStore.setState({ isSoundEnabled: true, isMusicEnabled: false });
    playSound('bump', 2000);
    expect(plays()).toBe(1);
    useGameStore.getState().toggleSoundEnabled();
    expect(useGameStore.getState().isSoundEnabled).toBe(false);
  });

  it('turned off, the sounds are not even loaded', () => {
    useGameStore.setState({ isSoundEnabled: false });
    setSoundSessionReady(true);
    expect(mockPlayers).toHaveLength(0);
  });

  it('is silent in the background', () => {
    setSoundSessionReady(true);
    (AppState as any).currentState = 'background';
    playSound('unlock', 1000);
    expect(plays()).toBe(0);
  });

  it('drops the same sound played again right away: a burst of moves does not crackle', () => {
    setSoundSessionReady(true);
    playSound('slide', 1000);
    playSound('slide', 1030);
    playSound('bump', 1030);
    playSound('slide', 1100);
    expect(plays()).toBe(3);
  });

  it('never throws when the native player fails', () => {
    setSoundSessionReady(true);
    for (const p of mockPlayers) p.play.mockImplementation(() => { throw new Error('native'); });
    expect(() => playSound('go', 1000)).not.toThrow();
  });
});

describe('win screen sounds', () => {
  it('the jingle, a ping per star each higher, then the chime of an unlock', () => {
    expect(winSoundPlan(3, true).map(s => s.sound)).toEqual(['win', 'star1', 'star2', 'star3', 'unlock']);
    expect(winSoundPlan(1, false).map(s => s.sound)).toEqual(['win', 'star1']);
    expect(winSoundPlan(0, false).map(s => s.sound)).toEqual(['win']);
    const times = winSoundPlan(3, true).map(s => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('closing the screen cancels the sounds not played yet', () => {
    jest.useFakeTimers();
    try {
      setSoundSessionReady(true);
      const cancel = playSoundPlan(winSoundPlan(3, false));
      jest.advanceTimersByTime(300);
      expect(plays()).toBe(1);
      cancel();
      jest.advanceTimersByTime(5000);
      expect(plays()).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
