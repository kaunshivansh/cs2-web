import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceAudibleEvents,
  computeBotDangerLevel,
  pickHeardThreat,
  updateBotBlackboard,
} from '../../src/ai/BotBlackboard.ts';

test('pickHeardThreat prefers fresh nearby enemy gunfire over stale distant noise', () => {
  const threat = pickHeardThreat(
    { x: 0, y: 0, z: 0 },
    'CT',
    [
      { team: 'T', kind: 'gunshot', position: { x: 6, y: 0, z: 0 }, age: 0.4, loudness: 1 },
      { team: 'T', kind: 'footstep', position: { x: 22, y: 0, z: 0 }, age: 2.8, loudness: 0.5 },
      { team: 'CT', kind: 'gunshot', position: { x: 2, y: 0, z: 0 }, age: 0.1, loudness: 1 },
    ],
    0.8,
  );

  assert.equal(threat?.kind, 'gunshot');
  assert.equal(threat?.position.x, 6);
});

test('computeBotDangerLevel rises under low HP, recent damage, and visible pressure', () => {
  const calm = computeBotDangerLevel({
    hp: 96,
    visibleEnemies: 0,
    distanceToObjective: 24,
    recentDamageAge: 9,
    bombPlanted: false,
  });
  const pressured = computeBotDangerLevel({
    hp: 28,
    visibleEnemies: 2,
    distanceToObjective: 5,
    recentDamageAge: 0.25,
    bombPlanted: true,
    heardThreat: {
      kind: 'gunshot',
      position: { x: 4, y: 0, z: -6 },
      age: 0.3,
      score: 0.82,
    },
  });

  assert.ok(pressured > calm);
  assert.ok(pressured > 0.7);
});

test('updateBotBlackboard can drive sound investigation when no enemies are visible', () => {
  const board = updateBotBlackboard({
    botTeam: 'CT',
    botPosition: { x: 0, y: 0, z: 0 },
    hp: 88,
    ammoRatio: 0.72,
    distanceToObjective: 14,
    visibleEnemies: 0,
    nearbyAllies: 1,
    hasBomb: false,
    bombPlanted: false,
    soundAwareness: 0.92,
    recentDamageAge: 8,
    audibleEvents: [
      { team: 'T', kind: 'footstep', position: { x: 5, y: 0, z: 4 }, age: 0.4, loudness: 0.75 },
    ],
    dt: 0.1,
  });

  assert.equal(board.decision, 'investigate-sound');
  assert.equal(board.heardThreat?.kind, 'footstep');
});

test('advanceAudibleEvents ages events out deterministically', () => {
  const next = advanceAudibleEvents(
    [
      { team: 'T', kind: 'gunshot', position: { x: 0, y: 0, z: 0 }, age: 5.8, loudness: 1 },
      { team: 'CT', kind: 'footstep', position: { x: 0, y: 0, z: 0 }, age: 1.5, loudness: 0.5 },
    ],
    0.5,
  );

  assert.equal(next.length, 1);
  assert.equal(next[0].age, 2);
});
