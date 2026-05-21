const fs = require('fs');
const path = require('path');

function checkGlb(filename) {
  const filePath = path.join('/Users/shivanshtiwari/Desktop/cs2/public/assets/models', filename);
  const buffer = fs.readFileSync(filePath);
  const chunkLength = buffer.readUInt32LE(12);
  const jsonBuffer = buffer.slice(20, 20 + chunkLength);
  const gltf = JSON.parse(jsonBuffer.toString('utf8'));
  
  if (gltf.animations) {
    const list = gltf.animations.map((anim, i) => `[${i}]: "${anim.name}"`).join('\n');
    fs.writeFileSync('/Users/shivanshtiwari/Desktop/cs2/scratch/all_animations.txt', list);
    console.log(`Saved ${gltf.animations.length} animations to scratch/all_animations.txt`);
  } else {
    console.log("No animations found.");
  }
}

checkGlb('sas__cs2_agent_model_blue.glb');
