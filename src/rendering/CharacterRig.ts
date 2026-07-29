import * as THREE from 'three';
import type { Team } from '../gameplay/match/MatchRules.ts';

export const BONE_CONTRACT = {
  HIPS: ['mixamorigHips', 'Hips', 'hips', 'pelvis'],
  SPINE: ['mixamorigSpine', 'Spine', 'spine', 'spine_1', 'chest', 'torso'],
  RIGHT_HAND: ['mixamorigRightHand', 'RightHand', 'righthand', 'r_hand', 'hand_r', 'weapon_hand_r'],
} as const;

export const CLIP_CONTRACT = {
  idle: ['idle', 'stand_idle', 'armature|idle', 'eye_test', 'tools_preview'],
  walk: ['walk', 'walking', 'armature|walk'],
  run: ['run', 'running', 'sprint', 'armature|run'],
  reload: ['reload', 'reloading', 'armature|reload'],
  fire: ['fire', 'shoot', 'attack', 'armature|fire'],
} as const;

export const TEAM_OPERATOR_CONFIG: Record<Team, string> = {
  CT: 'sas__cs2_agent_model_blue.glb',
  T: 'sas__cs2_agent_model_blue.glb',
};

export function resolveCharacterBone(root: THREE.Object3D, boneKey: keyof typeof BONE_CONTRACT): THREE.Object3D | null {
  const candidates = BONE_CONTRACT[boneKey];
  let found: THREE.Object3D | null = null;

  root.traverse((node) => {
    if (found) return;
    const nameLower = node.name.toLowerCase();
    for (const candidate of candidates) {
      if (nameLower === candidate.toLowerCase() || nameLower.includes(candidate.toLowerCase())) {
        found = node;
        break;
      }
    }
  });

  if (!found) {
    console.warn(`[CharacterRig] Required bone contract key '${boneKey}' not found on model '${root.name || 'unnamed'}' (candidates: ${candidates.join(', ')})`);
  }

  return found;
}

export function resolveCharacterClip(
  animations: THREE.AnimationClip[],
  clipKey: keyof typeof CLIP_CONTRACT,
  warnIfMissing: boolean = false
): THREE.AnimationClip | null {
  const candidates = CLIP_CONTRACT[clipKey];
  for (const anim of animations) {
    const animNameLower = anim.name.toLowerCase();
    for (const candidate of candidates) {
      if (animNameLower === candidate.toLowerCase() || animNameLower.includes(candidate.toLowerCase())) {
        return anim;
      }
    }
  }

  if (warnIfMissing) {
    console.warn(`[CharacterRig] Animation clip contract key '${clipKey}' not found in model animations (candidates: ${candidates.join(', ')})`);
  }
  return null;
}
