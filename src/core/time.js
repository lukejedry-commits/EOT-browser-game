/** Simulation rate. The render cap never changes this. */
export const SIM_HZ = 60;

/** Fixed physics step, in milliseconds. */
export const FIXED_DT_MS = 1000 / SIM_HZ;

/** Spiral-of-death guard. A hitch simulates at most this many steps. */
export const MAX_STEPS_PER_FRAME = 5;

/**
 * Plan the fixed steps for one presented frame.
 *
 * `accumulatorMs` is the leftover fraction from last frame. `deltaMs` is the
 * wall time since the last presented frame (skipped render frames are included,
 * so a 30 fps cap on a 60 Hz display yields two steps). `frameStartMs` is the
 * `performance.now()` value at the start of that window.
 *
 * Each entry in `stepEnds` is the wall-clock time at which that step closes.
 * The input buffer consumes events with `time <= stepEnds[i]` inside step i,
 * so a press between the two steps of a 30 fps frame lands on the later step.
 *
 * @returns {{
 *   accumulatorMs: number,
 *   steps: number,
 *   alpha: number,
 *   stepDtMs: number,
 *   stepEnds: number[],
 * }}
 */
export function planFixedSteps(accumulatorMs, deltaMs, frameStartMs, opts = {}) {
  const stepDtMs = opts.stepDtMs ?? FIXED_DT_MS;
  const maxSteps = opts.maxSteps ?? MAX_STEPS_PER_FRAME;
  const hitchCap = stepDtMs * maxSteps;
  const clamped = Math.min(Math.max(0, deltaMs), hitchCap);
  let acc = (Number.isFinite(accumulatorMs) ? accumulatorMs : 0) + clamped;
  const stepEnds = [];

  while (stepEnds.length < maxSteps && acc >= stepDtMs - 1e-6) {
    acc -= stepDtMs;
    if (acc < 0 && acc > -1e-6) acc = 0;
    stepEnds.push(frameStartMs + clamped - acc);
  }

  if (acc >= stepDtMs) acc %= stepDtMs;

  return {
    accumulatorMs: acc,
    steps: stepEnds.length,
    alpha: stepDtMs === 0 ? 0 : acc / stepDtMs,
    stepDtMs,
    stepEnds,
  };
}

/**
 * Render-cap gate. Returning false drops this rAF callback: the caller must
 * not present and must not advance `lastPresentMs`, so the next presented
 * frame's delta covers the skipped time and the fixed step catches up.
 * The 1 ms slop keeps a 60 Hz display from skipping a frame that lands a
 * fraction early, without turning a 30 cap into a 60 cap.
 */
export function shouldPresentFrame(nowMs, lastPresentMs, fpsCap) {
  if (lastPresentMs == null) return true;
  const cap = fpsCap === 60 ? 60 : 30;
  return nowMs - lastPresentMs >= 1000 / cap - 1;
}
