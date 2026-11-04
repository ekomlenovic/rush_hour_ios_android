import { type ArtDrawing, type ArtShape, circle, ellipse, light, line, path, rect } from '../art';
import { CELL, vehicleGradients } from '../events/vehicleKit';

/** Neon palette: a light cycle and its trail (2 cells) and a futuristic car outlined in light (3 cells), dark bodies glowing in the palette color */

const BODY = '#0F0F1E';

/** The light cycle: two glowing wheels, a narrow body and its rider, the trail of light behind */
function lightCycle(color: string): ArtShape[] {
  const glow = light(color, 0.35);
  return [
    rect(0, 40, 76, 20, { rx: 10, fill: color, opacity: 0.25 }),
    rect(0, 45, 84, 10, { rx: 5, fill: color, opacity: 0.85 }),
    line(0, 50, 84, 50, { stroke: '#FFFFFF', strokeWidth: 2, opacity: 0.8 }),
    ellipse(134, 50, 72, 40, { fill: color, opacity: 0.18 }),
    rect(64, 24, 46, 52, { rx: 22, fill: BODY, stroke: color, strokeWidth: 3 }),
    rect(150, 24, 46, 52, { rx: 22, fill: BODY, stroke: color, strokeWidth: 3 }),
    rect(72, 32, 30, 36, { rx: 15, fill: 'none', stroke: glow, strokeWidth: 1.2 }),
    rect(158, 32, 30, 36, { rx: 15, fill: 'none', stroke: glow, strokeWidth: 1.2 }),
    path('M86 34 L176 28 Q194 50 176 72 L86 66 Z', { fill: BODY, stroke: color, strokeWidth: 2.5 }),
    line(96, 50, 176, 50, { stroke: glow, strokeWidth: 2.5 }),
    ellipse(124, 50, 18, 15, { fill: '#1F2937', stroke: color, strokeWidth: 2 }),
    ellipse(131, 50, 10, 10, { fill: 'url(#glass)' }),
    circle(192, 50, 4, { fill: '#FFFFFF' }),
  ];
}

/** The futuristic car: a wedge outlined in light, its canopy, glowing stripes and a halo underneath */
function cyberCar(color: string): ArtShape[] {
  const glow = light(color, 0.35);
  return [
    rect(6, 6, 292, 88, { rx: 30, fill: color, opacity: 0.2 }),
    path('M16 12 L230 14 L296 44 L296 56 L230 86 L16 88 Q6 50 16 12 Z', { fill: BODY, stroke: color, strokeWidth: 2.5, strokeLinejoin: 'round' }),
    path('M30 24 L220 26 L270 46 L270 54 L220 74 L30 76', { fill: 'none', stroke: glow, strokeWidth: 1.4, opacity: 0.9 }),
    path('M120 30 L210 32 Q236 50 210 68 L120 70 Q110 50 120 30 Z', { fill: 'url(#glass)', stroke: color, strokeWidth: 1.2 }),
    path('M130 36 L196 37', { stroke: '#FFFFFF', strokeWidth: 2, opacity: 0.35 }),
    ...[0, 1, 2].map(i => rect(28 + i * 26, 44, 18, 12, { rx: 2, fill: color, opacity: 0.9 - i * 0.2 })),
    rect(8, 18, 5, 64, { rx: 2, fill: color }),
    line(250, 34, 292, 48, { stroke: '#FFFFFF', strokeWidth: 2.5, strokeLinecap: 'round' }),
    line(250, 66, 292, 52, { stroke: '#FFFFFF', strokeWidth: 2.5, strokeLinecap: 'round' }),
  ];
}

export function neonVehicle(length: number, color: string): ArtDrawing {
  const long = length >= 3;
  return { width: (long ? 3 : 2) * CELL, height: CELL, gradients: vehicleGradients(color), shapes: long ? cyberCar(color) : lightCycle(color) };
}
