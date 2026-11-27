import { planFixedSteps, shouldPresentFrame } from './time.js';

/**
 * Present frames at the fps cap. Each presented frame runs as many fixed
 * 60 Hz steps as the accumulator asks for. Pause and the resume frame do
 * not integrate the time spent paused: the sim clock stays frozen.
 *
 * @param {{
 *   getNow?: () => number,
 *   isPaused: () => boolean,
 *   getFpsCap: () => number,
 *   onResume?: (now: number) => void,
 *   onStep: (stepDtMs: number, stepEndMs: number) => number | void,
 *   onFrame: (alpha: number, now: number, info: object) => void,
 * }} opts
 */
export function createLoop(opts) {
  let raf = 0;
  let running = false;
  let lastNow = 0;
  let lastPresent = null;
  let accumulator = 0;
  let wasPaused = true;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const cap = opts.getFpsCap();
    if (!shouldPresentFrame(now, lastPresent, cap)) return;

    const paused = opts.isPaused();
    if (paused) {
      wasPaused = true;
      accumulator = 0;
      lastNow = now;
      lastPresent = now;
      opts.onFrame(0, now, { paused: true, steps: 0, frameDtMs: 0, stepMs: 0 });
      return;
    }

    if (wasPaused || lastNow === 0) {
      wasPaused = false;
      opts.onResume?.(now);
      accumulator = 0;
      lastNow = now;
      lastPresent = now;
      opts.onFrame(0, now, { paused: false, steps: 0, frameDtMs: 0, stepMs: 0 });
      return;
    }

    const delta = now - lastNow;
    const frameStart = lastNow;
    lastNow = now;
    lastPresent = now;

    const plan = planFixedSteps(accumulator, delta, frameStart);
    accumulator = plan.accumulatorMs;

    let stepMs = 0;
    for (const stepEnd of plan.stepEnds) {
      const taken = opts.onStep(plan.stepDtMs, stepEnd);
      if (typeof taken === 'number') stepMs += taken;
    }

    opts.onFrame(plan.alpha, now, {
      paused: false,
      steps: plan.steps,
      frameDtMs: delta,
      stepMs,
    });
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastNow = 0;
      lastPresent = null;
      accumulator = 0;
      wasPaused = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastNow = 0;
      lastPresent = null;
      accumulator = 0;
      wasPaused = true;
    },
  };
}
