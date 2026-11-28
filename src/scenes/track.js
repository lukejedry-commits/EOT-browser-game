import * as THREE from 'three';
import { LIGHTING } from '../config/lighting.js';

const scratch = { x: 0, y: 0, z: 0 };
const scratchRot = { x: 0, y: 0, z: 0, w: 1 };

/** Previous/current body poses so the render can interpolate between fixed steps. */
export function createTracker() {
  const items = [];

  function pull(item) {
    const t = item.body.translation(scratch);
    item.curr.set(t.x, t.y, t.z);
    if (item.rotation) {
      const r = item.body.rotation(scratchRot);
      item.currQ.set(r.x, r.y, r.z, r.w);
    }
  }

  return {
    add(mesh, body, { rotation = false } = {}) {
      const item = {
        mesh,
        body,
        rotation,
        prev: new THREE.Vector3(),
        curr: new THREE.Vector3(),
        prevQ: rotation ? new THREE.Quaternion() : null,
        currQ: rotation ? new THREE.Quaternion() : null,
      };
      pull(item);
      item.prev.copy(item.curr);
      mesh.position.copy(item.curr);
      if (rotation) {
        item.prevQ.copy(item.currQ);
        mesh.quaternion.copy(item.currQ);
      }
      items.push(item);
      return item;
    },
    snapshot() {
      for (const item of items) {
        item.prev.copy(item.curr);
        if (item.rotation) item.prevQ.copy(item.currQ);
        pull(item);
      }
    },
    apply(alpha) {
      for (const item of items) {
        item.mesh.position.lerpVectors(item.prev, item.curr, alpha);
        if (item.rotation) {
          item.mesh.quaternion.copy(item.prevQ).slerp(item.currQ, alpha);
        }
      }
    },
    snap(item) {
      pull(item);
      item.prev.copy(item.curr);
      item.mesh.position.copy(item.curr);
      if (item.rotation) {
        item.prevQ.copy(item.currQ);
        item.mesh.quaternion.copy(item.currQ);
      }
    },
  };
}

function mixColor(from, to, t) {
  const color = new THREE.Color(from);
  color.lerp(new THREE.Color(to), t);
  return color;
}

export function createLights(scene, config = LIGHTING) {
  const hemi = new THREE.HemisphereLight(config.hemiSky, config.hemiGround, config.hemiIntensity);
  const key = new THREE.DirectionalLight(config.rim, 0.9);
  key.position.set(0, 4, -2);
  const target = new THREE.Object3D();
  scene.add(target);
  key.target = target;
  const points = [0, 1].map(() => {
    const light = new THREE.PointLight(0xffffff, 0, 16, 1);
    scene.add(light);
    return light;
  });
  scene.add(hemi, key);
  if (points.length !== config.pointBudget) {
    throw new Error(`light budget is ${config.pointBudget} point lights`);
  }
  let dim = 1;
  let clockMs = 0;
  const flareMs = new Map();
  let from = null;
  let goal = null;
  let blend = config.blendMs;
  const shown = {
    sky: config.hemiSky,
    key: config.rim,
    keyIntensity: 0.9,
    points: points.map(() => ({ color: config.rim, intensity: 0, x: 0, y: 3, z: 0, distance: 16 })),
  };

  function snapshot() {
    return {
      sky: shown.sky,
      key: shown.key,
      keyIntensity: shown.keyIntensity,
      points: shown.points.map((point) => ({ ...point })),
    };
  }

  function apply(angel = 0) {
    hemi.color.setHex(shown.sky);
    hemi.groundColor.setHex(config.hemiGround);
    hemi.intensity = config.hemiIntensity * dim;
    key.color.setHex(shown.key);
    key.intensity = shown.keyIntensity * dim;
    points.forEach((light, index) => {
      const point = shown.points[index];
      const angelScale = point.angel ? angel : 1;
      let color = point.color;
      let intensity = point.intensity * angelScale;
      if (point.brazier) {
        const flare = flareMs.get(point.id) ?? 0;
        const flicker = 0.82 + 0.18 * Math.sin(clockMs * 0.013 + index * 1.7);
        color = flare > 0 ? 0x6e1208 : 0xff7a1a;
        intensity = point.intensity * (flare > 0 ? 2.6 : flicker);
      }
      light.color.setHex(color);
      light.intensity = intensity * dim;
      light.distance = point.distance;
      light.position.set(point.x, point.y, point.z);
    });
  }

  return {
    pointCount: points.length,
    setDimmed(on) {
      dim = on ? 0.4 : 1;
      apply();
    },
    aim(fromPosition, toPosition) {
      key.position.set(fromPosition.x, fromPosition.y + 1.4, fromPosition.z);
      target.position.set(toPosition.x, toPosition.y + 0.9, toPosition.z);
    },
    setZone(id) {
      const preset = config.zones[id] ?? config.zones.cam_corridor;
      const next = {
        sky: preset.sky,
        key: preset.key,
        keyIntensity: preset.keyIntensity,
        points: preset.points.map((point) => ({ ...point })),
      };
      if (!goal) {
        from = next;
        goal = next;
        shown.sky = next.sky;
        shown.key = next.key;
        shown.keyIntensity = next.keyIntensity;
        shown.points = next.points.map((point) => ({ ...point }));
        blend = config.blendMs;
        apply(0);
        return;
      }
      from = snapshot();
      goal = next;
      blend = 0;
    },
    step(dtMs, angel = 0) {
      if (!goal) {
        this.setZone('cam_cell');
        blend = config.blendMs;
      }
      blend = Math.min(config.blendMs, blend + dtMs);
      const t = config.blendMs <= 0 ? 1 : blend / config.blendMs;
      shown.sky = mixColor(from.sky, goal.sky, t).getHex();
      shown.key = mixColor(from.key, goal.key, t).getHex();
      shown.keyIntensity = from.keyIntensity + (goal.keyIntensity - from.keyIntensity) * t;
      shown.points.forEach((point, index) => {
        const next = goal.points[index];
        const prev = from.points[index];
        point.color = mixColor(prev.color, next.color, t).getHex();
        point.intensity = prev.intensity + (next.intensity - prev.intensity) * t;
        point.x = prev.x + (next.x - prev.x) * t;
        point.y = prev.y + (next.y - prev.y) * t;
        point.z = prev.z + (next.z - prev.z) * t;
        point.distance = prev.distance + (next.distance - prev.distance) * t;
        point.angel = Boolean(next.angel);
        point.brazier = Boolean(next.brazier);
        point.id = next.id ?? '';
      });
      clockMs += dtMs;
      for (const [id, left] of flareMs) {
        const nextLeft = left - dtMs;
        if (nextLeft <= 0) flareMs.delete(id);
        else flareMs.set(id, nextLeft);
      }
      apply(angel);
    },
    flareBrazier(id) {
      flareMs.set(id, 500);
    },
  };
}

export function disposeResources(geometries, materials) {
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
