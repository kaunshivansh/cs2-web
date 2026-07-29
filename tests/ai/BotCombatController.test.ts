import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatSnapshot,
  evaluateTransition,
  shouldFireWeapon,
  shouldMove,
} from '../../src/ai/BotCombatController.ts';
import type { CombatContext } from '../../src/ai/BotCombatController.ts';

function makeContext(overrides: Partial<CombatContext> = {}): CombatContext {
  return {
    hp: 100,
    maxHp: 100,
    ammoMag: 30,
    magSize: 30,
    hasLineOfSight: false,
    distanceToEnemy: 20,
    lastKnownEnemyAge: 10,
    coverScore: 0.5,
    nearestCoverScore: 0.5,
    hasBomb: false,
    bombPlanted: false,
    isOnBombSite: false,
    team: 'T',
    difficulty: 'medium',
    suppressionTimer: 0,
    ...overrides,
  };
}

test('createCombatSnapshot starts in patrolling state', () => {
  const snapshot = createCombatSnapshot();
  assert.equal(snapshot.state, 'patrolling');
  assert.equal(snapshot.stateTime, 0);
  assert.equal(snapshot.suppressionTimer, 0);
});

test('evaluateTransition transitions from patrolling to engaging on LoS', () => {
  const snapshot = createCombatSnapshot('patrolling');
  const context = makeContext({ hasLineOfSight: true });
  const transition = evaluateTransition(snapshot, context);
  assert.ok(transition !== null);
  assert.equal(transition!.nextState, 'engaging');
});

test('evaluateTransition transitions from patrolling to investigating on sound', () => {
  const snapshot = createCombatSnapshot('patrolling');
  const context = makeContext({ lastKnownEnemyAge: 2 }); // < 4 seconds
  const transition = evaluateTransition(snapshot, context);
  assert.ok(transition !== null);
  assert.equal(transition!.nextState, 'investigating');
});

test('evaluateTransition transitions from engaging to suppressing on LoS loss', () => {
  const snapshot = createCombatSnapshot('engaging');
  const context = makeContext({ hasLineOfSight: false, lastKnownEnemyAge: 1 }); // < 2 seconds
  const transition = evaluateTransition(snapshot, context);
  assert.ok(transition !== null);
  assert.equal(transition!.nextState, 'suppressing');
});

test('evaluateTransition transitions from engaging to retreating at low HP', () => {
  const snapshot = createCombatSnapshot('engaging');
  const context = makeContext({
    hp: 30,
    maxHp: 100,
    hasLineOfSight: true,
    nearestCoverScore: 0.8,
  });
  const transition = evaluateTransition(snapshot, context);
  assert.ok(transition !== null);
  assert.equal(transition!.nextState, 'retreating');
});

test('evaluateTransition transitions from suppressing to investigating after 1.5s', () => {
  const snapshot = { ...createCombatSnapshot('suppressing'), suppressionTimer: 2.0 };
  const context = makeContext();
  const transition = evaluateTransition(snapshot, context);
  assert.ok(transition !== null);
  assert.equal(transition!.nextState, 'investigating');
});

test('shouldFireWeapon returns true in engaging state', () => {
  const snapshot = createCombatSnapshot('engaging');
  const context = makeContext({ hasLineOfSight: true });
  assert.ok(shouldFireWeapon(snapshot, context));
});

test('shouldFireWeapon returns false in retreating state', () => {
  const snapshot = createCombatSnapshot('retreating');
  const context = makeContext();
  assert.ok(!shouldFireWeapon(snapshot, context));
});
