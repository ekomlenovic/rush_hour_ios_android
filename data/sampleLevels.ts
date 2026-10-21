import type { Level } from '../store/types';
import { CAMPAIGN_PACK } from './campaignPack';
import { decodeCampaignLevel } from './levelCodec';

/** Campaign levels, decoded once at startup from the compact pack (level id = position, from 1) */
export const sampleLevels: Level[] = CAMPAIGN_PACK.map((code, index) => decodeCampaignLevel(code, index + 1));
