import type { VehicleArt } from '../board';
import type { ArtDrawing } from './art';
import { annoShip } from './annoShips';
import { DRAWN_SKINS, skinDrawing, type DrawnSkin } from './targetSkins';
import { vintageVehicle } from './vintageVehicles';
import { hauntedVehicle, pumpkinCoachDrawing } from './halloweenVehicles';
import { festiveVehicle, sleighDrawing } from './christmasVehicles';

const isDrawnSkin = (art: VehicleArt): art is DrawnSkin => (DRAWN_SKINS as string[]).includes(art);

/** The drawing of a vehicle of `length` cells in a drawn style, front on the right */
export function drawVehicle(art: VehicleArt, length: number, color: string): ArtDrawing {
  if (isDrawnSkin(art)) return skinDrawing(art, color);
  switch (art) {
    case 'ship': return annoShip(length, color);
    case 'coach': return pumpkinCoachDrawing(color);
    case 'haunted': return hauntedVehicle(length, color);
    case 'sleigh': return sleighDrawing(color);
    case 'festive': return festiveVehicle(length, color);
    default: return vintageVehicle(length, color);
  }
}
