/** Graybox measures. Colliders are authored here, separate from the meshes. */

export const CEILING_Y = 6;
export const RUBBLE_VISIBLE_HEIGHT = 2.2;
export const GATE_TRAVEL = 3.5;
export const IDOL_HEIGHT = 1.4;
export const WEDGED_OPENING = IDOL_HEIGHT;
export const COLONNADE_GAP = 4.25;
export const THRESHOLD_HEIGHT = 2.2;
export const SAPH_HEIGHT = 4.5;

/** Under the portcullis. Active only while the gate is not wedged. */
export const GATE_PUSH_ZONE = {
  minX: -2.2,
  maxX: 2.2,
  minY: 0,
  maxY: 2.2,
  minZ: 80.2,
  maxZ: 82.4,
};

export const GATE_PUSH_SAFE = { x: 0, z: 78.4 };

export const TIDE_BLOCKERS = [
  { id: 'rubble', maxY: CEILING_Y, visibleHeight: RUBBLE_VISIBLE_HEIGHT },
  { id: 'portcullis', maxY: CEILING_Y, visibleHeight: GATE_TRAVEL },
  { id: 'gate_jamb', maxY: CEILING_Y, visibleHeight: 2.2 },
];

export function pushZoneEnabled(wedged) {
  return !wedged;
}

export function containsZone(zone, point) {
  return point.x >= zone.minX && point.x <= zone.maxX
    && point.y >= zone.minY && point.y <= zone.maxY
    && point.z >= zone.minZ && point.z <= zone.maxZ;
}

/** Shove Korrath back to the room side. No damage. The gate keeps falling. */
export function resolveGatePush({ wedged, position }) {
  if (!pushZoneEnabled(wedged)) return { shoved: false, position };
  if (!containsZone(GATE_PUSH_ZONE, position)) return { shoved: false, position };
  return {
    shoved: true,
    position: { x: GATE_PUSH_SAFE.x, y: position.y, z: GATE_PUSH_SAFE.z },
  };
}

export function wedgedOpening(wedged) {
  return wedged ? WEDGED_OPENING : 0;
}

export function canCrawlOpening(capsuleHeight, wedged = true) {
  const opening = wedgedOpening(wedged);
  return opening >= 1.3 && capsuleHeight <= opening;
}

const Y = { minY: 0, maxY: 6 };

export const ZONES = [
  {
    id: 'cam_cell',
    priority: 0,
    bounds: { ...Y, minX: -4, maxX: 4, minZ: -1, maxZ: 9 },
    kind: 'fixed',
    fov: 46,
    position: { x: 4.8, y: 3.2, z: -0.4 },
    lookAt: { x: -0.4, y: 1.2, z: 5 },
  },
  {
    id: 'cam_corridor',
    priority: 0,
    bounds: { ...Y, minX: -3, maxX: 3, minZ: 9, maxZ: 26 },
    kind: 'rail',
    fov: 48,
    rail: {
      axis: 'z',
      start: 9,
      end: 26,
      points: [
        { x: 3.4, y: 3.3, z: 10 },
        { x: 3.6, y: 3.6, z: 18 },
        { x: 3.2, y: 3.4, z: 25 },
      ],
      look: [
        { x: 0, y: 1.3, z: 14 },
        { x: 0, y: 1.3, z: 22 },
        { x: 0, y: 1.2, z: 29 },
      ],
    },
  },
  {
    id: 'cam_colonnade',
    priority: 0,
    bounds: { ...Y, minX: -8, maxX: 8, minZ: 26, maxZ: 44 },
    kind: 'fixed',
    fov: 52,
    position: { x: 11, y: 6.2, z: 34.1 },
    lookAt: { x: 0, y: 1.1, z: 34.1 },
  },
  {
    id: 'cam_arena',
    priority: 0,
    bounds: { ...Y, maxY: 8, minX: -14, maxX: 14, minZ: 44, maxZ: 62 },
    kind: 'fixed',
    fov: 50,
    position: { x: 13, y: 9.5, z: 46 },
    lookAt: { x: -1, y: 1.2, z: 54 },
  },
  {
    id: 'cam_gate',
    priority: 0,
    bounds: { ...Y, maxY: 8, minX: -14, maxX: 14, minZ: 62, maxZ: 86 },
    kind: 'fixed',
    fov: 48,
    position: { x: 0.5, y: 8.5, z: 63 },
    lookAt: { x: 1, y: 2, z: 78 },
  },
  {
    id: 'cam_threshold',
    priority: 2,
    bounds: { ...Y, minX: 5, maxX: 12, minY: 0, maxY: 5, minZ: 74, maxZ: 82 },
    kind: 'fixed',
    fov: 46,
    position: { x: 2, y: 3.4, z: 72 },
    lookAt: { x: 8.2, y: 2.4, z: 79 },
  },
  {
    id: 'cam_boss',
    priority: 0,
    bounds: { ...Y, maxY: 8, minX: -14, maxX: 14, minZ: 86, maxZ: 106 },
    kind: 'fixed',
    fov: 46,
    position: { x: 0, y: 2.5, z: 88 },
    lookAt: { x: 0, y: 2.6, z: 98 },
  },
];

export const SPAWN = { x: 0, y: 1.05, z: 2 };

export const GAP = { minX: -4, maxX: 4, minZ: 32, maxZ: 32 + COLONNADE_GAP, killY: 0.15 };

export const LORE_POINT = { x: 8.2, y: 2.5, z: 79.2 };
