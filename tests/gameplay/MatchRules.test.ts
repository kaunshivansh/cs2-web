import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateLossBonus,
  createInitialMatchState,
  resolveRound,
  shouldSwapSides,
} from '../../src/gameplay/match/MatchRules.ts';

test('createInitialMatchState builds a matchmaking-ready 5v5 freeze phase', () => {
  const state = createInitialMatchState({ playerName: 'Rook', playerTeam: 'CT' });

  assert.equal(state.phase, 'freeze');
  assert.equal(state.round, 1);
  assert.equal(state.rosters.CT.length, 5);
  assert.equal(state.rosters.T.length, 5);
  assert.equal(state.rosters.CT.filter((player) => player.isHuman).length, 1);
  assert.equal(state.rosters.T.filter((player) => player.hasBomb).length, 1);
  assert.equal(state.economy.CT.bank['ct-player'], 800);
});

test('calculateLossBonus follows tactical defusal escalation caps', () => {
  assert.equal(calculateLossBonus(1), 1400);
  assert.equal(calculateLossBonus(2), 1900);
  assert.equal(calculateLossBonus(3), 2400);
  assert.equal(calculateLossBonus(4), 2900);
  assert.equal(calculateLossBonus(7), 3400);
});

test('resolveRound updates score, loss streaks, MVP, and awards deterministically', () => {
  const state = createInitialMatchState({ playerName: 'Rook', playerTeam: 'CT' });
  const resolved = resolveRound(state, {
    winner: 'T',
    reason: 'elimination',
    mvpPlayerId: 't-1',
  });

  assert.equal(resolved.score.T, 1);
  assert.equal(resolved.score.CT, 0);
  assert.equal(resolved.economy.CT.lossStreak, 1);
  assert.equal(resolved.economy.T.lossStreak, 0);
  assert.equal(resolved.economy.CT.bank['ct-player'], 2200);
  assert.equal(resolved.roundHistory[0].mvpPlayerId, 't-1');
});

test('shouldSwapSides triggers exactly at regulation halftime', () => {
  assert.equal(shouldSwapSides(12, 24), true);
  assert.equal(shouldSwapSides(11, 24), false);
  assert.equal(shouldSwapSides(24, 24), false);
});
