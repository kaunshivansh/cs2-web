import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface MapData {
  spawnCT: THREE.Vector3;
  spawnT: THREE.Vector3;
  siteA: THREE.Vector3;
  siteB: THREE.Vector3;
  bounds: THREE.Box3;
  colliders: { min: THREE.Vector3, max: THREE.Vector3 }[];
}

export class MapLoader {
  private loader: GLTFLoader;
  public loadedMap: THREE.Group | null = null;
  public mapData: MapData | null = null;

  constructor() {
    this.loader = new GLTFLoader();
    
    // Setup DRACO for heavily compressed map assets
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
        (progress) => {
          // Can hook into UI for loading screen here
        },
        (error) => {
          console.error("Failed to load map:", error);
          reject(error);
        }
      );
    });
  }

  private processLoadedMap(mapGroup: THREE.Group) {
    const colliders: { min: THREE.Vector3, max: THREE.Vector3 }[] = [];
    
    // Reset Data
    this.mapData = {
      spawnCT: new THREE.Vector3(24, 0, 28),
      spawnT: new THREE.Vector3(-24, 0, -36),
      siteA: new THREE.Vector3(-30, 0, -10),
      siteB: new THREE.Vector3(30, 0, -18),
      bounds: new THREE.Box3(),
      colliders: []
    };

    const tempBox = new THREE.Box3();

    mapGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        
        // Setup shadows and materials
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: THREE.Material) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
              // AAA environment adjustments
              mat.roughness = Math.max(0.4, mat.roughness); 
            }
          });
        }

        // Generate bounding box colliders for physics
        // Note: For AAA, we'd use a dedicated convex hull or BVH physics tree (e.g. three-mesh-bvh)
        // This is a naive AABB extraction for compatibility with the current engine.
        
        // Only add collider if it's a structural element (ignore decals, grass, etc based on naming convention)
        if (!mesh.name.includes('no_col') && !mesh.name.includes('decal')) {
            mesh.geometry.computeBoundingBox();
            if (mesh.geometry.boundingBox) {
                tempBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
                colliders.push({ min: tempBox.min.clone(), max: tempBox.max.clone() });
            }
        }

        // Extract metadata points if set in Blender
        if (mesh.name === 'Spawn_CT') this.mapData!.spawnCT.copy(mesh.position);
        if (mesh.name === 'Spawn_T') this.mapData!.spawnT.copy(mesh.position);
        if (mesh.name === 'Site_A') this.mapData!.siteA.copy(mesh.position);
        if (mesh.name === 'Site_B') this.mapData!.siteB.copy(mesh.position);
      }
    });

    this.mapData.colliders = colliders;
  }
}
