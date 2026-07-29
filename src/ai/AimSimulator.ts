export interface Vec2 { x: number; y: number; }

export interface AimState {
  currentAngle: Vec2;  // current pitch, yaw
  targetAngle: Vec2;   // desired pitch, yaw
  reactionTimer: number; // seconds remaining before bot can aim
}

export type AimDifficulty = 'easy' | 'medium' | 'hard' | 'pro';

export const AIM_DIFFICULTY_PARAMS: Record<AimDifficulty, {
  reactionTimeMs: number;   // ms before starting to aim
  aimSpeed: number;         // lerp speed multiplier
  noiseRadius: number;      // gaussian noise spread
  burstAccuracy: number;    // accuracy during burst (0-1)
}> = {
  easy:   { reactionTimeMs: 700, aimSpeed: 3.5,  noiseRadius: 0.035, burstAccuracy: 0.3 },
  medium: { reactionTimeMs: 450, aimSpeed: 6.0,  noiseRadius: 0.018, burstAccuracy: 0.55 },
  hard:   { reactionTimeMs: 250, aimSpeed: 9.0,  noiseRadius: 0.008, burstAccuracy: 0.75 },
  pro:    { reactionTimeMs: 120, aimSpeed: 14.0, noiseRadius: 0.002, burstAccuracy: 0.92 },
};

export function createAimState(): AimState {
  return {
    currentAngle: { x: 0, y: 0 },
    targetAngle: { x: 0, y: 0 },
    reactionTimer: 0,
  };
}

export function setTarget(state: AimState, targetAngle: Vec2, difficulty: AimDifficulty): AimState {
  const params = AIM_DIFFICULTY_PARAMS[difficulty];
  return {
    ...state,
    targetAngle: { x: targetAngle.x, y: targetAngle.y },
    reactionTimer: params.reactionTimeMs / 1000,
  };
}

export function gaussianNoise(stddev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev;
}

export function updateAim(state: AimState, dt: number, difficulty: AimDifficulty): AimState {
  const params = AIM_DIFFICULTY_PARAMS[difficulty];

  // Decrement reaction timer
  const newReactionTimer = Math.max(0, state.reactionTimer - dt);

  // If still reacting, don't move aim
  if (newReactionTimer > 0) {
    return {
      ...state,
      reactionTimer: newReactionTimer,
    };
  }

  // Lerp currentAngle toward targetAngle
  const lerpFactor = Math.min(1, params.aimSpeed * dt);
  const dx = state.targetAngle.x - state.currentAngle.x;
  const dy = state.targetAngle.y - state.currentAngle.y;

  const newAngle: Vec2 = {
    x: state.currentAngle.x + dx * lerpFactor + gaussianNoise(params.noiseRadius),
    y: state.currentAngle.y + dy * lerpFactor + gaussianNoise(params.noiseRadius),
  };

  return {
    ...state,
    currentAngle: newAngle,
    reactionTimer: 0,
  };
}

export function getAimError(state: AimState): number {
  const dx = state.currentAngle.x - state.targetAngle.x;
  const dy = state.currentAngle.y - state.targetAngle.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isAimReady(state: AimState, threshold: number = 0.05): boolean {
  return getAimError(state) < threshold;
}
