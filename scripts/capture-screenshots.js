/**
 * Capture 3 App Store screenshots:
 *   1. Gameplay #1 — character running with obstacles
 *   2. Gameplay #2 — gravity flip in action
 *   3. Boss battle — injected via startBossPhase()
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const GAME_URL = 'https://gravity-dash-cdce1.web.app/';
const OUT = path.join(__dirname, '..', 'screenshots-raw');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function saveShot(page, name) {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  console.log('✓', name);
}
async function pressEsc(page) { await page.keyboard.press('Escape'); await sleep(400); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });
  await context.route('**/*', r => r.continue({ headers: { 'Cache-Control': 'no-cache' } }));

  const page = await context.newPage();
  console.log('Loading game...');
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(4000);

  // Login as guest
  await page.evaluate(() => {
    const inp = document.getElementById('nameInput');
    inp.value = 'Player';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(200);
  await page.click('#loginBtn');
  await sleep(4000);

  // Skip tutorial → TITLE state
  await pressEsc(page);
  await sleep(2500);
  await pressEsc(page); // close any open panel
  await sleep(400);

  // Start endless run — tap エンドレス button
  // btnY = H*0.80 = 675, center x = 120
  await page.touchscreen.tap(120, 675);
  await sleep(3000); // countdown

  console.log('Game started. Playing...');

  // Play for a bit to get into the action
  // Alternate taps to flip gravity and avoid obstacles
  for (let i = 0; i < 15; i++) {
    await page.touchscreen.tap(195, 450);
    await sleep(350 + Math.floor(Math.random() * 200));
  }
  await sleep(500);

  // ── Screenshot 1: Gameplay — mid-run ──────────────────────────────────
  await saveShot(page, '01-gameplay-run.png');

  // Keep playing
  for (let i = 0; i < 12; i++) {
    await page.touchscreen.tap(195, 450);
    await sleep(300 + Math.floor(Math.random() * 150));
  }
  await sleep(800);

  // ── Screenshot 2: Gameplay — action shot ─────────────────────────────
  await saveShot(page, '02-gameplay-action.png');

  // ── Screenshot 3: Boss battle ─────────────────────────────────────────
  // Inject boss phase directly
  console.log('Triggering boss battle...');
  await page.evaluate(() => {
    // Force boss phase activation
    if (typeof startBossPhase === 'function') {
      startBossPhase();
    } else if (typeof window.startBossPhase === 'function') {
      window.startBossPhase();
    }
  });
  await sleep(2000); // Let boss appear and prepare animation run

  // Tap to keep player alive during boss
  for (let i = 0; i < 6; i++) {
    await page.touchscreen.tap(195, 400);
    await sleep(400);
  }

  // ── Screenshot 3: Boss battle ─────────────────────────────────────────
  await saveShot(page, '03-boss-battle.png');

  // Take a couple more to find the best boss shot
  await sleep(500);
  for (let i = 0; i < 3; i++) {
    await page.touchscreen.tap(195, 400);
    await sleep(400);
  }
  await saveShot(page, '03-boss-battle-2.png');

  await browser.close();
  console.log('\nDone! Files:');
  ['01-gameplay-run.png', '02-gameplay-action.png', '03-boss-battle.png', '03-boss-battle-2.png']
    .forEach(f => console.log(' ', f));
}

main().catch(console.error);
