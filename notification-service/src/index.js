require('dotenv').config();
const amqp = require('amqplib');
const { createLogger, format, transports } = require('winston');
const emailService = require('./emailService');
const webhookService = require('./webhookService');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

const EXCHANGE_NAME = 'swiftdrop.events';
const EMAIL_QUEUE = 'swiftdrop.notifications.email';
const WEBHOOK_QUEUE = 'swiftdrop.notifications.webhook';

async function startConsumer() {
  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      logger.info(`Connecting to RabbitMQ (attempt ${attempt + 1})...`);
      const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      const channel = await connection.createChannel();

      // Set prefetch to process one message at a time
      channel.prefetch(1);

      // Declare exchange and queues (idempotent)
      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await channel.assertQueue(EMAIL_QUEUE, { durable: true });
      await channel.assertQueue(WEBHOOK_QUEUE, { durable: true });

      // Bind queues
      await channel.bindQueue(EMAIL_QUEUE, EXCHANGE_NAME, 'parcel.*');
      await channel.bindQueue(WEBHOOK_QUEUE, EXCHANGE_NAME, 'parcel.*');

      logger.info('✅ Notification service connected to RabbitMQ');
      logger.info(`📧 Listening on queue: ${EMAIL_QUEUE}`);
      logger.info(`🔔 Listening on queue: ${WEBHOOK_QUEUE}`);

      // Email consumer
      channel.consume(EMAIL_QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          logger.info(`📧 Processing email event: ${payload.event} for ${payload.trackingNumber}`);
          await emailService.sendStatusEmail(payload);
          channel.ack(msg);
          logger.info(`✅ Email sent for ${payload.trackingNumber}`);
        } catch (err) {
          logger.error(`❌ Email processing failed:`, err.message);
          // Requeue once, then dead-letter
          channel.nack(msg, false, !msg.fields.redelivered);
        }
      });

      // Webhook consumer
      channel.consume(WEBHOOK_QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          if (payload.webhookUrl && payload.merchantId) {
            logger.info(`🔔 Processing webhook for merchant ${payload.merchantId}`);
            await webhookService.sendWebhook(payload);
          }
          channel.ack(msg);
        } catch (err) {
          logger.error(`❌ Webhook processing failed:`, err.message);
          channel.nack(msg, false, !msg.fields.redelivered);
        }
      });

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Reconnecting in 5s...');
        setTimeout(startConsumer, 5000);
      });

      return; // Success
    } catch (err) {
      attempt++;
      logger.warn(`Connection failed (${attempt}/${maxRetries}): ${err.message}. Retrying in 5s...`);
      if (attempt >= maxRetries) {
        logger.error('Max retries reached. Exiting.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Initialize email transport on startup
async function init() {
  await emailService.initTransport();
  await startConsumer();
}

init().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
