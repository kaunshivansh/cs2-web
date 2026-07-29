// Navigation.ts — A* pathfinding over a nav node graph

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface NavNode {
  id: string;
  position: Vec3;
  connections: string[]; // connected node IDs
  coverScore: number; // 0-1
  siteProximity: Record<'A' | 'B', number>; // distance to each site
}

export interface NavGraph {
  nodes: Map<string, NavNode>;
  chokepoints: Set<string>; // node IDs that are chokepoint/doorway nodes
}

export interface PathResult {
  path: Vec3[];
  nodeIds: string[];
  totalDistance: number;
}

export interface BotNavState {
  currentPath: Vec3[];
  currentNodeIds: string[];
  pathIndex: number;
  stuckTimer: number;
  lastPosition: Vec3;
  occupiedChokepoints: Map<string, string>; // nodeId -> botId
}

/**
 * Euclidean distance between two Vec3 points.
 */
export function distanceVec3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Angle in degrees between segments ab and bc.
 */
export function angleBetweenSegments(a: Vec3, b: Vec3, c: Vec3): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;

  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const bcz = c.z - b.z;

  const dot = abx * bcx + aby * bcy + abz * bcz;
  const magAB = Math.sqrt(abx * abx + aby * aby + abz * abz);
  const magBC = Math.sqrt(bcx * bcx + bcy * bcy + bcz * bcz);

  if (magAB === 0 || magBC === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Build a NavGraph from a flat array of NavNodes.
 * Chokepoints are nodes with exactly 2 connections.
 */
export function buildNavGraph(nodes: NavNode[]): NavGraph {
  const nodeMap = new Map<string, NavNode>();
  const chokepoints = new Set<string>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  for (const node of nodes) {
    if (node.connections.length === 2) {
      chokepoints.add(node.id);
    }
  }

  return { nodes: nodeMap, chokepoints };
}

/**
 * Find the nearest NavNode to a given position.
 */
export function findNearestNode(graph: NavGraph, position: Vec3): NavNode | null {
  let nearest: NavNode | null = null;
  let nearestDist = Infinity;

  for (const node of graph.nodes.values()) {
    const dist = distanceVec3(position, node.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = node;
    }
  }

  return nearest;
}

/**
 * A* pathfinding from startPos to goalPos over the NavGraph.
 * If targetSite is provided, siteProximity is used as a tie-breaker in the heuristic.
 */
export function findPath(
  graph: NavGraph,
  startPos: Vec3,
  goalPos: Vec3,
  targetSite?: 'A' | 'B'
): PathResult {
  const startNode = findNearestNode(graph, startPos);
  const goalNode = findNearestNode(graph, goalPos);

  if (!startNode || !goalNode) {
    return { path: [], nodeIds: [], totalDistance: 0 };
  }

  if (startNode.id === goalNode.id) {
    return {
      path: [startNode.position],
      nodeIds: [startNode.id],
      totalDistance: 0,
    };
  }

  // A* implementation
  const openSet = new Set<string>([startNode.id]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(startNode.id, 0);

  const heuristic = (nodeId: string): number => {
    const node = graph.nodes.get(nodeId)!;
    let h = distanceVec3(node.position, goalNode.position);
    if (targetSite) {
      // Use siteProximity as tie-breaker (small weight)
      h += node.siteProximity[targetSite] * 0.1;
    }
    return h;
  };

  fScore.set(startNode.id, heuristic(startNode.id));

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current = '';
    let lowestF = Infinity;
    for (const nodeId of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = nodeId;
      }
    }

    if (current === goalNode.id) {
      // Reconstruct path
      const nodeIds: string[] = [];
      let c = current;
      while (c !== undefined) {
        nodeIds.unshift(c);
        c = cameFrom.get(c)!;
      }

      const path = nodeIds.map((id) => graph.nodes.get(id)!.position);
      let totalDistance = 0;
      for (let i = 1; i < path.length; i++) {
        totalDistance += distanceVec3(path[i - 1], path[i]);
      }

      return { path, nodeIds, totalDistance };
    }

    openSet.delete(current);
    const currentNode = graph.nodes.get(current)!;

    for (const neighborId of currentNode.connections) {
      const neighbor = graph.nodes.get(neighborId);
      if (!neighbor) continue;

      const tentativeG =
        (gScore.get(current) ?? Infinity) +
        distanceVec3(currentNode.position, neighbor.position);

      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + heuristic(neighborId));
        openSet.add(neighborId);
      }
    }
  }

  // No path found
  return { path: [], nodeIds: [], totalDistance: 0 };
}

/**
 * Remove intermediate nodes that are collinear within 15 degrees.
 */
export function smoothPath(path: Vec3[]): Vec3[] {
  if (path.length <= 2) return [...path];

  const smoothed: Vec3[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = smoothed[smoothed.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    const angle = angleBetweenSegments(prev, curr, next);
    // angle ≈ 0° means segments are nearly collinear (same direction)
    // Keep the node only if the deviation from straight is significant (> 15°)
    if (angle > 15) {
      smoothed.push(curr);
    }
  }

  smoothed.push(path[path.length - 1]);
  return smoothed;
}

/**
 * Create a fresh BotNavState for a bot at the given start position.
 */
export function createBotNavState(startPosition: Vec3): BotNavState {
  return {
    currentPath: [],
    currentNodeIds: [],
    pathIndex: 0,
    stuckTimer: 0,
    lastPosition: { ...startPosition },
    occupiedChokepoints: new Map(),
  };
}

/**
 * Advance pathIndex if close to current waypoint, detect stuck
 * (not moved > 0.5 units in 2 seconds), return next waypoint.
 */
export function updateNavState(
  state: BotNavState,
  currentPosition: Vec3,
  dt: number
): { repath: boolean; nextWaypoint: Vec3 | null } {
  if (state.currentPath.length === 0) {
    return { repath: false, nextWaypoint: null };
  }

  // Check if we've reached the current waypoint (within 1.0 unit)
  const waypointThreshold = 1.0;
  if (state.pathIndex < state.currentPath.length) {
    const currentWaypoint = state.currentPath[state.pathIndex];
    const distToWaypoint = distanceVec3(currentPosition, currentWaypoint);

    if (distToWaypoint < waypointThreshold) {
      state.pathIndex++;
    }
  }

  // Detect stuck: not moved > 0.5 units in 2 seconds
  const moved = distanceVec3(currentPosition, state.lastPosition);
  if (moved < 0.5) {
    state.stuckTimer += dt;
  } else {
    state.stuckTimer = 0;
    state.lastPosition = { ...currentPosition };
  }

  if (state.stuckTimer >= 2.0) {
    state.stuckTimer = 0;
    return { repath: true, nextWaypoint: null };
  }

  // Return next waypoint
  if (state.pathIndex < state.currentPath.length) {
    return { repath: false, nextWaypoint: state.currentPath[state.pathIndex] };
  }

  return { repath: false, nextWaypoint: null };
}

/**
 * Returns true if the chokepoint is not occupied by another bot.
 */
export function isChokepointAvailable(
  graph: NavGraph,
  nodeId: string,
  botId: string,
  occupiedChokepoints: Map<string, string>
): boolean {
  if (!graph.chokepoints.has(nodeId)) {
    return true; // Not a chokepoint, always available
  }

  const occupant = occupiedChokepoints.get(nodeId);
  if (occupant === undefined) {
    return true; // No one occupying
  }

  return occupant === botId; // Available only if this bot is the occupant
}
