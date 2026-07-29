const fs = require('fs');
const path = require('path');

function checkAnimations(filename) {
  const filePath = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, '../public/assets/models', filename);
  const buffer = fs.readFileSync(filePath);
  
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) { console.error("Not a GLB file"); return; }
  
  const totalLength = buffer.readUInt32LE(8);
  let offset = 12;
  let jsonChunk = null;
  
  while (offset < totalLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkType === 0x4E4F534A) {
      jsonChunk = buffer.slice(offset + 8, offset + 8 + chunkLength);
      break;
    }
    offset += 8 + chunkLength;
  }
  
  if (!jsonChunk) return;
  const gltf = JSON.parse(jsonChunk.toString('utf8'));
  console.log("Animations:");
  if (gltf.animations) {
    gltf.animations.forEach((anim, idx) => {
      console.log(`- Animation ${idx}: "${anim.name || 'unnamed'}"`);
    });
  } else {
    console.log("No animations found");
  }
}

const target = process.argv[2] || 'sas__cs2_agent_model_blue.glb';
checkAnimations(target);
