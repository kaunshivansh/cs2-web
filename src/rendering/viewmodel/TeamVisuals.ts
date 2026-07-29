import * as THREE from 'three';
import type { Team } from '../../gameplay/match/MatchRules.ts';

export interface TeamVisualPalette {
  gloveColor: number;
  gloveDarkColor: number;
  sleeveColor: number;
  sleeveDarkColor: number;
  uniformColor: number;
  vestColor: number;
  vestDetailColor: number;
  helmetColor: number;
  skinColor: number;
  visorColor: number;
  badgeColor: number;
}

const TEAM_VISUALS: Record<Team, TeamVisualPalette> = {
  CT: {
    gloveColor: 0x3d6b96,
    gloveDarkColor: 0x18202a,
    sleeveColor: 0x3a5f84,
    sleeveDarkColor: 0x2a4055,
    uniformColor: 0x3a5f84,
    vestColor: 0x1c2e3c,
    vestDetailColor: 0x263848,
    helmetColor: 0x182430,
    skinColor: 0xd4c0a8,
    visorColor: 0x1a3348,
    badgeColor: 0x4a8fc0,
  },
  T: {
    gloveColor: 0x8a4a30,
    gloveDarkColor: 0x3c2010,
    sleeveColor: 0x8a4a30,
    sleeveDarkColor: 0x5e3424,
    uniformColor: 0x8a4a30,
    vestColor: 0x3c1e14,
    vestDetailColor: 0x4e2818,
    helmetColor: 0x3c2010,
    skinColor: 0xc8a88a,
    visorColor: 0x281408,
    badgeColor: 0xd1844f,
  },
};

export function getTeamVisualPalette(team: Team): TeamVisualPalette {
  return { ...TEAM_VISUALS[team] };
}

export function createWeaponMaterialSet() {
  return {
    gunMetal: new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.78, roughness: 0.28 }),
    gunSteel: new THREE.MeshStandardMaterial({ color: 0x7a8390, metalness: 0.88, roughness: 0.18 }),
    gunPoly:  new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.2, roughness: 0.58 }),
    gunWood:  new THREE.MeshStandardMaterial({ color: 0x6b4422, roughness: 0.72, metalness: 0.06 }),
    gunTan:   new THREE.MeshStandardMaterial({ color: 0x706048, roughness: 0.65, metalness: 0.1 }),
    optic:    new THREE.MeshStandardMaterial({ color: 0x16191f, metalness: 0.55, roughness: 0.28 }),
    lens:     new THREE.MeshStandardMaterial({ color: 0x103050, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.7 }),
    brass:    new THREE.MeshStandardMaterial({ color: 0xb8882e, metalness: 0.85, roughness: 0.2 }),
  };
}

export function shadowify(obj: THREE.Object3D) {
  obj.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; (c as THREE.Mesh).receiveShadow = true; } });
  return obj;
}

export function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0, rx=0, ry=0, rz=0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.rotation.set(rx,ry,rz); parent.add(m); return m;
}

export function makeHands(team: Team) {
  const g = new THREE.Group();
  const palette = getTeamVisualPalette(team);
  const skin = new THREE.MeshStandardMaterial({ color: palette.skinColor, roughness: 0.9 });
  const glove = new THREE.MeshStandardMaterial({ color: palette.gloveColor, roughness: 0.85 });
  const gloveDark = new THREE.MeshStandardMaterial({ color: palette.gloveDarkColor, roughness: 0.88 });
  const sleeve = new THREE.MeshStandardMaterial({ color: palette.sleeveColor, roughness: 0.82, metalness: 0.04 });
  const sleeveDark = new THREE.MeshStandardMaterial({ color: palette.sleeveDarkColor, roughness: 0.86, metalness: 0.03 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8882e, metalness: 0.85, roughness: 0.2 });
  
  // Left hand
  addMesh(g, new THREE.BoxGeometry(0.09,0.13,0.22), glove,   -0.16,-0.21,-0.14, 0.18,0,-0.18);
  addMesh(g, new THREE.BoxGeometry(0.07,0.07,0.15), gloveDark,  -0.16,-0.24,-0.04, 0.48,0,-0.18);
  addMesh(g, new THREE.BoxGeometry(0.085,0.07,0.14), sleeve, -0.16,-0.275,0.015, 0.52,0,-0.16);
  addMesh(g, new THREE.BoxGeometry(0.07,0.04,0.11), sleeveDark, -0.16,-0.305,0.06, 0.48,0,-0.12);
  addMesh(g, new THREE.CylinderGeometry(0.014,0.016,0.12,8), brass, -0.15,-0.16,-0.02, 0,0,0.4);
  
  // Right hand
  addMesh(g, new THREE.BoxGeometry(0.09,0.13,0.22), glove,    0.16,-0.21,-0.14, 0.18,0, 0.18);
  addMesh(g, new THREE.BoxGeometry(0.07,0.07,0.15), gloveDark,   0.16,-0.24,-0.04, 0.48,0, 0.18);
  addMesh(g, new THREE.BoxGeometry(0.085,0.07,0.14), sleeve, 0.16,-0.275,0.015, 0.52,0,0.16);
  addMesh(g, new THREE.BoxGeometry(0.07,0.04,0.11), sleeveDark, 0.16,-0.305,0.06, 0.48,0,0.12);
  
  // fingers stub
  for (let s of [-1,1]) {
    addMesh(g, new THREE.BoxGeometry(0.018,0.06,0.04), skin, s*0.12,-0.18,-0.27, 0.3,0,s*0.05);
    addMesh(g, new THREE.BoxGeometry(0.018,0.06,0.04), skin, s*0.16,-0.17,-0.28, 0.28,0,0);
    addMesh(g, new THREE.BoxGeometry(0.018,0.06,0.04), skin, s*0.20,-0.18,-0.27, 0.3,0,-s*0.05);
  }
  return g;
}
