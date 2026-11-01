// Isolated browser fixtures only. No live credentials, accounts or database writes.
const { chromium } = require(process.env.SWIFTDROP_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.FRONTEND_BROWSER_URL || 'http://127.0.0.1:3000';
const output = path.resolve(__dirname, '../node_modules/.cache/swiftdrop-phase2');
fs.mkdirSync(output, { recursive: true });
const business = { businessName: 'A long registered Sri Lankan business name for responsive verification', category: 'Retail', contactName: 'Business contact', businessEmail: 'a-very-long-monitored-business-address@example.test', phone: '+94 77 123 4567', address: 'A long business address in Colombo', district: 'Colombo' };
const application = { id: 'test-app', userId: 'fixture', business, status: 'PENDING', submittedAt: '2026-11-01T00:00:00Z', version: 0 };
let checks = 0;
async function fixture(browser, role, viewport) {
  const context = await browser.newContext({ viewport }); let authenticated = !!role;
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await context.addInitScript(() => sessionStorage.setItem('swiftdrop_oauth_verifier', 'fixture-verifier-only'));
  const user = { id: 'fixture', name: 'A long customer name for navigation testing', email: 'customer@example.test', role: role || 'CUSTOMER', active: true };
  const session = { token: 'browser-fixture-only', expiresIn: 900, user };
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), endpoint = url.pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    let data = {}, status = 200;
    if (endpoint.endsWith('/auth/refresh')) { if (authenticated) data = session; else status = 401; }
    else if (endpoint.endsWith('/auth/login')) { authenticated = true; data = session; }
    else if (endpoint.endsWith('/auth/me')) data = user;
    else if (endpoint.endsWith('/auth/account')) data = { passwordEnabled: true, googleLinked: false, googleAvailable: true };
    else if (endpoint.endsWith('/auth/oauth/exchange')) { await new Promise(resolve => setTimeout(resolve, 3000)); authenticated = true; data = session; }
    else if (endpoint.endsWith('/auth/providers')) data = { google: true };
    else if (endpoint.endsWith('/auth/admin/users')) data = { users: [user], page: 0, pages: 1 };
    else if (endpoint.endsWith('/merchants/admin/applications')) data = { applications: [application], page: 0, pages: 1 };
    else if (endpoint.endsWith('/audit')) data = [];
    else if (endpoint.endsWith('/merchants/applications/me')) data = application;
    else if (endpoint.endsWith('/merchants/profile')) { data = application; status = 403; }
    else if (endpoint.includes('/merchants/admin/applications/')) data = application;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data }) });
  });
  return context;
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(size)}`); checks++;
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--renderer-process-limit=2'] });
  try {
    for (const width of [360, 390, 430, 768, 1024, 1280, 1536]) {
      for (const [role, routes] of [[null, ['/', '/track', '/track/SD-EXAMPLE', '/pricing', '/help', '/contact', '/login', '/register', '/forgot-password', '/reset-password#token=' + 't'.repeat(43), '/activate#code=' + 'a'.repeat(43), '/auth/callback#code=fixture-only']], ['CUSTOMER', ['/customer', '/merchant/apply', '/merchant/application-status', '/account']], ['MERCHANT', ['/merchant']], ['COURIER', ['/courier']], ['DISPATCHER', ['/admin']], ['ADMIN', ['/admin/users', '/admin/merchants']]]) {
        const context = await fixture(browser, role, { width, height: 900 }); const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        for (const route of routes) {
          await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.locator('main').waitFor();
          if (role) await page.locator('aside').waitFor({ state: 'attached' });
          await page.waitForTimeout(100);
          await noOverflow(page, `${role || 'PUBLIC'} ${route} ${width}`);
          if (!role && route === '/track/SD-EXAMPLE') {
            await page.getByRole('heading', { name: 'Tracking is not connected yet' }).waitFor();
            await page.getByRole('button', { name: 'View demonstration' }).click();
            await page.getByRole('article', { name: 'Demonstration tracking result' }).waitFor();
            await noOverflow(page, `demonstration timeline ${width}`);
          }
          if (!role && route === '/pricing') {
            await page.getByRole('button', { name: 'Calculate estimate' }).click();
            await page.getByText('Enter a pickup city or district.').waitFor();
            await noOverflow(page, `pricing validation ${width}`);
          }
          if (!role && route === '/contact') {
            await page.getByRole('button', { name: 'Submit message' }).click();
            await page.getByText('Enter your name.').waitFor();
            await noOverflow(page, `contact validation ${width}`);
          }
          if (!role && width < 1024 && route === '/') {
            await page.getByRole('button', { name: 'Open navigation' }).click();
            await page.getByRole('dialog').getByRole('link', { name: 'Pricing', exact: true }).waitFor();
            await noOverflow(page, `public drawer ${width}`);
            await page.keyboard.press('Escape');
          }
          if (role && width < 1024) {
            await page.getByRole('button', { name: 'Open navigation' }).click();
            await page.getByRole('dialog').waitFor(); await noOverflow(page, `drawer ${role} ${width}`);
            assert.equal(await page.getByRole('dialog').getByRole('link', { name: 'User accounts' }).count(), role === 'ADMIN' ? 1 : 0);
            await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
          }
          if (role && width >= 1024) assert(await page.locator('aside').isVisible());
          if (role === 'ADMIN' && route === '/admin/merchants') {
            await page.getByRole('button', { name: 'View details' }).click();
            await page.getByRole('button', { name: 'Reject', exact: true }).click();
            await page.getByLabel('Rejection reason').fill('Please correct the business address.');
            await noOverflow(page, `admin review form ${width}`);
            if ([360, 768, 1280].includes(width)) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(output, `admin-${width}.png`), fullPage: true }); }
          }
          if (!role && route === '/' && [360, 768, 1280].includes(width)) await page.screenshot({ path: path.join(output, `public-${width}.png`), fullPage: true });
        }
        if (role) {
          await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
          await page.locator('header').getByRole('link', { name: 'Dashboard', exact: true }).waitFor();
          await noOverflow(page, `authenticated public header ${role} ${width}`);
          if (width < 1024) {
            await page.getByRole('button', { name: 'Open navigation' }).click();
            await page.getByRole('dialog').getByRole('link', { name: 'Pricing', exact: true }).waitFor();
            await noOverflow(page, `authenticated public drawer ${role} ${width}`);
            await page.keyboard.press('Escape');
          }
        }
        assert.deepEqual(errors, [], `Browser runtime errors for ${role}`); await context.close();
      }
      console.log(`PASS: Phase 2 public/auth/account pages and all five portals at ${width}px; drawers, tracking timeline and validation checks`);
    }
    // Check submission controls still drive the existing auth flows in an isolated browser.
    const context = await fixture(browser, null, { width: 390, height: 844 }); const page = await context.newPage();
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' }); await page.getByLabel('Email address', { exact: true }).fill('customer@example.test'); await page.getByLabel('Password', { exact: true }).fill('Test-fixture-only!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByRole('heading', { name: 'Customer dashboard' }).waitFor();
    console.log(`PASS: mobile login submits and reaches the customer portal; ${checks} overflow checks passed`);
    await context.close();
    const googleContext = await fixture(browser, null, { width: 390, height: 844 });
    let started = false;
    await googleContext.route('http://localhost:4000/oauth2/authorization/google?**', async route => {
      const url = new URL(route.request().url());
      assert.match(url.searchParams.get('challenge'), /^[A-Za-z0-9_-]{43}$/);
      assert.deepEqual([...url.searchParams.keys()], ['challenge']); assert.equal(url.hash, ''); started = true;
      await route.fulfill({ contentType: 'text/html', body: '<title>Isolated OAuth start</title>' });
    });
    const googlePage = await googleContext.newPage(); await googlePage.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await googlePage.getByRole('button', { name: 'Sign in with Google', exact: true }).click();
    await googlePage.waitForURL('http://localhost:4000/oauth2/authorization/google?**'); assert(started);
    console.log('PASS: Google sign-in creates the browser challenge and starts the existing backend flow without tokens in the URL');
    await googleContext.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
