const fs = require('fs');
const path = require('path');

function inspectGlb(filename) {
  const filePath = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, '../public/assets/models', filename);
  const buffer = fs.readFileSync(filePath);
  
  // Find JSON chunk
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) { // "glTF"
    console.error("Not a GLB file");
    return;
  }
  
  const version = buffer.readUInt32LE(4);
  const totalLength = buffer.readUInt32LE(8);
  
  let offset = 12;
  let jsonChunk = null;
  
  while (offset < totalLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkType === 0x4E4F534A) { // "JSON"
      jsonChunk = buffer.slice(offset + 8, offset + 8 + chunkLength);
      break;
    }
    offset += 8 + chunkLength;
  }
  
  if (!jsonChunk) {
    console.error("JSON chunk not found");
    return;
  }
  
  const gltf = JSON.parse(jsonChunk.toString('utf8'));
  console.log("GLTF Nodes:");
  if (gltf.nodes) {
    gltf.nodes.forEach((node, idx) => {
      if (node.name) {
        console.log(`- Node ${idx}: "${node.name}"${node.translation ? ` translation: ${JSON.stringify(node.translation)}` : ''}`);
      }
    });
  } else {
    console.log("No nodes found in JSON chunk");
  }
}

const targetFile = process.argv[2] || 'city.glb';
inspectGlb(targetFile);
