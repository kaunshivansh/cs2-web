const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory with correct MIME types and cache headers
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    // Set custom MIME types
    if (ext === '.glb') {
      res.setHeader('Content-Type', 'model/gltf-binary');
    } else if (ext === '.gltf') {
      res.setHeader('Content-Type', 'model/gltf+json');
    } else if (ext === '.wasm') {
      res.setHeader('Content-Type', 'application/wasm');
    }

    // Set Cache-Control headers
    if (ext === '.glb' || ext === '.gltf' || ext === '.wasm' || filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
  }
}));

// Fallback to index.html for Single Page Application (SPA) routing
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
