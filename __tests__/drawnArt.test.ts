import { mixColor, type ArtDrawing } from '../theme/art/art';
import { vintageVehicle } from '../theme/art/vintageVehicles';
import { annoShip } from '../theme/art/annoShips';
import { drawVehicle } from '../theme/art/vehicles';
import { DRAWN_SKINS, skinDrawing } from '../theme/art/targetSkins';
import { BULLET_HOLE, MUZZLE_FLASH, TOMMY_GUN } from '../theme/art/tommyGun';
import {
  BULLET_FLIGHT, FIRE_END, FIRE_START, HOLES_FADE, SHOTS, buildTommyGunPlan, shotPhase, sprayAngle,
} from '../components/effects/tommyGunPlan';
import { CAR_SKINS, PALETTE_ART, VEHICLE_PALETTES } from '../theme/board';
import { COSMETICS, buildCosmeticContext, cosmeticKey, isCosmeticUnlocked } from '../data/cosmetics';

/** Every `url(#id)` of a drawing names one of its gradients */
function expectGradientsDefined(drawing: ArtDrawing) {
  const ids = new Set(drawing.gradients.map(g => g.id));
  for (const shape of drawing.shapes) {
    for (const value of Object.values(shape.attrs)) {
      const ref = typeof value === 'string' ? /^url\(#(\w+)\)$/.exec(value) : null;
      if (ref) expect(ids).toContain(ref[1]);
    }
  }
}

describe('Mafia vehicles', () => {
  it('a sedan for 2 cells, a truck for 3, 100 units per cell', () => {
    expect(vintageVehicle(2, '#7A1424')).toMatchObject({ width: 200, height: 100 });
    expect(vintageVehicle(3, '#E7DCC4')).toMatchObject({ width: 300, height: 100 });
  });

  it.each([2, 3])('the drawing of %i cells only refers to its own gradients', length => {
    expectGradientsDefined(vintageVehicle(length, '#14532D'));
  });

  it('are shaded from the vehicle color', () => {
    expect(mixColor('#808080', '#000000', 0.5)).toBe('#404040');
    expect(mixColor('#000000', '#FFFFFF', 1)).toBe('#ffffff');
    expect(mixColor('#abc', '#000000', 0)).toBe('#aabbcc');
    expect(mixColor('not a color', '#000000', 0.5)).toBe('not a color');
  });

  it('are used by the Mafia skin and palette', () => {
    expect(CAR_SKINS.mafia.art).toBe('vintage');
    expect(PALETTE_ART.mafia).toBe('vintage');
  });
});

describe('1800 ships (Anno 1800 style)', () => {
  it('a schooner for 2 cells, a paddle steamer for 3, 100 units per cell', () => {
    expect(annoShip(2, '#9B1B30')).toMatchObject({ width: 200, height: 100 });
    expect(annoShip(3, '#23395B')).toMatchObject({ width: 300, height: 100 });
  });

  it.each([2, 3])('the drawing of %i cells only refers to its own gradients', length => {
    expectGradientsDefined(annoShip(length, '#1F4D3A'));
  });

  it('are unlocked by 30 weekly challenges won', () => {
    const unlock = (key: string) => COSMETICS.find(c => cosmeticKey(c) === key)!;
    const context = (weeklies: number) => buildCosmeticContext({
      xp: 0, progress: [], dailyChallengeProgress: {}, achievements: [],
      weeklyChallengeProgress: Object.fromEntries(Array.from({ length: weeklies }, (_, i) => [`2026-W${i + 1}`, { completed: true, score: 300, stars: 3 }])),
    });
    for (const key of ['skin:flagship', 'palette:fleet']) {
      expect(isCosmeticUnlocked(unlock(key), context(29))).toBe(false);
      expect(isCosmeticUnlocked(unlock(key), context(30))).toBe(true);
    }
  });

  it('are used by the flagship skin and the fleet palette', () => {
    expect(CAR_SKINS.flagship.art).toBe('ship');
    expect(PALETTE_ART.fleet).toBe('ship');
  });
});

describe('drawn vehicles', () => {
  it('every skin is drawn but the red car, and only the drawn palettes have a drawing', () => {
    expect(Object.entries(CAR_SKINS).filter(([, s]) => !s.art).map(([id]) => id)).toEqual(['classic']);
    expect(Object.keys(PALETTE_ART).sort()).toEqual(['fleet', 'mafia']);
    for (const id of Object.keys(PALETTE_ART)) expect(VEHICLE_PALETTES).toHaveProperty(id);
  });

  it('each style draws its own vehicles', () => {
    expect(drawVehicle('vintage', 2, '#14532D')).toEqual(vintageVehicle(2, '#14532D'));
    expect(drawVehicle('ship', 3, '#14532D')).toEqual(annoShip(3, '#14532D'));
    expect(drawVehicle('taxi', 2, '#FACC15')).toEqual(skinDrawing('taxi', '#FACC15'));
  });
});

describe('target car skins', () => {
  it.each(DRAWN_SKINS)('%s is drawn on 2 cells and only refers to its own gradients', skin => {
    const drawing = skinDrawing(skin, CAR_SKINS[skin].color!);
    expect(drawing).toMatchObject({ width: 200, height: 100 });
    expect(drawing.shapes.length).toBeGreaterThan(5);
    expectGradientsDefined(drawing);
  });

  it.each(DRAWN_SKINS)('%s is used by its skin, in its color', skin => {
    expect(CAR_SKINS[skin]).toMatchObject({ art: skin, color: expect.any(String) });
  });
});

describe('Tommy gun win effect', () => {
  it.each([TOMMY_GUN, MUZZLE_FLASH, BULLET_HOLE])('its drawings only refer to their own gradients', drawing => {
    expectGradientsDefined(drawing);
  });

  it.each([[300, 300], [390, 844], [120, 120]])('every bullet hole stays in an area of %i × %i, right of the gun', (width, height) => {
    const plan = buildTommyGunPlan(width, height);
    expect(plan.shots).toHaveLength(SHOTS);
    for (const shot of plan.shots) {
      expect(shot.to.x).toBeGreaterThan(shot.from.x);
      expect(shot.to.x).toBeLessThanOrEqual(width);
      expect(shot.to.y).toBeGreaterThanOrEqual(0);
      expect(shot.to.y).toBeLessThanOrEqual(height);
    }
  });

  it('fires every shot while the gun is out, and the holes are seen before they fade', () => {
    const { shots } = buildTommyGunPlan(300, 300);
    for (const shot of shots) {
      expect(shot.t0).toBeGreaterThanOrEqual(FIRE_START);
      expect(shot.t0).toBeLessThan(FIRE_END);
      expect(shot.t0 + BULLET_FLIGHT).toBeLessThan(HOLES_FADE);
      expect(shot.angle).toBeCloseTo(sprayAngle(shot.t0));
    }
  });

  it('flashes only while firing', () => {
    expect(shotPhase(FIRE_START - 0.01)).toBe(-1);
    expect(shotPhase(FIRE_END)).toBe(-1);
    expect(shotPhase(FIRE_START)).toBe(0);
  });

  it('plays the same on every replay', () => {
    expect(buildTommyGunPlan(300, 300)).toEqual(buildTommyGunPlan(300, 300));
  });
});
