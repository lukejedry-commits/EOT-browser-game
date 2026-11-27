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
    fov: 58,
    position: { x: 0, y: 2.55, z: 0.45 },
    lookAt: { x: 0, y: 1.25, z: 7.4 },
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
        { x: 0, y: 2.55, z: 10.2 },
        { x: 0, y: 2.45, z: 15.2 },
        { x: 0, y: 2.7, z: 23.2 },
      ],
      look: [
        { x: 0, y: 1.2, z: 14 },
        { x: 0, y: 1.15, z: 18.5 },
        { x: 0, y: 1.15, z: 26 },
      ],
    },
  },
  {
    id: 'cam_colonnade',
    priority: 0,
    bounds: { ...Y, minX: -8, maxX: 8, minZ: 26, maxZ: 44 },
    kind: 'fixed',
    fov: 52,
    position: { x: 0, y: 3.2, z: 21.6 },
    lookAt: { x: 0, y: 1.2, z: 30 },
  },
  {
    id: 'cam_arena',
    priority: 0,
    bounds: { ...Y, maxY: 8, minX: -14, maxX: 14, minZ: 44, maxZ: 62 },
    kind: 'fixed',
    fov: 50,
    position: { x: 0, y: 3.4, z: 43.6 },
    lookAt: { x: 0, y: 1.2, z: 52 },
  },
  {
    id: 'cam_gate',
    priority: 0,
    bounds: { ...Y, maxY: 8, minX: -14, maxX: 14, minZ: 62, maxZ: 86 },
    kind: 'fixed',
    fov: 55,
    position: { x: -1.5, y: 4.8, z: 61.5 },
    lookAt: { x: 0.2, y: 1.45, z: 76 },
  },
  {
    id: 'cam_threshold',
    priority: 2,
    bounds: { ...Y, minX: 5, maxX: 12, minY: 0, maxY: 5, minZ: 74, maxZ: 82 },
    kind: 'fixed',
    fov: 46,
    position: { x: 5.4, y: 3.3, z: 67.8 },
    lookAt: { x: 5.4, y: 1.3, z: 76 },
  },
  {
    id: 'cam_boss',
    priority: 0,
    bounds: { ...Y, maxY: 8, minX: -14, maxX: 14, minZ: 86, maxZ: 106 },
    kind: 'fixed',
    fov: 46,
    position: { x: 0, y: 3.1, z: 82.6 },
    lookAt: { x: 0, y: 1.25, z: 90 },
  },
];

export const SPAWN = { x: 0, y: 1.05, z: 7.4 };

export const GAP = { minX: -4, maxX: 4, minZ: 32, maxZ: 32 + COLONNADE_GAP, killY: 0.15 };

export const LORE_POINT = { x: 8.2, y: 2.5, z: 79.2 };

/** Centers the Tide Gate wide shot has to show, with slack for each prop's own collider. */
export const GATE_SUBJECTS = [
  { id: 'gate', x: 0, y: 1.75, z: 81.2, slack: 1.2 },
  { id: 'crank', x: 7.2, y: 0.95, z: 73, slack: 0.9 },
  { id: 'idol', x: -5, y: 0.9, z: 70, slack: 1.6 },
  { id: 'drag', x: -5, y: 0.2, z: 73, slack: 0.5 },
  { id: 'rubble', x: -5, y: 1.2, z: 76, slack: 1.8 },
];

/** Corridor rail stays inside the walls and ducks under the crawl slab. */
export function corridorShot(player) {
  const z = player.z;
  let camZ = z - 8.4;
  let camY = 3.05;
  if (camZ < 8.4) camZ = 8.4;
  if (camZ > 17.2 && camZ < 21.8) {
    camZ = 16.8;
    camY = 3.4;
  }
  return {
    position: { x: 0, y: camY, z: camZ },
    lookAt: { x: 0, y: 1.2, z },
    fov: 62,
  };
}

/** Where Korrath stands when each shot is checked. Chest height is added by the sight test. */
export const ROUTE_POINTS = [
  { zone: 'cam_cell', x: 0, y: 1.05, z: 7.4 },
  { zone: 'cam_corridor', x: 0, y: 1.05, z: 15 },
  { zone: 'cam_colonnade', x: 0, y: 1.2, z: 30 },
  { zone: 'cam_arena', x: 0, y: 1.05, z: 52 },
  { zone: 'cam_gate', x: 0, y: 1.2, z: 70 },
  { zone: 'cam_threshold', x: 5.4, y: 1.2, z: 76 },
  { zone: 'cam_boss', x: 0, y: 1.05, z: 90 },
];
