import { generateLevel, randomSeed, DIFFICULTY_LEVELS } from './utils/generator';

console.log('Generating Easy Level...');
const easy = generateLevel(3, DIFFICULTY_LEVELS.EASY, randomSeed());
if (easy) {
  console.log(`Success! Easy Level generated requiring ${easy.minMoves} moves.`);
} else {
  console.log('Failed to generate Easy level.');
}

console.log('Generating Normal Level...');
const normal = generateLevel(4, DIFFICULTY_LEVELS.NORMAL, randomSeed());
if (normal) {
  console.log(`Success! Normal Level generated requiring ${normal.minMoves} moves.`);
} else {
  console.log('Failed to generate Normal level.');
}

console.log('Generating Hard Level...');
const hard = generateLevel(5, DIFFICULTY_LEVELS.HARD, randomSeed());
if (hard) {
  console.log(`Success! Hard Level generated requiring ${hard.minMoves} moves.`);
} else {
  console.log('Failed to generate Hard level.');
}
