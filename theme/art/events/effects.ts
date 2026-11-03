import type { ArtDrawing } from '../art';
import type { SpriteSpec } from '../../../components/effects/spritesPlan';
import { CHAMPAGNE_DRAWINGS } from './newYear';
import { HEART_DRAWINGS } from './valentine';
import { CLOVER_DRAWINGS } from './stPatrick';

/** Win effects of the seasonal events drawn by components/effects/SpritesEffect: their motion and drawings */
export type SpriteEffectId = 'champagne' | 'hearts' | 'clovers';

export interface SpriteEffect {
  spec: SpriteSpec;
  drawings: ArtDrawing[];
}

const effect = (drawings: ArtDrawing[], spec: Omit<SpriteSpec, 'drawings'>): SpriteEffect => ({ spec: { ...spec, drawings: drawings.length }, drawings });

export const SPRITE_EFFECTS: Record<SpriteEffectId, SpriteEffect> = {
  // New Year: corks, stars and streamers burst from the bottom like a bottle uncorked
  champagne: effect(CHAMPAGNE_DRAWINGS, { motion: 'burst', duration: 2200, count: 26, minSize: 0.06, maxSize: 0.1, spin: 540, seed: 1231 }),
  // Valentine's Day: hearts rising from the bottom, swaying
  hearts: effect(HEART_DRAWINGS, { motion: 'rise', duration: 2600, count: 20, minSize: 0.07, maxSize: 0.13, spin: 25, seed: 214 }),
  // Saint Patrick's Day: clovers and gold coins falling, turning
  clovers: effect(CLOVER_DRAWINGS, { motion: 'fall', duration: 2600, count: 22, minSize: 0.07, maxSize: 0.11, spin: 300, seed: 317 }),
};

export const SPRITE_EFFECT_IDS = Object.keys(SPRITE_EFFECTS) as SpriteEffectId[];
