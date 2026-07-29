import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MapBVH } from '../../src/maps/MapBVH.ts';

test('MapBVH builds bounds tree and performs triangle-accurate raycasting', () => {
  const group = new THREE.Group();
  const boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshBasicMaterial()
  );
  boxMesh.position.set(0, 2, 0);
  boxMesh.updateMatrixWorld(true);
  group.add(boxMesh);

  const mapBVH = new MapBVH();
  const built = mapBVH.buildFromScene(group);
  assert.equal(built, true);

  // Test raycast hit against wall
  const origin = new THREE.Vector3(0, 2, -10);
  const dir = new THREE.Vector3(0, 0, 1);
  const hit = mapBVH.raycast(origin, dir);

  assert.ok(hit !== null);
  assert.equal(hit.isWall, true);
  assert.ok(Math.abs(hit.point.z - (-2)) < 0.1);

  // Test line of sight clear vs blocked
  const clearTarget = new THREE.Vector3(10, 2, -10);
  assert.equal(mapBVH.losClear(origin, clearTarget), true);

  const blockedTarget = new THREE.Vector3(0, 2, 10);
  assert.equal(mapBVH.losClear(origin, blockedTarget), false);

  mapBVH.dispose();
});
