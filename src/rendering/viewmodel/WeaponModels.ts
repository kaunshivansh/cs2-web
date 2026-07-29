import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Team } from '../../gameplay/match/MatchRules.ts';
import { createWeaponMaterialSet, shadowify, makeHands } from './TeamVisuals.ts';

export interface WeaponModelResult {
  group: THREE.Group;
  muzzle: THREE.Object3D;
}

// Single DRACO/GLTF loader pipeline
let dracoLoader: DRACOLoader | null = null;
let gltfLoader: GLTFLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
  }
  return gltfLoader;
}

const weaponGLBCache = new Map<string, THREE.Group>();

export async function loadWeaponModelGLB(
  id: string,
  mode: 'view' | 'world' = 'view',
): Promise<WeaponModelResult | null> {
  const loader = getGLTFLoader();
  const cacheKey = `${id}_${mode}`;

  if (weaponGLBCache.has(cacheKey)) {
    const cachedGroup = weaponGLBCache.get(cacheKey)!.clone(true);
    let muzzle = cachedGroup.getObjectByName('muzzle') || cachedGroup.getObjectByName('barrel_tip');
    if (!muzzle) {
      muzzle = new THREE.Object3D();
      muzzle.name = 'muzzle';
      cachedGroup.add(muzzle);
    }
    return { group: cachedGroup, muzzle };
  }

  const paths = [
    `/assets/models/weapons/${id}_${mode}.glb`,
    `/assets/models/weapons/${id}.glb`,
  ];

  let lastError: any = null;
  for (const path of paths) {
    try {
      const gltf = await loader.loadAsync(path);
      const scene = gltf.scene;
      shadowify(scene);
      weaponGLBCache.set(cacheKey, scene);

      const cloned = scene.clone(true);
      let muzzle = cloned.getObjectByName('muzzle') || cloned.getObjectByName('barrel_tip');
      if (!muzzle) {
        muzzle = new THREE.Object3D();
        muzzle.name = 'muzzle';
        const bbox = new THREE.Box3().setFromObject(cloned);
        muzzle.position.set(0, bbox.max.y * 0.5, bbox.min.z);
        cloned.add(muzzle);
      }
      return { group: cloned, muzzle };
    } catch (err) {
      lastError = err;
    }
  }

  console.warn(`[WeaponModels] No GLB asset found for weapon '${id}' (${mode} mode) at /assets/models/weapons/${id}_${mode}.glb. Using procedural fallback mesh.`);
  return null;
}

/**
 * Creates weapon model with instant procedural fallback and async GLB mesh enrichment.
 */
export function createWeaponModel(
  id: string,
  mode: 'view' | 'world' = 'view',
  team: Team = 'CT',
): WeaponModelResult {
  const M = createWeaponMaterialSet();
  const g = new THREE.Group();
  const sc = mode === 'view' ? 1 : 0.44;
  g.scale.setScalar(sc);
  const muzzle = new THREE.Object3D();
  g.add(muzzle);

  if (mode === 'view') {
    g.add(makeHands(team));
  }

  const addMesh = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  const box = THREE.BoxGeometry;
  const cyl = THREE.CylinderGeometry;

  // Build fallback procedural mesh first
  switch (id) {
    case 'knife':
      addMesh(new box(0.04, 0.05, 0.18), M.gunPoly, 0.14, -0.22, -0.1, 0, 0, 0.16);
      addMesh(new box(0.015, 0.02, 0.48), M.gunSteel, 0.14, -0.22, -0.48, 0, 0, 0.04);
      addMesh(new box(0.015, 0.04, 0.16), M.gunSteel, 0.14, -0.21, -0.64, Math.PI / 12, 0, 0.04);
      addMesh(new box(0.05, 0.02, 0.06), M.gunSteel, 0.14, -0.22, -0.24);
      muzzle.position.set(0.14, -0.22, -0.78);
      break;

    case 'usp':
      addMesh(new box(0.11, 0.14, 0.48), M.gunPoly, 0.18, -0.21, -0.32);
      addMesh(new box(0.095, 0.09, 0.38), M.gunSteel, 0.18, -0.145, -0.28);
      addMesh(new cyl(0.026, 0.026, 0.64, 12), M.gunMetal, 0.18, -0.165, -0.82, 0, 0, Math.PI / 2);
      addMesh(new box(0.095, 0.26, 0.15), M.gunPoly, 0.16, -0.33, -0.07, -0.34);
      addMesh(new box(0.02, 0.015, 0.46), M.gunMetal, 0.18, -0.108, -0.27);
      muzzle.position.set(0.18, -0.165, -1.14);
      break;

    case 'deagle':
      addMesh(new box(0.12, 0.14, 0.56), M.gunSteel, 0.20, -0.21, -0.33);
      addMesh(new box(0.14, 0.12, 0.48), M.gunSteel, 0.20, -0.12, -0.31);
      addMesh(new box(0.10, 0.28, 0.17), M.gunPoly, 0.17, -0.36, -0.05, -0.38);
      addMesh(new box(0.08, 0.06, 0.24), M.gunSteel, 0.20, -0.175, -0.68);
      addMesh(new cyl(0.028, 0.028, 0.06, 12), M.gunSteel, 0.20, -0.13, -0.60, 0, 0, Math.PI / 2);
      muzzle.position.set(0.20, -0.13, -0.64);
      break;

    case 'glock':
      addMesh(new box(0.10, 0.12, 0.46), M.gunPoly, 0.18, -0.21, -0.30);
      addMesh(new box(0.09, 0.09, 0.38), M.gunSteel, 0.18, -0.150, -0.27);
      addMesh(new box(0.09, 0.23, 0.16), M.gunPoly, 0.16, -0.33, -0.08, -0.34);
      addMesh(new box(0.02, 0.01, 0.40), M.gunSteel, 0.18, -0.100, -0.28);
      addMesh(new cyl(0.018, 0.018, 0.04, 12), M.gunSteel, 0.18, -0.16, -0.48, 0, 0, Math.PI / 2);
      muzzle.position.set(0.18, -0.16, -0.51);
      break;

    case 'mp9':
      addMesh(new box(0.11, 0.14, 0.52), M.gunPoly, 0.18, -0.21, -0.33);
      addMesh(new cyl(0.025, 0.025, 0.52, 12), M.gunSteel, 0.19, -0.19, -0.86, 0, 0, Math.PI / 2);
      addMesh(new box(0.08, 0.30, 0.11), M.gunPoly, 0.15, -0.37, -0.19, -0.14);
      addMesh(new box(0.035, 0.22, 0.16), M.gunSteel, 0.21, -0.36, -0.52, 0.26);
      addMesh(new box(0.08, 0.22, 0.11), M.gunPoly, 0.18, -0.28, -0.60, -0.1);
      addMesh(new box(0.09, 0.06, 0.40), M.gunSteel, 0.18, -0.13, -0.40);
      addMesh(new box(0.05, 0.05, 0.10), M.optic, 0.18, -0.07, -0.30);
      muzzle.position.set(0.19, -0.19, -1.12);
      break;

    case 'mac10':
      addMesh(new box(0.11, 0.18, 0.44), M.gunSteel, 0.18, -0.21, -0.33);
      addMesh(new cyl(0.038, 0.038, 0.42, 12), M.gunSteel, 0.19, -0.185, -0.77, 0, 0, Math.PI / 2);
      addMesh(new box(0.08, 0.32, 0.11), M.gunPoly, 0.15, -0.38, -0.12, -0.11);
      addMesh(new box(0.04, 0.26, 0.14), M.gunSteel, 0.18, -0.38, -0.14, 0);
      addMesh(new box(0.035, 0.08, 0.14), M.gunMetal, 0.18, -0.10, -0.20);
      addMesh(new box(0.08, 0.04, 0.22), M.gunSteel, 0.18, -0.18, -0.58);
      muzzle.position.set(0.18, -0.175, -1.14);
      break;

    case 'm4a1':
      addMesh(new box(0.10, 0.14, 0.58), M.gunMetal, 0.20, -0.21, -0.33);
      addMesh(new cyl(0.026, 0.026, 0.80, 12), M.gunSteel, 0.21, -0.185, -0.96, 0, 0, Math.PI / 2);
      addMesh(new cyl(0.048, 0.048, 0.44, 14), M.gunMetal, 0.21, -0.185, -1.36, 0, 0, Math.PI / 2);
      addMesh(new box(0.08, 0.26, 0.14), M.gunPoly, 0.16, -0.37, -0.24, 0.16);
      addMesh(new box(0.10, 0.18, 0.30), M.gunPoly, 0.13, -0.23, -0.06);
      addMesh(new box(0.08, 0.10, 0.46), M.gunPoly, 0.20, -0.15, -0.72);
      addMesh(new box(0.05, 0.28, 0.12), M.gunMetal, 0.20, -0.34, -0.40, -0.1);
      addMesh(new box(0.06, 0.055, 0.17), M.optic, 0.20, -0.07, -0.48);
      addMesh(new cyl(0.018, 0.018, 0.12, 12), M.gunSteel, 0.20, -0.07, -0.41, 0, 0, Math.PI / 2);
      addMesh(new box(0.025, 0.02, 0.17), M.lens, 0.20, -0.07, -0.48);
      muzzle.position.set(0.21, -0.185, -1.58);
      break;

    case 'ak47':
      addMesh(new box(0.10, 0.14, 0.58), M.gunMetal, 0.20, -0.21, -0.33);
      addMesh(new cyl(0.022, 0.022, 0.72, 12), M.gunSteel, 0.21, -0.185, -0.92, 0, 0, Math.PI / 2);
      addMesh(new cyl(0.012, 0.012, 0.68, 8), M.gunSteel, 0.21, -0.14, -0.88, 0, 0, Math.PI / 2);
      addMesh(new box(0.08, 0.26, 0.12), M.gunWood, 0.16, -0.38, -0.24, 0.27, 0, -0.06);
      addMesh(new box(0.10, 0.17, 0.36), M.gunWood, 0.12, -0.22, -0.05);
      addMesh(new box(0.09, 0.10, 0.32), M.gunWood, 0.21, -0.16, -0.70);
      addMesh(new box(0.05, 0.30, 0.13), M.gunSteel, 0.20, -0.38, -0.46, -0.25);
      addMesh(new box(0.05, 0.08, 0.13), M.gunSteel, 0.20, -0.46, -0.48, -0.45);
      addMesh(new cyl(0.016, 0.016, 0.10, 8), M.gunSteel, 0.21, -0.185, -0.87, Math.PI / 2, 0, 0);
      muzzle.position.set(0.21, -0.185, -1.36);
      break;

    case 'awp':
      addMesh(new box(0.12, 0.15, 0.84), M.gunPoly, 0.21, -0.21, -0.30);
      addMesh(new cyl(0.028, 0.028, 1.24, 12), M.gunSteel, 0.22, -0.165, -1.10, 0, 0, Math.PI / 2);
      addMesh(new cyl(0.038, 0.038, 0.14, 12), M.gunSteel, 0.22, -0.165, -1.76, 0, 0, Math.PI / 2);
      addMesh(new cyl(0.048, 0.048, 0.64, 16), M.optic, 0.19, -0.04, -0.54, 0, 0, Math.PI / 2);
      addMesh(new cyl(0.056, 0.056, 0.08, 16), M.optic, 0.19, -0.04, -0.84, 0, 0, Math.PI / 2);
      addMesh(new box(0.024, 0.02, 0.64), M.lens, 0.19, -0.04, -0.54);
      addMesh(new box(0.09, 0.22, 0.14), M.gunPoly, 0.18, -0.38, -0.26, 0.1);
      addMesh(new box(0.14, 0.17, 0.48), M.gunPoly, 0.09, -0.23, 0.02);
      addMesh(new box(0.10, 0.08, 0.52), M.gunPoly, 0.21, -0.13, -0.74);
      addMesh(new box(0.06, 0.16, 0.14), M.gunSteel, 0.21, -0.30, -0.42);
      muzzle.position.set(0.22, -0.165, -1.84);
      break;

    default:
      addMesh(new box(0.10, 0.12, 0.48), M.gunMetal, 0.18, -0.21, -0.32);
      muzzle.position.set(0.18, -0.19, -0.90);
  }

  shadowify(g);

  // Asynchronously attempt GLB replacement if model exists
  loadWeaponModelGLB(id, mode).then((res) => {
    if (res) {
      // Clear primitive meshes
      while (g.children.length > 0) {
        const c = g.children[0];
        g.remove(c);
      }
      g.add(res.group);
      if (mode === 'view') {
        g.add(makeHands(team));
      }
      muzzle.position.copy(res.muzzle.position);
      g.add(muzzle);
    }
  }).catch((err) => {
    console.warn(`[WeaponModels] Exception loading GLB for weapon '${id}': ${err?.message || err}`);
  });

  return { group: g, muzzle };
}
