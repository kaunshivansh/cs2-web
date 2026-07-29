const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser to check spawns...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.text()}`);
  });

  await page.goto('http://localhost:3005/');

  console.log("Waiting for map to load...");
  await page.waitForFunction(() => window.__MAP_DEBUG__ !== undefined, { timeout: 20000 });

  const result = await page.evaluate(() => {
    const list = [
      {x: -35.3, z: -34.6}, // 0
      {x: -24, z: -30},    // 1
      {x: -16.5, z: -34},  // 2
      null,                // 3 (need to find)
      {x: -12, z: -34}     // 4
    ];

    // Find a spot for index 3 that is near original (-10, -34), free, and at least 3.0m away from indices 0, 1, 2, 4
    const originalX = -10, originalZ = -34;
    for (let r = 0.5; r <= 15.0; r += 0.5) {
      for (let angle = 0; angle < 360; angle += 15) {
        const rad = (angle * Math.PI) / 180;
        const nx = originalX + Math.cos(rad) * r;
        const nz = originalZ + Math.sin(rad) * r;
        if (!window.__BLOCKED_AT__(nx, nz, 0.42)) {
          // Check distance from others
          let farEnough = true;
          for (let i = 0; i < list.length; i++) {
            if (list[i] === null) continue;
            const dist = Math.hypot(nx - list[i].x, nz - list[i].z);
            if (dist < 2.5) {
              farEnough = false;
              break;
            }
          }
          if (farEnough) {
            return { x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10 };
          }
        }
      }
    }
    return null;
  });

  console.log("Found spot for index 3:", result);
  await browser.close();
})();
