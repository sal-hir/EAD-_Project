// Temporary loopback receiver. Use only with an explicit temporary HTTPS tunnel.
// Configuration and receipts stay in the ignored target/live-webhook directory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const folder = path.resolve(process.argv[2]);
let currentPath, receipts = [];
const server = http.createServer((req, res) => {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(folder, 'config.json'), 'utf8')); }
  catch { res.writeHead(503); res.end(); return; }
  if (req.method !== 'POST' || req.url !== config.path) { res.writeHead(404); res.end(); return; }
  if (currentPath !== config.path) { currentPath = config.path; receipts = []; }
  const chunks = []; let length = 0;
  req.on('data', chunk => { length += chunk.length; if (length > 16384) req.destroy(); else chunks.push(chunk); });
  req.on('end', () => {
    const raw = Buffer.concat(chunks), timestamp = req.headers['x-swiftdrop-timestamp'];
    const supplied = req.headers['x-swiftdrop-signature'] || '';
    const expected = 'v1=' + crypto.createHmac('sha256', config.secret).update(timestamp + '.').update(raw).digest('hex');
    const valid = typeof timestamp === 'string' && /^\d+$/.test(timestamp)
      && Math.abs(Date.now() / 1000 - Number(timestamp)) < 300
      && supplied.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!valid) { res.writeHead(401); res.end(); return; }
    const status = receipts.length === 0 ? 503 : 204;
    receipts.push({ verified: true, status, eventId: req.headers['x-swiftdrop-event-id'],
      bodyHash: crypto.createHash('sha256').update(raw).digest('hex') });
    fs.writeFileSync(path.join(folder, 'receipts.json'), JSON.stringify(receipts));
    res.writeHead(status, { 'Cache-Control': 'no-store' }); res.end();
  });
});
server.listen(8789, '127.0.0.1', () => console.log('Synthetic webhook verifier listening on loopback port 8789'));
