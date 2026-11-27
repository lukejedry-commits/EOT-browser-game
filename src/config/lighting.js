/**
 * One lighting rig for the whole route. Zone moods blend into it.
 * Hemisphere ground color and intensity are fixed so Korrath stays readable.
 * At most two point lights. The key is a cool rim aimed from the camera.
 * Ember light belongs on the Glaive, not on his body.
 */

export const LIGHTING = {
  background: 0x1c222b,
  fogNear: 8,
  fogFar: 30,
  blendMs: 400,
  hemiSky: 0xa8b6c8,
  hemiGround: 0x3a3f4a,
  hemiIntensity: 0.6,
  rim: 0xc5d2e0,
  pointBudget: 2,
  zones: {
    cam_cell: {
      sky: 0x6e7d92,
      key: 0xb9c8da,
      keyIntensity: 0.42,
      points: [
        { color: 0xd7e6f6, intensity: 2.4, x: -2.4, y: 3.5, z: 1.6, distance: 11 },
        { color: 0xfff4d2, intensity: 5.5, x: 0, y: 3.1, z: 4.2, distance: 18, angel: true },
      ],
    },
    cam_corridor: {
      sky: 0x9eb4cc,
      key: 0x8eabc4,
      keyIntensity: 1.25,
      points: [
        { color: 0x7f9cba, intensity: 2.2, x: 0, y: 3.2, z: 12, distance: 20 },
        { color: 0x6e90b0, intensity: 1.6, x: 0, y: 2.8, z: 22, distance: 18 },
      ],
    },
    cam_colonnade: {
      sky: 0x93a9c2,
      key: 0x89a0ba,
      keyIntensity: 0.8,
      points: [
        { color: 0x7893b0, intensity: 1.3, x: 0, y: 3.4, z: 28, distance: 18 },
        { color: 0x6a86a6, intensity: 1.0, x: 0, y: 3.2, z: 38, distance: 16 },
      ],
    },
    cam_arena: {
      sky: 0x8ea3bc,
      key: 0x849cb6,
      keyIntensity: 0.85,
      points: [
        { color: 0x738eac, intensity: 1.4, x: -4, y: 3.6, z: 50, distance: 20 },
        { color: 0x6884a4, intensity: 1.1, x: 4, y: 3.4, z: 56, distance: 18 },
      ],
    },
    cam_gate: {
      sky: 0x879eb8,
      key: 0x7d96b2,
      keyIntensity: 0.8,
      points: [
        { color: 0x6c87a6, intensity: 1.3, x: -2, y: 3.8, z: 68, distance: 22 },
        { color: 0x6280a0, intensity: 1.05, x: 3, y: 3.2, z: 78, distance: 18 },
      ],
    },
    cam_threshold: {
      sky: 0x849ab4,
      key: 0x7a94b0,
      keyIntensity: 0.75,
      points: [
        { color: 0x6884a4, intensity: 1.2, x: 6, y: 3.4, z: 74, distance: 14 },
        { color: 0x5e7c9c, intensity: 0.9, x: 8, y: 2.8, z: 80, distance: 12 },
      ],
    },
    cam_boss: {
      sky: 0x7e96b0,
      key: 0x7690ac,
      keyIntensity: 0.7,
      points: [
        { color: 0x64809e, intensity: 1.2, x: -3, y: 3.6, z: 88, distance: 18 },
        { color: 0x5a7896, intensity: 1.0, x: 3, y: 3.4, z: 96, distance: 16 },
      ],
    },
  },
};

export function zoneLight(id, config = LIGHTING) {
  return config.zones[id] ?? config.zones.cam_corridor;
}
