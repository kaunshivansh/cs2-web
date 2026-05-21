const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');

  await page.waitForFunction(
    () => window.__GAME_DEBUG__ && window.__GAME_DEBUG__.debugOverlays,
    { timeout: 25000 }
  );

  const results = await page.evaluate(() => {
    // Find the city group in the scene
    let cityGroup = null;
    window.__GAME_DEBUG__.debugOverlays.parent.children.forEach(child => {
      // The city group contains 'Sketchfab_model' or has a child named 'RootNode'
      let isCity = false;
      child.traverse(o => {
        if (o.name === 'RootNode' || o.name === 'Sketchfab_model') {
          isCity = true;
        }
      });
      if (isCity) {
        cityGroup = child;
      }
    });

    if (!cityGroup) {
      return { error: "City group not found in scene" };
    }

    const colliders = [];
    const tempB3 = new window.THREE.Box3();
    const vSize = new window.THREE.Vector3();

    cityGroup.traverse(o => {
      if (o.isMesh) {
        const name = o.name.toLowerCase();
        
        // Exclude ground, road lines, merged props, vehicles, etc.
        const isExcluded = 
          name.includes('plane') || 
          name.includes('road') || 
          name.includes('line') || 
          name.includes('panchina') || 
          name.includes('seemaforo') || 
          name.includes('cartello') || 
          name.includes('divieto') || 
          name.includes('cespuglio') || 
          name.includes('macchina') || 
          name.includes('camion') || 
          name.includes('bus') || 
          name.includes('cylinder') || 
          name.includes('sphere');

        if (!isExcluded) {
          o.geometry.computeBoundingBox();
          if (o.geometry.boundingBox) {
            tempB3.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
            tempB3.getSize(vSize);
            
            // Only structural elements matching Game.tsx criteria
            if (vSize.y > 0.4 && vSize.x > 0.05 && vSize.z > 0.05) {
              colliders.push({
                name: o.name,
                min: { x: tempB3.min.x, y: tempB3.min.y, z: tempB3.min.z },
                max: { x: tempB3.max.x, y: tempB3.max.y, z: tempB3.max.z }
              });
            }
          }
        }
      }
    });

    const r = 0.34;
    const eyeH = 1.72;
    const streetY = 4.65;
    
    const overlaps = (x, y, z) => {
      const mn = { x: x - r, y: y - eyeH, z: z - r };
      const mx = { x: x + r, y: y + 0.1, z: z + r };
      for (const c of colliders) {
        if (mn.x < c.max.x && mx.x > c.min.x && mn.y < c.max.y && mx.y > c.min.y && mn.z < c.max.z && mx.z > c.min.z) {
          return true;
        }
      }
      return false;
    };

    const findNearestSafe = (targetX, targetZ) => {
      // Spiral search
      for (let dist = 0; dist < 50; dist += 0.5) {
        for (let angle = 0; angle < 360; angle += 10) {
          const rad = (angle * Math.PI) / 180;
          const x = targetX + Math.cos(rad) * dist;
          const z = targetZ + Math.sin(rad) * dist;
          if (x >= -60 && x <= 60 && z >= -40 && z <= 40) {
            if (!overlaps(x, streetY + eyeH, z)) {
              return { x: Math.round(x * 10) / 10, y: 4.65, z: Math.round(z * 10) / 10, dist };
            }
          }
        }
      }
      return null;
    };

    // Let's search safe coords for CT_Spawn, T_Spawn, Site_A, Site_B
    const targets = {
      CT_Spawn: { x: 30, z: 25 },
      T_Spawn: { x: -30, z: -25 },
      Site_A: { x: -10, z: 10 },
      Site_B: { x: 10, z: -10 }
    };

    const output = {
      totalCollidersAfter: colliders.length,
      collidersList: colliders.map(c => c.name),
      coords: {}
    };

    for (const [key, target] of Object.entries(targets)) {
      output.coords[key] = findNearestSafe(target.x, target.z);
    }

    return output;
  });

  console.log("RESULTS:", JSON.stringify(results, null, 2));
  await browser.close();
})();
