import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBotProfile,
  scoreTacticalOptions,
  updateEnemyMemory,
} from '../../src/ai/TacticalDirector.ts';

test('createBotProfile makes pro bots faster and more accurate than easy bots', () => {
  const easy = createBotProfile('easy', 0.42);
  const pro = createBotProfile('pro', 0.42);

  assert.ok(pro.accuracy > easy.accuracy);
  assert.ok(pro.reactionTime < easy.reactionTime);
  assert.ok(pro.coordination > easy.coordination);
});

test('scoreTacticalOptions prioritizes cover under danger and objective under bomb pressure', () => {
  const danger = scoreTacticalOptions({
    hp: 24,
    ammoRatio: 0.8,
    distanceToObjective: 18,
    visibleEnemies: 1,
    nearbyAllies: 1,
    danger: 0.9,
    hasBomb: false,
    bombPlanted: false,
    heardFootstepAge: 3,
  });

  assert.equal(danger[0].action, 'take-cover');

  const objective = scoreTacticalOptions({
    hp: 88,
    ammoRatio: 0.6,
    distanceToObjective: 3,
    visibleEnemies: 0,
    nearbyAllies: 2,
    danger: 0.25,
    hasBomb: true,
    bombPlanted: false,
    heardFootstepAge: 10,
  });

  assert.equal(objective[0].action, 'plant-or-defuse');
});

test('updateEnemyMemory keeps freshest enemy intel and expires stale sightings', () => {
  const memory = updateEnemyMemory(undefined, { x: 10, y: 0, z: -4 }, 0);
  const fresh = updateEnemyMemory(memory, undefined, 3);
  const stale = updateEnemyMemory(fresh, undefined, 9);

  assert.equal(fresh?.lastKnownPosition.x, 10);
  assert.equal(stale, undefined);
});
