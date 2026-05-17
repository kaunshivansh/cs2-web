import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAmmoView,
  buildScoreboardView,
} from '../../src/ui/hud/ScoreboardModel.ts';

test('buildScoreboardView sorts alive players first, then kills, then name', () => {
  const view = buildScoreboardView({
    round: 8,
    maxRounds: 15,
    score: { CT: 4, T: 3 },
    playerName: 'Rook',
    playerTeam: 'CT',
    playerMoney: 4100,
    playerHasBomb: false,
    rows: [
      { team: 'CT', name: 'Bravo', hp: 80, alive: true, weaponName: 'M4A1-S', kills: 4, deaths: 2, money: null, hasBomb: false },
      { team: 'CT', name: 'Alpha', hp: 90, alive: true, weaponName: 'USP-S', kills: 4, deaths: 1, money: null, hasBomb: false },
      { team: 'CT', name: 'Ghost', hp: 0, alive: false, weaponName: 'AWP', kills: 10, deaths: 4, money: null, hasBomb: false },
      { team: 'T', name: 'Carrier', hp: 100, alive: true, weaponName: 'AK-47', kills: 3, deaths: 2, money: null, hasBomb: true },
    ],
  });

  assert.equal(view.teams.CT.rows[0].name, 'Alpha');
  assert.equal(view.teams.CT.rows[1].name, 'Bravo');
  assert.equal(view.teams.CT.rows[2].alive, false);
  assert.equal(view.teams.T.rows[0].prefix, '◆ ');
});

test('buildAmmoView returns safe structured ammo text for guns and melee', () => {
  assert.deepEqual(buildAmmoView({ type: 'melee' }), {
    primary: '—',
    reserve: '',
    reloading: false,
  });

  assert.deepEqual(buildAmmoView({ type: 'gun', mag: 24, reserve: 78, reloading: true }), {
    primary: '24',
    reserve: '/ 78 · RLD',
    reloading: true,
  });
});
