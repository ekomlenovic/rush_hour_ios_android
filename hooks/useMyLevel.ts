import { useGameStore } from '@/store/gameStore';
import { getPlayerLevel } from '@/data/progression';

/** My player level, from my XP */
export const useMyLevel = (): number => getPlayerLevel(useGameStore(s => s.xp));
