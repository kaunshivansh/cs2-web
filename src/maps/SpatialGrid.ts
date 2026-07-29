import * as THREE from 'three';

export interface AABBCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class SpatialGrid {
  private cellSize: number;
  private grid = new Map<string, AABBCollider[]>();

  constructor(cellSize: number = 4) {
    this.cellSize = cellSize;
  }

  private getKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public clear() {
    this.grid.clear();
  }

  public insert(collider: AABBCollider) {
    const minCx = Math.floor(collider.min.x / this.cellSize);
    const maxCx = Math.floor(collider.max.x / this.cellSize);
    const minCz = Math.floor(collider.min.z / this.cellSize);
    const maxCz = Math.floor(collider.max.z / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.getKey(cx, cz);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(collider);
      }
    }
  }

  public getCollidersInBox(min: THREE.Vector3, max: THREE.Vector3): AABBCollider[] {
    const minCx = Math.floor(min.x / this.cellSize);
    const maxCx = Math.floor(max.x / this.cellSize);
    const minCz = Math.floor(min.z / this.cellSize);
    const maxCz = Math.floor(max.z / this.cellSize);

    const result = new Set<AABBCollider>();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const list = this.grid.get(this.getKey(cx, cz));
        if (list) {
          for (let i = 0; i < list.length; i++) {
            result.add(list[i]);
          }
        }
      }
    }

    return Array.from(result);
  }

  public getCollidersInRadius(x: number, z: number, radius: number): AABBCollider[] {
    const minBox = new THREE.Vector3(x - radius, -100, z - radius);
    const maxBox = new THREE.Vector3(x + radius, 100, z + radius);
    return this.getCollidersInBox(minBox, maxBox);
  }
}
