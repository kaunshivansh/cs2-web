import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Team } from '../gameplay/match/MatchRules.ts';
import { getTeamVisualPalette, addMesh } from './viewmodel/TeamVisuals.ts';
import { createWeaponModel } from './viewmodel/WeaponModels.ts';
import {
  resolveCharacterBone,
  resolveCharacterClip,
  TEAM_OPERATOR_CONFIG,
} from './CharacterRig.ts';

export interface BotModelInstance {
  group: THREE.Group;
  visualGroup: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  weaponMount: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: {
    idle: THREE.AnimationAction | null;
    walk: THREE.AnimationAction | null;
    run: THREE.AnimationAction | null;
  };
  currentAction: THREE.AnimationAction | null;
  currentActionName?: string;
  spine?: THREE.Object3D;
}

const characterCache = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }>();
const loadingPromises = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null>>();

export function createBotModel(
  team: string,
  weaponId: string,
  gltfLoader?: GLTFLoader
): BotModelInstance {
  const isCT = team === 'CT';
  const g = new THREE.Group();
  const visualGroup = new THREE.Group();
  g.add(visualGroup);

  // AUTH HITBOXES
  const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.62, 5, 12), hitBoxMat);
  torso.position.y = 1.0;
  visualGroup.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.6, 0.05);
  visualGroup.add(headGroup);

  const faceHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), hitBoxMat);
  faceHitbox.position.set(0, 0.08, 0);
  headGroup.add(faceHitbox);

  // MOUNT
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.18, 0.98, 0.28);
  visualGroup.add(weaponMount);

  const worldWeapon = createWeaponModel(weaponId, 'world', team as Team);
  worldWeapon.group.rotation.set(0, -Math.PI / 2, Math.PI / 2);
  worldWeapon.group.position.set(0, 0.02, 0.2);
  worldWeapon.group.scale.multiplyScalar(0.88);
  weaponMount.add(worldWeapon.group);

  const res: BotModelInstance = {
    group: g,
    visualGroup,
    body: torso,
    head: headGroup,
    weaponMount,
    mixer: null,
    actions: { idle: null, walk: null, run: null },
    currentAction: null,
  };

  // INITIAL VISUALS (While external models load)
  const fallback = new THREE.Group();
  const pal = getTeamVisualPalette(team as Team);
  addMesh(fallback, new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), new THREE.MeshStandardMaterial({ color: pal.uniformColor }), 0, 1, 0);
  addMesh(fallback, new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshStandardMaterial({ color: pal.skinColor }), 0, 1.68, 0.05);
  visualGroup.add(fallback);

  const rawModelFile = TEAM_OPERATOR_CONFIG[team as Team] || 'sas__cs2_agent_model_blue.glb';
  const modelName = rawModelFile.endsWith('.glb') ? rawModelFile.slice(0, -4) : rawModelFile;

  const setupInstance = (data: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null) => {
    if (!data) return;
    fallback.visible = false;
    const model = SkeletonUtils.clone(data.scene);

    // Apply Team palette tinting to ensure CT and T read as visually distinct tactical operators
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const originalMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if (originalMat && 'color' in originalMat) {
            const clonedMat = (originalMat as THREE.MeshStandardMaterial).clone();
            if (!isCT) {
              // T side: Shift uniform tone towards desert tan / brown palette
              clonedMat.color.lerp(new THREE.Color(pal.uniformColor), 0.55);
            }
            mesh.material = clonedMat;
          }
        }
      }
    });

    const hand = resolveCharacterBone(model, 'RIGHT_HAND');
    if (hand) {
      (hand as THREE.Object3D).add(weaponMount);
      weaponMount.position.set(0, 0, 0);
      weaponMount.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
      weaponMount.scale.setScalar(2.2);
    }
    model.rotation.y = Math.PI;

    // Character clip contract resolution
    const idleClip = resolveCharacterClip(data.animations, 'idle');
    const walkClip = resolveCharacterClip(data.animations, 'walk');
    const runClip = resolveCharacterClip(data.animations, 'run');

    if (idleClip || walkClip || runClip) {
      const m = new THREE.AnimationMixer(model);
      res.mixer = m;
      const iC = idleClip || walkClip || runClip!;
      const wC = walkClip || runClip || iC;
      const rC = runClip || walkClip || iC;
      res.actions.idle = m.clipAction(iC);
      res.actions.walk = m.clipAction(wC);
      res.actions.run = m.clipAction(rC);

      for (const key in res.actions) {
        const action = (res.actions as Record<string, any>)[key];
        if (action) {
          action.enabled = true;
          action.setEffectiveTimeScale(1);
          action.setEffectiveWeight(key === 'idle' ? 1.0 : 0.0);
          action.play();
        }
      }
      res.currentAction = res.actions.idle;
      res.currentActionName = 'idle';
    }
    const spine = resolveCharacterBone(model, 'SPINE');
    if (spine) {
      res.spine = spine;
    }

    const b3 = new THREE.Box3().setFromObject(model);
    const sz = b3.getSize(new THREE.Vector3());
    model.scale.setScalar(1.82 / (sz.y || 1));
    b3.setFromObject(model);
    model.position.y = -b3.min.y;
    visualGroup.add(model);
  };

  const cached = characterCache.get(modelName);
  if (cached) {
    setupInstance(cached);
  } else if (gltfLoader) {
    if (!loadingPromises.has(modelName)) {
      const p = new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] } | null>((resolve) => {
        gltfLoader.load(
          `/assets/models/${modelName}.glb`,
          (gltf) => {
            gltf.scene.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                c.castShadow = c.receiveShadow = true;
                const m = (c as THREE.Mesh).material as any;
                if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
              }
            });
            const d = { scene: gltf.scene, animations: gltf.animations };
            characterCache.set(modelName, d);
            resolve(d);
          },
          undefined,
          () => resolve(null)
        );
      });
      loadingPromises.set(modelName, p);
    }
    loadingPromises.get(modelName)!.then(setupInstance);
  }

  return res;
}
