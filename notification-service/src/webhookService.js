const axios = require('axios');
const crypto = require('crypto');
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

const MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || '5', 10);
const INITIAL_DELAY_MS = 2000; // 2 seconds exponential backoff

/**
 * Generate HMAC SHA256 signature for webhook payload
 */
function generateSignature(payload, secret) {
  if (!secret) return '';
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Send webhook notification to merchant endpoint with exponential backoff retries
 */
async function sendWebhook(eventPayload) {
  const { webhookUrl, webhookSecret, merchantId, trackingNumber, newStatus } = eventPayload;

  if (!webhookUrl) {
    logger.warn(`No webhook URL configured for merchant ${merchantId}`);
    return;
  }

  const payload = {
    event: 'parcel.status_update',
    timestamp: new Date().toISOString(),
    data: {
      trackingNumber,
      status: newStatus,
      merchantId,
      note: eventPayload.note || null,
      updatedAt: eventPayload.timestamp,
    },
  };

  const signature = generateSignature(payload, webhookSecret || process.env.WEBHOOK_SECRET);

  let attempt = 0;
  let delay = INITIAL_DELAY_MS;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      logger.info(`Sending webhook to ${webhookUrl} (attempt ${attempt}/${MAX_RETRIES})...`);

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SwiftDrop-Webhook/1.0',
          'X-SwiftDrop-Signature': signature,
          'X-SwiftDrop-Delivery-Attempt': attempt.toString(),
        },
        timeout: 8000,
      });

      logger.info(`Webhook successfully delivered to ${webhookUrl} (status: ${response.status})`);
      return { success: true, status: response.status, attempts: attempt };
    } catch (err) {
      logger.warn(`Webhook attempt ${attempt} failed: ${err.message}`);

      if (attempt >= MAX_RETRIES) {
        logger.error(`Webhook delivery permanently failed for merchant ${merchantId} after ${MAX_RETRIES} attempts`);
        return { success: false, error: err.message, attempts: attempt };
      }

      // Wait with exponential backoff (e.g. 2s, 4s, 8s, 16s...)
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

module.exports = {
  sendWebhook,
  generateSignature,
};
