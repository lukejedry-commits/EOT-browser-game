export const STORAGE_KEY = 'eot.settings.v1';

export const FPS_CAPS = [30, 60];
export const RENDER_SCALES = [0.5, 0.75, 1];

/**
 * Weak-hardware rule (M0, written for Validation).
 *
 * On a first launch with no saved fps cap:
 * - 30 if the machine looks like the target Chromebook-class device
 * - 60 on a desktop test machine
 *
 * Weak when any of these hold:
 * 1. `navigator.deviceMemory` is a finite number and <= 4.
 *    Chrome reports gigabytes. The Chromebook 3100 has 4 GB, so it takes this branch.
 * 2. `navigator.hardwareConcurrency` is a finite number and <= 2.
 *    The Celeron N4020 reports 2 threads. This still selects 30 in Firefox, which
 *    does not expose `deviceMemory`.
 * 3. Both APIs are missing. Assume the safe 30 cap.
 *
 * If only one API exists, that one decides: 8 cores and no `deviceMemory` is 60;
 * 4 GB and no core count is 30. A saved cap of 30 or 60 always wins and is still
 * there after a reload.
 *
 * @param {{ deviceMemory?: number, hardwareConcurrency?: number }} nav
 */
export function isWeakHardware(nav) {
  const mem = nav?.deviceMemory;
  const cores = nav?.hardwareConcurrency;
  const hasMem = typeof mem === 'number' && Number.isFinite(mem);
  const hasCores = typeof cores === 'number' && Number.isFinite(cores);
  if (!hasMem && !hasCores) return true;
  if (hasMem && mem <= 4) return true;
  if (hasCores && cores <= 2) return true;
  return false;
}

export function defaultFpsCap(nav) {
  return isWeakHardware(nav) ? 30 : 60;
}

function clamp(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export function sanitizeSettings(raw, hardware) {
  const fpsCap = raw?.fpsCap === 30 || raw?.fpsCap === 60 ? raw.fpsCap : defaultFpsCap(hardware);
  const requestedScale = Number(raw?.renderScale);
  const renderScale = RENDER_SCALES.includes(requestedScale) ? requestedScale : 1;
  return {
    fpsCap,
    master: clamp(raw?.master, 0, 1, 1),
    music: clamp(raw?.music, 0, 1, 1),
    sfx: clamp(raw?.sfx, 0, 1, 1),
    mouseSensitivity: clamp(raw?.mouseSensitivity, 0.1, 3, 1),
    cameraShake: raw?.cameraShake === undefined ? true : Boolean(raw.cameraShake),
    renderScale,
    inputDevice: raw?.inputDevice === 'gamepad' ? 'gamepad' : 'keyboard',
  };
}

export function loadSettings(storage, hardware = {}) {
  let raw = null;
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text) raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  return sanitizeSettings(raw, hardware);
}

export function saveSettings(storage, settings) {
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings, {})));
}

export function createSettingsStore(storage, hardware = {}) {
  let current = loadSettings(storage, hardware);
  const listeners = new Set();

  function update(partial) {
    current = sanitizeSettings({ ...current, ...partial }, hardware);
    storage.setItem(STORAGE_KEY, JSON.stringify(current));
    for (const listener of listeners) listener(current);
    return current;
  }

  return {
    get: () => current,
    update,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
