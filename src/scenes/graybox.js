import * as THREE from 'three';
import {
  CAPSULE_HALF_HEIGHT,
  CAPSULE_RADIUS,
  createCharacter,
  createFixedCuboid,
  createWorld,
  readTranslation,
  stepCharacter,
  teleportBody,
} from '../physics/world.js';
import { createFollowCamera, cameraRelativeVelocity, readMoveAxes } from './follow.js';
import { createLights, createTracker, disposeResources } from './track.js';

const PLAYER_SPAWN = { x: 0, y: 1.2, z: 6 };

/**
 * Flat-shaded ground, a few boxes, and one kinematic capsule.
 * Confirms Rapier boots and that body translations drive the meshes.
 */
export function createGraybox(R) {
  const world = createWorld(R);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);

  const geometries = new Set();
  const materials = new Set();
  const lights = createLights(scene);
  const tracker = createTracker();

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8a8d92, flatShading: true });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  geometries.add(ground.geometry);
  materials.add(groundMat);
  createFixedCuboid(R, world, { x: 0, y: -0.5, z: 0 }, { x: 20, y: 0.5, z: 20 });

  const boxMat = new THREE.MeshLambertMaterial({ color: 0xb7b2a8, flatShading: true });
  materials.add(boxMat);
  const boxes = [
    { pos: [3, 0.5, -1], size: [1, 1, 1] },
    { pos: [-2.2, 0.75, 1.5], size: [1.6, 1.5, 1.6] },
    { pos: [0.6, 0.4, 3.2], size: [2.2, 0.8, 0.8] },
    { pos: [-4, 1, -1.5], size: [1, 2, 1] },
  ];
  for (const box of boxes) {
    const geometry = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]);
    const mesh = new THREE.Mesh(geometry, boxMat);
    mesh.position.set(box.pos[0], box.pos[1], box.pos[2]);
    scene.add(mesh);
    geometries.add(geometry);
    createFixedCuboid(
      R,
      world,
      { x: box.pos[0], y: box.pos[1], z: box.pos[2] },
      { x: box.size[0] / 2, y: box.size[1] / 2, z: box.size[2] / 2 },
    );
  }

  const playerMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a, flatShading: true });
  const playerGeo = new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 4, 8);
  const playerMesh = new THREE.Mesh(playerGeo, playerMat);
  scene.add(playerMesh);
  geometries.add(playerGeo);
  materials.add(playerMat);

  const actor = createCharacter(R, world, PLAYER_SPAWN);
  const playerTrack = tracker.add(playerMesh, actor.body);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  const follow = createFollowCamera(camera);
  let disposed = false;

  function captureState() {
    const position = readTranslation(actor.body);
    return {
      scene: 'graybox',
      player: position,
      yaw: follow.yaw,
    };
  }

  function restoreState(state) {
    const position = state?.player ?? PLAYER_SPAWN;
    teleportBody(actor.body, position);
    actor.vy = 0;
    actor.next.x = position.x;
    actor.next.y = position.y;
    actor.next.z = position.z;
    follow.reset();
    follow.yaw = state?.yaw ?? 0;
    tracker.snap(playerTrack);
  }

  return {
    name: 'graybox',
    scene,
    camera,
    world,
    step(dtMs, ctx) {
      const dt = dtMs / 1000;
      const axes = readMoveAxes(ctx.input, ctx.settings);
      follow.addPointer(ctx.pointer.dx, ctx.settings.mouseSensitivity);
      const velocity = cameraRelativeVelocity(follow.yaw, axes.fwd, axes.strafe);
      const t0 = performance.now();
      stepCharacter(actor, velocity.x, velocity.z, dt);
      world.step();
      const stepMs = performance.now() - t0;
      tracker.snapshot();
      return stepMs;
    },
    present(alpha, frameDtMs, paused) {
      if (paused) return;
      tracker.apply(alpha);
      follow.update(playerMesh.position, frameDtMs / 1000);
    },
    captureState,
    restoreState,
    setDimmed: lights.setDimmed,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeResources(geometries, materials);
      world.free();
    },
  };
}
