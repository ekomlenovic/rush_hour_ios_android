import { useGameStore, Level } from '../store/gameStore';
import { sampleLevels } from '../data/sampleLevels';

const initialState = useGameStore.getInitialState();

/** Fresh store, as on a first launch */
export function resetStore() {
  useGameStore.setState(initialState, true);
}

/** Freezes the clock at noon (local time) on a YYYY-MM-DD day */
export function setToday(dateKey: string, hour = 12) {
  const [year, month, day] = dateKey.split('-').map(Number);
  jest.setSystemTime(new Date(year, month - 1, day, hour));
}

/** Wins the daily challenge of a day, playing on that day */
export function winDaily(dateKey: string, stars = 3) {
  setToday(dateKey);
  useGameStore.getState().recordAppOpen();
  useGameStore.getState().completeDailyChallenge(dateKey, stars * 100, stars);
}

/** A campaign level loaded and won with the given help */
export function winMapLevel(level: Level = sampleLevels[0], options: { stars?: number; hints?: number; undos?: number } = {}) {
  const store = useGameStore.getState();
  store.loadLevel(level);
  for (let i = 0; i < (options.hints ?? 0); i++) useGameStore.getState().recordHintUsed();
  if (options.undos) {
    const v = level.vehicles.find(x => !x.isTarget)!;
    for (let i = 0; i < options.undos; i++) {
      useGameStore.getState().moveVehicle(v.id, v.row, v.col);
      useGameStore.getState().undo();
    }
  }
  const stars = options.stars ?? 3;
  useGameStore.getState().completeLevel(level.id, stars * 100, stars, 20_000);
}
