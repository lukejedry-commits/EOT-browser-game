/** Camera zone pick and the 0.5 s blend between shots. */

export const CAMERA_BLEND_MS = 500;

export function zoneContains(zone, point) {
  const box = zone.bounds;
  return point.x >= box.minX && point.x <= box.maxX
    && point.y >= box.minY && point.y <= box.maxY
    && point.z >= box.minZ && point.z <= box.maxZ;
}

/**
 * Stay in the current zone while it still contains the point, unless a
 * higher-priority zone also contains it. Empty space keeps the last zone.
 */
export function selectZone(zones, point, currentId) {
  const hits = zones.filter((zone) => zoneContains(zone, point));
  if (hits.length === 0) {
    return zones.find((zone) => zone.id === currentId) ?? null;
  }
  hits.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const current = hits.find((zone) => zone.id === currentId);
  const best = hits[0];
  if (current && (best.priority ?? 0) <= (current.priority ?? 0)) return current;
  return best;
}

export function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function lerp3(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function blendShots(from, to, elapsedMs, durationMs = CAMERA_BLEND_MS) {
  const raw = durationMs <= 0 ? 1 : elapsedMs / durationMs;
  const t = smoothstep(raw);
  return {
    position: lerp3(from.position, to.position, t),
    lookAt: lerp3(from.lookAt, to.lookAt, t),
    fov: from.fov + ((to.fov ?? from.fov) - from.fov) * t,
    t,
    done: elapsedMs >= durationMs,
  };
}

function samplePolyline(points, s) {
  if (points.length === 1) return points[0];
  const span = Math.max(1, points.length - 1);
  const scaled = Math.min(span, Math.max(0, s * span));
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return lerp3(points[index], points[index + 1], local);
}

/** `s` is 0..1 along the rail's player axis (z, unless `axis` is x). */
export function railProgress(rail, player) {
  const axis = rail.axis ?? 'z';
  const span = rail.end - rail.start || 1;
  return Math.min(1, Math.max(0, (player[axis] - rail.start) / span));
}

export function railShot(rail, player) {
  const s = railProgress(rail, player);
  return {
    position: samplePolyline(rail.points, s),
    lookAt: samplePolyline(rail.look, s),
    fov: rail.fov ?? 48,
  };
}
