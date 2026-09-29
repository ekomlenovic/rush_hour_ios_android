import fs from 'fs';
import { sampleLevels as pack1 } from './data/sampleLevels.ts';

const packA = JSON.parse(fs.readFileSync('./new_levels_1.json', 'utf-8'));

const mergeAndFixIds = (packs: any[][]) => {
    // 1. Fusionner tous les tableaux en un seul
    const allLevels = packs.flat();

    // 2. Réassigner les IDs de 1 à N
    const fixedLevels = allLevels.map((level, index) => ({
        ...level,
        id: index + 1 // L'index commence à 0, donc on fait +1
    }));

    return fixedLevels;
};

const finalPack = mergeAndFixIds([pack1, packA]);

// 3. Sauvegarder le résultat
const output = `// Auto-generated merge — ${new Date().toISOString()}
import { Level } from '@/store/gameStore';

export const sampleLevels: Level[] = ${JSON.stringify(finalPack, null, 2)};
`;

fs.writeFileSync('./data/fullLevelPack.ts', output);
console.log(`Fusion terminée : ${finalPack.length} niveaux générés !`);