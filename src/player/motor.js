import {
  MOVEMENT,
  accelRate,
  decelRate,
  deriveJump,
  turnSpeedRad,
} from '../config/movement.js';
import { wrapAngle } from '../camera/aim.js';

export function createMotorState() {
  return {
    vx: 0,
    vz: 0,
    vy: 0,
    facing: 0,
    grounded: true,
    coyoteMs: 0,
    bufferMs: Infinity,
    jumpsUsed: 0,
    airJumpsLeft: 0,
    peakY: 0,
    recoverMs: 0,
    crouching: false,
    unlockedChargeTier: 1,
    standMs: 0,
    dodgeMs: 0,
    blockMs: 0,
    blocking: false,
  };
}

function approach(current, target, rate, dt) {
  const delta = target - current;
  const step = rate * dt;
  if (Math.abs(delta) <= step) return target;
  return current + Math.sign(delta) * step;
}

export function stepHorizontal(state, wishX, wishZ, dtMs, config = MOVEMENT, speedScale = 1) {
  const dt = dtMs / 1000;
  const recovering = state.recoverMs > 0;
  let maxSpeed = config.runSpeed;
  if (state.crouching && state.grounded) maxSpeed = config.crouchSpeed;
  maxSpeed *= speedScale;
  if (recovering) maxSpeed = 0;
  const wishMag = Math.hypot(wishX, wishZ);
  const accel = accelRate(config) * (state.grounded ? 1 : config.airControl);
  const decel = decelRate(config);
  let targetX = 0;
  let targetZ = 0;
  if (wishMag > 1e-4 && maxSpeed > 0) {
    targetX = (wishX / wishMag) * maxSpeed;
    targetZ = (wishZ / wishMag) * maxSpeed;
  }
  const rate = wishMag > 1e-4 && maxSpeed > 0 ? accel : decel;
  state.vx = approach(state.vx, targetX, rate, dt);
  state.vz = approach(state.vz, targetZ, rate, dt);
  if (state.dodgeMs > 0) {
    const facingX = Math.sin(state.facing);
    const facingZ = Math.cos(state.facing);
    state.vx = facingX * config.dodgeSpeed;
    state.vz = facingZ * config.dodgeSpeed;
    state.dodgeMs = Math.max(0, state.dodgeMs - dtMs);
  }
  return state;
}

export function stepFacing(state, wishX, wishZ, dtMs, config = MOVEMENT) {
  const mag = Math.hypot(wishX, wishZ);
  if (mag < 0.05 || state.dodgeMs > 0) return state.facing;
  const target = Math.atan2(wishX, wishZ);
  const delta = wrapAngle(target - state.facing);
  const maxStep = turnSpeedRad(config) * (dtMs / 1000);
  const step = Math.max(-maxStep, Math.min(maxStep, delta));
  state.facing = wrapAngle(state.facing + step);
  return state.facing;
}

/** Capsule / hurtbox height. A roll uses the crouch capsule the whole way. */
export function hurtboxHeight(state, config = MOVEMENT) {
  if (state.dodgeMs > 0 || state.crouching) return config.crouchHeight;
  return config.standHeight;
}

/**
 * Crouch, the 0.1 s stand-up from attack / block / roll, and Space-from-crouch.
 * `headroom` is false under a ceiling that the standing capsule cannot enter.
 * Space stands and jumps in the same press. Attack, block, and roll wait
 * `standUpMs` before the capsule grows, and a roll keeps the low hurtbox
 * until the roll ends.
 */
export function stepBodyPose(state, intent, dtMs, config = MOVEMENT) {
  const headroom = intent.headroom !== false;
  let jump = false;
  if (intent.dodge && state.grounded && state.dodgeMs <= 0) {
    state.dodgeMs = config.dodgeMs;
    if (state.crouching) state.standMs = config.standUpMs;
  }
  if ((intent.attack || intent.block) && state.crouching && state.standMs <= 0) {
    state.standMs = config.standUpMs;
  }
  if (intent.jump && state.dodgeMs <= 0) {
    if (state.crouching) {
      if (headroom) {
        state.crouching = false;
        state.standMs = 0;
        jump = true;
      }
    } else {
      jump = true;
    }
  }
  if (intent.toggle && !state.crouching && state.dodgeMs <= 0) {
    state.crouching = true;
    state.standMs = 0;
  }
  if (state.standMs > 0) {
    state.standMs = Math.max(0, state.standMs - dtMs);
    if (state.standMs === 0 && headroom) state.crouching = false;
  }
  return { jump };
}

/**
 * Jump / coyote / buffer / double jump. Times are milliseconds.
 * Walking off a ledge and jumping inside the coyote window is the ground
 * jump. The air jump is only the later press, and it resets vertical speed.
 */
export function stepJump(state, { grounded, jumpEdge, posY, position, timeMs }, dtMs, config = MOVEMENT) {
  const derived = deriveJump(config);
  const events = [];
  const wasGrounded = state.grounded;
  state.grounded = grounded;

  if (grounded) {
    state.coyoteMs = 0;
    if (!wasGrounded) {
      const drop = state.peakY - posY;
      if (drop > config.landingFall) state.recoverMs = config.landingRecoverMs;
      state.jumpsUsed = 0;
      state.airJumpsLeft = 0;
      if (state.vy < 0) state.vy = 0;
    }
    state.peakY = posY;
  } else if (wasGrounded) {
    state.coyoteMs = dtMs;
    state.peakY = Math.max(state.peakY, posY);
  } else {
    state.coyoteMs += dtMs;
    if (posY > state.peakY) state.peakY = posY;
  }

  if (jumpEdge) state.bufferMs = 0;
  else if (state.bufferMs < Infinity) state.bufferMs += dtMs;

  const buffered = state.bufferMs <= config.jumpBufferMs;
  const coyote = state.coyoteMs <= config.coyoteMs;

  if (buffered && state.jumpsUsed === 0 && (grounded || coyote)) {
    state.vy = derived.jumpSpeed;
    state.jumpsUsed = 1;
    state.airJumpsLeft = config.airJumps;
    state.bufferMs = Infinity;
    state.coyoteMs = Infinity;
    state.grounded = false;
    events.push({ type: 'jump', position, time: timeMs });
  } else if (jumpEdge && !grounded && state.jumpsUsed >= 1 && state.airJumpsLeft > 0) {
    state.vy = derived.airJumpSpeed;
    state.airJumpsLeft -= 1;
    state.bufferMs = Infinity;
    events.push({ type: 'airJump', position, time: timeMs });
  }

  if (!(state.grounded && state.vy <= 0)) {
    const gravity = state.vy > 0 ? derived.riseGravity : derived.fallGravity;
    state.vy -= gravity * (dtMs / 1000);
  }
  if (state.recoverMs > 0) state.recoverMs = Math.max(0, state.recoverMs - dtMs);
  return events;
}

export function startDodge(state, config = MOVEMENT) {
  state.dodgeMs = config.dodgeMs;
}

export function noteBlock(state, down, dtMs) {
  if (down) {
    state.blocking = true;
    state.blockMs += dtMs;
  } else {
    state.blocking = false;
    state.blockMs = 0;
  }
}
