import type { Team } from '../gameplay/match/MatchRules.ts';
import {
  scoreTacticalOptions,
  updateEnemyMemory,
  type EnemyMemory,
  type TacticalAction,
} from './TacticalDirector.ts';

export type AudibleEventKind = 'footstep' | 'gunshot' | 'objective';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface AudibleEvent {
  team: Team | 'neutral';
  kind: AudibleEventKind;
  position: Vec3Like;
  age: number;
  loudness: number;
}

export interface HeardThreat {
  kind: AudibleEventKind;
  position: Vec3Like;
  age: number;
  score: number;
}

export interface BotBlackboardInput {
  botTeam: Team;
  botPosition: Vec3Like;
  hp: number;
  ammoRatio: number;
  distanceToObjective: number;
  visibleEnemies: number;
  nearbyAllies: number;
  hasBomb: boolean;
  bombPlanted: boolean;
  soundAwareness: number;
  recentDamageAge: number;
  visibleEnemyPosition?: Vec3Like;
  previousEnemyMemory?: EnemyMemory;
  audibleEvents: AudibleEvent[];
  dt: number;
}

export interface BotBlackboardState {
  danger: number;
  decision: TacticalAction;
  heardThreat?: HeardThreat;
  enemyMemory?: EnemyMemory;
}

export function pickHeardThreat(
  botPosition: Vec3Like,
  botTeam: Team,
  audibleEvents: AudibleEvent[],
  soundAwareness: number,
): HeardThreat | undefined {
  let best: HeardThreat | undefined;

  for (const event of audibleEvents) {
    if (event.team === botTeam) continue;
    if (event.age > 6) continue;

    const distance = distance3(botPosition, event.position);
    const score =
      event.loudness *
      freshnessScore(event.age, 6) *
      audibilityScore(distance) *
      (0.65 + soundAwareness * 0.9);

    if (!best || score > best.score) {
      best = {
        kind: event.kind,
        position: { ...event.position },
        age: event.age,
        score,
      };
    }
  }

  return best;
}

export function computeBotDangerLevel(input: {
  hp: number;
  visibleEnemies: number;
  distanceToObjective: number;
  recentDamageAge: number;
  bombPlanted: boolean;
  heardThreat?: HeardThreat;
}): number {
  const hpRisk = clamp01((55 - input.hp) / 55);
  const enemyPressure = clamp01(input.visibleEnemies / 3);
  const objectivePressure = input.bombPlanted ? clamp01((18 - input.distanceToObjective) / 18) * 0.28 : 0;
  const recentDamage = freshnessScore(input.recentDamageAge, 1.6) * 0.42;
  const soundPressure = input.heardThreat ? clamp01(input.heardThreat.score) * 0.22 : 0;

  return clamp01(hpRisk * 0.42 + enemyPressure * 0.46 + recentDamage + objectivePressure + soundPressure);
}

export function updateBotBlackboard(input: BotBlackboardInput): BotBlackboardState {
  const heardThreat = pickHeardThreat(
    input.botPosition,
    input.botTeam,
    input.audibleEvents,
    input.soundAwareness,
  );

  const danger = computeBotDangerLevel({
    hp: input.hp,
    visibleEnemies: input.visibleEnemies,
    distanceToObjective: input.distanceToObjective,
    recentDamageAge: input.recentDamageAge,
    bombPlanted: input.bombPlanted,
    heardThreat,
  });

  const enemyMemory = updateEnemyMemory(
    input.previousEnemyMemory,
    input.visibleEnemyPosition,
    input.dt,
  );

  let decision = scoreTacticalOptions({
    hp: input.hp,
    ammoRatio: input.ammoRatio,
    distanceToObjective: input.distanceToObjective,
    visibleEnemies: input.visibleEnemies,
    nearbyAllies: input.nearbyAllies,
    danger,
    hasBomb: input.hasBomb,
    bombPlanted: input.bombPlanted,
    heardFootstepAge: heardThreat?.age ?? 99,
  })[0]?.action ?? 'hold-crossfire';

  // Fresh hostile audio should break passive rotate loops and trigger a real clear.
  if (
    input.visibleEnemies === 0 &&
    heardThreat &&
    heardThreat.age < 1.5 &&
    heardThreat.score > 0.16 &&
    danger < 0.74
  ) {
    decision = 'investigate-sound';
  }

  return {
    danger,
    decision,
    heardThreat,
    enemyMemory,
  };
}

export function advanceAudibleEvents(events: AudibleEvent[], dt: number, maxAge = 6): AudibleEvent[] {
  return events
    .map((event) => ({ ...event, age: event.age + dt }))
    .filter((event) => event.age <= maxAge);
}

function freshnessScore(age: number, maxAge: number): number {
  return clamp01(1 - age / maxAge);
}

function audibilityScore(distance: number): number {
  return clamp01(1 / (1 + distance / 20));
}

function distance3(a: Vec3Like, b: Vec3Like): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
