import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { disposeObject3DResources } from '../../src/rendering/SceneDisposal.ts';

test('disposeObject3DResources disposes geometry and material trees', () => {
  const flags = { geometry: false, material: false, map: false };

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const texture = new THREE.Texture();
  material.map = texture;

  geometry.dispose = () => { flags.geometry = true; };
  material.dispose = () => { flags.material = true; };
  texture.dispose = () => { flags.map = true; };

  const mesh = new THREE.Mesh(geometry, material);
  const root = new THREE.Group();
  root.add(mesh);

  disposeObject3DResources(root);

  assert.deepEqual(flags, {
    geometry: true,
    material: true,
    map: true,
  });
});
