#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Usage: ts-node src/utils/AssetPipeline.ts <path-to-gltf-or-glb>
// Requires: npm install -g gltf-pipeline

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Usage: AssetPipeline.ts <input-file>");
  process.exit(1);
}

const ext = path.extname(inputFile);
const basename = path.basename(inputFile, ext);
const outDir = path.resolve(__dirname, '../../public/assets/models/optimized');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outputFile = path.join(outDir, `${basename}_draco.glb`);

try {
  console.log(`Optimizing ${inputFile} -> ${outputFile}...`);
  // Compress using draco
  execSync(`npx gltf-pipeline -i "${inputFile}" -o "${outputFile}" -d`);
  console.log('✅ Optimization complete!');
} catch (err) {
  console.error('❌ Failed to optimize asset:', err);
}
