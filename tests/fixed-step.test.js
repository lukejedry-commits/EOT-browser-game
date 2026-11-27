import { describe, expect, it } from 'vitest';
import { FIXED_DT_MS, planFixedSteps, shouldPresentFrame } from '../src/core/time.js';

describe('fixed-step accumulator', () => {
  it('runs one step at 60 fps and two steps at 30 fps', () => {
    const at60 = planFixedSteps(0, 1000 / 60, 0);
    const at30 = planFixedSteps(0, 1000 / 30, 0);
    expect(at60.steps).toBe(1);
    expect(at30.steps).toBe(2);
    expect(at60.accumulatorMs).toBeCloseTo(0, 6);
    expect(at30.accumulatorMs).toBeCloseTo(0, 6);
    expect(at60.stepDtMs).toBe(FIXED_DT_MS);
  });

  it('keeps a fractional remainder for the next frame', () => {
    const plan = planFixedSteps(0, FIXED_DT_MS * 1.25, 1000);
    expect(plan.steps).toBe(1);
    expect(plan.alpha).toBeCloseTo(0.25, 6);
    const next = planFixedSteps(plan.accumulatorMs, FIXED_DT_MS, 1000 + FIXED_DT_MS * 1.25);
    expect(next.steps).toBe(1);
    expect(next.accumulatorMs).toBeCloseTo(FIXED_DT_MS * 0.25, 5);
  });

  it('caps a hitch at five steps', () => {
    const plan = planFixedSteps(0, 1000, 0);
    expect(plan.steps).toBe(5);
    expect(plan.accumulatorMs).toBeLessThan(FIXED_DT_MS);
  });

  it('gives each step a wall-clock end so input can be split', () => {
    const frameStart = 5000;
    const plan = planFixedSteps(0, 1000 / 30, frameStart);
    expect(plan.stepEnds).toHaveLength(2);
    expect(plan.stepEnds[0]).toBeCloseTo(frameStart + FIXED_DT_MS, 5);
    expect(plan.stepEnds[1]).toBeCloseTo(frameStart + 2 * FIXED_DT_MS, 5);
    expect(plan.stepEnds[0]).toBeLessThan(plan.stepEnds[1]);
  });
});

function present(cap, frameTimes) {
  let lastNow = 0;
  let lastPresent = null;
  let acc = 0;
  let steps = 0;
  let presents = 0;
  let started = false;
  for (const now of frameTimes) {
    if (!shouldPresentFrame(now, lastPresent, cap)) continue;
    presents += 1;
    if (!started) {
      started = true;
      lastNow = now;
      lastPresent = now;
      continue;
    }
    const delta = now - lastNow;
    const plan = planFixedSteps(acc, delta, lastNow);
    acc = plan.accumulatorMs;
    steps += plan.steps;
    lastNow = now;
    lastPresent = now;
  }
  return { steps, presents, acc };
}

describe('fps cap', () => {
  const frames = Array.from({ length: 61 }, (_, i) => i * FIXED_DT_MS);

  it('drops frames at 30 and still steps the same 60 Hz sim', () => {
    const capped = present(30, frames);
    const full = present(60, frames);
    expect(full.presents).toBe(61);
    expect(capped.presents).toBeLessThan(full.presents);
    expect(capped.presents).toBeGreaterThanOrEqual(30);
    expect(capped.steps).toBe(full.steps);
    expect(full.steps).toBe(60);
  });

  it('presents every 60 Hz tick at the 60 cap and every other tick at 30', () => {
    expect(shouldPresentFrame(0, null, 30)).toBe(true);
    expect(shouldPresentFrame(16, 0, 60)).toBe(true);
    expect(shouldPresentFrame(16, 0, 30)).toBe(false);
    expect(shouldPresentFrame(33.4, 0, 30)).toBe(true);
    expect(shouldPresentFrame(10, 0, 60)).toBe(false);
  });
});
