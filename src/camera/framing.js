/**
 * Arena framing and the off-screen attacker arrow.
 * M1 has no enemies; the arrow list stays empty until M2.
 */

export function cameraAxes(position, lookAt, fovY, aspect) {
  let fx = lookAt.x - position.x;
  let fy = lookAt.y - position.y;
  let fz = lookAt.z - position.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = ryCross(fx, fy, fz, rx, 0, rz);
  return {
    forward: { x: fx, y: fy, z: fz },
    right: { x: rx, y: 0, z: rz },
    up: ux,
    fovY,
    aspect,
  };
}

function ryCross(fx, fy, fz, rx, ry, rz) {
  return {
    x: fy * rz - fz * ry,
    y: fz * rx - fx * rz,
    z: fx * ry - fy * rx,
  };
}

/** Normalized device coordinates. `behind` is true when the point is back of the camera. */
export function projectNdc(position, lookAt, fovY, aspect, point) {
  const axes = cameraAxes(position, lookAt, fovY, aspect);
  const dx = point.x - position.x;
  const dy = point.y - position.y;
  const dz = point.z - position.z;
  const z = dx * axes.forward.x + dy * axes.forward.y + dz * axes.forward.z;
  const x = dx * axes.right.x + dy * axes.right.y + dz * axes.right.z;
  const y = dx * axes.up.x + dy * axes.up.y + dz * axes.up.z;
  const tan = Math.tan(fovY / 2);
  return {
    ndcX: z <= 0.05 ? Math.sign(x || 1) * 2 : x / (z * tan * aspect),
    ndcY: z <= 0.05 ? Math.sign(y || 1) * 2 : y / (z * tan),
    behind: z <= 0.05,
  };
}

/**
 * Markers for subjects outside the frame. `margin` is the hero's inset
 * (0.1 = 10%); arrows themselves sit on the screen edge.
 */
export function offscreenEdges(subjects, project, margin = 0.1) {
  const markers = [];
  for (const subject of subjects) {
    const projected = project(subject);
    if (!projected) continue;
    const outside = projected.behind
      || Math.abs(projected.ndcX) > 1
      || Math.abs(projected.ndcY) > 1;
    if (!outside) continue;
    const ndcX = Math.max(-1, Math.min(1, projected.ndcX));
    const ndcY = Math.max(-1, Math.min(1, projected.ndcY));
    let edge = 'right';
    if (Math.abs(projected.ndcX) > Math.abs(projected.ndcY)) {
      edge = projected.ndcX < 0 ? 'left' : 'right';
    } else {
      edge = projected.ndcY < 0 ? 'bottom' : 'top';
    }
    markers.push({
      id: subject.id,
      edge,
      x: (ndcX * 0.5 + 0.5) * (1 - margin * 2) + margin,
      y: (1 - (ndcY * 0.5 + 0.5)) * (1 - margin * 2) + margin,
    });
  }
  return markers;
}

/** Pull a fixed camera back along its view until every subject is inside the margin. */
export function fitShot(shot, subjects, { aspect = 16 / 9, margin = 0.1, maxPull = 12 } = {}) {
  const fov = (shot.fov ?? 50) * (Math.PI / 180);
  let position = { ...shot.position };
  const lookAt = shot.lookAt;
  for (let step = 0; step < 8; step += 1) {
    let needs = 0;
    for (const subject of subjects) {
      const projected = projectNdc(position, lookAt, fov, aspect, subject);
      const limit = 1 - margin * 2;
      if (projected.behind || Math.abs(projected.ndcX) > limit || Math.abs(projected.ndcY) > limit) {
        needs = 1;
        break;
      }
    }
    if (!needs) break;
    const dx = position.x - lookAt.x;
    const dy = position.y - lookAt.y;
    const dz = position.z - lookAt.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const pull = Math.min(1.5, maxPull / 8);
    position = {
      x: position.x + (dx / len) * pull,
      y: position.y + (dy / len) * pull,
      z: position.z + (dz / len) * pull,
    };
  }
  return { position, lookAt, fov: shot.fov };
}
