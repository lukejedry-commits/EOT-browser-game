import { describe, expect, it } from 'vitest';
import {
  createSettingsStore,
  defaultFpsCap,
  isWeakHardware,
  loadSettings,
  RENDER_SCALES,
} from '../src/core/settings.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const chromebook = { deviceMemory: 4, hardwareConcurrency: 2 };
const desktop = { deviceMemory: 16, hardwareConcurrency: 8 };

describe('fps cap default', () => {
  it('selects 30 on weak hardware and 60 on a desktop', () => {
    expect(isWeakHardware(chromebook)).toBe(true);
    expect(defaultFpsCap(chromebook)).toBe(30);
    expect(isWeakHardware({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(true);
    expect(isWeakHardware({ hardwareConcurrency: 2 })).toBe(true);
    expect(isWeakHardware({})).toBe(true);

    expect(isWeakHardware(desktop)).toBe(false);
    expect(defaultFpsCap(desktop)).toBe(60);
    expect(isWeakHardware({ hardwareConcurrency: 8 })).toBe(false);
    expect(isWeakHardware({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe(false);
  });

  it('uses the hardware default only when nothing is saved', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage, chromebook).fpsCap).toBe(30);
    expect(loadSettings(storage, desktop).fpsCap).toBe(60);
  });
});

describe('settings persistence', () => {
  it('keeps an explicit 60 cap on weak hardware after a reload', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage, chromebook);
    expect(store.get().fpsCap).toBe(30);

    store.update({
      fpsCap: 60,
      master: 0.5,
      music: 0.25,
      sfx: 0,
      mouseSensitivity: 1.5,
      cameraShake: false,
      renderScale: 0.75,
    });

    const reloaded = createSettingsStore(storage, chromebook);
    expect(reloaded.get()).toMatchObject({
      fpsCap: 60,
      master: 0.5,
      music: 0.25,
      sfx: 0,
      mouseSensitivity: 1.5,
      cameraShake: false,
      renderScale: 0.75,
      inputDevice: 'keyboard',
    });
    expect(RENDER_SCALES).toContain(reloaded.get().renderScale);
  });

  it('rejects an out-of-range render scale and an unknown fps cap', () => {
    const storage = memoryStorage();
    storage.setItem('eot.settings.v1', JSON.stringify({
      fpsCap: 45,
      renderScale: 2,
      master: 4,
    }));
    const loaded = loadSettings(storage, desktop);
    expect(loaded.fpsCap).toBe(60);
    expect(loaded.renderScale).toBe(1);
    expect(loaded.master).toBe(1);
  });

  it('persists the main-menu input device without dropping the other settings', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage, desktop);
    store.update({ inputDevice: 'gamepad', master: 0.8 });
    const reloaded = createSettingsStore(storage, desktop);
    expect(reloaded.get().inputDevice).toBe('gamepad');
    expect(reloaded.get().master).toBe(0.8);
    expect(reloaded.get().fpsCap).toBe(60);
  });
});
