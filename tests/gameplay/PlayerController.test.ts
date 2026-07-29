import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCollision,
  capsuleOverlapsAABB,
  checkSlopeAngle,
  lerpCrouchHeight,
  moveWithCapsuleCollision,
  type Vec3,
  type Collider,
  type CapsuleConfig,
} from '../../src/gameplay/player/PlayerController.ts';

// ── resolveCollision ────────────────────────────────────────────────────────

test('resolveCollision slides velocity along wall normal', () => {
  // Moving diagonally into a wall with normal pointing in -X
  const velocity: Vec3 = { x: 5, y: 0, z: 3 };
  const wallNormal: Vec3 = { x: -1, y: 0, z: 0 };

  const result = resolveCollision(velocity, wallNormal);

  // The X component should be zeroed out (projected away)
  assert.ok(Math.abs(result.x) < 1e-6, `Expected x ≈ 0 but got ${result.x}`);
  // The Z component should be preserved
  assert.ok(
    Math.abs(result.z - 3) < 1e-6,
    `Expected z ≈ 3 but got ${result.z}`,
  );
});

// ── capsuleOverlapsAABB ─────────────────────────────────────────────────────

test('capsuleOverlapsAABB detects overlap correctly', () => {
  const capsule: CapsuleConfig = { radius: 0.4, height: 1.6 };
  const position: Vec3 = { x: 1, y: 1.6, z: 1 };
  const collider: Collider = {
    min: { x: 0.5, y: 0, z: 0.5 },
    max: { x: 1.5, y: 2, z: 1.5 },
  };

  const result = capsuleOverlapsAABB(position, capsule, collider);
  assert.equal(result, true, 'Capsule should overlap the collider');
});

test('capsuleOverlapsAABB returns false when no overlap', () => {
  const capsule: CapsuleConfig = { radius: 0.4, height: 1.6 };
  const position: Vec3 = { x: 10, y: 1.6, z: 10 };
  const collider: Collider = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 1, y: 2, z: 1 },
  };

  const result = capsuleOverlapsAABB(position, capsule, collider);
  assert.equal(result, false, 'Capsule should not overlap the collider');
});

// ── checkSlopeAngle ─────────────────────────────────────────────────────────

test('checkSlopeAngle rejects slopes steeper than 45 degrees', () => {
  // A very steep surface normal (nearly horizontal → steep slope)
  const steepNormal: Vec3 = { x: 0.9, y: 0.1, z: 0 };
  const result = checkSlopeAngle(steepNormal);

  assert.equal(result.walkable, false, 'Steep slope should not be walkable');
  // Slide direction should have a downward Y component
  assert.ok(
    result.slideDirection.y < 0,
    'Slide direction should point downward',
  );
});

test('checkSlopeAngle accepts flat ground', () => {
  const flatNormal: Vec3 = { x: 0, y: 1, z: 0 };
  const result = checkSlopeAngle(flatNormal);

  assert.equal(result.walkable, true, 'Flat ground should be walkable');
  assert.deepStrictEqual(result.slideDirection, { x: 0, y: 0, z: 0 });
});

// ── lerpCrouchHeight ────────────────────────────────────────────────────────

test('lerpCrouchHeight smoothly transitions height', () => {
  const current = 1.8; // standing
  const target = 0.9; // crouching
  const dt = 1 / 60; // one frame at 60fps

  const result = lerpCrouchHeight(current, target, dt);

  // Should move toward target but not reach it in one frame
  assert.ok(result < current, 'Height should decrease toward crouch');
  assert.ok(result > target, 'Height should not reach target in one frame');
});

// ── moveWithCapsuleCollision ────────────────────────────────────────────────

test('moveWithCapsuleCollision slides along walls instead of stopping', () => {
  const capsule: CapsuleConfig = { radius: 0.3, height: 1.6 };
  // Player starts well away from the wall
  const position: Vec3 = { x: 0, y: 1.6, z: 0 };
  const velocity: Vec3 = { x: 10, y: 0, z: 10 };
  const dt = 1 / 60;

  // Wall placed at X=[0.5, 0.6]. Player moves to X≈0.167 per frame, capsule
  // edge at 0.167+0.3=0.467 doesn't reach. Over a few ticks it will reach.
  const bigDt = 0.035; // 35ms step -> X moves to 0.35, capsule edge at 0.65 -> overlaps wall

  const wall: Collider = {
    min: { x: 0.5, y: 0, z: -60 },
    max: { x: 0.6, y: 3, z: 60 },
  };

  const result = moveWithCapsuleCollision(
    position,
    velocity,
    bigDt,
    capsule,
    [wall],
  );

  // Player's X should not have moved past the wall
  assert.ok(
    result.position.x < 0.5,
    `Player should be blocked in X but got x=${result.position.x}`,
  );

  // Player should still have moved along Z (sliding)
  assert.ok(
    result.position.z > position.z,
    `Player should slide along the wall in Z direction but z=${result.position.z}`,
  );
});
