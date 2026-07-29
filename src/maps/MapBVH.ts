import * as THREE from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  MeshBVH,
} from 'three-mesh-bvh';

// Plug three-mesh-bvh helpers into Three.js prototypes
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export interface MapRaycastResult {
  dist: number;
  isWall: boolean;
  point: THREE.Vector3;
  normal?: THREE.Vector3;
}

export class MapBVH {
  public mergedMesh: THREE.Mesh | null = null;
  public bvh: MeshBVH | null = null;
  private raycaster = new THREE.Raycaster();

  public buildFromScene(scene: THREE.Group): boolean {
    this.dispose();

    const geometries: THREE.BufferGeometry[] = [];
    const tempMatrix = new THREE.Matrix4();

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || '').toLowerCase();

        // Skip non-collidable meshes, skyboxes, and decals
        if (
          name.includes('no_col') ||
          name.includes('decal') ||
          name.includes('sky') ||
          name.includes('dome')
        ) {
          return;
        }

        if (mesh.geometry && mesh.geometry.attributes.position) {
          const clonedGeo = mesh.geometry.clone();
          tempMatrix.copy(mesh.matrixWorld);
          clonedGeo.applyMatrix4(tempMatrix);
          geometries.push(clonedGeo);
        }
      }
    });

    if (geometries.length === 0) return false;

    // Merge geometries into single buffer geometry for BVH construction
    const mergedGeometry = mergeBufferGeometries(geometries);
    for (const g of geometries) {
      g.dispose();
    }

    if (!mergedGeometry || !mergedGeometry.attributes.position) {
      return false;
    }

    // Build BVH tree
    mergedGeometry.computeBoundsTree();
    this.bvh = (mergedGeometry as any).boundsTree || null;

    const material = new THREE.MeshBasicMaterial({ visible: false });
    this.mergedMesh = new THREE.Mesh(mergedGeometry, material);
    this.mergedMesh.name = 'MapBVH_MergedMesh';

    return true;
  }

  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 500): MapRaycastResult | null {
    if (!this.mergedMesh) return null;

    this.raycaster.set(origin, direction);
    this.raycaster.far = maxDistance;

    const hits = this.raycaster.intersectObject(this.mergedMesh, false);
    if (hits.length > 0) {
      const firstHit = hits[0];
      return {
        dist: firstHit.distance,
        isWall: true,
        point: firstHit.point.clone(),
        normal: firstHit.face ? firstHit.face.normal.clone() : undefined,
      };
    }

    return null;
  }

  public losClear(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!this.mergedMesh) return true;

    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.05) return true;
    dir.normalize();

    this.raycaster.set(from, dir);
    this.raycaster.far = dist - 0.05;

    const hits = this.raycaster.intersectObject(this.mergedMesh, false);
    return hits.length === 0;
  }

  public dispose() {
    if (this.mergedMesh) {
      if (this.mergedMesh.geometry) {
        this.mergedMesh.geometry.disposeBoundsTree();
        this.mergedMesh.geometry.dispose();
      }
      this.mergedMesh = null;
    }
    this.bvh = null;
  }
}

/**
 * Custom buffer geometry merge utility.
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const g of geometries) {
    totalVertices += g.attributes.position.count;
    if (g.index) {
      totalIndices += g.index.count;
    } else {
      totalIndices += g.attributes.position.count;
    }
  }

  const positions = new Float32Array(totalVertices * 3);
  const indices = totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const g of geometries) {
    const posAttr = g.attributes.position;
    positions.set(posAttr.array, vertexOffset * 3);

    if (g.index) {
      const idxArray = g.index.array;
      for (let i = 0; i < idxArray.length; i++) {
        indices[indexOffset + i] = idxArray[i] + vertexOffset;
      }
      indexOffset += idxArray.length;
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices[indexOffset + i] = vertexOffset + i;
      }
      indexOffset += posAttr.count;
    }

    vertexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  merged.computeBoundingBox();

  return merged;
}
