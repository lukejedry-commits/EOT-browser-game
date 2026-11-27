/** Screen-relative move basis, latched across a camera cut. */

export function axesMoving(axes) {
  return Math.hypot(axes?.fwd ?? 0, axes?.strafe ?? 0) > 0.2;
}

/** Sign of each axis. A new key or a reversed key is a new direction. */
export function directionKey(axes) {
  const dead = 0.2;
  const fwd = Math.abs(axes.fwd) < dead ? 0 : Math.sign(axes.fwd);
  const strafe = Math.abs(axes.strafe) < dead ? 0 : Math.sign(axes.strafe);
  return `${fwd}:${strafe}`;
}

/**
 * Basis from a camera position and look target.
 * Yaw 0 (camera on +Z looking toward the origin) gives forward -Z and right +X.
 */
export function basisFromLook(position, lookAt) {
  let x = lookAt.x - position.x;
  let z = lookAt.z - position.z;
  const len = Math.hypot(x, z) || 1;
  x /= len;
  z /= len;
  return {
    forward: { x, z },
    right: { x: -z, z: x },
  };
}

export function velocityFromBasis(basis, axes, speed) {
  return {
    x: (basis.forward.x * axes.fwd + basis.right.x * axes.strafe) * speed,
    z: (basis.forward.z * axes.fwd + basis.right.z * axes.strafe) * speed,
  };
}

/**
 * On a cut, keep the basis the player was already moving on until they
 * release the stick or change direction. That way a cut cannot reverse them.
 */
export function updateMoveLatch(latch, previousBasis, nextBasis, axes, cut) {
  const moving = axesMoving(axes);
  const direction = directionKey(axes);
  if (!moving) return { basis: nextBasis, latch: null };
  if (cut) {
    const held = latch?.basis ?? previousBasis;
    return { basis: held, latch: { basis: held, direction } };
  }
  if (latch && latch.direction === direction) {
    return { basis: latch.basis, latch };
  }
  return { basis: nextBasis, latch: null };
}
