import { mixColor, type ArtDrawing } from '../theme/art/art';
import { vintageVehicle } from '../theme/art/vintageVehicles';
import { annoShip } from '../theme/art/annoShips';
import { drawVehicle } from '../theme/art/vehicles';
import { DRAWN_SKINS, skinDrawing } from '../theme/art/targetSkins';
import { FRIGATE, waves } from '../theme/art/frigate';
import {
  BALL_FLIGHT, BURST, FIRE_END as BROADSIDE_FIRE_END, FIRE_START as BROADSIDE_FIRE_START, SEA_IN_END, SEA_OUT_START, ballAt, buildBroadsidePlan, seaLevel, shipLeft,
} from '../components/effects/broadsidePlan';
import { BULLET_HOLE, MUZZLE_FLASH, TOMMY_GUN } from '../theme/art/tommyGun';
import {
  BULLET_FLIGHT, FIRE_END, FIRE_START, HOLES_FADE, SHOTS, buildTommyGunPlan, shotPhase, sprayAngle,
} from '../components/effects/tommyGunPlan';
import { BAT_DOWN, BAT_UP, JACK_O_LANTERN, LANTERN_GLOW } from '../theme/art/halloween';
import { GIFT_COLORS, giftBox } from '../theme/art/christmas';
import {
  BATS, BAT_FLIGHT, LANTERN_OUT_START, batAt, buildBatsPlan, lanternScale, wingsUp,
} from '../components/effects/batsPlan';
import { BOUNCE, DROP_END, FADE_START, GIFTS, buildGiftsPlan, giftAt, landsAt } from '../components/effects/giftsPlan';
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

describe('Broadside win effect', () => {
  it.each([FRIGATE, waves(false), waves(true)])('its drawings only refer to their own gradients', drawing => {
    expectGradientsDefined(drawing);
  });

  it.each([[340, 420], [390, 844], [140, 140]])('in an area of %i × %i, the frigate crosses it and every ball bursts inside it', (width, height) => {
    const plan = buildBroadsidePlan(width, height);
    expect(shipLeft(plan, 0) + plan.shipWidth).toBeLessThanOrEqual(0);
    expect(shipLeft(plan, 1)).toBeGreaterThanOrEqual(width);
    expect(plan.shots).toHaveLength(8);
    for (const shot of plan.shots) {
      expect(shot.to.x).toBeGreaterThanOrEqual(0);
      expect(shot.to.x).toBeLessThanOrEqual(width);
      expect(shot.to.y).toBeGreaterThanOrEqual(0);
      expect(shot.to.y).toBeLessThan(shot.from.y);
      expect(ballAt(shot, 0)).toEqual(shot.from);
      expect(ballAt(shot, 1).x).toBeCloseTo(shot.to.x);
      expect(ballAt(shot, 1).y).toBeCloseTo(shot.to.y);
    }
  });

  it('fires stern to bow while the ship is on screen, every burst over before the sea sinks', () => {
    const { shots } = buildBroadsidePlan(340, 420);
    shots.forEach((shot, i) => {
      expect(shot.t0).toBeGreaterThanOrEqual(BROADSIDE_FIRE_START);
      expect(shot.t0).toBeLessThan(BROADSIDE_FIRE_END);
      if (i > 0) expect(shot.t0).toBeGreaterThan(shots[i - 1].t0);
      expect(shot.t0 + BALL_FLIGHT + BURST).toBeLessThan(SEA_OUT_START);
    });
  });

  it('the sea rises, stays, then sinks', () => {
    expect(seaLevel(0)).toBe(0);
    expect(seaLevel(SEA_IN_END)).toBe(1);
    expect(seaLevel(0.5)).toBe(1);
    expect(seaLevel(1)).toBe(0);
  });

  it('plays the same on every replay', () => {
    expect(buildBroadsidePlan(340, 420)).toEqual(buildBroadsidePlan(340, 420));
  });

  it('is unlocked with the 1800 fleet, by 30 weekly challenges won', () => {
    const def = COSMETICS.find(c => cosmeticKey(c) === 'effect:broadside')!;
    expect(def.unlock).toEqual(COSMETICS.find(c => cosmeticKey(c) === 'palette:fleet')!.unlock);
  });
});

describe('Bats win effect (Halloween)', () => {
  it.each([BAT_UP, BAT_DOWN, JACK_O_LANTERN, LANTERN_GLOW])('its drawings only refer to their own gradients', drawing => {
    expectGradientsDefined(drawing);
  });

  it.each([[300, 300], [390, 844], [120, 120]])('in an area of %i × %i, every bat leaves the lantern and flies out by the top', (width, height) => {
    const plan = buildBatsPlan(width, height);
    expect(plan.lantern.x).toBeGreaterThanOrEqual(0);
    expect(plan.lantern.x + plan.lanternWidth).toBeLessThanOrEqual(width);
    expect(plan.lantern.y + plan.lanternHeight).toBeLessThanOrEqual(height);
    expect(plan.bats).toHaveLength(BATS);
    for (const bat of plan.bats) {
      expect(bat.from.y).toBeGreaterThan(plan.lantern.y);
      expect(bat.from.y).toBeLessThan(plan.lantern.y + plan.lanternHeight);
      expect(bat.to.y + bat.width / 2).toBeLessThanOrEqual(0);
      expect(bat.to.x).toBeGreaterThanOrEqual(0);
      expect(bat.to.x).toBeLessThanOrEqual(width);
      expect(batAt(bat, bat.t0 + 1e-6).y).toBeCloseTo(bat.from.y, 1);
    }
  });

  it('every bat is gone before the lantern shrinks away, and they flap', () => {
    const { bats } = buildBatsPlan(300, 300);
    for (const bat of bats) {
      expect(bat.t0 + BAT_FLIGHT).toBeLessThan(1);
      expect(batAt(bat, bat.t0 - 0.01).opacity).toBe(0);
      expect(batAt(bat, bat.t0 + BAT_FLIGHT / 2).opacity).toBe(1);
      expect(batAt(bat, bat.t0 + BAT_FLIGHT + 0.001).opacity).toBe(0);
    }
    expect(bats[0].t0).toBeLessThan(LANTERN_OUT_START);
    const beats = Array.from({ length: 50 }, (_, i) => wingsUp(bats[0], i / 50));
    expect(beats).toContain(true);
    expect(beats).toContain(false);
  });

  it('the lantern pops up, stays, then shrinks away', () => {
    expect(lanternScale(0)).toBe(0);
    expect(lanternScale(0.5)).toBe(1);
    expect(lanternScale(1)).toBe(0);
  });

  it('plays the same on every replay', () => {
    expect(buildBatsPlan(300, 300)).toEqual(buildBatsPlan(300, 300));
  });

  it('is unlocked with the Pumpkins board, by a Halloween daily', () => {
    const unlock = (key: string) => COSMETICS.find(c => cosmeticKey(c) === key)!.unlock;
    expect(unlock('effect:bats')).toEqual({ type: 'event', event: 'halloween' });
    expect(unlock('board:pumpkin')).toEqual(unlock('effect:bats'));
  });
});

describe('Gift shower win effect (Christmas)', () => {
  it.each(GIFT_COLORS.map(c => [c.wrap, c.ribbon]))('the %s present only refers to its own gradients', (wrap, ribbon) => {
    expectGradientsDefined(giftBox(wrap, ribbon));
  });

  it.each([[300, 300], [390, 844], [120, 120]])('in an area of %i × %i, every present falls from above the top and lands inside', (width, height) => {
    const { gifts, sparkles } = buildGiftsPlan(width, height);
    expect(gifts).toHaveLength(GIFTS);
    for (const gift of gifts) {
      expect(gift.fromY + gift.size / 2).toBeLessThanOrEqual(0);
      expect(gift.x - gift.size / 2).toBeGreaterThanOrEqual(0);
      expect(gift.x + gift.size / 2).toBeLessThanOrEqual(width);
      expect(gift.landY + gift.size / 2).toBeLessThanOrEqual(height);
      expect(GIFT_COLORS[gift.color]).toBeDefined();
      expect(giftAt(gift, landsAt(gift) + BOUNCE).y).toBeCloseTo(gift.landY);
    }
    expect(sparkles.length).toBeGreaterThan(0);
    for (const sparkle of sparkles) expect(sparkle.dy).toBeLessThan(0);
  });

  it('every present has landed and bounced before they fade out', () => {
    const { gifts } = buildGiftsPlan(300, 300);
    for (const gift of gifts) {
      expect(gift.t0).toBeLessThan(DROP_END);
      expect(landsAt(gift) + BOUNCE).toBeLessThan(FADE_START);
      expect(giftAt(gift, gift.t0 - 0.01).opacity).toBe(0);
      expect(giftAt(gift, landsAt(gift)).opacity).toBe(1);
      expect(giftAt(gift, 1).opacity).toBe(0);
    }
  });

  it('plays the same on every replay', () => {
    expect(buildGiftsPlan(300, 300)).toEqual(buildGiftsPlan(300, 300));
  });

  it('is unlocked with the Christmas board, by a Christmas daily', () => {
    const unlock = (key: string) => COSMETICS.find(c => cosmeticKey(c) === key)!.unlock;
    expect(unlock('effect:gifts')).toEqual({ type: 'event', event: 'christmas' });
    expect(unlock('board:christmas')).toEqual(unlock('effect:gifts'));
  });
});
