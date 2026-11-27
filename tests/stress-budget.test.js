import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/world.js';
import { createStressScene } from '../src/scenes/stress.js';

describe('stress scene budget', () => {
  it('lands near 50k triangles, 70 meshes, 6 enemy capsules and 12 debris bodies', async () => {
    const R = await loadRapier();
    const scene = createStressScene(R);

    let meshes = 0;
    let triangles = 0;
    scene.scene.traverse((object) => {
      if (!object.isMesh) return;
      meshes += 1;
      const geometry = object.geometry;
      triangles += geometry.index
        ? geometry.index.count / 3
        : geometry.attributes.position.count / 3;
    });

    let kinematic = 0;
    let dynamic = 0;
    scene.world.forEachRigidBody((body) => {
      if (body.isKinematic()) kinematic += 1;
      else if (body.isDynamic()) dynamic += 1;
    });

    let sprites = 0;
    let pointDraws = 0;
    scene.scene.traverse((object) => {
      if (!object.isPoints) return;
      pointDraws += 1;
      const range = object.geometry.drawRange;
      const count = range && range.count != null && range.count !== Infinity
        ? range.count
        : object.geometry.attributes.position.count;
      sprites += count;
    });

    expect(meshes).toBe(70);
    expect(triangles).toBe(49754);
    expect(pointDraws).toBe(2);
    expect(sprites).toBe(35);
    expect(kinematic).toBe(7);
    expect(dynamic).toBe(12);
    scene.dispose();
  }, 20000);
});
