/**
 * Deterministic CS2-style recoil patterns.
 * Each entry is [pitchOffset, yawOffset] applied per shot.
 * The pattern resets when the trigger is released + recovery time.
 */

export interface RecoilOffset {
  pitch: number;
  yaw: number;
}

/**
 * Per-weapon recoil patterns. Each array element corresponds to a shot index.
 * After the pattern is exhausted, the last entry is repeated.
 */
export const RECOIL_PATTERNS: Record<string, RecoilOffset[]> = {
  ak47: [
    { pitch: 0,    yaw: 0    },
    { pitch: 1.5,  yaw: 0.3  },
    { pitch: 2.1,  yaw: -0.2 },
    { pitch: 2.8,  yaw: 0.5  },
    { pitch: 3.2,  yaw: -0.4 },
    { pitch: 3.9,  yaw: 0.2  },
    { pitch: 4.1,  yaw: -0.6 },
    { pitch: 4.5,  yaw: 0.3  },
    { pitch: 4.8,  yaw: -0.1 },
    { pitch: 5.2,  yaw: 0.4  },
  ],
  m4a1: [
    { pitch: 0,    yaw: 0    },
    { pitch: 1.2,  yaw: 0.2  },
    { pitch: 1.8,  yaw: -0.15 },
    { pitch: 2.3,  yaw: 0.35 },
    { pitch: 2.7,  yaw: -0.3  },
    { pitch: 3.1,  yaw: 0.15 },
    { pitch: 3.4,  yaw: -0.4  },
    { pitch: 3.7,  yaw: 0.25 },
    { pitch: 3.9,  yaw: -0.1  },
    { pitch: 4.1,  yaw: 0.3  },
  ],
  mp9: [
    { pitch: 0,    yaw: 0    },
    { pitch: 0.8,  yaw: 0.4  },
    { pitch: 1.4,  yaw: -0.3 },
    { pitch: 1.9,  yaw: 0.5  },
    { pitch: 2.3,  yaw: -0.2 },
    { pitch: 2.6,  yaw: 0.3  },
    { pitch: 2.8,  yaw: -0.4 },
    { pitch: 3.0,  yaw: 0.2  },
  ],
  mac10: [
    { pitch: 0,    yaw: 0    },
    { pitch: 0.9,  yaw: 0.5  },
    { pitch: 1.6,  yaw: -0.4 },
    { pitch: 2.2,  yaw: 0.6  },
    { pitch: 2.7,  yaw: -0.3 },
    { pitch: 3.1,  yaw: 0.4  },
    { pitch: 3.4,  yaw: -0.5 },
    { pitch: 3.6,  yaw: 0.3  },
  ],
  usp: [
    { pitch: 0,   yaw: 0   },
    { pitch: 0.8, yaw: 0.1 },
    { pitch: 1.2, yaw: -0.1 },
  ],
  deagle: [
    { pitch: 0,    yaw: 0   },
    { pitch: 2.2,  yaw: 0.4 },
    { pitch: 3.1,  yaw: -0.3 },
  ],
  glock: [
    { pitch: 0,   yaw: 0   },
    { pitch: 0.6, yaw: 0.2 },
    { pitch: 1.0, yaw: -0.15 },
  ],
  awp: [
    { pitch: 0, yaw: 0 },
    { pitch: 3.5, yaw: 0 },
  ],
};

/**
 * Get the recoil offset for a specific weapon at a given shot index.
 * If the shot index exceeds the pattern length, the last entry is used.
 */
export function getRecoilOffset(weaponId: string, shotIndex: number): RecoilOffset {
  const pattern = RECOIL_PATTERNS[weaponId];
  if (!pattern || pattern.length === 0) {
    return { pitch: 0, yaw: 0 };
  }
  const idx = Math.min(shotIndex, pattern.length - 1);
  return pattern[idx];
}

/**
 * Convert recoil offset in degrees to radians, scaled by intensity factor.
 */
export function recoilToRadians(offset: RecoilOffset, intensity: number = 0.016): RecoilOffset {
  return {
    pitch: offset.pitch * intensity,
    yaw: offset.yaw * intensity,
  };
}

export interface FirstShotAccuracyInput {
  timeSinceStationary: number; // seconds standing still
  timeSinceJump: number;       // seconds since last jump
}

/**
 * Returns true if conditions are met for perfect first-shot accuracy
 * (zero spread on the first bullet).
 */
export function hasFirstShotAccuracy(input: FirstShotAccuracyInput): boolean {
  return input.timeSinceStationary >= 0.3 && input.timeSinceJump >= 0.5;
}

/**
 * Compute movement spread penalty.
 * Multiplies base spread by 1 + (velocity / maxSpeed) * 2.5
 */
export function movementSpreadPenalty(velocity: number, maxSpeed: number): number {
  return 1 + (Math.min(velocity, maxSpeed) / maxSpeed) * 2.5;
}

/**
 * Compute camera punch on fire.
 * Returns the instant pitch kick in radians.
 * Lerp back to zero at the specified recovery rate.
 */
export const CAMERA_PUNCH_PITCH = 0.8 * (Math.PI / 180); // 0.8 degrees in radians
export const CAMERA_PUNCH_RECOVERY_MS = 80;
