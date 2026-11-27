import { describe, expect, it } from 'vitest';
import {
  FRAMES,
  chargedHeavyElapsed,
  createCombatClock,
  phaseAt,
  rollHasIFrame,
} from '../src/config/combat.js';
import { createVentState, startVent, stepVent, ventAllowsRoll, ventDamageScale, ventUnbreakable } from '../src/player/vent.js';

describe('frame-data timers', () => {
  it('walks the light chain through startup, active, and recovery', () => {
    const clock = createCombatClock();
    clock.startLight();
    expect(clock.moveId()).toBe('light1');
    expect(clock.phase()).toBe('startup');
    clock.step(119);
    expect(clock.phase()).toBe('startup');
    clock.step(1);
    expect(clock.phase()).toBe('active');
    expect(clock.hitActive()).toBe(true);
    clock.step(100);
    expect(clock.phase()).toBe('recovery');
    clock.startLight();
    expect(clock.moveId()).toBe('light2');
    expect(phaseAt(FRAMES.light[1], 0)).toBe('startup');
    expect(FRAMES.light[1].startup).toBe(120);
    expect(FRAMES.light[1].active).toBe(100);
    expect(FRAMES.light[1].recovery).toBe(130);
    clock.step(FRAMES.light[1].startup + FRAMES.light[1].active);
    clock.startLight();
    expect(clock.moveId()).toBe('light3');
    clock.step(FRAMES.light[2].startup + FRAMES.light[2].active);
    clock.startLight();
    expect(clock.moveId()).toBe('light4');
    expect(FRAMES.light[3].startup).toBe(150);
    expect(FRAMES.light[3].active).toBe(200);
    expect(FRAMES.light[3].recovery).toBe(250);
    clock.step(149);
    expect(clock.phase()).toBe('startup');
    clock.step(1);
    expect(clock.phase()).toBe('active');
  });

  it('opens roll i-frames at 80 ms and closes them at 320 ms', () => {
    expect(FRAMES.roll.total).toBe(450);
    expect(rollHasIFrame(79)).toBe(false);
    expect(rollHasIFrame(80)).toBe(true);
    expect(rollHasIFrame(319)).toBe(true);
    expect(rollHasIFrame(320)).toBe(false);
  });

  it('enters a charged heavy at contact minus 150 ms', () => {
    expect(chargedHeavyElapsed()).toBe(FRAMES.heavy.startup - 150);
    const clock = createCombatClock();
    clock.startHeavy(true);
    clock.step(149);
    expect(clock.phase()).toBe('startup');
    clock.step(1);
    expect(clock.phase()).toBe('active');
    const plain = createCombatClock();
    plain.startHeavy(false);
    plain.step(449);
    expect(plain.phase()).toBe('startup');
    plain.step(1);
    expect(plain.phase()).toBe('active');
  });

  it('times parry, grab, and the double-jump kick from the input frame', () => {
    expect(FRAMES.parry.active).toBe(150);
    expect(FRAMES.parry.recovery).toBe(100);
    expect(FRAMES.grab.startup).toBe(100);
    expect(FRAMES.grab.active).toBe(150);
    const kick = createCombatClock();
    kick.startAirKick();
    expect(kick.phase()).toBe('active');
    expect(kick.hitActive()).toBe(true);
  });
});

describe('vent roll lock', () => {
  it('unlocks the roll at exactly 0.25 s and does not change damage', () => {
    const state = createVentState();
    expect(startVent(state, 1)).toBe(false);
    expect(startVent(state, 2)).toBe(true);
    expect(state.duration).toBe(400);
    stepVent(state, 249);
    expect(ventAllowsRoll(state)).toBe(false);
    expect(ventUnbreakable(state)).toBe(true);
    stepVent(state, 1);
    expect(ventAllowsRoll(state)).toBe(true);
    expect(ventUnbreakable(state)).toBe(false);
    expect(ventDamageScale()).toBe(1);
    const heavy = createVentState();
    startVent(heavy, 3);
    expect(heavy.duration).toBe(600);
  });
});
