const puppeteer = require('puppeteer');
const path = require('path');

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'docs', 'screenshots');

// Sarah is an owner — email: o1@parking.dev, password: password123
const SCREENS = [
  { name: '01_login',            path: null },           // before login
  { name: '02_my_requests',      path: '/my-requests' },
  { name: '03_new_request',      path: '/submit-request' },
  { name: '04_requests_view',    path: '/calendar' },
  { name: '05_pending_requests', path: '/pending' },
  { name: '06_approvals',        path: '/approvals' },
  { name: '07_parking_status',   path: '/lot-status' },
  { name: '08_lot_calendar',     path: '/lot-calendar' },
  { name: '09_my_lots',          path: '/my-lots' },
  { name: '10_notifications',    path: '/notifications' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();

  // ── 1. Screenshot login page ─────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  // Enable dark mode via localStorage before the app reads it
  await page.evaluate(() => {
    localStorage.setItem('parking_dark_mode', 'true');
  });
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.ant-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login.png'), fullPage: false });
  console.log('✓ 01_login');

  // ── 2. Login as Sarah ────────────────────────────────────────────────────
  // Click the "Sarah" demo tag
  const sarahTag = await page.evaluateHandle(() => {
    const spans = [...document.querySelectorAll('.ant-tag')];
    return spans.find(s => s.textContent.includes('Sarah'));
  });
  if (sarahTag) {
    await sarahTag.click();
    await new Promise(r => setTimeout(r, 500));
  }

  // Click Sign In
  const signInBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find(b => b.textContent.includes('Sign In'));
  });
  if (signInBtn) {
    await signInBtn.click();
  }

  // Wait for navigation after login
  await page.waitForFunction(
    () => !window.location.pathname.includes('login') || document.querySelector('.ant-menu'),
    { timeout: 15000 }
  );
  await new Promise(r => setTimeout(r, 2000));

  // Ensure dark mode is active
  await page.evaluate(() => {
    localStorage.setItem('parking_dark_mode', 'true');
  });

  // ── 3. Screenshot each screen ────────────────────────────────────────────
  for (const screen of SCREENS) {
    if (!screen.path) continue; // login already captured

    await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500)); // let animations settle

    // For calendar views, wait a bit more
    if (screen.path.includes('calendar')) {
      await new Promise(r => setTimeout(r, 1000));
    }

    // Scroll to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 300));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screen.name}.png`), fullPage: true });
    console.log(`✓ ${screen.name}`);
  }

  await browser.close();
  console.log('\nAll screenshots saved to docs/screenshots/');
})();
