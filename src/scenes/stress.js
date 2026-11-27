import * as THREE from 'three';
import {
  CAPSULE_HALF_HEIGHT,
  CAPSULE_RADIUS,
  createCharacter,
  createDynamicCuboid,
  createFixedCuboid,
  createWorld,
  readTranslation,
  stepCharacter,
  teleportBody,
} from '../physics/world.js';
import { cameraRelativeVelocity, createFollowCamera, readMoveAxes } from './follow.js';
import { createLights, createTracker, disposeResources } from './track.js';

/**
 * Peak-frame stand-in for Luke's Chromebook pass.
 *
 * One mesh is one draw call (nothing is instanced). Frustum culling is off so
 * the count does not change when the camera turns.
 *
 *   1 ground + 1 player + 6 enemies + 12 debris + 50 props = 70 draw calls
 *   props:    50 * BoxGeometry segments 9 = 50 * 972 = 48600 triangles
 *   capsules: 7 * CapsuleGeometry(0.35, 0.9, 4, 8) = 7 * 144 = 1008
 *   debris:   12 * BoxGeometry = 144
 *   ground:   2
 *   total:    49754 triangles
 *
 * Physics load named in the M0 brief: 6 kinematic capsules and 12 dynamic
 * debris bodies, plus the player capsule and a fixed ground. Prop meshes are
 * visual except the front row, which has fixed colliders so the capsule can
 * bump them. The bottom-row colliders are not extra draw calls.
 */

const PROP_COUNT = 50;
const PROP_SEGMENTS = 9;
const ENEMY_COUNT = 6;
const DEBRIS_COUNT = 12;
const PLAYER_SPAWN = { x: 0, y: 1.2, z: 8 };

export function createStressScene(R) {
  const world = createWorld(R);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121418);

  const geometries = new Set();
  const materials = new Set();
  const lights = createLights(scene);
  const tracker = createTracker();

  function addVisual(mesh) {
    mesh.frustumCulled = false;
    scene.add(mesh);
    geometries.add(mesh.geometry);
    materials.add(mesh.material);
    return mesh;
  }

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6e737a, flatShading: true });
  const ground = addVisual(new THREE.Mesh(new THREE.PlaneGeometry(48, 48), groundMat));
  ground.rotation.x = -Math.PI / 2;
  createFixedCuboid(R, world, { x: 0, y: -0.5, z: 0 }, { x: 24, y: 0.5, z: 24 });

  const propMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8, flatShading: true });
  const propGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9, PROP_SEGMENTS, PROP_SEGMENTS, PROP_SEGMENTS);
  const cols = 10;
  for (let i = 0; i < PROP_COUNT; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - (cols - 1) / 2) * 1.35;
    const y = 0.45 + r * 0.95;
    const z = -7 - r * 0.2;
    const mesh = addVisual(new THREE.Mesh(propGeo, propMat));
    mesh.position.set(x, y, z);
    if (r === 0) {
      createFixedCuboid(R, world, { x, y, z }, { x: 0.45, y: 0.45, z: 0.45 });
    }
  }

  const enemyMat = new THREE.MeshLambertMaterial({ color: 0x3fbf9a, flatShading: true });
  const capsuleGeo = new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 4, 8);
  const enemies = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const spawn = {
      x: -4 + i * 1.6,
      y: 1.2,
      z: -1.5,
    };
    const mesh = addVisual(new THREE.Mesh(capsuleGeo, enemyMat));
    const actor = createCharacter(R, world, spawn);
    const track = tracker.add(mesh, actor.body);
    enemies.push({ actor, track, spawn });
  }

  const debrisMat = new THREE.MeshLambertMaterial({ color: 0xc4b8a4, flatShading: true });
  const debrisGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const debris = [];
  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const spawn = {
      x: 5.2 + (i % 3) * 0.38,
      y: 1.2 + i * 0.36,
      z: 2.4 + Math.floor(i / 3) * 0.38,
    };
    const mesh = addVisual(new THREE.Mesh(debrisGeo, debrisMat));
    const body = createDynamicCuboid(R, world, spawn, { x: 0.16, y: 0.16, z: 0.16 });
    const track = tracker.add(mesh, body, { rotation: true });
    debris.push({ body, track, spawn });
  }

  const playerMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a, flatShading: true });
  const playerMesh = addVisual(new THREE.Mesh(capsuleGeo, playerMat));
  const player = createCharacter(R, world, PLAYER_SPAWN);
  const playerTrack = tracker.add(playerMesh, player.body);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const follow = createFollowCamera(camera);
  const scratch = { x: 0, y: 0, z: 0 };
  let elapsedMs = 0;
  let disposed = false;

  function captureState() {
    return {
      scene: 'stress',
      player: readTranslation(player.body),
      yaw: follow.yaw,
      enemies: enemies.map((enemy) => readTranslation(enemy.actor.body)),
      debris: debris.map((piece) => readTranslation(piece.body)),
    };
  }

  function placeCharacter(actor, track, position) {
    teleportBody(actor.body, position);
    actor.vy = 0;
    actor.next.x = position.x;
    actor.next.y = position.y;
    actor.next.z = position.z;
    tracker.snap(track);
  }

  function restoreState(state) {
    elapsedMs = 0;
    const playerPos = state?.player ?? PLAYER_SPAWN;
    placeCharacter(player, playerTrack, playerPos);
    follow.reset();
    follow.yaw = state?.yaw ?? 0;
    enemies.forEach((enemy, index) => {
      placeCharacter(enemy.actor, enemy.track, state?.enemies?.[index] ?? enemy.spawn);
    });
    debris.forEach((piece, index) => {
      const position = state?.debris?.[index] ?? piece.spawn;
      teleportBody(piece.body, position, { x: 0, y: 0, z: 0, w: 1 });
      tracker.snap(piece.track);
    });
  }

  return {
    name: 'stress',
    scene,
    camera,
    world,
    step(dtMs, ctx) {
      const dt = dtMs / 1000;
      elapsedMs += dtMs;
      const axes = readMoveAxes(ctx.input, ctx.settings);
      follow.addPointer(ctx.pointer.dx, ctx.settings.mouseSensitivity);
      const velocity = cameraRelativeVelocity(follow.yaw, axes.fwd, axes.strafe);
      const t0 = performance.now();
      stepCharacter(player, velocity.x, velocity.z, dt);
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const ang = elapsedMs * 0.0006 + i;
        const tx = enemy.spawn.x + Math.cos(ang) * 1.3;
        const tz = enemy.spawn.z + Math.sin(ang) * 1.3;
        const tr = enemy.actor.body.translation(scratch);
        let vx = tx - tr.x;
        let vz = tz - tr.z;
        const mag = Math.hypot(vx, vz) || 1;
        vx = (vx / mag) * 1.5;
        vz = (vz / mag) * 1.5;
        stepCharacter(enemy.actor, vx, vz, dt);
      }
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
