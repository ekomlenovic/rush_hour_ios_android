/** The game logic of the app, shared so that the server plays by exactly the same rules (#47) */
export { DIFFICULTY_LEVELS, generateSeededLevelSync } from '../../utils/generator';
export { applyMoves } from '../../utils/moveLog';
export type { Level, MoveRecord, Vehicle } from '../../store/types';
export { MULTI_LEVEL_ID } from '../../store/levelIds';
