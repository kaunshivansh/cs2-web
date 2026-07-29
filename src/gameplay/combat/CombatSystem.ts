import type { BodyPart } from './Hitbox.ts';
import { DAMAGE_MULTIPLIERS } from './Hitbox.ts';

export interface DamageInput {
  baseDamage: number;
  bodyPart: BodyPart;
  armorPenetration: number; // 0-1
  targetArmor: number;
  targetHasHelmet: boolean;
  distance: number;
  maxRange: number;
}

export interface DamageResult {
  damage: number;
  armorDamage: number;
  remainingArmor: number;
  isHeadshot: boolean;
}

/**
 * Computes final damage after applying body-part multiplier, range falloff,
 * helmet reduction, and armor absorption.
 *
 * - Helmet: if targetHasHelmet && targetArmor > 0 && bodyPart === 'head',
 *   the head multiplier is reduced from 4.0 to 1.4.
 * - Range falloff: factor = 1 - (distance / maxRange) * 0.12
 * - Armor reduction: absorbed = rawDamage * (1 - armorPenetration) when armor > 0
 *   and the body part is protected (head with helmet, or torso/stomach/arm).
 */
export function computeDamage(input: DamageInput): DamageResult {
  const { baseDamage, bodyPart, armorPenetration, targetArmor, targetHasHelmet, distance, maxRange } = input;

  const isHeadshot = bodyPart === 'head';

  // 1. Body-part multiplier (with helmet adjustment)
  let multiplier = DAMAGE_MULTIPLIERS[bodyPart];
  if (isHeadshot && targetHasHelmet && targetArmor > 0) {
    multiplier = 1.4;
  }

  // 2. Apply multiplier
  let damage = baseDamage * multiplier;

  // 3. Range falloff
  const rangeFactor = 1 - (distance / maxRange) * 0.12;
  damage *= rangeFactor;

  // 4. Armor reduction
  // Armor protects: torso, stomach, arm always; head only with helmet
  const armorProtects =
    bodyPart === 'torso' ||
    bodyPart === 'stomach' ||
    bodyPart === 'arm' ||
    (bodyPart === 'head' && targetHasHelmet);

  let armorDamage = 0;
  let remainingArmor = targetArmor;

  if (armorProtects && targetArmor > 0) {
    const absorbed = damage * (1 - armorPenetration);
    armorDamage = Math.min(absorbed, targetArmor);
    remainingArmor = targetArmor - armorDamage;
    damage -= armorDamage;
  }

  // Clamp
  damage = Math.max(0, damage);
  remainingArmor = Math.max(0, remainingArmor);

  return {
    damage: Math.round(damage * 100) / 100,
    armorDamage: Math.round(armorDamage * 100) / 100,
    remainingArmor: Math.round(remainingArmor * 100) / 100,
    isHeadshot,
  };
}
