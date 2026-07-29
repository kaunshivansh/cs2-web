export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BodyPart = 'head' | 'neck' | 'torso' | 'stomach' | 'arm' | 'leg';

export const DAMAGE_MULTIPLIERS: Record<BodyPart, number> = {
  head: 4.0,
  neck: 4.0,
  torso: 1.0,
  stomach: 1.25,
  arm: 0.75,
  leg: 0.75,
};

export const HITBOX_CHECK_ORDER: BodyPart[] = ['head', 'neck', 'torso', 'stomach', 'arm', 'leg'];

export interface HitboxBounds {
  part: BodyPart;
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface HitboxConfig {
  part: BodyPart;
  offsetY: number;
  radiusX: number;
  radiusY: number;
  radiusZ: number;
}

export const DEFAULT_HITBOX_LAYOUT: HitboxConfig[] = [
  { part: 'head',    offsetY: 1.68, radiusX: 0.12, radiusY: 0.12, radiusZ: 0.12 },
  { part: 'neck',    offsetY: 1.52, radiusX: 0.08, radiusY: 0.06, radiusZ: 0.08 },
  { part: 'torso',   offsetY: 1.20, radiusX: 0.22, radiusY: 0.22, radiusZ: 0.15 },
  { part: 'stomach', offsetY: 0.90, radiusX: 0.20, radiusY: 0.14, radiusZ: 0.14 },
  { part: 'arm',     offsetY: 1.20, radiusX: 0.35, radiusY: 0.28, radiusZ: 0.10 },
  { part: 'leg',     offsetY: 0.45, radiusX: 0.16, radiusY: 0.40, radiusZ: 0.12 },
];

/**
 * Computes world-space AABB bounds for each hitbox config given an entity position.
 */
export function computeHitboxBounds(entityPosition: Vec3, layout: HitboxConfig[]): HitboxBounds[] {
  return layout.map((config) => {
    const centerY = entityPosition.y + config.offsetY;
    return {
      part: config.part,
      minX: entityPosition.x - config.radiusX,
      maxX: entityPosition.x + config.radiusX,
      minY: centerY - config.radiusY,
      maxY: centerY + config.radiusY,
      minZ: entityPosition.z - config.radiusZ,
      maxZ: entityPosition.z + config.radiusZ,
    };
  });
}

/**
 * Ray-AABB intersection test (slab method).
 * Returns whether the ray hits the box and the distance to the entry point.
 */
export function rayIntersectsHitbox(
  rayOrigin: Vec3,
  rayDir: Vec3,
  hitbox: HitboxBounds
): { hit: boolean; distance: number } {
  let tMin = -Infinity;
  let tMax = Infinity;

  // X slab
  if (rayDir.x !== 0) {
    const t1 = (hitbox.minX - rayOrigin.x) / rayDir.x;
    const t2 = (hitbox.maxX - rayOrigin.x) / rayDir.x;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else {
    if (rayOrigin.x < hitbox.minX || rayOrigin.x > hitbox.maxX) {
      return { hit: false, distance: Infinity };
    }
  }

  // Y slab
  if (rayDir.y !== 0) {
    const t1 = (hitbox.minY - rayOrigin.y) / rayDir.y;
    const t2 = (hitbox.maxY - rayOrigin.y) / rayDir.y;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else {
    if (rayOrigin.y < hitbox.minY || rayOrigin.y > hitbox.maxY) {
      return { hit: false, distance: Infinity };
    }
  }

  // Z slab
  if (rayDir.z !== 0) {
    const t1 = (hitbox.minZ - rayOrigin.z) / rayDir.z;
    const t2 = (hitbox.maxZ - rayOrigin.z) / rayDir.z;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else {
    if (rayOrigin.z < hitbox.minZ || rayOrigin.z > hitbox.maxZ) {
      return { hit: false, distance: Infinity };
    }
  }

  if (tMax < 0 || tMin > tMax) {
    return { hit: false, distance: Infinity };
  }

  const distance = tMin >= 0 ? tMin : tMax;
  return { hit: true, distance };
}

/**
 * Checks hitboxes in HITBOX_CHECK_ORDER priority and returns the first hit part.
 * Returns null if no hitbox is intersected.
 */
export function findHitPart(
  rayOrigin: Vec3,
  rayDir: Vec3,
  entityPosition: Vec3,
  layout: HitboxConfig[] = DEFAULT_HITBOX_LAYOUT
): { part: BodyPart; distance: number } | null {
  const bounds = computeHitboxBounds(entityPosition, layout);

  // Index bounds by part for ordered lookup
  const boundsByPart = new Map<BodyPart, HitboxBounds>();
  for (const b of bounds) {
    boundsByPart.set(b.part, b);
  }

  for (const part of HITBOX_CHECK_ORDER) {
    const hitbox = boundsByPart.get(part);
    if (!hitbox) continue;

    const result = rayIntersectsHitbox(rayOrigin, rayDir, hitbox);
    if (result.hit) {
      return { part, distance: result.distance };
    }
  }

  return null;
}
