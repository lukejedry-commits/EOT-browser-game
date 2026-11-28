import * as THREE from 'three';
import { ORB_COLORS, ORB_POOL } from '../config/economy.js';

const vertex = `
attribute float shape;
attribute float age;
varying vec3 vColor;
varying float vShape;
varying float vAge;
void main() {
  vColor = color;
  vShape = shape;
  vAge = age;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 14.0 * (180.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = `
varying vec3 vColor;
varying float vShape;
varying float vAge;
void main() {
  if (vAge > 1.0) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float body = 0.0;
  if (vShape < 0.5) {
    float d = abs(p.x) + abs(p.y) * 0.65;
    body = 1.0 - smoothstep(0.55, 0.75, d);
  } else if (vShape < 1.5) {
    float d = length(p - vec2(0.0, 0.25)) + abs(p.y + 0.15) * 0.35;
    body = 1.0 - smoothstep(0.55, 0.8, d);
  } else {
    body = 1.0 - smoothstep(0.62, 0.82, abs(p.x) + abs(p.y));
  }
  if (body < 0.2) discard;
  gl_FragColor = vec4(vColor, body * (1.0 - vAge));
}
`;

/** One draw call for soul shards, health teardrops, and MP diamonds. */
export function createOrbPool() {
  const count = ORB_POOL;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const shapes = new Float32Array(count);
  const ages = new Float32Array(count);
  ages.fill(2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('shape', new THREE.BufferAttribute(shapes, 1));
  geometry.setAttribute('age', new THREE.BufferAttribute(ages, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const live = new Array(count).fill(null);

  function colorFor(kind) {
    const hex = ORB_COLORS[kind] ?? ORB_COLORS.soul;
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }

  return {
    points,
    spriteCount: count,
    burst(origin, kind, amount = 6) {
      const shape = kind === 'health' ? 1 : kind === 'mp' ? 2 : 0;
      const rgb = colorFor(kind === 'health' || kind === 'mp' ? kind : 'soul');
      let left = amount;
      for (let i = 0; i < count && left > 0; i += 1) {
        if (live[i]) continue;
        const ang = (i / count) * Math.PI * 2;
        live[i] = {
          x: origin.x, y: origin.y, z: origin.z,
          vx: Math.cos(ang) * 1.4,
          vy: 1.2 + (i % 3) * 0.3,
          vz: Math.sin(ang) * 1.4,
          age: 0,
        };
        shapes[i] = shape;
        colors[i * 3] = rgb[0];
        colors[i * 3 + 1] = rgb[1];
        colors[i * 3 + 2] = rgb[2];
        left -= 1;
      }
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.shape.needsUpdate = true;
    },
    step(dtMs) {
      const dt = dtMs / 1000;
      const attr = geometry.attributes.position;
      let any = false;
      for (let i = 0; i < count; i += 1) {
        const mote = live[i];
        if (!mote) {
          ages[i] = 2;
          continue;
        }
        any = true;
        mote.age += dtMs / 700;
        mote.vy -= 2.2 * dt;
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        mote.z += mote.vz * dt;
        attr.setXYZ(i, mote.x, mote.y, mote.z);
        ages[i] = mote.age;
        if (mote.age >= 1) live[i] = null;
      }
      points.visible = any;
      attr.needsUpdate = true;
      geometry.attributes.age.needsUpdate = true;
    },
  };
}
