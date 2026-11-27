/**
 * Rapier setup. The compat build inlines WASM so GitHub Pages and a future
 * itch.io zip do not need a separate .wasm fetch.
 *
 * Gameplay gravity for later launch math is ~25 m/s². This test scene uses
 * 9.81 so the capsule and debris read as ordinary falling bodies.
 */

export const GRAVITY_Y = -9.81;
const MAX_FALL_SPEED = -25;

let rapierPromise = null;

export function loadRapier() {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (mod) => {
      const R = mod.default && typeof mod.default.init === 'function' ? mod.default : mod;
      await R.init();
      return R;
    });
  }
  return rapierPromise;
}

export function createWorld(R) {
  const world = new R.World({ x: 0, y: GRAVITY_Y, z: 0 });
  world.timestep = 1 / 60;
  return world;
}

export function createFixedCuboid(R, world, position, halfExtents) {
  const body = world.createRigidBody(
    R.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
  );
  world.createCollider(
    R.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
    body,
  );
  return body;
}

export function createDynamicCuboid(R, world, position, halfExtents) {
  const body = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setCanSleep(true),
  );
  world.createCollider(
    R.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setDensity(0.6)
      .setFriction(0.7)
      .setRestitution(0.05),
    body,
  );
  return body;
}

export const CAPSULE_RADIUS = 0.35;
export const CAPSULE_HALF_HEIGHT = 0.45;

export function createCharacter(R, world, position, opts = {}) {
  const radius = opts.radius ?? CAPSULE_RADIUS;
  const halfHeight = opts.halfHeight ?? CAPSULE_HALF_HEIGHT;
  const body = world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z),
  );
  const collider = world.createCollider(R.ColliderDesc.capsule(halfHeight, radius), body);
  const controller = world.createCharacterController(0.04);
  controller.setSlideEnabled(true);
  controller.enableSnapToGround(0.28);
  controller.enableAutostep(0.3, 0.2, true);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(80);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  return {
    body,
    collider,
    controller,
    radius,
    halfHeight,
    vy: 0,
    desired: { x: 0, y: 0, z: 0 },
    next: { x: position.x, y: position.y, z: position.z },
  };
}

/**
 * Move a kinematic capsule. `dt` is seconds.
 * Pass `{ integrateGravity: false }` when a motor already set `actor.vy`.
 */
export function stepCharacter(actor, vx, vz, dt, options = {}) {
  const integrate = options.integrateGravity !== false;
  const gravity = options.gravity ?? GRAVITY_Y;
  if (integrate) actor.vy = Math.max(MAX_FALL_SPEED, actor.vy + gravity * dt);
  else actor.vy = Math.max(MAX_FALL_SPEED, actor.vy);
  actor.desired.x = vx * dt;
  actor.desired.y = actor.vy * dt;
  actor.desired.z = vz * dt;
  actor.controller.computeColliderMovement(actor.collider, actor.desired);
  const movement = actor.controller.computedMovement();
  const mx = movement.x;
  const my = movement.y;
  const mz = movement.z;
  const translation = actor.body.translation();
  actor.next.x = translation.x + mx;
  actor.next.y = translation.y + my;
  actor.next.z = translation.z + mz;
  actor.body.setNextKinematicTranslation(actor.next);
  const grounded = actor.controller.computedGrounded();
  if (grounded && actor.vy < 0) actor.vy = 0;
  actor.grounded = grounded && actor.vy <= 0;
}

export function teleportBody(body, position, rotation) {
  body.setTranslation(position, true);
  if (rotation) body.setRotation(rotation, true);
  if (typeof body.setLinvel === 'function') body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  if (typeof body.setAngvel === 'function') body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.setNextKinematicTranslation?.(position);
}

const scratch = { x: 0, y: 0, z: 0 };

export function readTranslation(body) {
  const t = body.translation(scratch);
  return { x: t.x, y: t.y, z: t.z };
}
