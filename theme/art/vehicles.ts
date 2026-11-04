import type { VehicleArt } from '../board';
import type { ArtDrawing } from './art';
import { annoShip } from './annoShips';
import { DRAWN_SKINS, skinDrawing, type DrawnSkin } from './targetSkins';
import { vintageVehicle } from './vintageVehicles';
import { hauntedVehicle, pumpkinCoachDrawing } from './halloweenVehicles';
import { festiveVehicle, sleighDrawing } from './christmasVehicles';
import { limoDrawing, partyVehicle } from './events/newYear';
import { loversVehicle, weddingDrawing } from './events/valentine';
import { emeraldVehicle, leprechaunDrawing } from './events/stPatrick';
import { goldfishDrawing, prankVehicle } from './events/aprilFools';
import { bunnyDrawing, eggVehicle } from './events/easter';
import { concertVehicle, guitarDrawing } from './events/musicDay';
import { fireEngineDrawing, paradeVehicle } from './events/bastille';
import { camperDrawing, roadtripVehicle } from './events/summerHoliday';
import { pencilDrawing, schoolVehicle } from './events/backToSchool';
import { oceanVehicle } from './palettes/ocean';
import { pastelVehicle } from './palettes/pastel';
import { earthVehicle } from './palettes/earth';
import { neonVehicle } from './palettes/neon';
import { candyVehicle } from './palettes/candy';
import { lavaVehicle } from './palettes/lava';
import { jungleVehicle } from './palettes/jungle';

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
    case 'limo': return limoDrawing(color);
    case 'party': return partyVehicle(length, color);
    case 'wedding': return weddingDrawing(color);
    case 'lovers': return loversVehicle(length, color);
    case 'leprechaun': return leprechaunDrawing(color);
    case 'emerald': return emeraldVehicle(length, color);
    case 'goldfish': return goldfishDrawing(color);
    case 'prank': return prankVehicle(length, color);
    case 'bunny': return bunnyDrawing(color);
    case 'eggs': return eggVehicle(length, color);
    case 'guitar': return guitarDrawing(color);
    case 'concert': return concertVehicle(length, color);
    case 'firetruck': return fireEngineDrawing(color);
    case 'tricolor': return paradeVehicle(length, color);
    case 'camper': return camperDrawing(color);
    case 'roadtrip': return roadtripVehicle(length, color);
    case 'pencil': return pencilDrawing(color);
    case 'school': return schoolVehicle(length, color);
    case 'boats': return oceanVehicle(length, color);
    case 'retro': return pastelVehicle(length, color);
    case 'offroad': return earthVehicle(length, color);
    case 'lightcycle': return neonVehicle(length, color);
    case 'sweets': return candyVehicle(length, color);
    case 'works': return lavaVehicle(length, color);
    case 'safari': return jungleVehicle(length, color);
    default: return vintageVehicle(length, color);
  }
}
