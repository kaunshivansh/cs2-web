import type { WeaponConfig } from '../../weapons/WeaponData.ts';

export interface SpreadInput {
  horizontalSpeedRatio: number;
  recoilIndex: number;
  onGround: boolean;
  crouched: boolean;
  scoped: boolean;
  timeSinceStationary?: number;
  timeSinceJump?: number;
  speed?: number;
  maxSpeed?: number;
}

export function computePlayerSpread(weapon: WeaponConfig, input: SpreadInput): number {
  const isFirstShot = input.recoilIndex <= 1;
  const timeSinceStat = input.timeSinceStationary ?? 0;
  const timeSinceJ = input.timeSinceJump ?? 0;
  
  if (isFirstShot && timeSinceStat >= 0.3 && timeSinceJ >= 0.5) {
    return 0;
  }
  
  const speed = input.speed ?? (input.horizontalSpeedRatio * (weapon.moveSpeed || 5.2));
  const maxSpeed = input.maxSpeed ?? (weapon.moveSpeed || 5.2);
  const penalty = 1 + (Math.min(speed, maxSpeed) / maxSpeed) * 2.5;

  let spread =
    weapon.spread * penalty +
    (input.onGround ? 0 : weapon.airSpread) +
    (input.crouched ? weapon.crouchSpread : 0) +
    Math.min(0.055, input.recoilIndex * 0.0048);

  if (weapon.scoped) spread *= input.scoped ? 0.24 : 4.5;
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

