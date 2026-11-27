import * as THREE from 'three';
import { basisFromLook, updateMoveLatch, velocityFromBasis } from '../camera/basis.js';
import { aimSnap } from '../camera/aim.js';
import { fitShot, offscreenEdges, projectNdc } from '../camera/framing.js';
import { blendShots, railShot, selectZone } from '../camera/zones.js';
import { KEYMAP, createActionResolver, axisFromKeys } from '../config/keymap.js';
import { createSubtitleState, requestBark, stepHint, stepSubtitles } from '../config/subtitles.js';
import { chargeGlow, createCombatClock } from '../config/combat.js';
import { LIGHTING } from '../config/lighting.js';
import { MOVEMENT } from '../config/movement.js';
import { t } from '../core/dialogue.js';
import { sampleGamepadStick } from '../core/input.js';
import { createAirPuff } from '../fx/puff.js';
import { createEmberCloud } from '../fx/embers.js';
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
  cellShot,
  corridorShot,
  GAP,
  GATE_PUSH_ZONE,
  GATE_TRAVEL,
  holdFixedShot,
  IDOL_HEIGHT,
  LORE_POINT,
  ROUTE_POINTS,
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
import { createVentState, startVent, stepVent, ventAllowsRoll, ventBlocksCombat, ventSpeedScale } from '../player/vent.js';
import { createLights, createTracker, disposeResources } from './track.js';

const RADIUS = 0.35;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

function shotFor(zone, player) {
  if (!zone) return null;
  if (zone.id === 'cam_cell') return cellShot(player);
  if (zone.kind === 'rail') return corridorShot(player);
  const anchor = ROUTE_POINTS.find((point) => point.zone === zone.id);
  return holdFixedShot(zone, player, anchor);
}

function quatX(angle) {
  return { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) };
}

export function createRoute(R, { camDebug = false, unlockedChargeTier = 1 } = {}) {
  const world = createWorld(R);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LIGHTING.background);
  scene.fog = new THREE.Fog(LIGHTING.background, LIGHTING.fogNear, LIGHTING.fogFar);
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
  // Shallow visual wedge. The old tilted box faced the player as a wall and
  // stopped him on the 0.25 m step, which is under the 0.35 m step-up.
  const rampAngle = -0.1;
  visual(3.2, 0.16, 2.2, 0, 0.12, 15.5, 0x6a737c, rampAngle);
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
  visual(0.55, 0.42, 0.48, LORE_POINT.x - 0.85, THRESHOLD_HEIGHT + 0.21, LORE_POINT.z, 0x6d675e);

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
  figure.name = 'korrath';
  figure.frustumCulled = false;
  figure.traverse((child) => {
    child.frustumCulled = false;
  });
  scene.add(figure);
  const playerTrack = tracker.add(figure, actor.body);
  const puff = createAirPuff();
  const cloud = createEmberCloud();
  scene.add(puff.points, cloud.points);
  geometries.add(puff.points.geometry);
  geometries.add(cloud.points.geometry);
  materials.add(puff.points.material);
  materials.add(cloud.points.material);

  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 140);
  const motor = createMotorState();
  motor.unlockedChargeTier = unlockedChargeTier === 2 || unlockedChargeTier === 3
    ? unlockedChargeTier
    : 1;
  const actions = createActionResolver(KEYMAP, () => motor.unlockedChargeTier);
  const combat = createCombatClock();
  const vent = createVentState();
  const subtitles = createSubtitleState();
  let subtitle = { id: null, opacity: 0, light: 0 };
  let hintMoveMs = 0;
  let hintOpacity = 1;
  const debugLines = [];
  lights.setZone('cam_cell');
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
    get unlockedChargeTier() { return motor.unlockedChargeTier; },
    get wedged() { return wedged; },
    get prompt() {
      if (subtitle.id) return t(subtitle.id);
      const pos = readTranslation(actor.body);
      if (wedged && pos.z > 79 && pos.z < 83 && Math.abs(pos.x) < 2.4) return 'Crouch';
      const lore = Math.hypot(pos.x - LORE_POINT.x, pos.z - LORE_POINT.z);
      if (lore < 1.6 && pos.y > 1.6) return t('lore_dagon_hands');
      return '';
    },
    get subtitleOpacity() { return subtitle.opacity; },
    get hintOpacity() { return hintOpacity; },
    get debugLines() { return debugLines; },
    attackers() { return []; },
    step(dtMs, ctx) {
      simMs += dtMs;
      subtitle = stepSubtitles(subtitles, dtMs);
      stepVent(vent, dtMs);
      const moving = Math.hypot(motor.vx, motor.vz) > 0.45;
      const hintState = stepHint(hintMoveMs, moving, dtMs);
      hintMoveMs = hintState.moveMs;
      hintOpacity = hintState.opacity;
      puff.setQuality(ctx.settings.quality);
      const resolved = actions.push(ctx.events ?? [], simMs);
      const ventEvent = resolved.find((item) => item.type === 'emberVent');
      if (ventEvent && startVent(vent, ventEvent.tier)) {
        debugLines.push(`emberVent tier=${ventEvent.tier} duration=${ventEvent.duration}`);
        if (debugLines.length > 6) debugLines.shift();
        if (ventEvent.tier >= 2) requestBark(subtitles, 'bark_ember_vent');
        cloud.playVent(readTranslation(actor.body));
      }
      const locked = ventBlocksCombat(vent);
      const names = resolved.filter((item) => item.action !== 'contextmenu').map((item) => item.action);
      if (names.length) actionText = names[names.length - 1];
      const jumpEdge = resolved.some((item) => item.action === 'jump');
      const dodge = resolved.some((item) => item.action === 'dodge') && ventAllowsRoll(vent);
      const heavy = resolved.find((item) => item.action === 'heavy');
      const attack = !locked && resolved.some((item) => item.action === 'light' || item.action === 'heavy' || item.action === 'wrath');
      const block = !locked && resolved.some((item) => item.action === 'block' || item.action === 'parry');
      if (!locked && resolved.some((item) => item.action === 'light')) combat.startLight();
      if (!locked && heavy) combat.startHeavy((heavy.chargeMs ?? 0) > 0);
      if (!locked && resolved.some((item) => item.action === 'parry')) combat.startParry();
      if (!locked && resolved.some((item) => item.action === 'interact')) combat.startGrab();
      combat.step(dtMs);
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
        lights.setZone(zone.id);
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
      stepHorizontal(motor, speedBasis.x, speedBasis.z, dtMs, MOVEMENT, actions.speedScale() * ventSpeedScale(vent));
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
          combat.startAirKick();
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
      glaive.material.emissiveIntensity = 0.55 * flare * (vent.active ? 0.5 : 1);
      lights.step(dtMs, subtitle.light);
      puff.step(dtMs);
      cloud.setOrigin(position);
      cloud.setMotes(actions.charging() ? Math.max(actions.charge01(), 0.15) : 0);
      cloud.step(dtMs);
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
      lights.aim(camera.position, figure.position);
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
        player: {
          ...readTranslation(actor.body),
          unlockedChargeTier: motor.unlockedChargeTier,
        },
        facing: motor.facing,
        wedged,
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
      const savedTier = state?.player?.unlockedChargeTier;
      if (savedTier === 1 || savedTier === 2 || savedTier === 3) motor.unlockedChargeTier = savedTier;
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
