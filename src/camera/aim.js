/** Soft attack aim. No combat calls this yet; attacks will. */

export const AIM_MAX_ANGLE = Math.PI / 4;
export const AIM_MAX_DISTANCE = 4;

export function wrapAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function yawToward(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/**
 * Snap `facing` at most 45° toward the nearest enemy within 4 m of the aim
 * direction. Aim direction is the stick, or `facing` when there is no input.
 * Enemies outside that cone are ignored.
 */
export function aimSnap(facing, origin, enemies, aimDir) {
  const aimYaw = aimDir && Math.hypot(aimDir.x ?? 0, aimDir.z ?? 0) > 1e-4
    ? Math.atan2(aimDir.x, aimDir.z)
    : facing;
  let bestYaw = null;
  let bestDist = AIM_MAX_DISTANCE;
  for (const enemy of enemies) {
    const dx = enemy.x - origin.x;
    const dz = enemy.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > AIM_MAX_DISTANCE || dist < 1e-4) continue;
    const yaw = Math.atan2(dx, dz);
    if (Math.abs(wrapAngle(yaw - aimYaw)) > AIM_MAX_ANGLE + 1e-6) continue;
    if (dist < bestDist) {
      bestDist = dist;
      bestYaw = yaw;
    }
  }
  if (bestYaw == null) return facing;
  const turn = wrapAngle(bestYaw - facing);
  const clamped = Math.max(-AIM_MAX_ANGLE, Math.min(AIM_MAX_ANGLE, turn));
  return wrapAngle(facing + clamped);
}
