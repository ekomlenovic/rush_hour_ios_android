import type { VehicleArt } from '../board';
import type { ArtDrawing } from './art';
import { annoShip } from './annoShips';
import { vintageVehicle } from './vintageVehicles';

/** The drawing of a vehicle of `length` cells in a drawn style, front on the right */
export function drawVehicle(art: VehicleArt, length: number, color: string): ArtDrawing {
  return art === 'ship' ? annoShip(length, color) : vintageVehicle(length, color);
}
