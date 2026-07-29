# Web Shooter 3D

Live project: [cs2-web-three.vercel.app](https://cs2-web-three.vercel.app)

![CS2 Web splash](./public/opengraph.jpg)

A browser-based tactical FPS prototype built with **React**, **TypeScript**, **Three.js**, and **Vite**. 

The project aims to capture the feel of a 5v5 round-based defusal shooter in the browser. It features a complete gameplay loop, advanced bot AI, realistic weapon mechanics, and P2P multiplayer. The codebase is actively being structured into clean, testable systems for match rules, AI, weapons, maps, audio, and rendering.

## Current State & Features

The project is highly playable and includes the following fully integrated systems:

### 🎮 Gameplay & Mechanics
- **5v5 Round-based Matches:** Complete with freeze time, live action, bomb planting, and defusal phases.
- **Realistic Combat System:** Features hitboxes, headshot multipliers, damage falloff over distance, armor penetration, and helmet logic (`src/gameplay/combat`).
- **Weapon Mechanics:** Unique recoil patterns, movement spread penalties, camera punch (aim kick), and first-shot accuracy logic (`src/gameplay/player/RecoilPatterns.ts`, `WeaponFeel.ts`).
- **Economy System:** Full CS-style economy with a buy menu, round loss bonuses, and loadout management (`src/gameplay/match`, `src/ai/BotEconomy.ts`).
- **First-Person Controller:** Smooth movement, jumping, crouching, counter-strafing, and view bobbing.

### 🧠 Advanced Bot AI
Bots are not just target practice; they utilize a robust, multi-layered AI system (`src/ai`):
- **Tactical Director:** Evaluates situations dynamically to choose actions like `take-cover`, `trade-frag`, `hold-crossfire`, `plant-or-defuse`, or `investigate-sound` (`TacticalDirector.ts`).
- **Combat Controller:** State machine handling engagements, suppressing fire, retreating to cover, and reloading safely (`BotCombatController.ts`).
- **Navigation & Pathfinding:** Generates navigation graphs and analyzes chokepoints to smoothly navigate complex maps (`Navigation.ts`).
- **Difficulty Profiles:** AI profiles ranging from `easy` to `pro`, affecting reaction time, accuracy, aggression, and peek discipline.

### 🌐 Multiplayer (P2P)
- **PeerJS Integration:** Seamless, serverless multiplayer through WebRTC data channels (`src/networking/RoomManager.ts`).
- **State Synchronization:** Synchronizes player transforms, animations, weapon states, health, and combat events across the network.

### 🖼️ Rendering & Tech
- **Three.js Graphics:** First-person procedural view models, muzzle flashes, tracers, dynamic lighting, and shadows.
- **Map Pipeline:** Loads GLTF/GLB environments (compressed with Draco) using a flexible manifest system allowing for multiple map definitions (`src/maps/MapLoader.ts`).
- **Adaptive Quality:** Dynamically adjusts WebGL pixel ratio based on device framerate to maintain smooth performance (`src/rendering/AdaptiveQuality.ts`).
- **Audio System:** Lazy WebAudio bootstrapping with spatial audio for footsteps, gunshots, and objective events.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Graphics Engine:** Three.js
- **Networking:** PeerJS
- **Build Tool:** Vite
- **Testing:** Node built-in test runner

## Getting Started

### Requirements
- Node.js 22+ recommended
- npm

### Install
```bash
npm install
```

### Run Locally
```bash
npm run dev
```
Vite serves the game on `http://localhost:5173`.

## Available Scripts

- `npm run dev` - Starts the local dev server on `0.0.0.0:5173`
- `npm test` - Runs the TypeScript node tests
- `npm run typecheck` - Validates types via `tsc --noEmit`
- `npm run build` - Creates the production build in `dist/`
- `npm run serve` - Previews the built app locally

## Controls

- `W A S D` - Move
- `Mouse` - Aim
- `Left Click` - Fire
- `Right Click` - ADS / Scope
- `1 / 2 / 3` - Switch weapon slots (Primary, Sidearm, Knife)
- `R` - Reload
- `G` - Drop Weapon
- `B` - Open Buy Menu (during freeze time)
- `E` - Interact, Plant, or Defuse bomb
- `Shift` - Walk (increases accuracy, reduces footstep noise)
- `Ctrl` - Crouch (increases accuracy)
- `Space` - Jump
- `Tab` - Scoreboard

## Project Structure

```text
src/
  ai/                 Tactical director, nav meshes, combat state machines, and economy logic
  audio/              WebAudio runtime and spatial sound management
  engine/             Fixed-timestep GameLoop and input helpers
  gameplay/           Core logic for combat (damage, hitboxes), player (movement, recoil), and match rules
  maps/               Map manifests, loader wrappers, and boundary definitions
  networking/         PeerJS P2P room management and state sync
  pages/              React UI shell, main Game loop initialization (`Game.tsx`)
  rendering/          Three.js visual utilities, scene disposal, and adaptive resolution
  ui/                 HUD components and scoreboard models
  weapons/            Weapon metadata catalog (damage, spread, prices)
tests/                Node-based unit tests for extracted subsystems
public/assets/        Static maps, models (GLB), and asset documentation
public/draco/         Draco decoder WASM for fast map loading
```

## Verification

Run the same checks used for local quality gates:

```bash
npm test
npm run typecheck
npm run build
```

## Deployment

The project is configured for static deployment on **Vercel**.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- Static assets are served from `public/`
- Draco decoder files must remain available under `/draco/`

## Roadmap

- Continue refactoring the main game loop out of `src/pages/Game.tsx` into modular engine components.
- Enhance the P2P networking with better interpolation and snapshot prediction for smoother multiplayer.
- Expand visual effects (VFX) utilizing pooled particle systems instead of one-off mesh allocations.
- Further optimize the map pipeline and physics colliders (e.g., integrating `three-mesh-bvh`).
- Expand grenade systems (Smokes, Flashes, HE) and related AI tactical logic.
