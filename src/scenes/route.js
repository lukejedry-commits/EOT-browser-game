import * as THREE from 'three';
import { basisFromLook, updateMoveLatch, velocityFromBasis } from '../camera/basis.js';
import { aimSnap } from '../camera/aim.js';
import { fitShot, offscreenEdges, projectNdc } from '../camera/framing.js';
import { blendShots, railShot, selectZone } from '../camera/zones.js';
import { createActionResolver, axisFromKeys } from '../config/keymap.js';
import { chargeGlow } from '../config/combat.js';
import { MOVEMENT } from '../config/movement.js';
import { t } from '../core/dialogue.js';
import { sampleGamepadStick } from '../core/input.js';
import { createAirPuff } from '../fx/puff.js';
import {
  createCharacter,
  createFixedCuboid,
  createWorld,
  readTranslation,
  stepCharacter,
  teleportBody,
} from '../physics/world.js';
import {
  CEILING_Y,
  COLONNADE_GAP,
  GAP,
  GATE_PUSH_ZONE,
  GATE_TRAVEL,
  IDOL_HEIGHT,
  LORE_POINT,
  RUBBLE_VISIBLE_HEIGHT,
  SAPH_HEIGHT,
  SPAWN,
  THRESHOLD_HEIGHT,
  WEDGED_OPENING,
  ZONES,
  resolveGatePush,
} from './level-data.js';
import {
  createMotorState,
  hurtboxHeight,
  stepBodyPose,
  stepFacing,
  stepHorizontal,
  stepJump,
} from '../player/motor.js';
import { createLights, createTracker, disposeResources } from './track.js';

const RADIUS = 0.35;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function shotFor(zone, player) {
  if (!zone) return null;
  if (zone.kind === 'rail') return { ...railShot(zone.rail, player), fov: zone.fov };
  return { position: { ...zone.position }, lookAt: { ...zone.lookAt }, fov: zone.fov };
}

function quatX(angle) {
  return { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
}

export function createRoute(R, { camDebug = false } = {}) {
  const world = createWorld(R);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);
  scene.fog = new THREE.Fog(0x14161a, 22, 78);
  const geometries = new Set();
  const materials = new Set();
  const lights = createLights(scene);
  const tracker = createTracker();
  const mats = new Map();

  function material(color, standard = false) {
    const key = `${color}:${standard}`;
    if (mats.has(key)) return mats.get(key);
    const mat = standard
      ? new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true, roughness: 1 })
      : new THREE.MeshLambertMaterial({ color, flatShading: true });
    mats.set(key, mat);
    materials.add(mat);
    return mat;
  }

  function visual(w, h, d, x, y, z, color, rotX = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material(color));
    mesh.position.set(x, y, z);
    mesh.rotation.x = rotX;
    scene.add(mesh);
    geometries.add(geo);
    return mesh;
  }

  function solid(w, h, d, x, y, z, color) {
    visual(w, h, d, x, y, z, color);
    createFixedCuboid(R, world, { x, y, z }, { x: w / 2, y: h / 2, z: d / 2 });
  }

  function sensor(bounds, id) {
    const hx = (bounds.maxX - bounds.minX) / 2;
    const hy = (bounds.maxY - bounds.minY) / 2;
    const hz = (bounds.maxZ - bounds.minZ) / 2;
    const body = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2,
    ));
    world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setSensor(true), body);
    return id;
  }

  // Floors and rooms. Gameplay colliders are created beside the meshes.
  solid(8, 0.4, 10, 0, -0.2, 4, 0x4e565f);
  solid(0.4, 3.2, 10, -4, 1.6, 4, 0x3c434c);
  solid(0.4, 3.2, 10, 4, 1.6, 4, 0x3c434c);
  solid(8, 3.2, 0.4, 0, 1.6, -1, 0x3c434c);
  solid(6, 0.4, 18, 0, -0.2, 17, 0x4a525b);
  solid(0.4, 3, 18, -3, 1.5, 17, 0x3c434c);
  solid(0.4, 3, 18, 3, 1.5, 17, 0x3c434c);
  solid(4, 0.25, 1.2, 0, 0.125, 14, 0x5c656e);
  const rampAngle = 0.3;
  const ramp = visual(4, 0.3, 4, 0, 0.55, 16.2, 0x6a737c, rampAngle);
  const rampBody = world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(0, 0.55, 16.2).setRotation(quatX(rampAngle)),
  );
  world.createCollider(R.ColliderDesc.cuboid(2, 0.15, 2), rampBody);
  solid(5, 1.6, 3.2, 0, 2.1, 19.6, 0x2a3038);
  solid(16, 0.4, 6, 0, -0.2, 29, 0x465058);
  solid(16, 0.4, 7.6, 0, -0.2, 40.1, 0x465058);
  solid(28, 0.4, 18, 0, -0.2, 53, 0x4e565f);
  solid(0.6, 3, 18, -14, 1.5, 53, 0x3c434c);
  solid(0.6, 3, 18, 14, 1.5, 53, 0x3c434c);
  solid(4, 1, 4, -6, 0.5, 52, 0x6a737c);
  solid(3, 1.4, 3, 4, 0.7, 56, 0x5c656e);
  solid(28, 0.4, 24, 0, -0.2, 74, 0x465058);
  solid(28, 0.4, 20, 0, -0.2, 96, 0x3e464e);

  // Rubble: short visual, ceiling collider so a jump cannot clear it.
  visual(2.2, RUBBLE_VISIBLE_HEIGHT, 2.2, -5, RUBBLE_VISIBLE_HEIGHT / 2, 76, 0x5c5348);
  visual(0.4, 0.15, 1.4, -5, RUBBLE_VISIBLE_HEIGHT + 0.05, 76, 0xff7a1a);
  createFixedCuboid(R, world, { x: -5, y: CEILING_Y / 2, z: 76 }, { x: 1.2, y: CEILING_Y / 2, z: 1.2 });
  visual(0.8, 0.05, 6, -5, 0.03, 73, 0x2a3036);

  // Idol: sloped top, not a perch. Visual and collider are separate objects.
  const idolAngle = 0.96;
  visual(1.2, IDOL_HEIGHT, 2.4, -5, 0.7, 70, 0x6d675e, idolAngle);
  const idolBody = world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(-5, 0.7, 70).setRotation(quatX(idolAngle)),
  );
  world.createCollider(R.ColliderDesc.cuboid(0.6, IDOL_HEIGHT / 2, 1.2), idolBody);

  visual(0.4, 1.2, 0.4, 7.2, 0.6, 73, 0x8a8175);
  visual(1.1, 0.15, 1.1, 7.2, 1.25, 73, 0x8a8175);

  // Portcullis visual. The blocking collider is swapped when the gate wedges.
  const gateMesh = visual(4.2, GATE_TRAVEL, 0.5, 0, GATE_TRAVEL / 2, 81.2, 0x2c343c);
  let gateBody = null;
  let gateCollider = null;
  let wedged = false;

  function syncGate() {
    if (gateCollider) world.removeCollider(gateCollider, true);
    if (gateBody) world.removeRigidBody(gateBody);
    const minY = wedged ? WEDGED_OPENING : 0;
    const height = CEILING_Y - minY;
    gateBody = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, minY + height / 2, 81.2));
    gateCollider = world.createCollider(R.ColliderDesc.cuboid(2.1, height / 2, 0.4), gateBody);
    gateMesh.position.y = (wedged ? WEDGED_OPENING : 0) + GATE_TRAVEL / 2;
  }
  syncGate();
  createFixedCuboid(R, world, { x: -4.6, y: CEILING_Y / 2, z: 81.2 }, { x: 2.2, y: CEILING_Y / 2, z: 0.6 });
  createFixedCuboid(R, world, { x: 4.6, y: CEILING_Y / 2, z: 81.2 }, { x: 1.6, y: CEILING_Y / 2, z: 0.6 });
  solid(3.2, THRESHOLD_HEIGHT, 2.4, 8.2, THRESHOLD_HEIGHT / 2, 79.2, 0x5a534c);
  visual(0.35, 0.35, 0.35, LORE_POINT.x, LORE_POINT.y, LORE_POINT.z, 0xff7a1a);

  solid(1.4, 6, 1.4, -5, 3, 94, 0x3c434c);
  solid(1.4, 6, 1.4, 5, 3, 94, 0x3c434c);
  const saph = visual(2.4, SAPH_HEIGHT, 2.2, 0, SAPH_HEIGHT / 2, 98, 0x3fbf9a);
  createFixedCuboid(R, world, { x: 0, y: SAPH_HEIGHT / 2, z: 98 }, { x: 1.2, y: SAPH_HEIGHT / 2, z: 1.1 });

  // Surf under the colonnade gap. The lips are the floors already placed;
  // the gap itself has no floor.
  const nearLip = 32;
  const farLip = 32 + COLONNADE_GAP;
  visual(1.2, 0.2, 0.8, 0, 0.2, farLip + 0.3, 0xff7a1a);
  visual(0.3, 0.3, 1.4, 0, 0.4, (nearLip + farLip) / 2, 0x6a6258);

  for (const zone of ZONES) sensor(zone.bounds, zone.id);
  sensor(GATE_PUSH_ZONE, 'gate_push');

  if (camDebug) {
    for (const zone of ZONES) {
      const box = zone.bounds;
      const geo = new THREE.BoxGeometry(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ);
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff7a1a }));
      line.position.set((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2);
      scene.add(line);
      geometries.add(geo);
      geometries.add(edges);
    }
  }

  const actor = createCharacter(R, world, SPAWN, { radius: RADIUS, halfHeight: 0.55 });
  actor.grounded = false;
  const figure = new THREE.Group();
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.4), material(0xc47a4a));
  bodyMesh.position.y = 0.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), material(0xd8b090));
  head.position.y = 0.85;
  const glaive = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), material(0xff7a1a, true));
  glaive.position.set(0.42, 0.45, 0.1);
  figure.add(bodyMesh, head, glaive);
  geometries.add(bodyMesh.geometry);
  geometries.add(head.geometry);
  geometries.add(glaive.geometry);
  scene.add(figure);
  const playerTrack = tracker.add(figure, actor.body);
  const puff = createAirPuff();
  scene.add(puff.points);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 140);
  const actions = createActionResolver();
  const motor = createMotorState();
  let zoneId = 'cam_cell';
  let latch = null;
  let basis = basisFromLook(ZONES[0].position, ZONES[0].lookAt);
  let blendFrom = null;
  let blendMs = 0;
  let pose = shotFor(ZONES[0], SPAWN);
  let safe = { ...SPAWN };
  let simMs = 0;
  let flareMs = Infinity;
  let actionText = '';
  let disposed = false;
  const standShape = new R.Capsule(0.55, RADIUS);

  function resizeCapsule(height) {
    const half = height / 2 - RADIUS;
    if (Math.abs(half - actor.halfHeight) < 0.02) return;
    world.removeCollider(actor.collider, true);
    actor.halfHeight = half;
    actor.collider = world.createCollider(R.ColliderDesc.capsule(Math.max(0.05, half), RADIUS), actor.body);
  }

  function headroom(position) {
    const centerY = position.y - (actor.halfHeight + RADIUS) + 0.08 + 0.55 + RADIUS;
    const hit = world.intersectionWithShape(
      { x: position.x, y: centerY, z: position.z },
      IDENTITY,
      standShape,
      undefined,
      undefined,
      actor.collider,
      actor.body,
    );
    return !hit;
  }

  function applyHeight() {
    const height = hurtboxHeight(motor, MOVEMENT);
    resizeCapsule(height);
    figure.scale.y = height / MOVEMENT.standHeight;
  }

  return {
    name: 'route',
    scene,
    camera,
    world,
    get actionText() { return actionText; },
    chargeLevel() { return actions.charge01(); },
    get cameraName() { return zoneId; },
    get wedged() { return wedged; },
    get prompt() {
      const pos = readTranslation(actor.body);
      if (zoneId === 'cam_cell') return t('cell_angel_01');
      if (wedged && pos.z > 79 && pos.z < 83 && Math.abs(pos.x) < 2.4) return 'Crouch';
      const lore = Math.hypot(pos.x - LORE_POINT.x, pos.z - LORE_POINT.z);
      if (lore < 1.6 && pos.y > 1.6) return t('lore_dagon_hands');
      return '';
    },
    attackers() { return []; },
    step(dtMs, ctx) {
      simMs += dtMs;
      puff.setQuality(ctx.settings.quality);
      const resolved = actions.push(ctx.events ?? [], simMs);
      const names = resolved.filter((item) => item.action !== 'contextmenu').map((item) => item.action);
      if (names.length) actionText = names[names.length - 1];
      const jumpEdge = resolved.some((item) => item.action === 'jump');
      const dodge = resolved.some((item) => item.action === 'dodge');
      const attack = resolved.some((item) => item.action === 'light' || item.action === 'heavy' || item.action === 'wrath');
      const block = resolved.some((item) => item.action === 'block' || item.action === 'parry');
      const toggle = resolved.some((item) => item.action === 'crouch');
      const interact = resolved.some((item) => item.action === 'interact');

      let axes = axisFromKeys(ctx.input);
      if (ctx.settings.inputDevice === 'gamepad') {
        const stick = sampleGamepadStick();
        if (stick) {
          axes = { fwd: -stick.y, strafe: stick.x };
        }
      }

      const position = readTranslation(actor.body);
      const zone = selectZone(ZONES, position, zoneId) ?? ZONES[0];
      const cut = zone.id !== zoneId && zoneId != null;
      const previousShot = pose;
      if (cut) {
        blendFrom = { position: { ...previousShot.position }, lookAt: { ...previousShot.lookAt }, fov: previousShot.fov };
        blendMs = 0;
        zoneId = zone.id;
      } else {
        blendMs += dtMs;
      }
      const target = shotFor(zone, position);
      const shown = blendFrom ? blendShots(blendFrom, target, blendMs) : target;
      if (!blendFrom || shown.done) blendFrom = null;
      pose = shown.done || !blendFrom ? target : shown;

      const previousBasis = basis;
      const nextBasis = basisFromLook(target.position, target.lookAt);
      const latched = updateMoveLatch(latch, previousBasis, nextBasis, axes, cut);
      latch = latched.latch;
      basis = latched.basis;

      const room = headroom(position);
      const poseIntent = stepBodyPose(motor, {
        toggle, attack, block, dodge: dodge && motor.grounded, jump: jumpEdge, headroom: room,
      }, dtMs);
      applyHeight();
      if ((attack) && motor.grounded) {
        const wish = { x: Math.sin(motor.facing), z: Math.cos(motor.facing) };
        motor.facing = aimSnap(motor.facing, position, [], wish);
      }

      const speedBasis = velocityFromBasis(basis, axes, 1);
      stepHorizontal(motor, speedBasis.x, speedBasis.z, dtMs, MOVEMENT, actions.speedScale());
      const glow = chargeGlow(actions.charge01());
      glaive.material.color.setHex(glow);
      glaive.material.emissive.setHex(glow);
      stepFacing(motor, speedBasis.x, speedBasis.z, dtMs);
      const jumpEvents = stepJump(motor, {
        grounded: actor.grounded,
        jumpEdge: poseIntent.jump,
        posY: position.y,
        position,
        timeMs: simMs,
      }, dtMs);
      for (const jumpEvent of jumpEvents) {
        if (jumpEvent.type === 'airJump') {
          puff.play(position);
          flareMs = 0;
        }
      }

      if (motor.vy > 0) actor.controller.disableSnapToGround();
      else actor.controller.enableSnapToGround(0.28);
      if (actor.grounded && motor.vy <= 0) actor.controller.enableAutostep(MOVEMENT.stepUp, 0.2, true);
      else actor.controller.disableAutostep();

      const t0 = performance.now();
      stepCharacter(actor, motor.vx, motor.vz, dtMs / 1000, { integrateGravity: false });
      world.step();
      const stepMs = performance.now() - t0;
      tracker.snapshot();

      const landed = readTranslation(actor.body);
      const pushed = resolveGatePush({ wedged, position: landed });
      if (pushed.shoved) {
        teleportBody(actor.body, pushed.position);
        tracker.snap(playerTrack);
      }
      const inGap = landed.z > GAP.minZ && landed.z < GAP.maxZ && Math.abs(landed.x) < 4;
      if (actor.grounded && !inGap) safe = { ...landed };
      if (inGap && landed.y < GAP.killY + 0.9) {
        teleportBody(actor.body, { x: safe.x, y: 1.05, z: Math.min(safe.z, nearLip - 0.6) });
        motor.vy = 0;
        tracker.snap(playerTrack);
      }
      if (interact && Math.hypot(landed.x - 7.2, landed.z - 73) < 2.2) {
        wedged = true;
        syncGate();
      }
      if (flareMs <= 500) flareMs += dtMs;
      const flare = flareMs < 150 ? 2 : flareMs < 350 ? 2 - (flareMs - 150) / 200 : 1;
      glaive.material.emissiveIntensity = 0.55 * flare;
      puff.step(dtMs);
      figure.rotation.y = motor.facing;
      return stepMs;
    },
    present(alpha, frameDtMs, paused) {
      if (paused) return;
      tracker.apply(alpha);
      const position = figure.position;
      const zone = ZONES.find((item) => item.id === zoneId);
      let shot = pose;
      if (zone && (zone.id === 'cam_arena' || zone.id === 'cam_boss')) {
        shot = fitShot(shot, [{ ...position, y: position.y + 0.8 }], {
          aspect: camera.aspect || 16 / 9,
        });
      }
      camera.position.set(shot.position.x, shot.position.y, shot.position.z);
      camera.lookAt(shot.lookAt.x, shot.lookAt.y, shot.lookAt.z);
      camera.fov = shot.fov ?? 48;
      camera.updateProjectionMatrix();
    },
    edgeMarkers() {
      const fov = (camera.fov * Math.PI) / 180;
      return offscreenEdges(this.attackers(), (subject) => projectNdc(
        camera.position,
        pose.lookAt,
        fov,
        camera.aspect || 16 / 9,
        subject,
      ));
    },
    captureState() {
      return {
        scene: 'route',
        player: { ...SPAWN },
        facing: 0,
        wedged: false,
      };
    },
    restoreState(state) {
      const position = state?.player ?? SPAWN;
      teleportBody(actor.body, position);
      actor.vy = 0;
      motor.vx = 0;
      motor.vz = 0;
      motor.vy = 0;
      motor.facing = state?.facing ?? 0;
      motor.crouching = false;
      wedged = Boolean(state?.wedged);
      syncGate();
      applyHeight();
      tracker.snap(playerTrack);
      zoneId = 'cam_cell';
      blendFrom = null;
      latch = null;
    },
    place(position) {
      teleportBody(actor.body, position);
      actor.vy = 0;
      motor.vy = 0;
      tracker.snap(playerTrack);
      const zone = selectZone(ZONES, position, null);
      if (zone) {
        zoneId = zone.id;
        pose = shotFor(zone, position);
        blendFrom = null;
      }
    },
    setDimmed: lights.setDimmed,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeResources(geometries, materials);
      world.free();
    },
  };
}
