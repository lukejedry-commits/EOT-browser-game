import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadRapier } from '../src/physics/world.js';
import { createRoute } from '../src/scenes/route.js';
import { GATE_SUBJECTS, ROUTE_POINTS } from '../src/scenes/level-data.js';

function projectBox(camera, box) {
  const corners = [
    [box.min.x, box.min.y, box.min.z],
    [box.min.x, box.min.y, box.max.z],
    [box.min.x, box.max.y, box.min.z],
    [box.min.x, box.max.y, box.max.z],
    [box.max.x, box.min.y, box.min.z],
    [box.max.x, box.min.y, box.max.z],
    [box.max.x, box.max.y, box.min.z],
    [box.max.x, box.max.y, box.max.z],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y, z] of corners) {
    const ndc = new THREE.Vector3(x, y, z).project(camera);
    minX = Math.min(minX, ndc.x);
    maxX = Math.max(maxX, ndc.x);
    minY = Math.min(minY, ndc.y);
    maxY = Math.max(maxY, ndc.y);
  }
  return { minX, maxX, minY, maxY, height: (maxY - minY) / 2 };
}

function rayHitsBefore(R, world, player, origin, target, slack) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dy, dz);
  const ray = new R.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: dx / dist, y: dy / dist, z: dz / dist },
  );
  const hit = world.castRay(
    ray,
    dist,
    false,
    undefined,
    undefined,
    undefined,
    player,
    (collider) => !collider.isSensor(),
  );
  if (!hit) return false;
  return dist - hit.timeOfImpact > slack;
}

describe('camera zones frame Korrath', () => {
  it('keeps every route sample in frame, clear of colliders, and at a readable size', async () => {
    const R = await loadRapier();
    const route = createRoute(R);
    let player = null;
    route.world.forEachRigidBody((body) => {
      if (body.isKinematic()) player = body;
    });
    const hero = route.scene.getObjectByName('korrath');
    const box = new THREE.Box3();

    for (const point of ROUTE_POINTS) {
      route.place(point);
      route.camera.aspect = 16 / 9;
      route.present(1, 16, false);
      expect(route.cameraName, point.zone).toBe(point.zone);

      hero.updateWorldMatrix(true, true);
      box.setFromObject(hero);
      route.camera.updateMatrixWorld(true);
      const frame = projectBox(route.camera, box);
      expect(frame.minX, `${point.zone} left`).toBeGreaterThan(-0.8);
      expect(frame.maxX, `${point.zone} right`).toBeLessThan(0.8);
      expect(frame.minY, `${point.zone} bottom`).toBeGreaterThan(-0.8);
      expect(frame.maxY, `${point.zone} top`).toBeLessThan(0.8);
      expect(frame.height, `${point.zone} height`).toBeGreaterThanOrEqual(0.15);
      expect(frame.height, `${point.zone} height`).toBeLessThanOrEqual(0.25);

      const chest = { x: point.x, y: (box.min.y + box.max.y) / 2, z: point.z };
      const blocked = rayHitsBefore(R, route.world, player, route.camera.position, chest, 0.4);
      expect(blocked, `${point.zone} occlusion`).toBe(false);
    }

    route.place(ROUTE_POINTS.find((point) => point.zone === 'cam_gate'));
    route.camera.aspect = 16 / 9;
    route.present(1, 16, false);
    route.camera.updateMatrixWorld(true);
    for (const subject of GATE_SUBJECTS) {
      const ndc = new THREE.Vector3(subject.x, subject.y, subject.z).project(route.camera);
      expect(Math.abs(ndc.x), `${subject.id} x`).toBeLessThan(1);
      expect(Math.abs(ndc.y), `${subject.id} y`).toBeLessThan(1);
      expect(ndc.z, `${subject.id} depth`).toBeLessThan(1);
      const hidden = rayHitsBefore(
        R,
        route.world,
        player,
        route.camera.position,
        subject,
        subject.slack,
      );
      expect(hidden, `${subject.id} hidden`).toBe(false);
    }

    route.dispose();
  }, 20000);
});
