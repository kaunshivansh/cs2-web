import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpatialGrid } from '../../src/maps/SpatialGrid.ts';

test('SpatialGrid inserts and retrieves colliders by cell coordinates in O(1)', () => {
  const grid = new SpatialGrid(4);
  const collider1 = {
    min: new THREE.Vector3(0, 0, 0),
    max: new THREE.Vector3(2, 2, 2),
  };
  const collider2 = {
    min: new THREE.Vector3(10, 0, 10),
    max: new THREE.Vector3(12, 2, 12),
  };

  grid.insert(collider1);
  grid.insert(collider2);

  const nearby1 = grid.getCollidersInRadius(1, 1, 2);
  assert.equal(nearby1.length, 1);
  assert.equal(nearby1[0], collider1);

  const nearby2 = grid.getCollidersInRadius(11, 11, 2);
  assert.equal(nearby2.length, 1);
  assert.equal(nearby2[0], collider2);
});
