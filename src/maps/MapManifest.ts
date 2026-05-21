export interface TacticalMapSite {
  id: 'A' | 'B';
  position: [number, number, number];
  radius: number;
}

export interface TacticalMapSpawn {
  team: 'CT' | 'T';
  position: [number, number, number];
  yaw: number;
}

export interface TacticalMapDefinition {
  id: string;
  name: string;
  theme: 'industrial' | 'urban' | 'dockyard' | 'trainyard';
  assetRoot: string;
  metadataPath: string;
  sourceLicense: 'CC0' | 'MIT';
  bombSites: TacticalMapSite[];
  spawns: TacticalMapSpawn[];
  lanes: string[];
  callouts: string[];
  performanceBudget: {
    maxDrawCalls: number;
    maxTriangles: number;
    maxTextureMegabytes: number;
  };
}

export interface TacticalMapManifest {
  version: 1;
  maps: TacticalMapDefinition[];
}

export interface ManifestValidationResult {
  errors: string[];
}

export const MAP_MANIFEST: TacticalMapManifest = {
  version: 1,
  maps: [
    {
      id: 'city',
      name: 'City Grid',
      theme: 'urban',
      assetRoot: '/assets/models/',
      metadataPath: '/assets/maps/city.json',
      sourceLicense: 'CC0',
      bombSites: [
        { id: 'A', position: [-10, 4.65, 10], radius: 4.2 },
        { id: 'B', position: [10, 4.65, -10], radius: 4.2 },
      ],
      spawns: [
        { team: 'CT', position: [30, 4.65, 25], yaw: -0.35 },
        { team: 'T', position: [-30, 4.65, -25], yaw: 0.48 },
      ],
      lanes: ['A dry dock', 'mid customs', 'B warehouse', 'CT checkpoint', 'T freight'],
      callouts: ['T Yard', 'A Dock', 'A Crane', 'Mid Customs', 'B Ramp', 'B Warehouse', 'CT Gate'],
      performanceBudget: { maxDrawCalls: 550, maxTriangles: 550_000, maxTextureMegabytes: 180 },
    },
  ],
};

export function validateMapManifest(manifest: TacticalMapManifest): ManifestValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (manifest.version !== 1) errors.push('Unsupported map manifest version.');
  if (manifest.maps.length < 1) errors.push('At least one tactical map is required.');

  for (const map of manifest.maps) {
    if (ids.has(map.id)) errors.push(`Duplicate map id: ${map.id}`);
    ids.add(map.id);
    if (!map.assetRoot.startsWith('/assets/')) errors.push(`${map.id} assetRoot must be under /assets/.`);
    if (!map.metadataPath.startsWith('/assets/maps/')) errors.push(`${map.id} metadataPath must be under /assets/maps/.`);
    if (map.bombSites.length !== 2) errors.push(`${map.id} must define exactly two bomb sites.`);
    if (map.spawns.filter((spawn) => spawn.team === 'CT').length !== 1) errors.push(`${map.id} must define one CT spawn.`);
    if (map.spawns.filter((spawn) => spawn.team === 'T').length !== 1) errors.push(`${map.id} must define one T spawn.`);
    if (map.callouts.length < 6) errors.push(`${map.id} needs at least six callouts for comms and radar.`);
    if (map.performanceBudget.maxDrawCalls > 700) errors.push(`${map.id} draw-call budget is too high for web.`);
  }

  return { errors };
}
