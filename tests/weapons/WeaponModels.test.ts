import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeaponModel } from '../../src/rendering/viewmodel/WeaponModels.ts';

const ALL_WEAPONS = ['knife', 'usp', 'deagle', 'glock', 'mp9', 'mac10', 'm4a1', 'ak47', 'awp'];

test('createWeaponModel returns valid Group and muzzle node for all 9 weapons in view mode', () => {
  for (const id of ALL_WEAPONS) {
    const res = createWeaponModel(id, 'view', 'CT');
    assert.ok(res, `Failed for ${id}`);
    assert.ok(res.group, `Group missing for ${id}`);
    assert.ok(res.muzzle, `Muzzle node missing for ${id}`);
    assert.equal(res.muzzle.isObject3D, true, `Muzzle is not Object3D for ${id}`);
  }
});

test('createWeaponModel returns valid Group and muzzle node for all 9 weapons in world mode', () => {
  for (const id of ALL_WEAPONS) {
    const res = createWeaponModel(id, 'world', 'T');
    assert.ok(res, `Failed for ${id}`);
    assert.ok(res.group, `Group missing for ${id}`);
    assert.ok(res.muzzle, `Muzzle node missing for ${id}`);
  }
});
