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
      id: 'harbor-industrial',
      name: 'Harbor Exchange',
      theme: 'industrial',
      assetRoot: '/assets/models/industrial/',
      metadataPath: '/assets/maps/harbor-industrial.json',
      sourceLicense: 'CC0',
      bombSites: [
        { id: 'A', position: [-30, 0, -10], radius: 4.2 },
        { id: 'B', position: [30, 0, -18], radius: 4.2 },
      ],
      spawns: [
        { team: 'CT', position: [24, 0, 28], yaw: -0.35 },
        { team: 'T', position: [-24, 0, -36], yaw: 0.48 },
      ],
      lanes: ['A dry dock', 'mid customs', 'B warehouse', 'CT checkpoint', 'T freight'],
      callouts: ['T Yard', 'A Dock', 'A Crane', 'Mid Customs', 'B Ramp', 'B Warehouse', 'CT Gate'],
      performanceBudget: { maxDrawCalls: 550, maxTriangles: 550_000, maxTextureMegabytes: 180 },
    },
    {
      id: 'urban-gridlock',
      name: 'Gridlock',
      theme: 'urban',
      assetRoot: '/assets/models/urban/',
      metadataPath: '/assets/maps/urban-gridlock.json',
      sourceLicense: 'CC0',
      bombSites: [
        { id: 'A', position: [-22, 0, 8], radius: 4 },
        { id: 'B', position: [28, 0, -16], radius: 4 },
      ],
      spawns: [
        { team: 'CT', position: [30, 0, 32], yaw: -0.6 },
        { team: 'T', position: [-34, 0, -32], yaw: 0.65 },
      ],
      lanes: ['apartments', 'market mid', 'underpass', 'parking', 'service alley'],
      callouts: ['T Spawn', 'Apartments', 'Market', 'Underpass', 'Parking', 'A Store', 'B Alley'],
      performanceBudget: { maxDrawCalls: 600, maxTriangles: 620_000, maxTextureMegabytes: 210 },
    },
    {
      id: 'dockyard-storm',
      name: 'Storm Pier',
      theme: 'dockyard',
      assetRoot: '/assets/models/dockyard/',
      metadataPath: '/assets/maps/dockyard-storm.json',
      sourceLicense: 'CC0',
      bombSites: [
        { id: 'A', position: [-36, 0, -4], radius: 4.4 },
        { id: 'B', position: [24, 0, -24], radius: 4.1 },
      ],
      spawns: [
        { team: 'CT', position: [22, 0, 36], yaw: -0.42 },
        { team: 'T', position: [-30, 0, -40], yaw: 0.5 },
      ],
      lanes: ['pier long', 'container maze', 'warehouse mid', 'waterfront flank', 'security'],
      callouts: ['Pier', 'Long', 'Blue Container', 'Warehouse', 'Waterfront', 'Security', 'Back B'],
      performanceBudget: { maxDrawCalls: 560, maxTriangles: 580_000, maxTextureMegabytes: 190 },
    },
    {
      id: 'trainyard-switch',
      name: 'Switchyard',
      theme: 'trainyard',
      assetRoot: '/assets/models/trainyard/',
      metadataPath: '/assets/maps/trainyard-switch.json',
      sourceLicense: 'CC0',
      bombSites: [
        { id: 'A', position: [-18, 0, -18], radius: 4.2 },
        { id: 'B', position: [34, 0, 4], radius: 4.2 },
      ],
      spawns: [
        { team: 'CT', position: [28, 0, 34], yaw: -0.5 },
        { team: 'T', position: [-32, 0, -38], yaw: 0.54 },
      ],
      lanes: ['yard long', 'switch house', 'ladder lane', 'maintenance', 'back rail'],
      callouts: ['T Platform', 'Switch House', 'A Rail', 'Connector', 'Ladder', 'B Train', 'CT Bridge'],
      performanceBudget: { maxDrawCalls: 620, maxTriangles: 650_000, maxTextureMegabytes: 220 },
    },
  ],
};

export function validateMapManifest(manifest: TacticalMapManifest): ManifestValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (manifest.version !== 1) errors.push('Unsupported map manifest version.');
  if (manifest.maps.length < 4) errors.push('At least four tactical maps are required.');

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
