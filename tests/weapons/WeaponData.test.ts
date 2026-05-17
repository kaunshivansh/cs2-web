import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UTILITY_WEAPON_IDS,
  WEAPONS,
  getWeaponConfig,
  validateWeaponCatalog,
} from '../../src/weapons/WeaponData.ts';

test('weapon catalog validates every gameplay-critical numeric field', () => {
  const result = validateWeaponCatalog(WEAPONS);

  assert.deepEqual(result.errors, []);
  assert.ok(result.weaponCount >= 12);
});

test('utility catalog includes tactical grenade types needed by AI and smoke vision', () => {
  assert.deepEqual(UTILITY_WEAPON_IDS, ['smoke', 'flash', 'hegrenade', 'molotov']);
  assert.equal(getWeaponConfig('smoke').blocksVision, true);
  assert.equal(getWeaponConfig('flash').detonatesAfter, 1.45);
});
