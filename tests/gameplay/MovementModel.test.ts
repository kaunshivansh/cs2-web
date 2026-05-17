import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGroundFrictionToVelocity,
  applyCounterStrafeToVelocity,
  computeMovementSpeed,
} from '../../src/gameplay/player/MovementModel.ts';

test('computeMovementSpeed compounds crouch, walk, and scope penalties', () => {
  const speed = computeMovementSpeed(5.2, {
    crouched: true,
    walking: true,
    scoped: true,
  });

  assert.equal(Number(speed.toFixed(4)), Number((5.2 * 0.58 * 0.74 * 0.55).toFixed(4)));
});

test('applyGroundFrictionToVelocity clamps near-zero speed cleanly', () => {
  const next = applyGroundFrictionToVelocity({ x: 0.01, z: 0.02 }, 1 / 60, 8.4);

  assert.equal(next.x, 0);
  assert.equal(next.z, 0);
});

test('applyCounterStrafeToVelocity brakes against opposite input directions', () => {
  const next = applyCounterStrafeToVelocity(
    { x: 0, z: -4 },
    { x: 0, z: -1 },
    { x: 1, z: 0 },
    { forward: false, backward: true, left: false, right: false },
  );

  assert.ok(next.z > -4);
});
