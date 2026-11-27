import { describe, expect, it } from 'vitest';
import { charge01, chargeGlow, chargeTier, COMBAT } from '../src/config/combat.js';
import { KEYMAP, createActionResolver } from '../src/config/keymap.js';
import { createMotorState, stepHorizontal } from '../src/player/motor.js';
import { MOVEMENT } from '../src/config/movement.js';

function press(partial) {
  return { pressed: true, shift: false, alt: false, ...partial };
}

describe('charge tiers', () => {
  it('splits T1, T2, and T3 on the mechanic boundaries', () => {
    expect(chargeTier(0)).toBe(1);
    expect(chargeTier(299)).toBe(1);
    expect(chargeTier(300)).toBe(2);
    expect(chargeTier(799)).toBe(2);
    expect(chargeTier(800)).toBe(3);
    expect(chargeTier(1400)).toBe(3);
    expect(chargeTier(4000)).toBe(3);
  });

  it('clamps charge01 at the max charge time', () => {
    expect(charge01(0)).toBe(0);
    expect(charge01(COMBAT.maxChargeMs / 2)).toBeCloseTo(0.5);
    expect(charge01(COMBAT.maxChargeMs)).toBe(1);
    expect(charge01(COMBAT.maxChargeMs + 500)).toBe(1);
  });

  it('keeps the glaive glow ember-to-red and never white', () => {
    expect(chargeGlow(0)).toBe(COMBAT.glowEmber);
    expect(chargeGlow(1)).toBe(COMBAT.glowMax);
    const max = chargeGlow(1);
    expect((max >> 8) & 255).toBeLessThan(40);
    expect(max & 255).toBeLessThan(40);
  });
});

describe('shift tap, hold, and chargeMs', () => {
  it('crouches only on a short clean Shift tap', () => {
    const tap = createActionResolver();
    const tapped = tap.push([
      press({ kind: 'key', code: 'ShiftLeft', time: 0 }),
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 200 },
    ], 200);
    expect(tapped.map((item) => item.action).filter(Boolean)).toEqual(['crouch']);

    const held = createActionResolver();
    held.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const released = held.push([
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 400 },
    ], 400);
    expect(released.some((item) => item.action === 'crouch')).toBe(false);
    expect(released.some((item) => item.action === 'heavy')).toBe(false);
  });

  it('does not crouch when Space or LMB happened during the hold', () => {
    const rolled = createActionResolver();
    const dodge = rolled.push([
      press({ kind: 'key', code: 'ShiftLeft', time: 0 }),
      press({ kind: 'key', code: 'Space', time: 80, shift: true }),
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 120 },
    ], 120);
    expect(dodge.some((item) => item.action === 'dodge')).toBe(true);
    expect(dodge.some((item) => item.action === 'crouch')).toBe(false);
    expect(dodge.some((item) => item.action === 'jump')).toBe(false);

    const heavy = createActionResolver(KEYMAP, 3);
    const attack = heavy.push([
      press({ kind: 'key', code: 'ShiftLeft', time: 0 }),
      press({ kind: 'mouse', button: 0, time: 500, shift: true }),
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 520 },
    ], 520);
    const hit = attack.find((item) => item.action === 'heavy');
    expect(hit.chargeMs).toBe(500);
    expect(hit.tier).toBe(2);
    expect(hit.charge01).toBeCloseTo(500 / COMBAT.maxChargeMs);
    expect(attack.some((item) => item.action === 'crouch')).toBe(false);
  });

  it('emits tier changes as the hold crosses each boundary', () => {
    const resolver = createActionResolver(KEYMAP, 3);
    const started = resolver.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    expect(started.some((item) => item.type === 'chargeTier' && item.tier === 1)).toBe(true);
    const mid = resolver.push([], 300);
    expect(mid.some((item) => item.type === 'chargeTier' && item.tier === 2 && item.previous === 1)).toBe(true);
    const maxed = resolver.push([], 800);
    expect(maxed.some((item) => item.type === 'chargeTier' && item.tier === 3)).toBe(true);
    expect(resolver.charge01()).toBeCloseTo(800 / COMBAT.maxChargeMs);
  });
});

describe('charge cancel and move speed', () => {
  it('cancels on roll, RMB, and a hit', () => {
    const rolled = createActionResolver();
    rolled.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const roll = rolled.push([press({ kind: 'key', code: 'Space', time: 400, shift: true })], 400);
    expect(roll.some((item) => item.type === 'chargeTier' && item.tier === 0 && item.reason === 'roll')).toBe(true);
    expect(rolled.charging()).toBe(false);

    const blocked = createActionResolver();
    blocked.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const rmb = blocked.push([press({ kind: 'mouse', button: 2, time: 400 })], 400);
    expect(rmb.some((item) => item.reason === 'rmb' && item.tier === 0)).toBe(true);
    expect(blocked.canBlock()).toBe(true);

    const hurt = createActionResolver();
    hurt.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const hit = hurt.cancelFromHit();
    expect(hit.some((item) => item.reason === 'hit')).toBe(true);
    expect(hurt.speedScale()).toBe(1);
  });

  it('defaults the player charge tier to 1', () => {
    expect(createMotorState().unlockedChargeTier).toBe(1);
  });

  it('stops charging at the unlocked tier and does not vent from tier 1', () => {
    const locked = createActionResolver();
    locked.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const climbed = locked.push([], 900);
    expect(climbed.some((item) => item.type === 'chargeTier' && item.tier > 1)).toBe(false);
    expect(locked.charging()).toBe(true);
    const released = locked.push([
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 900 },
    ], 900);
    expect(released.some((item) => item.type === 'emberVent')).toBe(false);
    expect(released.some((item) => item.type === 'chargeTier' && item.tier > 1)).toBe(false);

    const mid = createActionResolver(KEYMAP, 2);
    mid.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const heldMid = mid.push([], 900);
    expect(heldMid.some((item) => item.type === 'chargeTier' && item.tier === 3)).toBe(false);
    expect(heldMid.some((item) => item.type === 'chargeTier' && item.tier === 2)).toBe(true);

    const open = createActionResolver(KEYMAP, 3);
    open.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const tier2 = open.push([], 500);
    expect(tier2.some((item) => item.type === 'chargeTier' && item.tier === 2)).toBe(true);
    const vented = open.push([
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 500 },
    ], 500);
    expect(vented.some((item) => item.type === 'emberVent' && item.tier === 2)).toBe(true);
  });

  it('halves move speed only while the charge is held', () => {
    const charging = createActionResolver();
    charging.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    expect(charging.speedScale()).toBe(0.5);
    expect(charging.canBlock()).toBe(false);

    const slow = createMotorState();
    slow.grounded = true;
    const full = createMotorState();
    full.grounded = true;
    for (let t = 0; t < 200; t += 10) {
      stepHorizontal(slow, 0, 1, 10, MOVEMENT, 0.5);
      stepHorizontal(full, 0, 1, 10, MOVEMENT, 1);
    }
    const slowSpeed = Math.hypot(slow.vx, slow.vz);
    const fullSpeed = Math.hypot(full.vx, full.vz);
    expect(slowSpeed).toBeCloseTo(MOVEMENT.runSpeed * 0.5, 1);
    expect(fullSpeed).toBeCloseTo(MOVEMENT.runSpeed, 1);
  });

  it('vents on the 0.3 s boundary, not on a 0.25 s crouch tap, and auto-vents at 2 s past max', () => {
    const open = createActionResolver(KEYMAP, 3);
    open.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const early = open.push([
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 299 },
    ], 299);
    expect(early.some((item) => item.type === 'emberVent')).toBe(false);

    const tier2 = createActionResolver(KEYMAP, 3);
    tier2.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const at2 = tier2.push([
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 300 },
    ], 300);
    const vent2 = at2.find((item) => item.type === 'emberVent');
    expect(vent2).toMatchObject({ tier: 2, duration: 400 });

    const tier3 = createActionResolver(KEYMAP, 3);
    tier3.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const at3 = tier3.push([
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 800 },
    ], 800);
    expect(at3.find((item) => item.type === 'emberVent')).toMatchObject({ tier: 3, duration: 600 });

    const crouch = createActionResolver(KEYMAP, 3);
    const tapped = crouch.push([
      press({ kind: 'key', code: 'ShiftLeft', time: 0 }),
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 250 },
    ], 250);
    expect(tapped.some((item) => item.action === 'crouch')).toBe(true);
    expect(tapped.some((item) => item.type === 'emberVent')).toBe(false);

    const pastCrouch = createActionResolver(KEYMAP, 3);
    const heldPast = pastCrouch.push([
      press({ kind: 'key', code: 'ShiftLeft', time: 0 }),
      { kind: 'key', code: 'ShiftLeft', pressed: false, time: 251 },
    ], 251);
    expect(heldPast.some((item) => item.action === 'crouch')).toBe(false);
    expect(heldPast.some((item) => item.type === 'emberVent')).toBe(false);

    const auto = createActionResolver(KEYMAP, 3);
    auto.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const before = auto.push([], COMBAT.maxChargeMs + 1999);
    expect(before.some((item) => item.type === 'emberVent')).toBe(false);
    const after = auto.push([], COMBAT.maxChargeMs + 2000);
    expect(after.find((item) => item.type === 'emberVent')).toMatchObject({ tier: 3, duration: 600, auto: true });
  });

  it('does not vent when a roll, a right click, or a hit cancels the charge', () => {
    const rolled = createActionResolver(KEYMAP, 3);
    rolled.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const dodge = rolled.push([
      press({ kind: 'key', code: 'Space', time: 500, shift: true }),
    ], 500);
    expect(dodge.some((item) => item.action === 'dodge')).toBe(true);
    expect(dodge.some((item) => item.type === 'emberVent')).toBe(false);

    const blocked = createActionResolver(KEYMAP, 3);
    blocked.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    const rmb = blocked.push([press({ kind: 'mouse', button: 2, time: 500 })], 500);
    expect(rmb.some((item) => item.type === 'emberVent')).toBe(false);

    const hurt = createActionResolver(KEYMAP, 3);
    hurt.push([press({ kind: 'key', code: 'ShiftLeft', time: 0 })], 0);
    hurt.push([], 500);
    const hit = hurt.cancelFromHit();
    expect(hit.some((item) => item.reason === 'hit')).toBe(true);
    expect(hit.some((item) => item.type === 'emberVent')).toBe(false);
  });

  it('keeps plain RMB as block and treats alt-click as heavy only when enabled', () => {
    const plain = createActionResolver();
    plain.push([press({ kind: 'mouse', button: 2, time: 0, alt: true })], 0);
    const release = plain.push([
      { kind: 'mouse', button: 2, pressed: false, time: 40, alt: true },
    ], 40);
    expect(release.some((item) => item.action === 'parry')).toBe(true);
    expect(release.some((item) => item.action === 'heavy')).toBe(false);

    const off = createActionResolver();
    const ignored = off.push([{ kind: 'contextmenu', time: 10, alt: true }], 10);
    expect(ignored.some((item) => item.action === 'heavy')).toBe(false);

    const alt = createActionResolver({ ...KEYMAP, altHeavy: true });
    const fromMenu = alt.push([{ kind: 'contextmenu', time: 10, alt: true }], 10);
    expect(fromMenu.some((item) => item.action === 'heavy')).toBe(true);
    const fromClick = createActionResolver({ ...KEYMAP, altHeavy: true }).push([
      press({ kind: 'mouse', button: 0, time: 0, alt: true }),
    ], 0);
    expect(fromClick.some((item) => item.action === 'heavy')).toBe(true);
  });
});
