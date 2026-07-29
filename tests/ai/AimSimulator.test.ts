import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAimState,
  setTarget,
  updateAim,
  isAimReady,
  AIM_DIFFICULTY_PARAMS,
} from '../../src/ai/AimSimulator.ts';

test('createAimState returns zeroed state', () => {
  const state = createAimState();
  assert.deepStrictEqual(state.currentAngle, { x: 0, y: 0 });
  assert.deepStrictEqual(state.targetAngle, { x: 0, y: 0 });
  assert.equal(state.reactionTimer, 0);
});

test('setTarget sets reaction timer based on difficulty', () => {
  const state = createAimState();

  const easyState = setTarget(state, { x: 1, y: 1 }, 'easy');
  assert.equal(easyState.reactionTimer, AIM_DIFFICULTY_PARAMS.easy.reactionTimeMs / 1000);

  const proState = setTarget(state, { x: 1, y: 1 }, 'pro');
  assert.equal(proState.reactionTimer, AIM_DIFFICULTY_PARAMS.pro.reactionTimeMs / 1000);

  assert.ok(easyState.reactionTimer > proState.reactionTimer);
});

test('updateAim does not move during reaction time', () => {
  const state = setTarget(createAimState(), { x: 1, y: 0.5 }, 'easy');
  // dt is small enough that reaction timer won't expire (0.7s timer, 0.1s step)
  const updated = updateAim(state, 0.1, 'easy');
  assert.deepStrictEqual(updated.currentAngle, { x: 0, y: 0 });
  assert.ok(updated.reactionTimer > 0);
});

test('updateAim lerps toward target after reaction time', () => {
  let state = setTarget(createAimState(), { x: 1, y: 1 }, 'hard');
  // Expire reaction timer completely
  state = { ...state, reactionTimer: 0 };

  // Run several updates to converge
  for (let i = 0; i < 50; i++) {
    state = updateAim(state, 0.016, 'hard');
  }

  // After many iterations with hard difficulty (aimSpeed 9.0), should be close to target
  assert.ok(
    Math.abs(state.currentAngle.x - 1) < 0.15,
    `Expected currentAngle.x ~1, got ${state.currentAngle.x}`
  );
  assert.ok(
    Math.abs(state.currentAngle.y - 1) < 0.15,
    `Expected currentAngle.y ~1, got ${state.currentAngle.y}`
  );
});

test('pro difficulty has faster aim speed than easy', () => {
  assert.ok(AIM_DIFFICULTY_PARAMS.pro.aimSpeed > AIM_DIFFICULTY_PARAMS.easy.aimSpeed);
  assert.ok(AIM_DIFFICULTY_PARAMS.pro.reactionTimeMs < AIM_DIFFICULTY_PARAMS.easy.reactionTimeMs);
  assert.ok(AIM_DIFFICULTY_PARAMS.pro.noiseRadius < AIM_DIFFICULTY_PARAMS.easy.noiseRadius);
});

test('isAimReady returns true when aim is close to target', () => {
  const state = createAimState();
  // currentAngle and targetAngle are both {0,0}, error = 0
  assert.ok(isAimReady(state));

  const farState = setTarget(state, { x: 1, y: 1 }, 'easy');
  // currentAngle is still {0,0}, target is {1,1}, error = sqrt(2) ≈ 1.41
  assert.ok(!isAimReady(farState));
});
