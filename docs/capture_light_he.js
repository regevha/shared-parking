/**
 * capture_light_he.js
 * מצלם את כל 10 המסכים במצב יום (light mode) ובשפה עברית.
 * שומר את הצילומים ב: docs/screenshots/he_light/
 * כניסה: Sarah (בעלת חנייה) — sarah@parking.dev / password123
 */

'use strict';
const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const BASE    = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots', 'he_light');
fs.mkdirSync(OUT_DIR, { recursive: true });

const SCREENS = [
  { name: '01_login',            route: null },
  { name: '02_my_requests',      route: '/my-requests' },
  { name: '03_new_request',      route: '/submit-request' },
  { name: '04_requests_view',    route: '/calendar' },
  { name: '05_pending_requests', route: '/pending' },
  { name: '06_approvals',        route: '/approvals' },
  { name: '07_parking_status',   route: '/lot-status' },
  { name: '08_lot_calendar',     route: '/lot-calendar' },
  { name: '09_my_lots',          route: '/my-lots' },
  { name: '10_notifications',    route: '/notifications' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // ── 1. הגדר עברית + מצב יום לפני הטעינה הראשונה ─────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('parking_dark_mode', 'false');
    localStorage.setItem('parking_language',  'he');
  });

  // ── 2. צלם מסך כניסה ─────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.ant-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, '01_login.png'), fullPage: false });
  console.log('✓ 01_login');

  // ── 3. כניסה כ-Sarah ─────────────────────────────────────────────────────
  const sarahTag = await page.evaluateHandle(() => {
    const spans = [...document.querySelectorAll('.ant-tag')];
    return spans.find(s => s.textContent.trim().startsWith('Sarah'));
  });
  if (sarahTag) {
    await sarahTag.click();
    await new Promise(r => setTimeout(r, 400));
  }

  const signInBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find(b => b.type === 'submit' || b.textContent.includes('Sign') || b.textContent.includes('כניסה'));
  });
  if (signInBtn) await signInBtn.click();

  await page.waitForFunction(
    () => !window.location.pathname.includes('login') || document.querySelector('.ant-menu'),
    { timeout: 15000 }
  );
  await new Promise(r => setTimeout(r, 2500));

  // ודא שהשפה והמצב נשמרו אחרי הכניסה
  await page.evaluate(() => {
    localStorage.setItem('parking_dark_mode', 'false');
    localStorage.setItem('parking_language',  'he');
  });

  // ── 4. צלם כל מסך ────────────────────────────────────────────────────────
  for (const screen of SCREENS) {
    if (!screen.route) continue;

    await page.goto(`${BASE}${screen.route}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, screen.route.includes('calendar') ? 2500 : 1600));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 300));

    await page.screenshot({ path: path.join(OUT_DIR, `${screen.name}.png`), fullPage: true });
    console.log(`✓ ${screen.name}`);
  }

  await browser.close();
  console.log('\nהצילומים נשמרו ב: docs/screenshots/he_light/');
})();
