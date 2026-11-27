import { COMBAT, charge01, chargeTier } from './combat.js';

/**
 * Bindings live here so they can change without hunting through the game.
 * Current layout (Luke + Mechanics): no Ctrl and no Alt bindings.
 * The resolver still understands modifier chords (Shift+Space, Shift+LMB)
 * and mouse hold-vs-tap, so a later map can be data only.
 *
 * heavyMode 'shiftClick': Shift+LMB is heavy (default).
 * heavyMode 'holdLMB': holding LMB for heavyHoldMs is heavy.
 */

export const HEAVY_HOLD_MS = 300;
export const PARRY_TAP_MS = 150;

export const KEYMAP = {
  heavyMode: 'shiftClick',
  /** Off by default. When on, Alt+click and an alt-flagged contextmenu count as heavy. */
  altHeavy: false,
  jump: { code: 'Space' },
  crouch: { code: 'ShiftLeft', tap: true },
  dodge: { code: 'Space', modifiers: ['shift'] },
  heavy: { mouse: 0, modifiers: ['shift'] },
  light: { mouse: 0 },
  block: { mouse: 2, hold: true },
  parry: { mouse: 2, tap: true },
  wrath: { code: 'KeyR' },
  interact: { code: 'KeyF' },
  pause: { code: 'KeyP' },
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export const CONTROL_LINES = [
  ['Move', 'W A S D'],
  ['Jump / double jump', 'Space'],
  ['Crouch', 'Tap Left Shift'],
  ['Dodge roll', 'Left Shift + Space'],
  ['Light attack', 'Left mouse'],
  ['Heavy attack', 'Left Shift + left mouse'],
  ['Block / parry', 'Right mouse hold / tap'],
  ['Ember Wrath', 'R'],
  ['Grab / interact', 'F'],
  ['Pause', 'P'],
];

function heavyPayload(chargeMs) {
  const tier = chargeTier(chargeMs);
  return {
    action: 'heavy',
    chargeMs,
    tier,
    charge01: charge01(chargeMs),
    ...COMBAT.tiers[tier],
  };
}

export function createActionResolver(keymap = KEYMAP) {
  let shiftDownAt = null;
  let shiftDirty = false;
  let chargeVoid = false;
  let tier = 0;
  let shown01 = 0;
  let rmbDown = null;
  let rmbBlocking = false;
  let lmbDown = null;
  let lmbResolved = false;

  function voidCharge(actions, reason) {
    if (shiftDownAt == null || chargeVoid) return;
    actions.push({ type: 'chargeTier', tier: 0, previous: tier, chargeMs: 0, charge01: 0, reason });
    tier = 0;
    shown01 = 0;
    chargeVoid = true;
    shiftDirty = true;
  }

  function noteTier(actions, stepTime) {
    if (shiftDownAt == null || chargeVoid) {
      if (tier !== 0) {
        actions.push({ type: 'chargeTier', tier: 0, previous: tier, chargeMs: 0, charge01: 0 });
        tier = 0;
      }
      return;
    }
    const chargeMs = Math.min(COMBAT.maxChargeMs, Math.max(0, stepTime - shiftDownAt));
    const next = chargeTier(chargeMs);
    shown01 = charge01(chargeMs);
    if (next !== tier) {
      actions.push({
        type: 'chargeTier',
        tier: next,
        previous: tier,
        chargeMs,
        charge01: charge01(chargeMs),
      });
      tier = next;
    }
  }

  function push(events, stepTime) {
    const actions = [];
    const mode = keymap.heavyMode === 'holdLMB' ? 'holdLMB' : 'shiftClick';
    const altHeavy = keymap.altHeavy === true;

    for (const event of events) {
      const shifted = Boolean(event.shift) || shiftDownAt != null;
      if (event.kind === 'key' && event.code === 'ShiftLeft') {
        if (event.pressed) {
          shiftDownAt = event.time;
          shiftDirty = false;
          chargeVoid = false;
          noteTier(actions, event.time);
        } else if (shiftDownAt != null) {
          const held = event.time - shiftDownAt;
          if (!shiftDirty && !chargeVoid && held <= COMBAT.crouchTapMs) {
            actions.push({ action: 'crouch', time: event.time });
          }
          if (tier !== 0) {
            actions.push({ type: 'chargeTier', tier: 0, previous: tier, chargeMs: 0, charge01: 0, reason: 'release' });
          }
          tier = 0;
          shown01 = 0;
          shiftDownAt = null;
          shiftDirty = false;
          chargeVoid = false;
        }
        continue;
      }
      if (event.kind === 'key' && event.code === 'Space' && event.pressed) {
        if (shifted) {
          shiftDirty = true;
          voidCharge(actions, 'roll');
          actions.push({ action: 'dodge', time: event.time });
        } else {
          actions.push({ action: 'jump', time: event.time });
        }
        continue;
      }
      if (event.kind === 'key' && event.pressed && event.code === 'KeyR') {
        actions.push({ action: 'wrath', time: event.time });
        continue;
      }
      if (event.kind === 'key' && event.pressed && event.code === 'KeyF') {
        actions.push({ action: 'interact', time: event.time });
        continue;
      }
      if (event.kind === 'key' && event.pressed && shiftDownAt != null) shiftDirty = true;

      if (event.kind === 'mouse' && event.button === 0 && event.pressed) {
        const altClick = altHeavy && event.alt;
        if (shifted && mode === 'shiftClick' && !chargeVoid && shiftDownAt != null) {
          shiftDirty = true;
          const chargeMs = Math.min(COMBAT.maxChargeMs, Math.max(0, event.time - shiftDownAt));
          actions.push({ ...heavyPayload(chargeMs), time: event.time });
          tier = 0;
          shiftDownAt = event.time;
          chargeVoid = false;
          actions.push({ type: 'chargeTier', tier: 1, previous: 0, chargeMs: 0, charge01: 0 });
          tier = 1;
        } else if (altClick) {
          actions.push({ ...heavyPayload(0), time: event.time });
        } else if (mode === 'holdLMB') {
          lmbDown = event.time;
          lmbResolved = false;
        } else if (!shifted) {
          actions.push({ action: 'light', time: event.time });
        }
        continue;
      }
      if (event.kind === 'mouse' && event.button === 0 && !event.pressed && lmbDown != null) {
        if (!lmbResolved && event.time - lmbDown < HEAVY_HOLD_MS) {
          actions.push({ action: 'light', time: event.time });
        }
        lmbDown = null;
        lmbResolved = false;
        continue;
      }
      if (event.kind === 'mouse' && event.button === 2) {
        if (event.pressed) {
          if (shiftDownAt != null && !chargeVoid) voidCharge(actions, 'rmb');
          rmbDown = event.time;
          rmbBlocking = false;
        } else if (rmbDown != null) {
          if (!rmbBlocking && event.time - rmbDown <= PARRY_TAP_MS) {
            actions.push({ action: 'parry', time: event.time });
          } else if (rmbBlocking) {
            actions.push({ action: 'blockEnd', time: event.time });
          }
          rmbDown = null;
          rmbBlocking = false;
        }
        continue;
      }
      if (event.kind === 'contextmenu') {
        if (altHeavy && event.alt) {
          actions.push({ ...heavyPayload(0), time: event.time, via: 'contextmenu' });
        } else {
          actions.push({ action: 'contextmenu', time: event.time, alt: Boolean(event.alt) });
        }
      }
    }

    if (mode === 'holdLMB' && lmbDown != null && !lmbResolved && stepTime - lmbDown >= HEAVY_HOLD_MS) {
      lmbResolved = true;
      actions.push({ ...heavyPayload(HEAVY_HOLD_MS), time: stepTime });
    }
    if (rmbDown != null && !rmbBlocking && stepTime - rmbDown > PARRY_TAP_MS) {
      rmbBlocking = true;
      actions.push({ action: 'block', time: stepTime });
    }
    noteTier(actions, stepTime);
    return actions;
  }

  return {
    push,
    charging() {
      return shiftDownAt != null && !chargeVoid;
    },
    speedScale() {
      return this.charging() ? COMBAT.chargeMoveScale : 1;
    },
    charge01() {
      return shown01;
    },
    canBlock() {
      return !this.charging();
    },
    cancelFromHit() {
      const actions = [];
      voidCharge(actions, 'hit');
      return actions;
    },
  };
}

export function keymapAvoidsBrowserChords(keymap = KEYMAP) {
  const blocked = ['Control', 'Alt', 'Meta'];
  const codes = [];
  for (const value of Object.values(keymap)) {
    if (typeof value === 'string') codes.push(value);
    else if (Array.isArray(value)) codes.push(...value);
    else if (value && typeof value.code === 'string') codes.push(value.code);
  }
  return codes.every((code) => !blocked.some((prefix) => code.startsWith(prefix)));
}

export function axisFromKeys(input) {
  let fwd = 0;
  let strafe = 0;
  if (KEYMAP.forward.some((code) => input.isDown(code))) fwd += 1;
  if (KEYMAP.back.some((code) => input.isDown(code))) fwd -= 1;
  if (KEYMAP.right.some((code) => input.isDown(code))) strafe += 1;
  if (KEYMAP.left.some((code) => input.isDown(code))) strafe -= 1;
  const mag = Math.hypot(fwd, strafe);
  if (mag > 1) {
    fwd /= mag;
    strafe /= mag;
  }
  return { fwd, strafe };
}
