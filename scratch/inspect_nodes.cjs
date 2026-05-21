const fs = require('fs');
const path = require('path');

function checkExtensions(filename) {
  const filePath = path.join('/Users/shivanshtiwari/Desktop/cs2/public/assets/models', filename);
  const buffer = fs.readFileSync(filePath);
  const chunkLength = buffer.readUInt32LE(12);
  const jsonBuffer = buffer.slice(20, 20 + chunkLength);
  const gltf = JSON.parse(jsonBuffer.toString('utf8'));

  console.log("extensionsUsed:", gltf.extensionsUsed);
  console.log("extensionsRequired:", gltf.extensionsRequired);
}

checkExtensions('city.glb');
