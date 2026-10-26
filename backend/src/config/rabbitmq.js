const amqp = require('amqplib');
const logger = require('./logger');

let connection = null;
let channel = null;

const EXCHANGE_NAME = 'swiftdrop.events';
const EXCHANGE_TYPE = 'topic';

async function connectRabbitMQ() {
  const isDev = process.env.NODE_ENV !== 'production';
  const maxRetries = isDev ? 2 : 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      channel = await connection.createChannel();

      // Declare the main topic exchange
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

      // Declare queues
      await channel.assertQueue('swiftdrop.notifications.email', { durable: true });
      await channel.assertQueue('swiftdrop.notifications.webhook', { durable: true });

      // Bind queues to exchange
      await channel.bindQueue('swiftdrop.notifications.email', EXCHANGE_NAME, 'parcel.*');
      await channel.bindQueue('swiftdrop.notifications.webhook', EXCHANGE_NAME, 'parcel.*');

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, reconnecting...');
        setTimeout(connectRabbitMQ, 5000);
      });

      logger.info('✅ RabbitMQ connected, exchange declared');
      return;
    } catch (err) {
      attempt++;
      logger.warn(`RabbitMQ connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt >= maxRetries) {
        if (isDev) {
          logger.warn('⚠️ RabbitMQ is not running locally. Continuing in dev fallback mode (events logged to console).');
          return;
        }
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function publishEvent(routingKey, payload) {
  try {
    if (!channel) {
      logger.info(`[Dev Broker Fallback] Event published: ${routingKey}`, payload);
      return;
    }
    const message = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE_NAME, routingKey, message, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });
    logger.debug(`Published event: ${routingKey}`, payload);
  } catch (err) {
    logger.error('Failed to publish event:', err);
  }
}

function getChannel() {
  return channel;
}

module.exports = { connectRabbitMQ, publishEvent, getChannel, EXCHANGE_NAME };
