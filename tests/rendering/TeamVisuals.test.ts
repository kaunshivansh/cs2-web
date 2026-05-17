import test from 'node:test';
import assert from 'node:assert/strict';

import { getTeamVisualPalette } from '../../src/rendering/viewmodel/TeamVisuals.ts';

test('CT and T palettes use distinct competitive team colors', () => {
  const ct = getTeamVisualPalette('CT');
  const t = getTeamVisualPalette('T');

  assert.equal(ct.gloveColor, 0x3d6b96);
  assert.equal(t.gloveColor, 0x8a4a30);
  assert.notEqual(ct.gloveColor, t.gloveColor);
  assert.notEqual(ct.sleeveColor, t.sleeveColor);
});

test('team palette helper returns fresh objects to avoid shared mutation assumptions', () => {
  const first = getTeamVisualPalette('CT');
  const second = getTeamVisualPalette('CT');

  assert.notEqual(first, second);
  assert.deepEqual(first, second);
});
