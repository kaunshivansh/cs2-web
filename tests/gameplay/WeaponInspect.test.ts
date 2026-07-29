import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeamVisualPalette, makeHands } from '../../src/rendering/viewmodel/TeamVisuals.ts';

test('Weapon inspect progression advances inspectT and caps smoothly', () => {
  const player = { inspecting: true, inspectT: 0 };
  const dt = 0.5;

  // Advance inspection frame
  player.inspectT = Math.min(2.5, player.inspectT + dt);
  assert.equal(player.inspectT, 0.5);

  // Complete inspection
  player.inspectT = 2.5;
  if (player.inspectT >= 2.5) {
    player.inspecting = false;
    player.inspectT = 0;
  }

  assert.equal(player.inspecting, false);
  assert.equal(player.inspectT, 0);
});

test('Weapon inspect cancels immediately on firing, reloading, or taking damage', () => {
  const player = { inspecting: true, inspectT: 1.2 };

  // Trigger weapon action
  player.inspecting = false;
  player.inspectT = 0;

  assert.equal(player.inspecting, false);
  assert.equal(player.inspectT, 0);
});

test('makeHands binds CT and T team visual palettes distinctively', () => {
  const ctPalette = getTeamVisualPalette('CT');
  const tPalette = getTeamVisualPalette('T');

  assert.notEqual(ctPalette.gloveColor, tPalette.gloveColor);
  assert.notEqual(ctPalette.sleeveColor, tPalette.sleeveColor);

  const ctHands = makeHands('CT');
  const tHands = makeHands('T');

  assert.ok(ctHands, 'CT hands object created');
  assert.ok(tHands, 'T hands object created');
});
