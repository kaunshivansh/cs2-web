export interface MovementFlags {
  crouched: boolean;
  walking: boolean;
  scoped: boolean;
}

export interface FlatVelocity {
  x: number;
  z: number;
}

export interface FlatVector {
  x: number;
  z: number;
}

export interface CounterStrafeInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export function computeMovementSpeed(baseSpeed: number, flags: MovementFlags): number {
  let speed = baseSpeed;
  if (flags.crouched) speed *= 0.58;
  if (flags.walking) speed *= 0.74;
  if (flags.scoped) speed *= 0.55;
  return speed;
}

export function applyGroundFrictionToVelocity(
  velocity: FlatVelocity,
  dt: number,
  friction: number,
  stopSpeed = 1.65,
): FlatVelocity {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed < 0.025) return { x: 0, z: 0 };

  const control = Math.max(speed, stopSpeed);
  const next = Math.max(0, speed - control * friction * dt);
  const scale = next / speed;
  return {
    x: velocity.x * scale,
    z: velocity.z * scale,
  };
}

export function applyCounterStrafeToVelocity(
  velocity: FlatVelocity,
  forward: FlatVector,
  right: FlatVector,
  input: CounterStrafeInput,
  strength = 0.86,
): FlatVelocity {
  const next = { ...velocity };

  if (input.forward && input.backward) {
    next.x *= 0.22;
    next.z *= 0.22;
    return next;
  }

  const forwardSpeed = next.x * forward.x + next.z * forward.z;
  const sideSpeed = next.x * right.x + next.z * right.z;

  if (input.forward && forwardSpeed < -0.12) {
    next.x += forward.x * (-forwardSpeed * strength);
    next.z += forward.z * (-forwardSpeed * strength);
  }
  if (input.backward && forwardSpeed > 0.12) {
    next.x += forward.x * (-forwardSpeed * strength);
    next.z += forward.z * (-forwardSpeed * strength);
  }
  if (input.right && sideSpeed < -0.12) {
    next.x += right.x * (-sideSpeed * strength);
    next.z += right.z * (-sideSpeed * strength);
  }
  if (input.left && sideSpeed > 0.12) {
    next.x += right.x * (-sideSpeed * strength);
    next.z += right.z * (-sideSpeed * strength);
  }

  return next;
}
