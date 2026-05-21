const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION]:`, err);
  });

  console.log("Navigating to http://localhost:4173/ ...");
  await page.goto('http://localhost:4173/');

  console.log("Waiting for map to load...");
  // The map loaded UI contains the button "SINGLEPLAYER". Let's wait for it.
  try {
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent && b.textContent.includes('SINGLEPLAYER'));
      },
      { timeout: 25000 }
    );
    console.log("Map loaded in lobby successfully!");
  } catch (e) {
    console.error("Timeout waiting for map to load in lobby. Current page text:", await page.evaluate(() => document.body.innerText));
    await browser.close();
    process.exit(1);
  }

  // Click SINGLEPLAYER
  console.log("Clicking SINGLEPLAYER...");
  const mapDebug = await page.evaluate(() => window.__MAP_DEBUG__);
  console.log("MAP DEBUG INFO:", JSON.stringify(mapDebug, null, 2));
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const singleBtn = buttons.find(b => b.textContent && b.textContent.includes('SINGLEPLAYER'));
    if (singleBtn) singleBtn.click();
    else throw new Error("SINGLEPLAYER button not found");
  });

  // Enter username and click START MATCH
  console.log("Setting name and starting match...");
  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="Player Name..."]');
    if (input) {
      input.value = 'TestPlayer';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const buttons = Array.from(document.querySelectorAll('button'));
    const startBtn = buttons.find(b => b.textContent && b.textContent.includes('START MATCH'));
    if (startBtn) startBtn.click();
    else throw new Error("START MATCH button not found");
  });

  console.log("Match started! Waiting 6 seconds to capture logs/errors...");
  await new Promise(r => setTimeout(r, 6000));

  console.log("Taking screenshot...");
  await page.screenshot({ path: 'scratch/screenshot.png' });
  console.log("Screenshot saved to scratch/screenshot.png");

  await browser.close();
  console.log("Browser closed.");
})();
