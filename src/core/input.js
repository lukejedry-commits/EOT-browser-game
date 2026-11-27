/**
 * Timestamped input buffer.
 *
 * Listeners stamp `performance.now()` when the event fires. The fixed step
 * consumes every event with `time <= stepEnd`. Gameplay must not sample the
 * keyboard once per rendered frame: at a 30 fps cap a press can fall between
 * the two physics steps, and later windows (parry, dodge) are only a few
 * rendered frames long.
 *
 * Pointer axes are summed from the events of that step. Gamepad sticks have
 * no DOM event, so the step samples the Gamepad API itself (once per step,
 * not once per rendered frame).
 */

export function createInputBuffer() {
  /** @type {Array<Record<string, any>>} */
  const events = [];
  /** @type {Map<string, boolean>} */
  const down = new Map();

  function record(event) {
    events.push(event);
  }

  function consumeUpTo(timeMs) {
    if (events.length > 1) {
      let ordered = true;
      for (let i = 1; i < events.length; i++) {
        if (events[i].time < events[i - 1].time) {
          ordered = false;
          break;
        }
      }
      if (!ordered) events.sort((a, b) => a.time - b.time);
    }

    const consumed = [];
    let i = 0;
    while (i < events.length && events[i].time <= timeMs) {
      const event = events[i];
      if (event.kind === 'key') {
        const id = `key:${event.code}`;
        if (event.pressed) down.set(id, true);
        else down.delete(id);
      } else if (event.kind === 'mouse') {
        const id = `mouse:${event.button}`;
        if (event.pressed) down.set(id, true);
        else down.delete(id);
      }
      consumed.push(event);
      i += 1;
    }
    if (i > 0) events.splice(0, i);
    return consumed;
  }

  function isDown(code) {
    return down.get(`key:${code}`) === true;
  }

  function isMouseDown(button) {
    return down.get(`mouse:${button}`) === true;
  }

  function clear() {
    events.length = 0;
    down.clear();
  }

  return { record, consumeUpTo, isDown, isMouseDown, clear };
}

/** Radians of camera yaw for a pointer delta. Linear in pixels, so summing two steps equals one. */
export function yawDeltaFromPixels(dx, sensitivity) {
  const sens = Number.isFinite(sensitivity) ? sensitivity : 1;
  return -dx * 0.0022 * sens;
}

export function pointerDelta(events) {
  let dx = 0;
  let dy = 0;
  for (const event of events) {
    if (event.kind === 'pointer') {
      dx += event.dx || 0;
      dy += event.dy || 0;
    }
  }
  return { dx, dy };
}

/**
 * @param {ReturnType<typeof createInputBuffer>} buffer
 * @param {Window | Document | HTMLElement} target
 * @param {{ getNow?: () => number, allowPointer?: () => boolean }} [hooks]
 */
export function attachInput(buffer, target, hooks = {}) {
  const getNow = hooks.getNow ?? (() => performance.now());
  const allowPointer = hooks.allowPointer ?? (() => true);

  const mods = (event) => ({
    shift: Boolean(event.shiftKey),
    alt: Boolean(event.altKey),
    ctrl: Boolean(event.ctrlKey),
  });
  const onKeyDown = (event) => {
    if (event.repeat) return;
    if (event.code === 'AltLeft' || event.code === 'AltRight') event.preventDefault();
    buffer.record({
      kind: 'key',
      code: event.code,
      pressed: true,
      time: getNow(),
      ...mods(event),
    });
  };
  const onKeyUp = (event) => {
    if (event.code === 'AltLeft' || event.code === 'AltRight') event.preventDefault();
    buffer.record({
      kind: 'key',
      code: event.code,
      pressed: false,
      time: getNow(),
      ...mods(event),
    });
  };
  const onMouseDown = (event) => {
    buffer.record({
      kind: 'mouse',
      button: event.button,
      pressed: true,
      time: getNow(),
      ...mods(event),
    });
  };
  const onMouseUp = (event) => {
    buffer.record({
      kind: 'mouse',
      button: event.button,
      pressed: false,
      time: getNow(),
      ...mods(event),
    });
  };
  const onContext = (event) => {
    event.preventDefault();
    buffer.record({
      kind: 'contextmenu',
      button: 2,
      pressed: true,
      time: getNow(),
      ...mods(event),
    });
  };
  const onMouseMove = (event) => {
    if (!allowPointer()) return;
    if (!event.movementX && !event.movementY) return;
    buffer.record({
      kind: 'pointer',
      dx: event.movementX,
      dy: event.movementY,
      time: getNow(),
    });
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup', onMouseUp);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('contextmenu', onContext);

  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('mousedown', onMouseDown);
    target.removeEventListener('mouseup', onMouseUp);
    target.removeEventListener('mousemove', onMouseMove);
    target.removeEventListener('contextmenu', onContext);
  };
}

const STICK_DEADZONE = 0.18;

/**
 * Sample the first connected gamepad. Call this from the fixed step.
 * Returns null when no pad is connected. Axis values inside the deadzone are 0.
 */
export function sampleGamepadStick() {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }
  const pads = navigator.getGamepads();
  let pad = null;
  for (const candidate of pads) {
    if (candidate) {
      pad = candidate;
      break;
    }
  }
  if (!pad) return null;
  const ax = pad.axes[0] || 0;
  const ay = pad.axes[1] || 0;
  return {
    id: pad.id,
    x: Math.abs(ax) < STICK_DEADZONE ? 0 : ax,
    y: Math.abs(ay) < STICK_DEADZONE ? 0 : ay,
  };
}

export function connectedGamepadLabel() {
  const stick = sampleGamepadStick();
  return stick ? stick.id : null;
}
