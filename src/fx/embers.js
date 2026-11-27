import * as THREE from 'three';

const MOTE_COUNT = 10;
const VENT_COUNT = 9;
export const EMBER_SPRITE_COUNT = 16 + MOTE_COUNT + VENT_COUNT;

const DEEP = 0x6e1208;
const EMBER = 0xff4a1a;

/**
 * Charge motes and the vent burst share one draw call.
 * Colors stay deep orange-red. Nothing here is white.
 */
export function createEmberCloud() {
  const count = MOTE_COUNT + VENT_COUNT;
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: EMBER,
    size: 0.11,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  let motes = 0;
  let ventAge = Infinity;
  let origin = { x: 0, y: 1, z: 0 };

  function writeMotes(attr, level) {
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      if (i >= motes) {
        attr.setXYZ(i, origin.x, origin.y, origin.z);
        continue;
      }
      const ang = (i / MOTE_COUNT) * Math.PI * 2 + level * 4;
      const radius = 0.18 + (i % 3) * 0.08;
      attr.setXYZ(
        i,
        origin.x + Math.cos(ang) * radius,
        origin.y + 0.35 + Math.sin(ang * 2) * 0.12,
        origin.z + Math.sin(ang) * radius,
      );
    }
  }

  return {
    points,
    spriteCount: count,
    setOrigin(position) {
      origin = { x: position.x, y: position.y, z: position.z };
    },
    setMotes(level) {
      motes = level > 0.02 ? MOTE_COUNT : 0;
      if (motes > 0) points.visible = true;
    },
    playVent(position) {
      origin = { x: position.x, y: position.y + 0.4, z: position.z };
      ventAge = 0;
      points.visible = true;
      material.color.setHex(EMBER);
    },
    step(dtMs) {
      const attr = geometry.attributes.position;
      const charging = motes > 0;
      const venting = ventAge <= 420;
      if (!charging && !venting) {
        points.visible = false;
        material.opacity = 0;
        return;
      }
      points.visible = true;
      writeMotes(attr, venting ? ventAge / 420 : 0.4);
      if (venting) {
        ventAge += dtMs;
        const t = Math.min(1, ventAge / 420);
        for (let i = 0; i < VENT_COUNT; i += 1) {
          const ang = (i / VENT_COUNT) * Math.PI * 2;
          const radius = 0.12 + t * 1.15;
          const lift = t * 0.85 + (i % 2) * 0.15;
          attr.setXYZ(
            MOTE_COUNT + i,
            origin.x + Math.cos(ang) * radius,
            origin.y + lift,
            origin.z + Math.sin(ang) * radius,
          );
        }
        material.opacity = 1 - t * 0.85;
        material.color.setHex(t < 0.55 ? EMBER : DEEP);
      } else {
        for (let i = 0; i < VENT_COUNT; i += 1) attr.setXYZ(MOTE_COUNT + i, origin.x, origin.y, origin.z);
        material.opacity = 0.85;
        material.color.setHex(EMBER);
      }
      attr.needsUpdate = true;
    },
  };
}
