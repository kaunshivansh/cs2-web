import * as THREE from 'three';

const TEXTURE_KEYS = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'map',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const;

type Disposable = {
  dispose?: () => void;
};

export function disposeObject3DResources(root: THREE.Object3D) {
  disposeObject3DResourcesWithOptions(root, {});
}

export function disposeObject3DResourcesWithOptions(
  root: THREE.Object3D,
  options: { disposeTextureMaps?: boolean },
) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry?.dispose?.();

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) disposeMaterial(material as THREE.Material, options);
  });
}

function disposeMaterial(
  material: THREE.Material,
  options: { disposeTextureMaps?: boolean },
) {
  const maybeMaterial = material as THREE.Material & Record<string, Disposable | undefined>;

  if (options.disposeTextureMaps !== false) {
    for (const key of TEXTURE_KEYS) maybeMaterial[key]?.dispose?.();
  }
  material.dispose?.();
}
