import type { WeaponConfig } from '../../weapons/WeaponData.ts';

export interface SpreadInput {
  horizontalSpeedRatio: number;
  recoilIndex: number;
  onGround: boolean;
  crouched: boolean;
  scoped: boolean;
}

export function computePlayerSpread(weapon: WeaponConfig, input: SpreadInput): number {
  let spread =
    weapon.spread +
    clamp(input.horizontalSpeedRatio, 0, 1.4) * weapon.moveSpread +
    (input.onGround ? 0 : weapon.airSpread) +
    (input.crouched ? weapon.crouchSpread : 0) +
    Math.min(0.055, input.recoilIndex * 0.0048);

  if (weapon.scoped) spread *= input.scoped ? 0.24 : 6.5;
  return Math.max(0, spread);
}

export function computePitchKick(weapon: WeaponConfig, recoilIndex: number): number {
  const recoil = weapon.recoil[Math.min(Math.floor(recoilIndex), weapon.recoil.length - 1)] ?? 0.5;
  return recoil * 0.016;
}

export function advanceRecoilIndex(weapon: Pick<WeaponConfig, 'recoil'>, recoilIndex: number): number {
  return Math.min(recoilIndex + 1, weapon.recoil.length - 1 + 4);
}

export function recoverRecoilIndex(recoilIndex: number, dt: number, recoveryRate = 12): number {
  return Math.max(0, recoilIndex - dt * recoveryRate);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
