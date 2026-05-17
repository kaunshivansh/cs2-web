# Tactical FPS Production Checklist

## Major Changes And Impact

- Modular match rules: deterministic 5v5 state, economy awards, MVP bookkeeping, and halftime detection now live outside React. Performance impact is negligible because this is pure data; security impact is positive because this is the foundation for server-authoritative validation.
- Typed weapon catalog: weapons and utility grenades are now validated through `validateWeaponCatalog`. Performance impact is negligible; security impact is positive because future network/loadout payloads can be checked against a known schema.
- Tactical AI director: bot difficulty, coordination, reaction, sound awareness, and peek discipline are profile-driven. Performance impact is low because scoring is simple arithmetic; gameplay impact is higher consistency and easier hard/pro tuning.
- Lazy WebAudio: audio no longer creates an `AudioContext` at import time. Performance impact is lower startup cost; security/stability impact is positive because browser autoplay and test environments are handled safely.
- Adaptive quality: the renderer can reduce pixel ratio under sustained slow frames and recover on fast frames. Performance impact is positive on mid hardware; visual impact is controlled by minimum pixel ratio.
- Safer DOM updates: buy menu and killfeed now use text nodes instead of `innerHTML`. Security impact is positive for future multiplayer player names and weapon strings.
- Asset manifest: four maps now have metadata contracts and static folder targets. Performance impact is future-facing because each map carries draw-call, triangle, and texture budgets.
- Vite chunking: React and Three are separated into cacheable chunks. Performance impact is better repeat-load caching; deployment impact is Vercel-friendly static output.

## External Asset Download Targets

Download assets only from the linked source pages and keep the original license file beside each import.

- Kenney City Kit Roads: download from `https://www.kenney.nl/assets/city-kit-roads`; place GLB files in `public/assets/models/urban/kenney-city-kit-roads/*.glb` or keep the existing `public/assets/kenney-city-kit-roads/*.glb`.
- Kenney City Kit Commercial: download from `https://www.kenney.nl/assets/city-kit-commercial`; place optimized GLBs in `public/assets/models/urban/kenney-city-commercial/*.glb`.
- Kenney Train Kit: download from `https://kenney.nl/assets/train-kit`; place optimized GLBs in `public/assets/models/trainyard/kenney-train-kit/*.glb`.
- Quaternius Modular Sci-Fi Megakit: download from `https://quaternius.com/packs/modularscifimegakit.html`; place grid modular GLBs in `public/assets/models/industrial/quaternius-modular-scifi/*.glb`.
- Poly Haven Concrete Road Barrier: download from `https://polyhaven.com/a/concrete_road_barrier`; place the GLB in `public/assets/models/industrial/concrete_road_barrier.glb`.
- Poly Haven Empty Warehouse 01 HDRI: download from `https://polyhaven.com/a/empty_warehouse_01`; place the 1K or 2K HDR/EXR in `public/assets/textures/hdr/empty_warehouse_01_2k.hdr`.
- ambientCG Concrete002: download from `https://ambientcg.com/view?id=Concrete002`; place 1K or 2K texture set in `public/assets/textures/concrete/Concrete002/`.
- Poly Pizza CC0 search: use `https://poly.pizza/search/CC0` for small props only after verifying each model page says Public Domain or CC0; place GLB props in `public/assets/models/props/poly-pizza/<model-name>.glb`.
- Sketchfab CC0: use Sketchfab search filtered to downloadable CC0 assets; place every asset in `public/assets/models/sketchfab-cc0/<creator>-<asset-name>/` with a `SOURCE.md` containing URL, creator, license, and download date.

## TODO Roadmap

- Extract `Game.tsx` systems in this order: match runtime, weapon runtime, bot runtime, map runtime, rendering effects, HUD components.
- Replace all remaining `any` in gameplay-critical paths with explicit state and snapshot types.
- Add utility grenades to the active runtime: smoke projectile, volumetric impostor, AI vision blocking, flash exposure, HE falloff, molotov area denial.
- Add server-authoritative prep: input commands, snapshot schema, deterministic cooldown validation, interpolation buffers, and replay records.
- Add real map loading path that chooses map metadata from `MAP_MANIFEST` instead of hardcoding Harbor Exchange only.
- Add object pools for tracers, blood, sparks, shell casings, smoke particles, and explosion particles.
- Add settings UI for quality, crosshair, keybinds, audio mix, mouse sensitivity, and accessibility toggles.
- Add game modes as data-driven rule presets: competitive defusal, deathmatch, gun game, retake, warmup, practice, aim trainer, and bot training.

## Optimization Checklist

- Keep gameplay simulation outside React rerenders.
- Keep steady-state allocations near zero in the render loop.
- Use instancing for repeated crates, barriers, cones, lights, rail pieces, and shell casings.
- Use LODs for imported buildings and containers.
- Use KTX2 texture compression for production texture sets.
- Use Draco or Meshopt compression for GLB maps.
- Keep shadow casters selective; use baked/painted AO where possible.
- Cap postprocessing by quality tier and expose a low-latency competitive preset.
- Add frustum culling, occlusion zones, and map-sector activation for each imported map.
- Profile with Chrome Performance and SpectorJS before adding heavier shaders.

## Security Checklist

- Never trust client hit, cooldown, inventory, economy, plant, or defuse claims in multiplayer.
- Validate every loadout id against `WEAPONS`.
- Validate every map id against `MAP_MANIFEST`.
- Keep player names rendered with `textContent`, not `innerHTML`.
- Bound all effect pools and dropped object arrays.
- Handle WebGL context loss and recovery.
- Avoid eager AudioContext creation.
- Sanitize future WebSocket packets with runtime validators before state mutation.
- Use fixed tick simulation for server state and replay capture.
- Keep authoritative server code separate from presentation code.

## Deployment Checklist

- Run `npm test`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Commit source, docs, tests, `public/assets`, and `public/draco`.
- Do not commit `dist/`, `node_modules/`, local env files, or profiler dumps.
- Push to GitHub.
- In Vercel, import the GitHub repo.
- Set framework preset to Vite.
- Set build command to `npm run build`.
- Set output directory to `dist`.
- Confirm static assets load from `/assets/...` and Draco decoders load from `/draco/...`.
- Smoke test lobby, match start, buy menu, shooting, bomb plant/defuse, spectator, scoreboard, and mobile lobby layout after deployment.
