export type BotCombatState =
  | 'patrolling'
  | 'investigating'
  | 'engaging'
  | 'suppressing'
  | 'retreating'
  | 'reloading'
  | 'planting'
  | 'defusing';

export interface CombatContext {
  hp: number;
  maxHp: number;
  ammoMag: number;
  magSize: number;
  hasLineOfSight: boolean;
  distanceToEnemy: number;
  lastKnownEnemyAge: number; // seconds since last seen
  coverScore: number;        // 0-1, how good current cover is
  nearestCoverScore: number; // 0-1, best nearby cover
  hasBomb: boolean;
  bombPlanted: boolean;
  isOnBombSite: boolean;
  team: 'CT' | 'T';
  difficulty: 'easy' | 'medium' | 'hard' | 'pro';
  suppressionTimer: number;  // seconds spent suppressing
}

export interface CombatTransition {
  nextState: BotCombatState;
  reason: string;
}

export interface BotCombatSnapshot {
  state: BotCombatState;
  stateTime: number; // time in current state
  suppressionTimer: number;
}

export function createCombatSnapshot(initialState: BotCombatState = 'patrolling'): BotCombatSnapshot {
  return {
    state: initialState,
    stateTime: 0,
    suppressionTimer: 0,
  };
}

export function evaluateTransition(
  snapshot: BotCombatSnapshot,
  context: CombatContext
): CombatTransition | null {
  switch (snapshot.state) {
    case 'patrolling':
      if (context.hasLineOfSight) {
        return { nextState: 'engaging', reason: 'Enemy spotted' };
      }
      if (context.lastKnownEnemyAge < 4) {
        return { nextState: 'investigating', reason: 'Heard/saw enemy recently' };
      }
      return null;

    case 'investigating':
      if (context.hasLineOfSight) {
        return { nextState: 'engaging', reason: 'Enemy spotted while investigating' };
      }
      if (snapshot.stateTime > 6) {
        return { nextState: 'patrolling', reason: 'Investigation timed out' };
      }
      return null;

    case 'engaging':
      if (!context.hasLineOfSight && context.lastKnownEnemyAge < 2) {
        return { nextState: 'suppressing', reason: 'Lost sight, suppressing last known position' };
      }
      if (context.hp < context.maxHp * 0.35 && context.nearestCoverScore > 0.7) {
        return { nextState: 'retreating', reason: 'Low HP, retreating to cover' };
      }
      if (context.ammoMag <= 0 && context.coverScore > 0.5) {
        return { nextState: 'reloading', reason: 'Out of ammo, reloading in cover' };
      }
      return null;

    case 'suppressing':
      if (snapshot.suppressionTimer > 1.5) {
        return { nextState: 'investigating', reason: 'Suppression complete, moving to investigate' };
      }
      if (context.hasLineOfSight) {
        return { nextState: 'engaging', reason: 'Reacquired target during suppression' };
      }
      return null;

    case 'retreating':
      if (context.ammoMag <= 0) {
        return { nextState: 'reloading', reason: 'Out of ammo while retreating' };
      }
      if (snapshot.stateTime > 4 && !context.hasLineOfSight) {
        return { nextState: 'patrolling', reason: 'Retreat complete, resuming patrol' };
      }
      return null;

    case 'reloading':
      if (context.hasLineOfSight && context.ammoMag > 0) {
        return { nextState: 'engaging', reason: 'Reload interrupted by enemy contact' };
      }
      if (snapshot.stateTime > 3) {
        return { nextState: 'patrolling', reason: 'Reload complete, resuming patrol' };
      }
      return null;

    case 'planting':
      if (context.hasLineOfSight && context.hp < context.maxHp * 0.5) {
        return { nextState: 'engaging', reason: 'Interrupted planting to fight' };
      }
      return null;

    case 'defusing':
      if (context.hasLineOfSight) {
        return { nextState: 'engaging', reason: 'Interrupted defuse to fight' };
      }
      return null;
  }

  return null;
}

export function advanceCombatState(
  snapshot: BotCombatSnapshot,
  context: CombatContext,
  dt: number
): BotCombatSnapshot {
  const updatedSnapshot: BotCombatSnapshot = {
    ...snapshot,
    stateTime: snapshot.stateTime + dt,
    suppressionTimer: snapshot.state === 'suppressing'
      ? snapshot.suppressionTimer + dt
      : snapshot.suppressionTimer,
  };

  const transition = evaluateTransition(updatedSnapshot, context);

  if (transition) {
    return {
      state: transition.nextState,
      stateTime: 0,
      suppressionTimer: transition.nextState === 'suppressing' ? updatedSnapshot.suppressionTimer : 0,
    };
  }

  return updatedSnapshot;
}

export function shouldFireWeapon(snapshot: BotCombatSnapshot, context: CombatContext): boolean {
  return snapshot.state === 'engaging' || snapshot.state === 'suppressing';
}

export function shouldMove(snapshot: BotCombatSnapshot): boolean {
  return (
    snapshot.state === 'investigating' ||
    snapshot.state === 'retreating' ||
    snapshot.state === 'patrolling'
  );
}
