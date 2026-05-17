# Tactical FPS Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing browser FPS into a modular, tactical 5v5 defusal shooter while preserving current playability.

**Architecture:** Keep the current Three.js runtime, but move deterministic gameplay, AI, weapons, maps, rendering quality, networking prep, and security utilities into testable TypeScript modules. `src/pages/Game.tsx` remains the playable shell during the transition, and each slice removes responsibilities from it instead of rewriting the game in one risky pass.

**Tech Stack:** React, TypeScript, Three.js, WebAudio, Vite, Node test runner, GLB/glTF, Draco.

---

## Current Audit

- Architecture: `src/pages/Game.tsx` is a 2600-line god component that owns rendering, simulation, input, AI, weapons, UI, audio calls, map construction, and match rules. This works for a prototype but blocks safe feature growth.
- Security: most player-facing text is safe, but buy menu and killfeed used `innerHTML`; scoreboards escaped values, but the pattern was still risky for future network/player names.
- Rendering: the current render path is direct `renderer.render(scene,camera)` with fixed device pixel ratio up to `2`; good screens can look sharp, but mid hardware can overdraw itself into low FPS.
- Gameplay: round flow, economy, bomb, spectator, buy, and bots exist, but match state is not deterministic or server-authoritative yet.
- AI: bots already pathfind, hold, rotate, plant, defuse, and search, but difficulty and coordination values were hardcoded per spawn instead of profile-driven.
- Audio: `AudioSystem` eagerly created an `AudioContext` during module import, which can violate browser autoplay expectations and crash non-browser verification.
- Assets: Kenney City Kit Roads is already present and licensed CC0; map metadata for the requested four-map pipeline was missing.
- Deployment: the workspace was not a Git repository at audit time, so GitHub/Vercel publishing requires local git initialization and a remote.

## Implemented First Slice

- [x] Add Node test runner coverage for audio safety, match rules, weapon catalog validation, tactical AI scoring, adaptive quality, and map manifest validation.
- [x] Add `src/gameplay/match/MatchRules.ts` with deterministic 5v5 rosters, economy awards, loss bonus escalation, halftime detection, MVP bookkeeping, and overtime-ready state.
- [x] Replace ad hoc weapon data with typed weapon configs and utility grenade definitions for smoke, flashbang, HE, and molotov.
- [x] Add `src/ai/TacticalDirector.ts` with difficulty profiles, tactical utility scoring, and enemy memory expiry.
- [x] Add `src/rendering/AdaptiveQuality.ts` and wire it into the active Three.js renderer.
- [x] Add `src/maps/MapManifest.ts` plus JSON metadata stubs for industrial, urban, dockyard, and trainyard maps.
- [x] Refactor `AudioSystem` to lazily create WebAudio only after `unlock()`.
- [x] Replace unsafe killfeed and buy menu `innerHTML` writes with DOM text nodes.
- [x] Remove an anonymous canvas click listener leak during cleanup.
- [x] Add Vite manual chunks so React and Three can be cached separately on Vercel.
- [x] Add `public/draco/` decoder files for compressed GLB support.

## Next Tasks

### Task 1: Extract Match Runtime From `Game.tsx`

**Files:**
- Modify: `src/pages/Game.tsx`
- Modify: `src/gameplay/match/MatchRules.ts`
- Create: `src/gameplay/match/MatchRuntime.ts`
- Test: `tests/gameplay/MatchRuntime.test.ts`

- [ ] Move `startRound`, `endRound`, score, loss streak, and side swap logic behind `MatchRuntime`.
- [ ] Preserve current HUD refs by exposing a `MatchSnapshot`.
- [ ] Add halftime side swap at round 13 for MR12.
- [ ] Add overtime state when scores tie at regulation end.
- [ ] Verify with `npm test` and `npm run build`.

### Task 2: Extract Bots Into AI System

**Files:**
- Modify: `src/pages/Game.tsx`
- Modify: `src/ai/TacticalDirector.ts`
- Create: `src/ai/BotRuntime.ts`
- Create: `src/ai/NavGrid.ts`
- Test: `tests/ai/BotRuntime.test.ts`

- [ ] Move nav grid, LOS, cover finding, and bot state transitions out of `Game.tsx`.
- [ ] Add smoke vision blockers to LOS checks.
- [ ] Add sound memory events for footsteps and gunshots.
- [ ] Add squad callouts for trade, rotate, and fake rotate decisions.
- [ ] Verify bot behavior in browser with screenshots and a playtest note.

### Task 3: Asset Pipeline And Imported Maps

**Files:**
- Modify: `src/maps/MapLoader.ts`
- Modify: `src/maps/MapManifest.ts`
- Create: `scripts/optimize-gltf.mjs`
- Add: `public/assets/models/{industrial,urban,dockyard,trainyard}/*.glb`
- Add: `public/assets/textures/*.ktx2`

- [ ] Download only CC0 or MIT assets listed in `docs/production/tactical-fps-production-checklist.md`.
- [ ] Convert source formats to GLB.
- [ ] Generate Draco-compressed runtime GLBs.
- [ ] Author low-poly collision proxies named `_col`.
- [ ] Validate each map with metadata, callouts, cover nodes, nav nodes, and sightline budgets.

### Task 4: Multiplayer-Ready Simulation

**Files:**
- Create: `src/networking/SnapshotTypes.ts`
- Create: `src/networking/PredictionBuffer.ts`
- Create: `src/networking/ReplicationSchema.ts`
- Test: `tests/networking/SnapshotTypes.test.ts`

- [ ] Define serializable entity snapshots.
- [ ] Add input command sequence numbers.
- [ ] Add interpolation buffer for remote actors.
- [ ] Add rollback-safe deterministic weapon fire inputs.
- [ ] Keep all networking validators client-safe and server-authoritative-ready.

### Task 5: Production Rendering Pass

**Files:**
- Modify: `src/rendering/Renderer.ts`
- Modify: `src/pages/Game.tsx`
- Create: `src/rendering/EffectsPool.ts`
- Create: `src/rendering/DecalSystem.ts`
- Test: `tests/rendering/EffectsPool.test.ts`

- [ ] Replace one-off tracers, impacts, blood, and shell effects with pooled objects.
- [ ] Add optional postprocessing quality tiers controlled by `AdaptiveQualityController`.
- [ ] Add WebGL context loss handling.
- [ ] Add draw-call and triangle counters to a debug overlay.
- [ ] Verify no unbounded effect arrays or GPU resources remain after a round.
