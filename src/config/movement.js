/**
 * Korrath movement tunables (Mechanics, M1).
 * Jump shape is derived from apex height and time so tests and the
 * controller share one set of numbers. Autostep is grounded-only and is
 * not part of jump reach.
 */

export const MOVEMENT = {
  runSpeed: 6,
  accelTime: 0.12,
  decelTime: 0.08,
  turnSpeedDeg: 720,
  airControl: 0.6,

  jumpApex: 1.6,
  jumpApexTime: 0.35,
  fallGravityScale: 1.6,

  airJumps: 1,
  airJumpApex: 1.1,

  coyoteMs: 100,
  jumpBufferMs: 120,

  landingFall: 3,
  landingRecoverMs: 200,

  stepUp: 0.35,
  maxSlopeDeg: 45,

  standHeight: 1.8,
  crouchHeight: 1.1,
  crouchSpeed: 3,
  crawlOpening: 1.3,
  standUpMs: 100,

  dodgeMs: 450,
  dodgeSpeed: 9,
  parryMs: 150,
};

export function deriveJump(config = MOVEMENT) {
  const riseGravity = (2 * config.jumpApex) / (config.jumpApexTime * config.jumpApexTime);
  const jumpSpeed = riseGravity * config.jumpApexTime;
  const fallGravity = riseGravity * config.fallGravityScale;
  const fallTime = Math.sqrt((2 * config.jumpApex) / fallGravity);
  const singleAirtime = config.jumpApexTime + fallTime;
  const airJumpSpeed = Math.sqrt(2 * riseGravity * config.airJumpApex);
  const airRiseTime = airJumpSpeed / riseGravity;
  const maxHeight = config.jumpApex + config.airJumpApex * config.airJumps;
  const fallFromMax = Math.sqrt((2 * maxHeight) / fallGravity);
  const doubleAirtime = config.airJumps > 0
    ? config.jumpApexTime + airRiseTime + fallFromMax
    : singleAirtime;
  return {
    riseGravity,
    fallGravity,
    jumpSpeed,
    airJumpSpeed,
    fallTime,
    singleAirtime,
    airRiseTime,
    maxHeight,
    doubleAirtime,
  };
}

/** Highest a jump can reach. Step-up is excluded: autostep is off in the air. */
export function verticalReach(config = MOVEMENT, jumps = 1) {
  const derived = deriveJump(config);
  const used = Math.max(0, Math.min(jumps, 1 + config.airJumps));
  if (used <= 1) return config.jumpApex;
  return config.jumpApex + config.airJumpApex * (used - 1);
}

/**
 * Horizontal distance at full run, holding the takeoff velocity.
 * Air control scales steering, not the speed you already have.
 */
export function horizontalReach(config = MOVEMENT, jumps = 1) {
  const derived = deriveJump(config);
  const airtime = jumps <= 1 || config.airJumps < 1 ? derived.singleAirtime : derived.doubleAirtime;
  return config.runSpeed * airtime;
}

export function accelRate(config = MOVEMENT) {
  return config.runSpeed / config.accelTime;
}

export function decelRate(config = MOVEMENT) {
  return config.runSpeed / config.decelTime;
}

export function turnSpeedRad(config = MOVEMENT) {
  return (config.turnSpeedDeg * Math.PI) / 180;
}
