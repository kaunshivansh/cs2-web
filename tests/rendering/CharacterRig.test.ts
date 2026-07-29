import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  BONE_CONTRACT,
  CLIP_CONTRACT,
  TEAM_OPERATOR_CONFIG,
  resolveCharacterBone,
  resolveCharacterClip,
} from '../../src/rendering/CharacterRig.ts';

test('TEAM_OPERATOR_CONFIG declares tactical operator GLB models for CT and T teams', () => {
  assert.equal(typeof TEAM_OPERATOR_CONFIG.CT, 'string');
  assert.equal(typeof TEAM_OPERATOR_CONFIG.T, 'string');
  assert.ok(TEAM_OPERATOR_CONFIG.CT.endsWith('.glb'));
  assert.ok(TEAM_OPERATOR_CONFIG.T.endsWith('.glb'));
  assert.equal(TEAM_OPERATOR_CONFIG.T.includes('elf'), false, 'T side must map to a tactical operator, not an elf');
});

test('resolveCharacterBone finds contract bones in object hierarchy', () => {
  const root = new THREE.Group();
  root.name = 'CharacterRoot';
  const hips = new THREE.Object3D();
  hips.name = 'pelvis';
  const spine = new THREE.Object3D();
  spine.name = 'spine_1';
  const hand = new THREE.Object3D();
  hand.name = 'hand_r';

  root.add(hips);
  hips.add(spine);
  spine.add(hand);

  assert.equal(resolveCharacterBone(root, 'HIPS'), hips);
  assert.equal(resolveCharacterBone(root, 'SPINE'), spine);
  assert.equal(resolveCharacterBone(root, 'RIGHT_HAND'), hand);
});

test('resolveCharacterClip matches clip candidates in animation arrays', () => {
  const idleClip = new THREE.AnimationClip('character_idle', 1, []);
  const runClip = new THREE.AnimationClip('character_run', 1, []);
  const animations = [idleClip, runClip];

  assert.equal(resolveCharacterClip(animations, 'idle'), idleClip);
  assert.equal(resolveCharacterClip(animations, 'run'), runClip);
  assert.equal(resolveCharacterClip(animations, 'reload'), null);
});
