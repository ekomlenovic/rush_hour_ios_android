// Appends the generated levels (generated.jsonl) to data/campaignPack.ts, up to --to.
// Levels already in the pack are never touched. Then add the new [count, hash] line printed here
// to SHIPPED in __tests__/campaignPack.test.ts once the batch is released.
//
// Usage: npx tsx scripts/campaign/build.ts --to 500
import { createHash } from 'crypto';
import { CAMPAIGN_PACK } from '../../data/campaignPack';
import { readCheckpoint } from './checkpoint';
import { writePack } from './packFile';

const i = process.argv.indexOf('--to');
const to = Number(process.argv[i + 1]);
if (i < 0 || !Number.isInteger(to) || to <= CAMPAIGN_PACK.length) {
  console.error(`Usage: build.ts --to <dernier id> (le pack s'arrête au niveau ${CAMPAIGN_PACK.length})`);
  process.exit(1);
}

const generated = readCheckpoint();
const codes = [...CAMPAIGN_PACK];
for (let id = codes.length + 1; id <= to; id++) {
  const level = generated.get(id);
  if (!level) {
    console.error(`Niveau ${id} pas encore généré : lance d'abord generate.ts --to ${to}`);
    process.exit(1);
  }
  codes.push(level.code);
}
writePack(codes);
const hash = createHash('sha256').update(codes.join('\n')).digest('hex');
console.log(`data/campaignPack.ts : ${CAMPAIGN_PACK.length} → ${codes.length} niveaux`);
console.log(`Ligne pour SHIPPED : [${codes.length}, '${hash}'],`);
