/**
 * capture_bilingual.js
 * Captures all 10 screens in English (dark mode) and Hebrew (dark mode + RTL).
 * Outputs to: docs/screenshots/en/ and docs/screenshots/he/
 * Login: Sarah (owner role) — sarah@parking.dev / password123
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const EN_DIR = path.join(__dirname, 'screenshots', 'en');
const HE_DIR = path.join(__dirname, 'screenshots', 'he');

fs.mkdirSync(EN_DIR, { recursive: true });
fs.mkdirSync(HE_DIR, { recursive: true });

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

async function loginAsSarah(page) {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.ant-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));

  // Click the Sarah demo tag
  const sarahTag = await page.evaluateHandle(() => {
    const spans = [...document.querySelectorAll('.ant-tag')];
    return spans.find(s => s.textContent.includes('Sarah'));
  });
  if (sarahTag) {
    await sarahTag.click();
    await new Promise(r => setTimeout(r, 400));
  }

  // Click Sign In
  const signInBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find(b => b.textContent.includes('Sign In'));
  });
  if (signInBtn) await signInBtn.click();

  await page.waitForFunction(
    () => !window.location.pathname.includes('login') || document.querySelector('.ant-menu'),
    { timeout: 15000 }
  );
  await new Promise(r => setTimeout(r, 2000));
}

async function captureLanguage(browser, lang, outDir) {
  const page = await browser.newPage();

  // ── 1. Set language + dark mode BEFORE first load ──────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((l) => {
    localStorage.setItem('parking_dark_mode', 'true');
    localStorage.setItem('parking_language', l);
  }, lang);

  // ── 2. Reload, then capture login page ─────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.ant-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(outDir, '01_login.png'), fullPage: false });
  console.log(`[${lang}] ✓ 01_login`);

  // ── 3. Login as Sarah ───────────────────────────────────────────────────────
  const sarahTag = await page.evaluateHandle(() => {
    const spans = [...document.querySelectorAll('.ant-tag')];
    return spans.find(s => s.textContent.trim().startsWith('Sarah'));
  });
  if (sarahTag) {
    await sarahTag.click();
    await new Promise(r => setTimeout(r, 400));
  }

  const signInBtn = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button[type="submit"], button')];
    return btns.find(b => b.type === 'submit' || b.textContent.includes('Sign'));
  });
  if (signInBtn) await signInBtn.click();

  await page.waitForFunction(
    () => !window.location.pathname.includes('login') || document.querySelector('.ant-menu'),
    { timeout: 15000 }
  );
  await new Promise(r => setTimeout(r, 2500));

  // Ensure language stays set after login (it may reset from server prefs)
  await page.evaluate((l) => {
    localStorage.setItem('parking_language', l);
  }, lang);

  // ── 4. Screenshot each screen ───────────────────────────────────────────────
  for (const screen of SCREENS) {
    if (!screen.route) continue;

    await page.goto(`${BASE}${screen.route}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, screen.route.includes('calendar') ? 2500 : 1500));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 300));

    await page.screenshot({ path: path.join(outDir, `${screen.name}.png`), fullPage: true });
    console.log(`[${lang}] ✓ ${screen.name}`);
  }

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log('=== Capturing English screenshots ===');
  await captureLanguage(browser, 'en', EN_DIR);

  console.log('\n=== Capturing Hebrew screenshots ===');
  await captureLanguage(browser, 'he', HE_DIR);

  await browser.close();
  console.log('\nDone. Screenshots saved to docs/screenshots/en/ and docs/screenshots/he/');
})();
