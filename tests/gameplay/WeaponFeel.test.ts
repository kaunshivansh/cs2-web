import test from 'node:test';
import assert from 'node:assert/strict';

import { WEAPONS } from '../../src/weapons/WeaponData.ts';
import {
  advanceRecoilIndex,
  computePitchKick,
  computePlayerSpread,
} from '../../src/gameplay/player/WeaponFeel.ts';

test('computePlayerSpread increases with movement and decreases while scoped', () => {
  const awp = WEAPONS.awp;

  const movingHip = computePlayerSpread(awp, {
    horizontalSpeedRatio: 0.8,
    recoilIndex: 2,
    onGround: true,
    crouched: false,
    scoped: false,
  });
  const scopedStill = computePlayerSpread(awp, {
    horizontalSpeedRatio: 0,
    recoilIndex: 0,
    onGround: true,
    crouched: false,
    scoped: true,
  });

  assert.ok(movingHip > scopedStill);
});

test('computePitchKick follows the authored recoil pattern', () => {
  const ak = WEAPONS.ak47;

  assert.equal(computePitchKick(ak, 0), ak.recoil[0] * 0.016);
  assert.equal(computePitchKick(ak, 999), ak.recoil[ak.recoil.length - 1] * 0.016);
});

test('advanceRecoilIndex caps against the recoil pattern tail buffer', () => {
  const ak = WEAPONS.ak47;
  const capped = advanceRecoilIndex(ak, 999);

  assert.equal(capped, ak.recoil.length - 1 + 4);
});
