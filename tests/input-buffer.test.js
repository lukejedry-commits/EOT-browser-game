import { describe, expect, it } from 'vitest';
import { FIXED_DT_MS, planFixedSteps } from '../src/core/time.js';
import {
  createInputBuffer,
  pointerDelta,
  yawDeltaFromPixels,
} from '../src/core/input.js';

describe('input timestamp buffer', () => {
  it('consumes events up to the step time and updates held keys', () => {
    const buffer = createInputBuffer();
    buffer.record({ kind: 'key', code: 'KeyW', pressed: true, time: 10 });
    buffer.record({ kind: 'key', code: 'KeyW', pressed: false, time: 30 });
    buffer.record({ kind: 'key', code: 'Space', pressed: true, time: 45 });

    const first = buffer.consumeUpTo(32);
    expect(first.map((event) => event.code)).toEqual(['KeyW', 'KeyW']);
    expect(buffer.isDown('KeyW')).toBe(false);
    expect(buffer.consumeUpTo(32)).toEqual([]);

    const second = buffer.consumeUpTo(45);
    expect(second.map((event) => event.code)).toEqual(['Space']);
    expect(buffer.isDown('Space')).toBe(true);
  });

  it('splits a press across the two steps of a 30 fps frame', () => {
    const frameStart = 1000;
    const plan = planFixedSteps(0, 1000 / 30, frameStart);
    const buffer = createInputBuffer();
    buffer.record({
      kind: 'key',
      code: 'Space',
      pressed: true,
      time: plan.stepEnds[0] - 1,
    });
    buffer.record({
      kind: 'key',
      code: 'KeyF',
      pressed: true,
      time: plan.stepEnds[0] + 1,
    });

    const early = buffer.consumeUpTo(plan.stepEnds[0]);
    const late = buffer.consumeUpTo(plan.stepEnds[1]);
    expect(early.map((event) => event.code)).toEqual(['Space']);
    expect(late.map((event) => event.code)).toEqual(['KeyF']);
    expect(plan.stepEnds[1] - plan.stepEnds[0]).toBeCloseTo(FIXED_DT_MS, 5);
  });

  it('sums pointer pixels per step so sensitivity does not depend on the render cap', () => {
    const buffer = createInputBuffer();
    buffer.record({ kind: 'pointer', dx: 10, dy: 0, time: 5 });
    buffer.record({ kind: 'pointer', dx: 6, dy: -2, time: 12 });
    buffer.record({ kind: 'pointer', dx: 4, dy: 1, time: 20 });

    const first = pointerDelta(buffer.consumeUpTo(14));
    const second = pointerDelta(buffer.consumeUpTo(20));
    expect(first).toEqual({ dx: 16, dy: -2 });
    expect(second).toEqual({ dx: 4, dy: 1 });

    const sensitivity = 1.5;
    const split = yawDeltaFromPixels(first.dx, sensitivity) + yawDeltaFromPixels(second.dx, sensitivity);
    const combined = yawDeltaFromPixels(first.dx + second.dx, sensitivity);
    expect(split).toBeCloseTo(combined, 8);
  });
});
