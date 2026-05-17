export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'pro';
export type TacticalAction =
  | 'take-cover'
  | 'reload'
  | 'engage'
  | 'trade-frag'
  | 'plant-or-defuse'
  | 'hold-crossfire'
  | 'rotate'
  | 'investigate-sound';

export interface BotProfile {
  difficulty: BotDifficulty;
  accuracy: number;
  reactionTime: number;
  aggression: number;
  coordination: number;
  soundAwareness: number;
  utilityBaitChance: number;
  peekDiscipline: number;
}

export interface TacticalScoreInput {
  hp: number;
  ammoRatio: number;
  distanceToObjective: number;
  visibleEnemies: number;
  nearbyAllies: number;
  danger: number;
  hasBomb: boolean;
  bombPlanted: boolean;
  heardFootstepAge: number;
}

export interface TacticalDecision {
  action: TacticalAction;
  score: number;
}

export interface EnemyMemory {
  lastKnownPosition: { x: number; y: number; z: number };
  age: number;
  confidence: number;
}

const PROFILE_BASE: Record<BotDifficulty, Omit<BotProfile, 'difficulty'>> = {
  easy: {
    accuracy: 0.42,
    reactionTime: 0.45,
    aggression: 0.36,
    coordination: 0.22,
    soundAwareness: 0.25,
    utilityBaitChance: 0.03,
    peekDiscipline: 0.28,
  },
  medium: {
    accuracy: 0.58,
    reactionTime: 0.28,
    aggression: 0.52,
    coordination: 0.48,
    soundAwareness: 0.52,
    utilityBaitChance: 0.12,
    peekDiscipline: 0.52,
  },
  hard: {
    accuracy: 0.73,
    reactionTime: 0.18,
    aggression: 0.62,
    coordination: 0.72,
    soundAwareness: 0.78,
    utilityBaitChance: 0.24,
    peekDiscipline: 0.74,
  },
  pro: {
    accuracy: 0.86,
    reactionTime: 0.11,
    aggression: 0.68,
    coordination: 0.9,
    soundAwareness: 0.92,
    utilityBaitChance: 0.36,
    peekDiscipline: 0.88,
  },
};

export function createBotProfile(difficulty: BotDifficulty, seed = 0.5): BotProfile {
  const base = PROFILE_BASE[difficulty];
  const variance = (seed - 0.5) * 0.08;

  return {
    difficulty,
    accuracy: clamp01(base.accuracy + variance),
    reactionTime: Math.max(0.05, base.reactionTime - variance * 0.4),
    aggression: clamp01(base.aggression + variance * 0.5),
    coordination: clamp01(base.coordination + variance * 0.45),
    soundAwareness: clamp01(base.soundAwareness + variance * 0.4),
    utilityBaitChance: clamp01(base.utilityBaitChance + variance * 0.25),
    peekDiscipline: clamp01(base.peekDiscipline + variance * 0.35),
  };
}

export function scoreTacticalOptions(input: TacticalScoreInput): TacticalDecision[] {
  const hpRisk = clamp01((55 - input.hp) / 55);
  const objectiveUrgency = clamp01((16 - input.distanceToObjective) / 16);
  const soundFreshness = clamp01((6 - input.heardFootstepAge) / 6);
  const allySupport = clamp01(input.nearbyAllies / 3);
  const enemyPressure = clamp01(input.visibleEnemies / 3);

  const decisions: TacticalDecision[] = [
    {
      action: 'take-cover',
      score: input.danger * 0.55 + hpRisk * 0.5 + enemyPressure * 0.2,
    },
    {
      action: 'reload',
      score: (1 - input.ammoRatio) * 0.58 + (1 - enemyPressure) * 0.18 - input.danger * 0.2,
    },
    {
      action: 'engage',
      score: enemyPressure * 0.5 + input.ammoRatio * 0.25 + allySupport * 0.18 - hpRisk * 0.24,
    },
    {
      action: 'trade-frag',
      score: enemyPressure * 0.38 + allySupport * 0.34 + input.ammoRatio * 0.16,
    },
    {
      action: 'plant-or-defuse',
      score: objectiveUrgency * 0.7 + (input.hasBomb || input.bombPlanted ? 0.42 : 0) - input.danger * 0.18,
    },
    {
      action: 'hold-crossfire',
      score: allySupport * 0.4 + objectiveUrgency * 0.24 + input.ammoRatio * 0.18 - input.danger * 0.08,
    },
    {
      action: 'rotate',
      score: (1 - objectiveUrgency) * 0.38 + soundFreshness * 0.18 + allySupport * 0.12,
    },
    {
      action: 'investigate-sound',
      score: soundFreshness * 0.46 + input.danger * 0.12 - hpRisk * 0.18,
    },
  ];

  return decisions.sort((a, b) => b.score - a.score);
}

export function updateEnemyMemory(
  memory: EnemyMemory | undefined,
  visiblePosition: EnemyMemory['lastKnownPosition'] | undefined,
  dt: number,
): EnemyMemory | undefined {
  if (visiblePosition) {
    return {
      lastKnownPosition: { ...visiblePosition },
      age: 0,
      confidence: 1,
    };
  }

  if (!memory) return undefined;

  const age = memory.age + dt;
  if (age > 8) return undefined;

  return {
    ...memory,
    age,
    confidence: clamp01(1 - age / 8),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
