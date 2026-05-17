# Tactical FPS Asset Pipeline

This project serves static game assets from `public/assets` so Vercel can deploy them without a separate CDN.

## Required Folders

- `public/assets/maps/` stores JSON map metadata: spawns, bomb sites, lanes, callouts, nav nodes, cover nodes, and performance budgets.
- `public/assets/models/` stores optimized `.glb` files grouped by theme: `industrial`, `urban`, `dockyard`, `trainyard`, and `optimized`.
- `public/assets/textures/` stores texture atlases and compressed KTX2 textures.
- `public/assets/audio/` stores licensed `.ogg` or `.mp3` weapon tails, footsteps, ambience, and announcer lines.
- `public/draco/` stores Three.js Draco decoder files required by `DRACOLoader`.

## Import Rules

- Prefer CC0 or MIT assets only.
- Ship runtime models as GLB or glTF 2.0.
- Run mesh compression before committing large assets.
- Use texture atlases or KTX2 compressed textures for production maps.
- Keep collision meshes low-poly and named with `_col`; mark visual-only meshes with `no_col`.

## Current Included Asset

- `public/assets/kenney-city-kit-roads/`: Kenney City Kit Roads 2.0, CC0, already used as map dressing.
