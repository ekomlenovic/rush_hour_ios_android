import type { VehicleArt } from '../board';
import type { ArtDrawing } from './art';
import { annoShip } from './annoShips';
import { DRAWN_SKINS, skinDrawing, type DrawnSkin } from './targetSkins';
import { vintageVehicle } from './vintageVehicles';

const isDrawnSkin = (art: VehicleArt): art is DrawnSkin => (DRAWN_SKINS as string[]).includes(art);

/** The drawing of a vehicle of `length` cells in a drawn style, front on the right */
export function drawVehicle(art: VehicleArt, length: number, color: string): ArtDrawing {
  if (isDrawnSkin(art)) return skinDrawing(art, color);
  return art === 'ship' ? annoShip(length, color) : vintageVehicle(length, color);
}
