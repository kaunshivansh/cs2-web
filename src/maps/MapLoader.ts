import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MapBVH } from './MapBVH.ts';
import { SpatialGrid, AABBCollider } from './SpatialGrid.ts';

export interface MapData {
  spawnCT: THREE.Vector3;
  spawnT: THREE.Vector3;
  siteA: THREE.Vector3;
  siteB: THREE.Vector3;
  bounds: THREE.Box3;
  colliders: AABBCollider[];
  mapBVH: MapBVH;
  spatialGrid: SpatialGrid;
}

export class MapLoader {
  private loader: GLTFLoader;
  public loadedMap: THREE.Group | null = null;
  public mapData: MapData | null = null;

  constructor() {
    this.loader = new GLTFLoader();
    
    // Setup DRACO for compressed map assets
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(dracoLoader);
  }

  async loadMap(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          this.loadedMap = gltf.scene;
          this.processLoadedMap(this.loadedMap);
          resolve(this.loadedMap);
        },
        undefined,
        (error) => {
          console.error("Failed to load map:", error);
          reject(error);
        }
      );
    });
  }

  private processLoadedMap(mapGroup: THREE.Group) {
    const colliders: AABBCollider[] = [];
    const mapBVH = new MapBVH();
    const spatialGrid = new SpatialGrid(4);

    mapGroup.updateMatrixWorld(true);
    mapBVH.buildFromScene(mapGroup);

    this.mapData = {
      spawnCT: new THREE.Vector3(24, 0, 28),
      spawnT: new THREE.Vector3(-24, 0, -36),
      siteA: new THREE.Vector3(-30, 0, -10),
      siteB: new THREE.Vector3(30, 0, -18),
      bounds: new THREE.Box3().setFromObject(mapGroup),
      colliders: [],
      mapBVH,
      spatialGrid,
    };

    mapGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = (mesh.name || '').toLowerCase();
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: THREE.Material) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
              mat.roughness = Math.max(0.4, mat.roughness); 
            }
          });
        }

        // Exclude non-collidable meshes, skyboxes, decals
        const isExcluded = 
          name.includes('no_col') || 
          name.includes('decal') || 
          name.includes('road') || 
          name.includes('line') || 
          name.includes('cespuglio') ||
          name.includes('sky') ||
          name.includes('dome');

        if (!isExcluded) {
          const subBoxes = extractTightSubColliders(mesh);
          for (const box of subBoxes) {
            colliders.push(box);
            spatialGrid.insert(box);
          }
        }

        // Extract metadata points
        if (mesh.name === 'Spawn_CT') {
          const wp = new THREE.Vector3();
          mesh.getWorldPosition(wp);
          this.mapData!.spawnCT.copy(wp);
        }
        if (mesh.name === 'Spawn_T') {
          const wp = new THREE.Vector3();
          mesh.getWorldPosition(wp);
          this.mapData!.spawnT.copy(wp);
        }
        if (mesh.name === 'Site_A') {
          const wp = new THREE.Vector3();
          mesh.getWorldPosition(wp);
          this.mapData!.siteA.copy(wp);
        }
        if (mesh.name === 'Site_B') {
          const wp = new THREE.Vector3();
          mesh.getWorldPosition(wp);
          this.mapData!.siteB.copy(wp);
        }
      }
    });

    this.mapData.colliders = colliders;
  }
}

/**
 * Extracts tight sub-colliders for a mesh to avoid bloated AABBs on rotated/curved geometry.
 */
export function extractTightSubColliders(mesh: THREE.Mesh, maxSubBoxSize: number = 2.5): AABBCollider[] {
  mesh.geometry.computeBoundingBox();
  if (!mesh.geometry.boundingBox) return [];

  const worldBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  const size = worldBox.getSize(new THREE.Vector3());

  // Skip tiny/flat/zero-volume surfaces
  if (size.y < 0.35 || size.x < 0.05 || size.z < 0.05) return [];

  // Skip massive backdrop environment boxes
  if (size.x > 35 || size.z > 35) return [];

  // Small and already tight
  if (size.x <= maxSubBoxSize && size.z <= maxSubBoxSize) {
    return [{ min: worldBox.min.clone(), max: worldBox.max.clone() }];
  }

  const subColliders: AABBCollider[] = [];
  const stepsX = Math.ceil(size.x / maxSubBoxSize);
  const stepsZ = Math.ceil(size.z / maxSubBoxSize);

  const stepXSize = size.x / stepsX;
  const stepZSize = size.z / stepsZ;

  const posAttr = mesh.geometry.attributes.position;
  if (!posAttr) return [{ min: worldBox.min.clone(), max: worldBox.max.clone() }];

  const indexAttr = mesh.geometry.index;
  const vertexCount = posAttr.count;
  const worldVerts: THREE.Vector3[] = new Array(vertexCount);
  
  for (let i = 0; i < vertexCount; i++) {
    worldVerts[i] = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(mesh.matrixWorld);
  }

  const triangleCount = indexAttr ? indexAttr.count / 3 : vertexCount / 3;

  for (let ix = 0; ix < stepsX; ix++) {
    for (let iz = 0; iz < stepsZ; iz++) {
      const cellMinX = worldBox.min.x + ix * stepXSize;
      const cellMaxX = cellMinX + stepXSize;
      const cellMinZ = worldBox.min.z + iz * stepZSize;
      const cellMaxZ = cellMinZ + stepZSize;

      let cellMinY = Infinity;
      let cellMaxY = -Infinity;
      let hasTriangles = false;

      for (let t = 0; t < triangleCount; t++) {
        let i0 = t * 3, i1 = t * 3 + 1, i2 = t * 3 + 2;
        if (indexAttr) {
          i0 = indexAttr.getX(t * 3);
          i1 = indexAttr.getX(t * 3 + 1);
          i2 = indexAttr.getX(t * 3 + 2);
        }

        const v0 = worldVerts[i0];
        const v1 = worldVerts[i1];
        const v2 = worldVerts[i2];

        const triMinX = Math.min(v0.x, v1.x, v2.x);
        const triMaxX = Math.max(v0.x, v1.x, v2.x);
        const triMinZ = Math.min(v0.z, v1.z, v2.z);
        const triMaxZ = Math.max(v0.z, v1.z, v2.z);

        if (triMinX <= cellMaxX && triMaxX >= cellMinX && triMinZ <= cellMaxZ && triMaxZ >= cellMinZ) {
          hasTriangles = true;
          cellMinY = Math.min(cellMinY, v0.y, v1.y, v2.y);
          cellMaxY = Math.max(cellMaxY, v0.y, v1.y, v2.y);
        }
      }

      if (hasTriangles && cellMaxY - cellMinY >= 0.35) {
        subColliders.push({
          min: new THREE.Vector3(cellMinX, cellMinY, cellMinZ),
          max: new THREE.Vector3(cellMaxX, cellMaxY, cellMaxZ),
        });
      }
    }
  }

  return subColliders.length > 0 ? subColliders : [{ min: worldBox.min.clone(), max: worldBox.max.clone() }];
}
