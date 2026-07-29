import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRecoilOffset,
  recoilToRadians,
  hasFirstShotAccuracy,
  movementSpreadPenalty,
  RECOIL_PATTERNS,
  CAMERA_PUNCH_PITCH,
  CAMERA_PUNCH_RECOVERY_MS,
} from '../../src/gameplay/player/RecoilPatterns.ts';

test('getRecoilOffset returns correct pattern entry for AK-47', () => {
  const offset = getRecoilOffset('ak47', 3);
  assert.equal(offset.pitch, 2.8);
  assert.equal(offset.yaw, 0.5);
});

test('getRecoilOffset clamps to last entry when shot index exceeds pattern', () => {
  const pattern = RECOIL_PATTERNS['ak47'];
  const offset = getRecoilOffset('ak47', 100);
  assert.equal(offset.pitch, pattern[pattern.length - 1].pitch);
  assert.equal(offset.yaw, pattern[pattern.length - 1].yaw);
});

test('getRecoilOffset returns zero for unknown weapon', () => {
  const offset = getRecoilOffset('unknown_weapon', 0);
  assert.equal(offset.pitch, 0);
  assert.equal(offset.yaw, 0);
});

test('recoilToRadians scales offset by intensity', () => {
  const offset = { pitch: 2.0, yaw: 1.0 };
  const result = recoilToRadians(offset, 0.016);
  assert.equal(Number(result.pitch.toFixed(5)), 0.032);
  assert.equal(Number(result.yaw.toFixed(5)), 0.016);
});

test('hasFirstShotAccuracy returns true when stationary and not jumping', () => {
  assert.equal(hasFirstShotAccuracy({ timeSinceStationary: 0.5, timeSinceJump: 1.0 }), true);
});

test('hasFirstShotAccuracy returns false when recently moved', () => {
  assert.equal(hasFirstShotAccuracy({ timeSinceStationary: 0.1, timeSinceJump: 1.0 }), false);
});

test('hasFirstShotAccuracy returns false when recently jumped', () => {
  assert.equal(hasFirstShotAccuracy({ timeSinceStationary: 0.5, timeSinceJump: 0.3 }), false);
});

test('movementSpreadPenalty returns 1 when stationary', () => {
  assert.equal(movementSpreadPenalty(0, 5), 1);
});

test('movementSpreadPenalty scales up to 3.5 at max speed', () => {
  assert.equal(movementSpreadPenalty(5, 5), 3.5);
});

test('CAMERA_PUNCH_PITCH is approximately 0.8 degrees in radians', () => {
  const expected = 0.8 * Math.PI / 180;
  assert.ok(Math.abs(CAMERA_PUNCH_PITCH - expected) < 0.0001);
});

test('CAMERA_PUNCH_RECOVERY_MS is 80 milliseconds', () => {
  assert.equal(CAMERA_PUNCH_RECOVERY_MS, 80);
});

test('all weapons in RECOIL_PATTERNS have non-empty patterns', () => {
  for (const [id, pattern] of Object.entries(RECOIL_PATTERNS)) {
    assert.ok(pattern.length > 0, `${id} should have at least one recoil entry`);
    assert.equal(pattern[0].pitch, 0, `${id} first shot should have zero pitch offset`);
    assert.equal(pattern[0].yaw, 0, `${id} first shot should have zero yaw offset`);
  }
});
