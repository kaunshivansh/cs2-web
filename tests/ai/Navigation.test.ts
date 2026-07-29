import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNavGraph,
  findPath,
  smoothPath,
  createBotNavState,
  updateNavState,
  isChokepointAvailable,
  findNearestNode,
  distanceVec3,
  type NavNode,
  type Vec3,
} from '../../src/ai/Navigation.ts';

// Helper to create a NavNode
function makeNode(
  id: string,
  x: number,
  y: number,
  z: number,
  connections: string[],
  coverScore = 0.5
): NavNode {
  return {
    id,
    position: { x, y, z },
    connections,
    coverScore,
    siteProximity: { A: 10, B: 20 },
  };
}

// ---- Test graph layout ----
//
//  A ----> B ----> C
//          |       |
//          v       v
//          D ----> E
//
// B and D have exactly 2 connections (chokepoints)

function createTestNodes(): NavNode[] {
  return [
    makeNode('A', 0, 0, 0, ['B']),
    makeNode('B', 10, 0, 0, ['A', 'C', 'D']),
    makeNode('C', 20, 0, 0, ['B', 'E']),
    makeNode('D', 10, 10, 0, ['B', 'E']),
    makeNode('E', 20, 10, 0, ['C', 'D']),
  ];
}

test('buildNavGraph creates graph with correct node count', () => {
  const nodes = createTestNodes();
  const graph = buildNavGraph(nodes);
  assert.equal(graph.nodes.size, 5);
});

test('buildNavGraph identifies chokepoints', () => {
  const nodes = createTestNodes();
  const graph = buildNavGraph(nodes);

  // C has 2 connections: B, E → chokepoint
  assert.ok(graph.chokepoints.has('C'), 'C should be a chokepoint (2 connections)');
  // D has 2 connections: B, E → chokepoint
  assert.ok(graph.chokepoints.has('D'), 'D should be a chokepoint (2 connections)');
  // E has 2 connections: C, D → chokepoint
  assert.ok(graph.chokepoints.has('E'), 'E should be a chokepoint (2 connections)');

  // A has 1 connection → not a chokepoint
  assert.ok(!graph.chokepoints.has('A'), 'A should not be a chokepoint');
  // B has 3 connections → not a chokepoint
  assert.ok(!graph.chokepoints.has('B'), 'B should not be a chokepoint');
});

test('findPath returns direct path for adjacent nodes', () => {
  const nodes = createTestNodes();
  const graph = buildNavGraph(nodes);

  const result = findPath(graph, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
  assert.deepEqual(result.nodeIds, ['A', 'B']);
  assert.equal(result.path.length, 2);
  assert.ok(result.totalDistance > 0);
});

test('findPath finds shortest path through graph', () => {
  const nodes = createTestNodes();
  const graph = buildNavGraph(nodes);

  // Path from A to E: A->B->C->E or A->B->D->E
  const result = findPath(graph, { x: 0, y: 0, z: 0 }, { x: 20, y: 10, z: 0 });
  assert.ok(result.path.length >= 3, 'Path should have at least 3 waypoints');
  assert.equal(result.nodeIds[0], 'A');
  assert.equal(result.nodeIds[result.nodeIds.length - 1], 'E');
  assert.ok(result.totalDistance > 0);
});

test('smoothPath removes collinear intermediate nodes', () => {
  // Three collinear points along X axis
  const path: Vec3[] = [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];

  const smoothed = smoothPath(path);
  // Middle point is collinear (angle = 180° → deviation = 0° < 15°), should be removed
  assert.equal(smoothed.length, 2);
  assert.deepEqual(smoothed[0], { x: 0, y: 0, z: 0 });
  assert.deepEqual(smoothed[1], { x: 10, y: 0, z: 0 });
});

test('updateNavState detects stuck bot', () => {
  const state = createBotNavState({ x: 0, y: 0, z: 0 });
  state.currentPath = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 },
  ];
  state.currentNodeIds = ['A', 'B', 'C'];

  // Simulate not moving for 2+ seconds (at same position)
  const pos = { x: 0.1, y: 0, z: 0 };
  let result = updateNavState(state, pos, 1.0);
  assert.equal(result.repath, false, 'Should not repath after 1 second');

  result = updateNavState(state, pos, 1.0);
  assert.equal(result.repath, true, 'Should repath after 2 seconds stuck');
});

test('isChokepointAvailable prevents bot clustering', () => {
  const nodes = createTestNodes();
  const graph = buildNavGraph(nodes);
  const occupied = new Map<string, string>();

  // C is a chokepoint
  assert.ok(isChokepointAvailable(graph, 'C', 'bot1', occupied));

  // bot2 occupies C
  occupied.set('C', 'bot2');
  assert.ok(!isChokepointAvailable(graph, 'C', 'bot1', occupied), 'bot1 should be blocked');
  assert.ok(isChokepointAvailable(graph, 'C', 'bot2', occupied), 'bot2 is the occupant');
});

test('findNearestNode returns closest node', () => {
  const nodes = createTestNodes();
  const graph = buildNavGraph(nodes);

  const nearest = findNearestNode(graph, { x: 9, y: 1, z: 0 });
  assert.ok(nearest !== null);
  assert.equal(nearest.id, 'B');

  const nearestE = findNearestNode(graph, { x: 19, y: 9, z: 0 });
  assert.ok(nearestE !== null);
  assert.equal(nearestE.id, 'E');
});
