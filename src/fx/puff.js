import * as THREE from 'three';

const LIFE_MS = 350;
const COUNT = 16;

/** One draw call. No light and no camera shake. */
export function createAirPuff() {
  const positions = new Float32Array(COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xff7a1a,
    size: 0.14,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  let age = Infinity;
  let origin = { x: 0, y: 0, z: 0 };
  let count = COUNT;

  return {
    points,
    setQuality(quality) {
      count = quality === 'low' ? 8 : COUNT;
      geometry.setDrawRange(0, count);
    },
    play(position) {
      origin = { x: position.x, y: position.y - 0.2, z: position.z };
      age = 0;
      points.visible = true;
      material.opacity = 1;
    },
    step(dtMs) {
      if (age > LIFE_MS) {
        points.visible = false;
        return;
      }
      age += dtMs;
      const t = Math.min(1, age / LIFE_MS);
      const attr = geometry.attributes.position;
      for (let i = 0; i < count; i += 1) {
        const ang = (i / count) * Math.PI * 2;
        const radius = 0.08 + t * 0.6;
        attr.setXYZ(
          i,
          origin.x + Math.cos(ang) * radius,
          origin.y + t * 0.15,
          origin.z + Math.sin(ang) * radius,
        );
      }
      attr.needsUpdate = true;
      material.opacity = 1 - t;
      material.color.set(t < 0.5 ? 0xff7a1a : 0xffb060);
    },
  };
}
