import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAMAGE_MULTIPLIERS,
  computeHitboxBounds,
  findHitPart,
  DEFAULT_HITBOX_LAYOUT,
} from '../../src/gameplay/combat/Hitbox.ts';
import { computeDamage } from '../../src/gameplay/combat/CombatSystem.ts';
import type { Vec3 } from '../../src/gameplay/combat/Hitbox.ts';

test('DAMAGE_MULTIPLIERS has correct values for all body parts', () => {
  assert.equal(DAMAGE_MULTIPLIERS.head, 4.0);
  assert.equal(DAMAGE_MULTIPLIERS.neck, 4.0);
  assert.equal(DAMAGE_MULTIPLIERS.torso, 1.0);
  assert.equal(DAMAGE_MULTIPLIERS.stomach, 1.25);
  assert.equal(DAMAGE_MULTIPLIERS.arm, 0.75);
  assert.equal(DAMAGE_MULTIPLIERS.leg, 0.75);
});

test('computeHitboxBounds positions hitboxes correctly', () => {
  const entityPos: Vec3 = { x: 5, y: 0, z: 10 };
  const layout = [
    { part: 'head' as const, offsetY: 1.68, radiusX: 0.12, radiusY: 0.12, radiusZ: 0.12 },
  ];

  const bounds = computeHitboxBounds(entityPos, layout);
  assert.equal(bounds.length, 1);

  const head = bounds[0];
  assert.equal(head.part, 'head');
  assert.ok(Math.abs(head.minX - (5 - 0.12)) < 0.001);
  assert.ok(Math.abs(head.maxX - (5 + 0.12)) < 0.001);
  assert.ok(Math.abs(head.minY - (1.68 - 0.12)) < 0.001);
  assert.ok(Math.abs(head.maxY - (1.68 + 0.12)) < 0.001);
  assert.ok(Math.abs(head.minZ - (10 - 0.12)) < 0.001);
  assert.ok(Math.abs(head.maxZ - (10 + 0.12)) < 0.001);
});

test('findHitPart returns head for ray aimed at head height', () => {
  const entityPos: Vec3 = { x: 0, y: 0, z: 5 };
  // Ray from origin, aimed straight at head height (y = 1.68)
  const rayOrigin: Vec3 = { x: 0, y: 1.68, z: 0 };
  const rayDir: Vec3 = { x: 0, y: 0, z: 1 }; // shooting along +Z

  const result = findHitPart(rayOrigin, rayDir, entityPos);
  assert.notEqual(result, null);
  assert.equal(result!.part, 'head');
  assert.ok(result!.distance > 0);
});

test('findHitPart returns null for ray that misses', () => {
  const entityPos: Vec3 = { x: 0, y: 0, z: 5 };
  // Ray aimed far above the entity
  const rayOrigin: Vec3 = { x: 0, y: 10, z: 0 };
  const rayDir: Vec3 = { x: 0, y: 0, z: 1 };

  const result = findHitPart(rayOrigin, rayDir, entityPos);
  assert.equal(result, null);
});

test('computeDamage applies headshot multiplier correctly', () => {
  const result = computeDamage({
    baseDamage: 30,
    bodyPart: 'head',
    armorPenetration: 1.0, // full pen, no armor effect
    targetArmor: 0,
    targetHasHelmet: false,
    distance: 0,
    maxRange: 1000,
  });

  // 30 * 4.0 * 1.0 (range factor at dist=0) = 120
  assert.equal(result.damage, 120);
  assert.equal(result.isHeadshot, true);
});

test('computeDamage reduces head multiplier to 1.4 with helmet', () => {
  const result = computeDamage({
    baseDamage: 30,
    bodyPart: 'head',
    armorPenetration: 1.0, // full pen so armor doesn't absorb
    targetArmor: 100,
    targetHasHelmet: true,
    distance: 0,
    maxRange: 1000,
  });

  // 30 * 1.4 * 1.0 = 42, full pen means no absorption
  assert.equal(result.damage, 42);
  assert.equal(result.isHeadshot, true);
});

test('computeDamage applies armor reduction', () => {
  const result = computeDamage({
    baseDamage: 40,
    bodyPart: 'torso',
    armorPenetration: 0.5,
    targetArmor: 100,
    targetHasHelmet: false,
    distance: 0,
    maxRange: 1000,
  });

  // multiplier = 1.0, range factor = 1.0
  // raw damage = 40 * 1.0 * 1.0 = 40
  // absorbed = 40 * (1 - 0.5) = 20
  // final damage = 40 - 20 = 20
  assert.equal(result.damage, 20);
  assert.equal(result.armorDamage, 20);
  assert.equal(result.remainingArmor, 80);
});

test('computeDamage applies range falloff', () => {
  const result = computeDamage({
    baseDamage: 100,
    bodyPart: 'torso',
    armorPenetration: 1.0,
    targetArmor: 0,
    targetHasHelmet: false,
    distance: 500,
    maxRange: 1000,
  });

  // multiplier = 1.0
  // range factor = 1 - (500/1000) * 0.12 = 1 - 0.06 = 0.94
  // damage = 100 * 1.0 * 0.94 = 94
  assert.equal(result.damage, 94);
});
