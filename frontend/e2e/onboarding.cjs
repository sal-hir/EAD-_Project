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
  const adminToken = await login(admin, 'admin@onboarding.example', password, '/admin'); await review(admin, 'Browser Customer Business', 'approve');
  assert.equal((await customerContext.request.get(`${auth}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${customerToken}` } })).status(), 401);
  await customer.reload(); await customer.waitForURL(`${base}/login`); const approvedToken = await login(customer, email, replacement, '/merchant');
  await customer.getByText('Status: APPROVED', { exact: true }).waitFor();
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchants/profile`, { headers: { Authorization: `Bearer ${approvedToken}` } })).status(), 200); pass();
  stage = 'approved merchant generates a one-time API key and authenticates a machine request';
  await customer.goto(`${base}/merchant/credentials`);
  await customer.getByLabel('Key label', { exact: true }).fill('Browser integration');
  await customer.getByRole('button', { name: 'Generate API key', exact: true }).click();
  const rawKey = await customer.getByLabel('New API key (shown once)', { exact: true }).inputValue();
  assert.match(rawKey, /^sd_mk_[A-Za-z0-9_-]{43}$/);
  const machineResponse = await customerContext.request.get(`${merchant}/api/v1/merchant-api/identity`, { headers: { 'X-API-Key': rawKey } });
  assert.equal(machineResponse.status(), 200); const machine = (await machineResponse.json()).data;
  const metadata = await customerContext.request.get(`${merchant}/api/v1/merchants/api-keys`, { headers: { Authorization: `Bearer ${approvedToken}` } });
  assert.equal(metadata.status(), 200); assert(!(await metadata.text()).includes(rawKey));
  await customer.getByRole('button', { name: 'I have saved the key' }).click();
  assert.equal(await customer.getByLabel('New API key (shown once)').count(), 0); pass();
  stage = 'merchant revokes its API key and replay is rejected';
  await customer.getByRole('button', { name: 'Revoke', exact: true }).click();
  await customer.getByRole('button', { name: 'Revoke key', exact: true }).click();
  await customer.getByText('API key revoked. Future requests using this key will be rejected.', { exact: true }).waitFor();
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchant-api/identity`, { headers: { 'X-API-Key': rawKey } })).status(), 401); pass();
  stage = 'current Auth deactivation blocks API keys and ADMIN revocation is enforced';
  await customer.getByLabel('Key label', { exact: true }).fill('Admin revocation');
  await customer.getByRole('button', { name: 'Generate API key', exact: true }).click();
  const adminKey = await customer.getByLabel('New API key (shown once)', { exact: true }).inputValue();
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchant-api/identity`, { headers: { 'X-API-Key': adminKey } })).status(), 200);
  assert.equal((await adminContext.request.post(`${auth}/api/v1/auth/admin/users/${machine.userId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` }, data: { active: false }
  })).status(), 200);
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchant-api/identity`, { headers: { 'X-API-Key': adminKey } })).status(), 401);
  await admin.goto(`${base}/admin/merchants/${machine.merchantId}/credentials`);
  await admin.getByRole('button', { name: 'Revoke', exact: true }).click();
  await admin.getByRole('button', { name: 'Revoke key', exact: true }).click();
  await admin.getByText('API key revoked. Future requests using this key will be rejected.', { exact: true }).waitFor();
  assert.equal((await adminContext.request.post(`${auth}/api/v1/auth/admin/users/${machine.userId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` }, data: { active: true }
  })).status(), 200);
  assert.equal((await customerContext.request.get(`${merchant}/api/v1/merchant-api/identity`, { headers: { 'X-API-Key': adminKey } })).status(), 401); pass();
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
  stage = 'OAuth client creation, standard client-credentials token grant and authenticated identity';
  await existing.goto(`${base}/merchant/oauth-clients`);
  await existing.getByLabel('Client label', { exact: true }).fill('Browser OAuth integration');
  await existing.getByRole('button', { name: 'Create OAuth client', exact: true }).click();
  const clientId = await existing.getByLabel('Client ID', { exact: true }).inputValue();
  const clientSecret = await existing.getByLabel('Client secret (shown once)', { exact: true }).inputValue();
  assert.match(clientSecret, /^sd_cs_[A-Za-z0-9_-]{43}$/);
  const grant = (secret, scope) => existingContext.request.post(`${merchant}/api/v1/oauth/token`, {
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` },
    form: { grant_type: 'client_credentials', ...(scope ? { scope } : {}) }
  });
  const granted = await grant(clientSecret); assert.equal(granted.status(), 200);
  const tokenData = await granted.json(); assert.equal(tokenData.token_type, 'Bearer'); assert.equal(tokenData.expires_in, 900);
  const oauthIdentity = token => existingContext.request.get(`${merchant}/api/v1/merchant-api/oauth/identity`, { headers: { Authorization: `Bearer ${token}` } });
  const oauthResponse = await oauthIdentity(tokenData.access_token); assert.equal(oauthResponse.status(), 200);
  const oauthBusiness = (await oauthResponse.json()).data; assert.equal(oauthBusiness.clientId, clientId);
  await existing.getByRole('button', { name: 'I have saved the client secret' }).click();
  assert.equal(await existing.getByLabel('Client secret (shown once)').count(), 0); pass();
  stage = 'OAuth access tokens enforce requested scopes';
  const limited = await grant(clientSecret, 'merchant:read'); assert.equal(limited.status(), 200);
  const limitedToken = (await limited.json()).access_token;
  assert.equal((await existingContext.request.get(`${merchant}/api/v1/merchant-api/oauth/authorize?scope=orders%3Awrite`, {
    headers: { Authorization: `Bearer ${limitedToken}` }
  })).status(), 403);
  assert.equal((await grant(clientSecret, 'admin')).status(), 400); pass();
  stage = 'OAuth secret rotation invalidates old client secret and issued tokens';
  await existing.getByRole('button', { name: 'Rotate secret', exact: true }).click();
  await existing.getByRole('button', { name: 'Confirm rotation', exact: true }).click();
  const rotatedSecret = await existing.getByLabel('Client secret (shown once)', { exact: true }).inputValue();
  assert.notEqual(rotatedSecret, clientSecret); assert.equal((await grant(clientSecret)).status(), 401);
  assert.equal((await oauthIdentity(tokenData.access_token)).status(), 401);
  const rotatedGrant = await grant(rotatedSecret); assert.equal(rotatedGrant.status(), 200);
  const rotatedToken = (await rotatedGrant.json()).access_token; assert.equal((await oauthIdentity(rotatedToken)).status(), 200); pass();
  stage = 'Auth deactivation and ADMIN client revocation block OAuth token access';
  assert.equal((await adminContext.request.post(`${auth}/api/v1/auth/admin/users/${oauthBusiness.userId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` }, data: { active: false }
  })).status(), 200);
  assert.equal((await oauthIdentity(rotatedToken)).status(), 401); assert.equal((await grant(rotatedSecret)).status(), 401);
  await admin.goto(`${base}/admin/merchants/${oauthBusiness.merchantId}/oauth-clients`);
  await admin.getByRole('button', { name: 'Revoke client', exact: true }).click();
  await admin.getByRole('button', { name: 'Confirm client revocation', exact: true }).click();
  await admin.getByText('OAuth client revoked. Its secret and access tokens can no longer be used.', { exact: true }).waitFor();
  assert.equal((await adminContext.request.post(`${auth}/api/v1/auth/admin/users/${oauthBusiness.userId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` }, data: { active: true }
  })).status(), 200);
  assert.equal((await grant(rotatedSecret)).status(), 401); assert.equal((await oauthIdentity(rotatedToken)).status(), 401); pass();
  await customerContext.close(); await adminContext.close(); await existingContext.close();
})().catch(error => { console.error(`FAIL: ${stage} (${error.name}) ${error.stack?.match(/onboarding\.cjs:\d+:\d+/)?.[0] || ''}`); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });
