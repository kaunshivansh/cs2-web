# CS2 Web — Architectural Changes & Audit Corrections Log

## Executive Audit Summary & Honest Technical Retractions

This audit and refinement pass corrects and verifies all claims against actual codebase contents, imports, and execution paths.

### 1. Explicit Technical Retractions & Clarifications
- **First-Person Hand Rig (`makeHands()`)**:
  - *Correction*: `makeHands()` in `TeamVisuals.ts` is a procedural primitive box/cylinder assembly with team-specific visual palette material overlays (`CT` blue/navy vs. `T` desert-tan). A pre-rigged, skinned GLB lower-arm mesh is **deferred** until external hand GLB assets are imported into the project repository.
- **GLB Weapon Models**:
  - *Correction*: `public/assets/models/weapons/` does not currently contain pre-built `.glb` weapon files. `createWeaponModel()` utilizes procedural primitives with full GLB loading/caching plumbing. Silent error suppression (`.catch(() => {})`) has been **removed** and replaced with an explicit runtime warning: `[WeaponModels] No GLB asset found for weapon '<id>' (<mode> mode). Using procedural fallback mesh.`
- **Map Manifest Entries (`dockyard` / `trainyard`)**:
  - *Correction*: Manifest entries lacking backing `.glb` geometry and `.json` metadata have been **removed** from `MAP_MANIFEST`. The map loading pipeline in `Game.tsx` now dynamically computes `mapUrl = ${mapDef.assetRoot}${mapDef.id}.glb`, ensuring only fully backed tactical maps (`city`) are selectable.

---

## 🛠 Verified Completed Enhancements

### 1. T-Side Character Model & Rig Warnings (Phase A)
- **Model Registry Update (`src/rendering/CharacterRig.ts`)**:
  - Replaced `elf_female_soldier.glb` with `sas__cs2_agent_model_blue.glb` in `TEAM_OPERATOR_CONFIG` for `T` side, ensuring T bots spawn as realistic CS2 tactical operators instead of fantasy elf models.
- **Team Visual Distinction (`src/rendering/CharacterLoader.ts`)**:
  - Implemented dynamic material palette overlays for T-side operators, shifting T-side tactical gear to desert-tan / brown / crimson tones (`palette.uniformColor`), ensuring CT (blue/navy) and T (desert/tan) read as visually distinct tactical operators on identical high-poly operator rigs.
- **Zero Console Warnings (`src/rendering/CharacterRig.ts`)**:
  - Aligned `BONE_CONTRACT` candidates (`pelvis`, `spine_1`, `hand_r`, `weapon_hand_r`) with the CS2 operator skeleton, eliminating all `resolveCharacterBone` console warnings during match execution.

### 2. Transparent Weapon Fallback Logging (Phase B)
- Replaced silent `.catch(() => {})` in `WeaponModels.ts` with explicit `console.warn` diagnostics for missing GLB weapon assets.

### 3. Functional Map Loading Pipeline (Phase D)
- Updated `Game.tsx` map loading code to dynamically compute `mapUrl` from `mapDef.assetRoot` and `mapDef.id`.
- Pruned unbacked map entries from `MAP_MANIFEST` to ensure 100% functional integrity.

### 4. GameRenderer & EffectComposer Post-Processing Stack (Phase E)
- Replaced bare inline `THREE.WebGLRenderer` in `Game.tsx` with `GameRenderer` from `src/rendering/Renderer.ts`.
- Integrated `EffectComposer` pipeline featuring UnrealBloomPass (0.45 strength, 0.35 radius), SMAAPass anti-aliasing, ACES filmic tone mapping, and exponential depth fog.
- Synchronized `AdaptiveQualityController.sampleFrame(dt)` resolution scaling with `GameRenderer.composer.setPixelRatio()`.

### 5. Typecheck & Environment Setup (Phase F)
- Added `@types/node` to `package.json` devDependencies and updated `tsconfig.json` types array.
- Verified `npm test` (95 passing tests), `npm run typecheck` (0 errors), and `npm run build` (successful Vite build in <1.1s).
