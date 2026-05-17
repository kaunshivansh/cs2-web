export type WeaponSlot = 'knife' | 'sidearm' | 'primary' | 'utility';
export type WeaponType = 'melee' | 'gun' | 'utility';
export type UtilityEffect = 'smoke' | 'flash' | 'explosive' | 'incendiary';

export interface WeaponConfig {
  name: string;
  slot: WeaponSlot;
  type: WeaponType;
  dmg: number;
  cd: number;
  range: number;
  price: number;
  spread: number;
  moveSpread: number;
  airSpread: number;
  crouchSpread: number;
  recoil: number[];
  headMul: number;
  armorPen: number;
  reload: number;
  magSize: number;
  reserve: number;
  moveSpeed: number;
  reward: number;
  auto: boolean;
  scoped?: boolean;
  scopeFov?: number;
  fireModes?: Array<'semi' | 'burst' | 'auto'>;
  penetration?: number;
  pellets?: number;
  detonatesAfter?: number;
  radius?: number;
  duration?: number;
  blocksVision?: boolean;
  effect?: UtilityEffect;
}

export type WeaponCatalog = Record<string, WeaponConfig>;

const inertBallistics = {
  spread: 0,
  moveSpread: 0,
  airSpread: 0,
  crouchSpread: 0,
  recoil: [0],
  headMul: 1,
  armorPen: 0,
  reload: 0,
  magSize: 0,
  reserve: 0,
  auto: false,
};

export const WEAPONS: WeaponCatalog = {
  knife: {
    name: 'KNIFE',
    slot: 'knife',
    type: 'melee',
    dmg: 58,
    cd: 0.45,
    range: 2.1,
    price: 0,
    moveSpeed: 5.8,
    reward: 0,
    ...inertBallistics,
  },
  usp: {
    name: 'USP-S',
    slot: 'sidearm',
    type: 'gun',
    dmg: 27,
    cd: 0.22,
    range: 68,
    price: 200,
    spread: 0.009,
    moveSpread: 0.026,
    airSpread: 0.09,
    crouchSpread: -0.0025,
    recoil: [0.65, 0.45, 0.4],
    headMul: 4.1,
    armorPen: 0.72,
    reload: 1.7,
    magSize: 12,
    reserve: 24,
    moveSpeed: 5.5,
    reward: 300,
    auto: false,
    fireModes: ['semi'],
    penetration: 0.35,
  },
  deagle: {
    name: 'DESERT EAGLE',
    slot: 'sidearm',
    type: 'gun',
    dmg: 54,
    cd: 0.29,
    range: 72,
    price: 700,
    spread: 0.0065,
    moveSpread: 0.038,
    airSpread: 0.12,
    crouchSpread: -0.002,
    recoil: [1.1, 0.7, 0.55],
    headMul: 2.35,
    armorPen: 0.92,
    reload: 2.1,
    magSize: 7,
    reserve: 21,
    moveSpeed: 5.25,
    reward: 300,
    auto: false,
    fireModes: ['semi'],
    penetration: 0.72,
  },
  glock: {
    name: 'GLOCK-18',
    slot: 'sidearm',
    type: 'gun',
    dmg: 24,
    cd: 0.18,
    range: 64,
    price: 200,
    spread: 0.011,
    moveSpread: 0.024,
    airSpread: 0.09,
    crouchSpread: -0.002,
    recoil: [0.55, 0.42, 0.3],
    headMul: 4,
    armorPen: 0.66,
    reload: 1.7,
    magSize: 20,
    reserve: 40,
    moveSpeed: 5.6,
    reward: 300,
    auto: false,
    fireModes: ['semi', 'burst'],
    penetration: 0.28,
  },
  mp9: {
    name: 'MP9',
    slot: 'primary',
    type: 'gun',
    dmg: 24,
    cd: 0.075,
    range: 60,
    price: 1250,
    spread: 0.011,
    moveSpread: 0.02,
    airSpread: 0.09,
    crouchSpread: -0.003,
    recoil: [0.35, 0.48, 0.58, 0.72, 0.82, 0.68, 0.58, 0.46, 0.35],
    headMul: 3.35,
    armorPen: 0.58,
    reload: 2.1,
    magSize: 30,
    reserve: 90,
    moveSpeed: 5.75,
    reward: 600,
    auto: true,
    fireModes: ['auto'],
    penetration: 0.32,
  },
  mac10: {
    name: 'MAC-10',
    slot: 'primary',
    type: 'gun',
    dmg: 23,
    cd: 0.071,
    range: 56,
    price: 1050,
    spread: 0.012,
    moveSpread: 0.024,
    airSpread: 0.095,
    crouchSpread: -0.003,
    recoil: [0.36, 0.5, 0.64, 0.8, 0.92, 0.76, 0.62, 0.48],
    headMul: 3.2,
    armorPen: 0.56,
    reload: 2.25,
    magSize: 30,
    reserve: 90,
    moveSpeed: 5.8,
    reward: 600,
    auto: true,
    fireModes: ['auto'],
    penetration: 0.3,
  },
  m4a1: {
    name: 'M4A1-S',
    slot: 'primary',
    type: 'gun',
    dmg: 34,
    cd: 0.088,
    range: 88,
    price: 2900,
    spread: 0.0062,
    moveSpread: 0.018,
    airSpread: 0.085,
    crouchSpread: -0.0038,
    recoil: [0.42, 0.56, 0.68, 0.82, 0.98, 0.9, 0.84, 0.76, 0.62, 0.48, 0.36],
    headMul: 4,
    armorPen: 0.84,
    reload: 2.45,
    magSize: 25,
    reserve: 75,
    moveSpeed: 5,
    reward: 300,
    auto: true,
    fireModes: ['semi', 'auto'],
    penetration: 0.58,
  },
  ak47: {
    name: 'AK-47',
    slot: 'primary',
    type: 'gun',
    dmg: 36,
    cd: 0.095,
    range: 92,
    price: 2700,
    spread: 0.0072,
    moveSpread: 0.02,
    airSpread: 0.09,
    crouchSpread: -0.0035,
    recoil: [0.48, 0.66, 0.82, 0.94, 1.06, 0.96, 0.88, 0.74, 0.62, 0.48],
    headMul: 4.05,
    armorPen: 0.78,
    reload: 2.45,
    magSize: 30,
    reserve: 90,
    moveSpeed: 4.95,
    reward: 300,
    auto: true,
    fireModes: ['semi', 'auto'],
    penetration: 0.62,
  },
  awp: {
    name: 'AWP',
    slot: 'primary',
    type: 'gun',
    dmg: 115,
    cd: 1.25,
    range: 150,
    price: 4750,
    spread: 0.0012,
    moveSpread: 0.065,
    airSpread: 0.2,
    crouchSpread: -0.0008,
    recoil: [1.2],
    headMul: 1.45,
    armorPen: 0.97,
    reload: 3.45,
    magSize: 10,
    reserve: 30,
    moveSpeed: 4.35,
    reward: 100,
    auto: false,
    scoped: true,
    scopeFov: 28,
    fireModes: ['semi'],
    penetration: 0.92,
  },
  smoke: {
    name: 'SMOKE GRENADE',
    slot: 'utility',
    type: 'utility',
    dmg: 0,
    cd: 1.1,
    range: 42,
    price: 300,
    moveSpeed: 5.35,
    reward: 0,
    detonatesAfter: 1.55,
    radius: 5.8,
    duration: 18,
    blocksVision: true,
    effect: 'smoke',
    ...inertBallistics,
  },
  flash: {
    name: 'FLASHBANG',
    slot: 'utility',
    type: 'utility',
    dmg: 0,
    cd: 1,
    range: 48,
    price: 200,
    moveSpeed: 5.45,
    reward: 0,
    detonatesAfter: 1.45,
    radius: 11,
    duration: 2.8,
    blocksVision: false,
    effect: 'flash',
    ...inertBallistics,
  },
  hegrenade: {
    name: 'HE GRENADE',
    slot: 'utility',
    type: 'utility',
    dmg: 98,
    cd: 1.1,
    range: 46,
    price: 300,
    moveSpeed: 5.35,
    reward: 0,
    detonatesAfter: 1.6,
    radius: 4.8,
    duration: 0.4,
    blocksVision: false,
    effect: 'explosive',
    ...inertBallistics,
  },
  molotov: {
    name: 'MOLOTOV',
    slot: 'utility',
    type: 'utility',
    dmg: 8,
    cd: 1.2,
    range: 40,
    price: 400,
    moveSpeed: 5.3,
    reward: 0,
    detonatesAfter: 1.35,
    radius: 4.6,
    duration: 7,
    blocksVision: false,
    effect: 'incendiary',
    ...inertBallistics,
  },
};

export const UTILITY_WEAPON_IDS = ['smoke', 'flash', 'hegrenade', 'molotov'] as const;

export function getWeaponConfig(id: string): WeaponConfig {
  const config = WEAPONS[id];
  if (!config) throw new Error(`Unknown weapon config: ${id}`);
  return config;
}

export function validateWeaponCatalog(catalog: WeaponCatalog): { errors: string[]; weaponCount: number } {
  const errors: string[] = [];

  for (const [id, weapon] of Object.entries(catalog)) {
    if (!/^[a-z0-9_-]+$/.test(id)) errors.push(`${id}: id must be URL-safe.`);
    if (!/^[A-Z0-9 +_.-]+$/.test(weapon.name)) errors.push(`${id}: weapon name contains unsafe UI characters.`);
    if (weapon.price < 0 || !Number.isFinite(weapon.price)) errors.push(`${id}: invalid price.`);
    if (weapon.cd < 0 || !Number.isFinite(weapon.cd)) errors.push(`${id}: invalid cooldown.`);
    if (weapon.range < 0 || !Number.isFinite(weapon.range)) errors.push(`${id}: invalid range.`);
    if (weapon.armorPen < 0 || weapon.armorPen > 1) errors.push(`${id}: armor penetration must be 0..1.`);
    if (weapon.moveSpeed <= 0) errors.push(`${id}: moveSpeed must be positive.`);

    if (weapon.type === 'gun') {
      if (weapon.magSize <= 0) errors.push(`${id}: guns need a positive magSize.`);
      if (weapon.reserve < 0) errors.push(`${id}: reserve ammo cannot be negative.`);
      if (!weapon.recoil.length) errors.push(`${id}: guns need recoil pattern data.`);
      if (!weapon.fireModes?.length) errors.push(`${id}: guns need at least one fire mode.`);
    }

    if (weapon.type === 'utility') {
      if (!weapon.effect) errors.push(`${id}: utility must declare an effect.`);
      if (!weapon.radius || weapon.radius <= 0) errors.push(`${id}: utility must declare a positive radius.`);
      if (!weapon.detonatesAfter || weapon.detonatesAfter <= 0) errors.push(`${id}: utility must declare detonation timing.`);
    }
  }

  return {
    errors,
    weaponCount: Object.keys(catalog).length,
  };
}
