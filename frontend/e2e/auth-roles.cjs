// Optional browser integration: uses RoleBrowserTest's isolated H2 server, never Neon.
const { chromium } = require(process.env.SWIFTDROP_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = 'http://localhost:3000', backend = process.env.AUTH_BROWSER_API;
const password = process.env.AUTH_BROWSER_PASSWORD;
if (!backend || !password) throw new Error('Run through RoleBrowserTest with isolated fixtures');
let browser, stage = 'launch';
const pass = () => console.log(`PASS: ${stage}`);
async function context() {
  const c = await browser.newContext();
  await c.route('http://localhost:4000/**', async route => {
    const response = await route.fetch({ url: route.request().url().replace('http://localhost:4000', backend) });
    await route.fulfill({ response });
  });
  return c;
}
async function login(page, email, destination) {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(`${base}${destination}`);
}
(async () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--renderer-process-limit=2'] });
  for (const [role, destination] of [['CUSTOMER','/customer'],['MERCHANT','/merchant'],['COURIER','/courier'],['DISPATCHER','/admin'],['ADMIN','/admin']]) {
    stage = `${role} shared login, browser reload, protected routes and logout`;
    const c = await context(), page = await c.newPage(); page.setDefaultTimeout(20000);
    await login(page, `${role.toLowerCase()}@browser.example`, destination);
    await page.reload(); await page.waitForURL(`${base}${destination}`);
    await page.getByTitle('Logout').waitFor();
    if (role !== 'ADMIN') { await page.goto(`${base}/admin/users`); await page.waitForURL(`${base}/`); }
    let other;
    if (role === 'CUSTOMER') {
      other = await c.newPage(); await other.goto(`${base}/customer`); await other.getByTitle('Logout').waitFor();
    }
    await page.getByTitle('Logout').click(); await page.waitForURL(`${base}/login`);
    if (other) await other.waitForURL(`${base}/login`);
    await c.close(); pass();
  }
  stage = 'ADMIN UI provision and recipient activation';
  const adminContext = await context(), admin = await adminContext.newPage();
  await login(admin, 'admin@browser.example', '/admin');
  await admin.getByRole('link', { name: 'User accounts' }).click();
  await admin.getByLabel('name', { exact: true }).fill('Provisioned browser user');
  await admin.getByLabel('email', { exact: true }).fill('provisioned@browser.example');
  await admin.getByRole('button', { name: 'Create identity' }).click();
  const activation = admin.locator('a[href*="/activate#code="]'); await activation.waitFor();
  const recipientContext = await context(), recipient = await recipientContext.newPage();
  await recipient.goto(await activation.getAttribute('href'));
  await recipient.getByLabel('New password').fill(password);
  await recipient.getByLabel('Confirm password').fill(password);
  await recipient.getByRole('button', { name: 'Set password' }).click();
  await recipient.getByText('Password set. You can now sign in.').waitFor();
  await login(recipient, 'provisioned@browser.example', '/courier'); pass();
  stage = 'ADMIN UI role change revokes sessions and changes subsequent navigation';
  const row = admin.getByRole('row').filter({ hasText: 'provisioned@browser.example' });
  await row.getByRole('combobox').selectOption('DISPATCHER');
  const roleChange = admin.waitForResponse(r => r.url().endsWith('/role') && r.request().method() === 'POST');
  await row.getByRole('button', { name: 'Change role' }).click(); assert.equal((await roleChange).status(), 200);
  await recipient.reload(); await recipient.waitForURL(`${base}/login`);
  await login(recipient, 'provisioned@browser.example', '/admin'); pass();
  stage = 'ADMIN UI deactivation blocks restoration and records audit';
  const deactivation = admin.waitForResponse(r => r.url().endsWith('/status') && r.request().method() === 'POST');
  await row.getByRole('button', { name: 'Deactivate', exact: true }).click(); assert.equal((await deactivation).status(), 200);
  await recipient.reload(); await recipient.waitForURL(`${base}/login`);
  await row.getByRole('button', { name: 'Audit', exact: true }).click();
  await admin.getByText(/ROLE_CHANGED/).waitFor(); await admin.getByText(/STATUS_CHANGED/).waitFor(); pass();
  await adminContext.close(); await recipientContext.close();
})().catch(error => { console.error(`FAIL: ${stage} (${error.name})`); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
