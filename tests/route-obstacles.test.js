import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MOVEMENT, verticalReach } from '../src/config/movement.js';
import { LIGHTING } from '../src/config/lighting.js';
import {
  COLONNADE_GAP,
  GATE_PUSH_ZONE,
  MAIN_SLABS,
  THRESHOLD_HEIGHT,
  WEDGED_OPENING,
  CEILING_Y,
} from '../src/scenes/level-data.js';
import { loadRapier } from '../src/physics/world.js';
import { createRoute } from '../src/scenes/route.js';
import { createLights } from '../src/scenes/track.js';
import * as THREE from 'three';

describe('main-route slabs', () => {
  it('is a step no taller than 0.35 m, or a jump no taller than 1.6 m', () => {
    expect(MAIN_SLABS.length).toBeGreaterThan(0);
    for (const slab of MAIN_SLABS) {
      if (slab.kind === 'jump') {
        expect(slab.height).toBeLessThanOrEqual(verticalReach(MOVEMENT, 1));
      } else {
        expect(slab.height).toBeLessThanOrEqual(MOVEMENT.stepUp);
      }
    }
  });

  it('walks over the corridor step from spawn', async () => {
    const R = await loadRapier();
    const route = createRoute(R);
    const input = { isDown: (code) => code === 'KeyW' };
    let z = 0;
    for (let t = 0; t < 240; t += 1) {
      route.step(16, { input, settings: { quality: 'high', inputDevice: 'keyboard' }, events: [] });
      z = route.captureState().player.z;
      if (z > 17) break;
    }
    expect(z).toBeGreaterThan(17);
    route.dispose();
  }, 20000);
});

describe('tide gate graybox', () => {
  it('keeps the authored gap, ledge, crawl, ceiling, and push-out', () => {
    expect(COLONNADE_GAP).toBe(4.25);
    expect(THRESHOLD_HEIGHT).toBe(2.2);
    expect(WEDGED_OPENING).toBe(1.4);
    expect(CEILING_Y).toBe(6);
    expect(GATE_PUSH_ZONE.minZ).toBeLessThan(GATE_PUSH_ZONE.maxZ);
  });
});

describe('lighting rig', () => {
  it('uses the cool ground fill, the fog color, and two point lights', () => {
    expect(LIGHTING.hemiGround).toBe(0x3a3f4a);
    expect(LIGHTING.hemiIntensity).toBe(0.6);
    expect(LIGHTING.background).toBe(0x1c222b);
    expect(LIGHTING.fogNear).toBe(8);
    expect(LIGHTING.fogFar).toBe(30);
    expect(LIGHTING.blendMs).toBe(400);
    expect(LIGHTING.pointBudget).toBe(2);
    const scene = new THREE.Scene();
    const lights = createLights(scene);
    lights.setZone('cam_cell');
    const hemi = scene.children.find((child) => child.isHemisphereLight);
    const points = scene.children.filter((child) => child.isPointLight);
    expect(hemi.groundColor.getHex()).toBe(0x3a3f4a);
    expect(hemi.intensity).toBeCloseTo(0.6);
    expect(lights.pointCount).toBe(2);
    expect(points).toHaveLength(2);
    const key = scene.children.find((child) => child.isDirectionalLight);
    const cellKey = key.intensity;
    lights.setZone('cam_corridor');
    lights.step(200, 0);
    expect(key.intensity).toBeGreaterThan(cellKey);
    expect(key.intensity).toBeLessThan(LIGHTING.zones.cam_corridor.keyIntensity);
  });
});

describe('dialogue ids', () => {
  it('has the vent hiss and the hands lore id', () => {
    const lines = JSON.parse(readFileSync(new URL('../public/data/dialogue.json', import.meta.url)));
    expect(lines.bark_ember_vent).toBe('(hiss)');
    expect(typeof lines.lore_dagon_hands).toBe('string');
    expect(lines.lore_dagon_hands.length).toBeGreaterThan(0);
  });
});
