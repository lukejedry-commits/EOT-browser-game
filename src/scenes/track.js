import * as THREE from 'three';

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

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xd5dde6, 0x2c3036, 0.9);
  const key = new THREE.DirectionalLight(0xf2f6fb, 1.15);
  key.position.set(8, 14, 6);
  scene.add(hemi, key);
  const baseHemi = hemi.intensity;
  const baseKey = key.intensity;
  return {
    setDimmed(on) {
      const scale = on ? 0.4 : 1;
      hemi.intensity = baseHemi * scale;
      key.intensity = baseKey * scale;
    },
  };
}

export function disposeResources(geometries, materials) {
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
