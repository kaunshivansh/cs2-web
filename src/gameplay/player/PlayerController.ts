// PlayerController.ts — Pure player movement physics with capsule-based collision.
// No React, no Three.js. All geometry uses plain number/object types.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Collider {
  min: Vec3;
  max: Vec3;
}

export interface CapsuleConfig {
  radius: number;
  height: number;
}

export interface MoveResult {
  position: Vec3;
  velocity: Vec3;
  onGround: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Projects velocity onto the surface plane (edge sliding).
 * If dot(velocity, normal) < 0, removes the component of velocity along the normal.
 */
export function resolveCollision(velocity: Vec3, surfaceNormal: Vec3): Vec3 {
  const d = dot(velocity, surfaceNormal);
  if (d < 0) {
    return {
      x: velocity.x - surfaceNormal.x * d,
      y: velocity.y - surfaceNormal.y * d,
      z: velocity.z - surfaceNormal.z * d,
    };
  }
  return { ...velocity };
}

/**
 * Tests if a capsule at `position` overlaps with an AABB collider.
 * The capsule extends from position.y - capsule.height to position.y + 0.1
 * with horizontal radius capsule.radius.
 */
export function capsuleOverlapsAABB(
  position: Vec3,
  capsule: CapsuleConfig,
  collider: Collider,
): boolean {
  const capsuleBottom = position.y - capsule.height;
  const capsuleTop = position.y + 0.1;

  // Vertical overlap check
  if (capsuleTop < collider.min.y || capsuleBottom > collider.max.y) {
    return false;
  }

  // Horizontal overlap: closest point on AABB to capsule center axis
  const closestX = clamp(position.x, collider.min.x, collider.max.x);
  const closestZ = clamp(position.z, collider.min.z, collider.max.z);

  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distSq = dx * dx + dz * dz;

  return distSq <= capsule.radius * capsule.radius;
}

/**
 * Checks if the player can stair-step over an obstacle.
 * Returns whether stepping is possible and the Y position after the step.
 */
export function canStairStep(
  position: Vec3,
  velocity: Vec3,
  colliders: Collider[],
  capsule: CapsuleConfig,
  stepHeight: number = 0.22,
): { canStep: boolean; newY: number } {
  // Raise position by stepHeight and try moving forward
  const raisedPos: Vec3 = {
    x: position.x + velocity.x,
    y: position.y + stepHeight,
    z: position.z + velocity.z,
  };

  // Check if raised position collides with anything
  const collidesAtRaised = colliders.some((c) =>
    capsuleOverlapsAABB(raisedPos, capsule, c),
  );

  if (collidesAtRaised) {
    return { canStep: false, newY: position.y };
  }

  // Sweep downward to find ground
  let groundY = position.y;
  const sweepSteps = 10;
  const sweepDelta = stepHeight / sweepSteps;

  for (let i = 0; i <= sweepSteps; i++) {
    const testY = raisedPos.y - sweepDelta * i;
    const testPos: Vec3 = { x: raisedPos.x, y: testY, z: raisedPos.z };

    const collides = colliders.some((c) =>
      capsuleOverlapsAABB(testPos, capsule, c),
    );

    if (collides) {
      // Ground found just above this position
      groundY = testY + sweepDelta;
      return { canStep: true, newY: groundY };
    }
  }

  // No ground found within step range – can step but land at original height
  return { canStep: true, newY: position.y };
}

/**
 * Checks if a slope is walkable based on its surface normal.
 * Returns walkability and the slide direction if the slope is too steep.
 */
export function checkSlopeAngle(
  surfaceNormal: Vec3,
  maxSlopeAngle: number = 45,
): { walkable: boolean; slideDirection: Vec3 } {
  const maxCos = Math.cos((maxSlopeAngle * Math.PI) / 180);
  const normalised = normalize(surfaceNormal);

  if (normalised.y >= maxCos) {
    return { walkable: true, slideDirection: { x: 0, y: 0, z: 0 } };
  }

  // Compute slide direction: gravity projected onto the slope surface
  // slideDir = gravity - normal * dot(gravity, normal)
  const gravity: Vec3 = { x: 0, y: -1, z: 0 };
  const d = dot(gravity, normalised);
  const slideDirection = normalize({
    x: gravity.x - normalised.x * d,
    y: gravity.y - normalised.y * d,
    z: gravity.z - normalised.z * d,
  });

  return { walkable: false, slideDirection };
}

/**
 * Smoothly interpolates crouch height using exponential lerp.
 */
export function lerpCrouchHeight(
  currentHeight: number,
  targetHeight: number,
  dt: number,
  speed: number = 12,
): number {
  const t = 1 - Math.exp(-speed * dt);
  return currentHeight + (targetHeight - currentHeight) * t;
}

/**
 * Main movement function. Moves the player with capsule collision, stair
 * stepping, and edge sliding. Processes each axis independently.
 */
export function moveWithCapsuleCollision(
  position: Vec3,
  velocity: Vec3,
  dt: number,
  capsule: CapsuleConfig,
  colliders: Collider[],
  stepHeight: number = 0.22,
): MoveResult {
  const MAP_MIN = -60;
  const MAP_MAX = 60;

  let pos: Vec3 = { ...position };
  let vel: Vec3 = { ...velocity };
  let onGround = false;

  // ── X axis ──────────────────────────────────────────────────────────────
  const nextX: Vec3 = { x: pos.x + vel.x * dt, y: pos.y, z: pos.z };
  const collidesX = colliders.some((c) =>
    capsuleOverlapsAABB(nextX, capsule, c),
  );

  if (!collidesX) {
    pos.x = nextX.x;
  } else {
    // Try stair stepping
    const step = canStairStep(
      pos,
      { x: vel.x * dt, y: 0, z: 0 },
      colliders,
      capsule,
      stepHeight,
    );
    if (step.canStep && step.newY > pos.y) {
      pos.x = pos.x + vel.x * dt;
      pos.y = step.newY;
    } else {
      // Edge sliding along X wall — wall normal is along X
      const wallNormal: Vec3 = { x: vel.x > 0 ? -1 : 1, y: 0, z: 0 };
      vel = resolveCollision(vel, wallNormal);
    }
  }

  // ── Z axis ──────────────────────────────────────────────────────────────
  const nextZ: Vec3 = { x: pos.x, y: pos.y, z: pos.z + vel.z * dt };
  const collidesZ = colliders.some((c) =>
    capsuleOverlapsAABB(nextZ, capsule, c),
  );

  if (!collidesZ) {
    pos.z = nextZ.z;
  } else {
    const step = canStairStep(
      pos,
      { x: 0, y: 0, z: vel.z * dt },
      colliders,
      capsule,
      stepHeight,
    );
    if (step.canStep && step.newY > pos.y) {
      pos.z = pos.z + vel.z * dt;
      pos.y = step.newY;
    } else {
      const wallNormal: Vec3 = { x: 0, y: 0, z: vel.z > 0 ? -1 : 1 };
      vel = resolveCollision(vel, wallNormal);
    }
  }

  // ── Y axis (gravity / ground) ───────────────────────────────────────────
  const nextY: Vec3 = { x: pos.x, y: pos.y + vel.y * dt, z: pos.z };
  const collidesY = colliders.some((c) =>
    capsuleOverlapsAABB(nextY, capsule, c),
  );

  if (!collidesY) {
    pos.y = nextY.y;
  } else {
    // Falling downward and hit something → on ground
    if (vel.y <= 0) {
      onGround = true;
    }
    vel.y = 0;
  }

  // Ground plane check
  if (pos.y <= 0) {
    pos.y = 0;
    if (vel.y < 0) vel.y = 0;
    onGround = true;
  }

  // ── Clamp to map boundaries ─────────────────────────────────────────────
  pos.x = clamp(pos.x, MAP_MIN, MAP_MAX);
  pos.y = clamp(pos.y, 0, MAP_MAX);
  pos.z = clamp(pos.z, MAP_MIN, MAP_MAX);

  return { position: pos, velocity: vel, onGround };
}
