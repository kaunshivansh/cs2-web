import * as THREE from 'three';

export interface Collider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class PhysicsSystem {
  private tempBox = new THREE.Box3();
  private playerBox = new THREE.Box3();
  
  // AAA Movement Constants
  public gravity = 28;
  public friction = 8.5; // High friction for snappy tactical stops (counter-strafing)
  public airFriction = 0.5;
  public maxSpeed = 250; // Base speed, scaled by weapon

  constructor(public colliders: Collider[]) {}

  public updatePlayerPhysics(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    dt: number,
    isGrounded: boolean,
    moveDir: THREE.Vector3, // Normalized movement intention
    speedScale: number
  ): { onGround: boolean } {
    
    // Apply Gravity
    vel.y -= this.gravity * dt;

    // Movement Physics (Source-engine style)
    const currentSpeed = Math.hypot(vel.x, vel.z);
    
    // Apply Friction (Ground only)
    if (isGrounded) {
      const drop = currentSpeed * this.friction * dt;
      const multiplier = Math.max(0, currentSpeed - drop) / (currentSpeed || 1);
      vel.x *= multiplier;
      vel.z *= multiplier;
    } else {
      // Air drag
      vel.x *= (1 - this.airFriction * dt);
      vel.z *= (1 - this.airFriction * dt);
    }

    // Apply Acceleration
    const accel = isGrounded ? 14 : 2; // Much less control in air
    const targetSpeed = this.maxSpeed * speedScale * 0.01; // Scale to world units
    
    vel.x += moveDir.x * targetSpeed * accel * dt;
    vel.z += moveDir.z * targetSpeed * accel * dt;

    // Clamp horizontal speed
    const newSpeed = Math.hypot(vel.x, vel.z);
    if (newSpeed > targetSpeed && isGrounded) {
      vel.x = (vel.x / newSpeed) * targetSpeed;
      vel.z = (vel.z / newSpeed) * targetSpeed;
    }

    // Attempt Move
    pos.x += vel.x * dt;
    this.resolveCollisions(pos, vel, 'x');

    pos.y += vel.y * dt;
    const hitGround = this.resolveCollisions(pos, vel, 'y');

    pos.z += vel.z * dt;
    this.resolveCollisions(pos, vel, 'z');

    return { onGround: hitGround && vel.y <= 0 };
  }

  private resolveCollisions(pos: THREE.Vector3, vel: THREE.Vector3, axis: 'x' | 'y' | 'z'): boolean {
    const r = 0.35; // Player radius
    const h = 1.6;  // Player height
    
    // Player AABB
    this.playerBox.min.set(pos.x - r, pos.y - h, pos.z - r);
    this.playerBox.max.set(pos.x + r, pos.y, pos.z + r);

    let collided = false;

    for (const c of this.colliders) {
      this.tempBox.min.copy(c.min);
      this.tempBox.max.copy(c.max);

      if (this.playerBox.intersectsBox(this.tempBox)) {
        collided = true;
        if (axis === 'y') {
          if (vel.y < 0) {
            pos.y = c.max.y + h;
          } else if (vel.y > 0) {
            pos.y = c.min.y;
          }
          vel.y = 0;
        } else if (axis === 'x') {
          if (vel.x > 0) pos.x = c.min.x - r;
          else if (vel.x < 0) pos.x = c.max.x + r;
          vel.x = 0;
        } else if (axis === 'z') {
          if (vel.z > 0) pos.z = c.min.z - r;
          else if (vel.z < 0) pos.z = c.max.z + r;
          vel.z = 0;
        }
        
        // Recompute AABB for next collider check
        this.playerBox.min.set(pos.x - r, pos.y - h, pos.z - r);
        this.playerBox.max.set(pos.x + r, pos.y, pos.z + r);
      }
    }
    return collided;
  }
}
