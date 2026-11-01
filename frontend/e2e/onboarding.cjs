const { chromium } = require(process.env.SWIFTDROP_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://localhost:3000', auth = process.env.AUTH_BROWSER_API, merchant = process.env.MERCHANT_BROWSER_API;
const password = process.env.AUTH_BROWSER_PASSWORD, replacement = `${password}!`, inbox = process.env.RECOVERY_INBOX_FILE;
if (!auth || !merchant || !password || !inbox) throw new Error('Run through OnboardingBrowserTest with isolated fixtures');
let browser, stage = 'starting isolated services';
const pass = () => console.log(`PASS: ${stage}`);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(url) { for (let i = 0; i < 160; i++) { try { if ((await fetch(url)).ok) return; } catch {} await wait(250); } throw new Error('Test server did not start'); }
async function context() {
  const c = await browser.newContext();
  // External font availability is unrelated to this isolated integration contract.
  await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  for (const [from, to] of [['http://localhost:4000', auth], ['http://localhost:4001', merchant]]) {
    await c.route(`${from}/**`, async route => { const response = await route.fetch({ url: route.request().url().replace(from, to) }); await route.fulfill({ response }); });
  }
  return c;
}
async function login(page, email, secret, destination) {
  await page.goto(`${base}/login`); await page.getByLabel('Email address', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(secret);
  const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); const result = await response;
  assert.equal(result.status(), 200); const token = (await result.json()).data.token;
  await page.waitForURL(`${base}${destination}`); return token;
}
async function apply(page, name) {
  await page.goto(`${base}/merchant/apply`);
  for (const [label, value] of [['Registered business name *', name], ['Business category *', 'Retail'], ['Contact person *', 'Kamal'], ['Business email *', 'business@example.lk'], ['Business phone *', '+94 77 123 4567'], ['Business address *', '1 Example Road'], ['City / district *', 'Colombo']]) await page.getByLabel(label, { exact: true }).fill(value);
  const response = page.waitForResponse(r => r.url().endsWith('/merchants/applications') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit application' }).click(); assert.equal((await response).status(), 201);
  await page.getByText('Status: PENDING', { exact: true }).waitFor();
}
async function review(admin, name, decision) {
  await admin.goto(`${base}/admin/merchants`);
  const row = admin.getByRole('row').filter({ hasText: name }); await row.getByRole('button', { name: 'View details' }).click();
  await admin.getByRole('button', { name: decision === 'approve' ? 'Approve' : 'Reject', exact: true }).click();
  if (decision === 'reject') await admin.getByLabel('Rejection reason').fill('Correct your business address');
  await admin.getByRole('button', { name: decision === 'approve' ? 'Confirm approval' : 'Confirm rejection' }).click();
  await admin.getByText(`Status: ${decision === 'approve' ? 'APPROVED' : 'REJECTED'}`, { exact: true }).waitFor();
}
(async () => {
  await ready(base); await ready(`${merchant}/actuator/health/readiness`);
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--renderer-process-limit=2'] });
  const customerContext = await context(), customer = await customerContext.newPage(); customer.setDefaultTimeout(30000);
  const email = `applicant-${Date.now()}@onboarding.example`;
  stage = 'customer registration and shared login';
  await customer.goto(`${base}/register`); await customer.getByLabel('Full Name', { exact: true }).fill('Onboarding browser user');
  await customer.getByLabel('Email address', { exact: true }).fill(email); await customer.getByLabel('Password', { exact: true }).fill(password); await customer.getByLabel('Confirm password', { exact: true }).fill(password);
  await customer.getByRole('button', { name: 'Create Account', exact: true }).click(); await customer.waitForURL(`${base}/customer`); pass();
  stage = 'password recovery through fake email inbox, single-use reset and new-password login';
  await customer.goto(`${base}/forgot-password`); await customer.getByLabel('Email address').fill(email); await customer.getByRole('button', { name: 'Send reset instructions' }).click();
  await customer.getByRole('status').filter({ hasText: 'If an eligible account exists' }).waitFor();
  for (let i = 0; i < 80 && !fs.existsSync(inbox); i++) await wait(100);
  assert(fs.existsSync(inbox)); await customer.goto(fs.readFileSync(inbox, 'utf8'));
  await customer.getByLabel('New password', { exact: true }).fill(replacement); await customer.getByLabel('Confirm password', { exact: true }).fill(replacement);
  await customer.getByRole('button', { name: 'Change password' }).click(); await customer.getByText('Password changed. Sign in again with your new password.').waitFor();
  assert.equal((await customerContext.request.post(`${auth}/api/v1/auth/login`, { data: { email, password } })).status(), 401);
  const customerToken = await login(customer, email, replacement, '/customer'); pass();
  stage = 'CUSTOMER applies, stays pending and cannot access administrator review';
  await apply(customer, 'Browser Customer Business');
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchants/admin/applications`, { headers: { Authorization: `Bearer ${customerToken}` } })).status(), 403); pass();
  stage = 'ADMIN approval securely grants merchant role and revokes prior customer session';
  const adminContext = await context(), admin = await adminContext.newPage(); admin.setDefaultTimeout(30000);
  await login(admin, 'admin@onboarding.example', password, '/admin'); await review(admin, 'Browser Customer Business', 'approve');
  assert.equal((await customerContext.request.get(`${auth}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${customerToken}` } })).status(), 401);
  await customer.reload(); await customer.waitForURL(`${base}/login`); const approvedToken = await login(customer, email, replacement, '/merchant');
  await customer.getByText('Status: APPROVED', { exact: true }).waitFor();
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchants/profile`, { headers: { Authorization: `Bearer ${approvedToken}` } })).status(), 200); pass();
  stage = 'pre-provisioned merchant has no approved business by default';
  const existingContext = await context(), existing = await existingContext.newPage(); existing.setDefaultTimeout(30000);
  const existingToken = await login(existing, 'merchant@onboarding.example', password, '/merchant');
  assert.equal((await existingContext.request.get(`${merchant}/api/v1/merchants/profile`, { headers: { Authorization: `Bearer ${existingToken}` } })).status(), 404);
  await apply(existing, 'Browser Provisioned Business'); pass();
  stage = 'rejection, correction and controlled resubmission';
  await review(admin, 'Browser Provisioned Business', 'reject'); await existing.reload();
  await existing.getByText('Reason: Correct your business address').waitFor(); await existing.getByRole('link', { name: 'Edit business details' }).click();
  await existing.getByLabel('Business address *', { exact: true }).fill('2 Corrected Road'); await existing.getByRole('button', { name: 'Save corrections' }).click();
  await existing.getByRole('button', { name: 'Resubmit application' }).click(); await existing.getByText('Status: PENDING', { exact: true }).waitFor(); pass();
  stage = 'existing merchant identity is approved without duplicate identity or manual role editing';
  await review(admin, 'Browser Provisioned Business', 'approve'); await existing.goto(`${base}/merchant`); await existing.getByText('Status: APPROVED', { exact: true }).waitFor(); pass();
  await customerContext.close(); await adminContext.close(); await existingContext.close();
})().catch(error => { console.error(`FAIL: ${stage} (${error.name}) ${error.stack?.match(/onboarding\.cjs:\d+:\d+/)?.[0] || ''}`); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
