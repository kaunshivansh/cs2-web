export type BotNodeStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING';

export interface BotContext {
  id: number;
  team: 'CT' | 'T';
  hp: number;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  hasBomb: boolean;
  canSeeEnemy: boolean;
  lastSeenEnemyPos?: { x: number; y: number; z: number };
  tacticalDanger: number;
  timeSinceLastFire: number;
  timeSinceDamaged: number;
  ammo: number;
}

export abstract class BehaviorNode {
  abstract tick(context: BotContext, dt: number): BotNodeStatus;
}

export class SelectorNode extends BehaviorNode {
  constructor(public children: BehaviorNode[]) { super(); }
  tick(context: BotContext, dt: number): BotNodeStatus {
    for (const child of this.children) {
      const status = child.tick(context, dt);
      if (status !== 'FAILURE') return status;
    }
    return 'FAILURE';
  }
}

export class SequenceNode extends BehaviorNode {
  constructor(public children: BehaviorNode[]) { super(); }
  tick(context: BotContext, dt: number): BotNodeStatus {
    for (const child of this.children) {
      const status = child.tick(context, dt);
      if (status !== 'SUCCESS') return status;
    }
    return 'SUCCESS';
  }
}

// Action nodes
export class EngageEnemyNode extends BehaviorNode {
  tick(context: BotContext, dt: number): BotNodeStatus {
    if (!context.canSeeEnemy) return 'FAILURE';
    // Aim at enemy, manage recoil, fire
    if (context.ammo <= 0) return 'FAILURE'; // Needs to reload
    return 'RUNNING';
  }
}

export class FindCoverNode extends BehaviorNode {
  tick(context: BotContext, dt: number): BotNodeStatus {
    if (context.tacticalDanger < 0.5 && context.hp > 40) return 'FAILURE';
    // Find nearest cover point that breaks line of sight to lastSeenEnemyPos
    return 'RUNNING';
  }
}

export class ReloadNode extends BehaviorNode {
  tick(context: BotContext, dt: number): BotNodeStatus {
    if (context.ammo > 0 && context.canSeeEnemy) return 'FAILURE'; // Don't reload if engaging and have ammo
    if (context.ammo === 30 /* MAX_AMMO */) return 'SUCCESS';
    return 'RUNNING';
  }
}

export class PlantBombNode extends BehaviorNode {
  tick(context: BotContext, dt: number): BotNodeStatus {
    if (context.team !== 'T' || !context.hasBomb) return 'FAILURE';
    // Navigate to site and plant
    return 'RUNNING';
  }
}

export class RotateNode extends BehaviorNode {
  tick(context: BotContext, dt: number): BotNodeStatus {
    // Navigate to other site based on team comms / bomb spot
    return 'RUNNING';
  }
}

// Bot AI Core
export class TacticalBotAI {
  root: BehaviorNode;

  constructor() {
    this.root = new SelectorNode([
      new FindCoverNode(),     // Flee/cover if low HP or taking heavy fire
      new ReloadNode(),        // Reload if empty and safe
      new EngageEnemyNode(),   // Fight if see enemy
      new PlantBombNode(),     // Play objective
      new RotateNode()         // Map rotation and holding
    ]);
  }

  update(context: BotContext, dt: number) {
    this.root.tick(context, dt);
  }
}
