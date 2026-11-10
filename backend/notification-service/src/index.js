const amqp = require('amqplib');
const winston = require('winston');
const http = require('http');
const { initTransport, sendEmailNotification } = require('./emailService');
const { sendSmsNotification, getSmsHistory } = require('./smsService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.simple()),
  transports: [new winston.transports.Console()],
});

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://swiftdrop:swiftdrop_pass@rabbitmq:5672';
const EXCHANGE_NAME = 'swiftdrop.events';
const EMAIL_QUEUE = 'swiftdrop.notifications.email';
const SMS_QUEUE = 'swiftdrop.notifications.sms';
const PORT = parseInt(process.env.PORT || '4005', 10);

let isConsumerHealthy = false;

// In-memory list of active SSE client responses
const sseClients = new Set();

function broadcastSse(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// HTTP Health Check, SMS History, and Real-time SSE Notification Stream
function startHttpServer() {
  const server = http.createServer((req, res) => {
    // Enable CORS for frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/health' || req.url === '/actuator/health') {
      res.writeHead(isConsumerHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: isConsumerHealthy ? 'UP' : 'DOWN', service: 'notification-service' }));
      return;
    }

    if (req.url === '/api/v1/notifications/sms-log') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: getSmsHistory().length, messages: getSmsHistory() }));
      return;
    }

    // Server-Sent Events (SSE) stream for live in-app notifications
    if (req.url?.startsWith('/api/v1/notifications/stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(': connected\n\n');
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🌐 Notification Service HTTP & SSE stream listening on port ${PORT}`);
  });
}

async function startRabbitMqConsumer() {
  const maxRetries = 30;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      logger.info(`🔌 Connecting to RabbitMQ at ${RABBITMQ_URL} (Attempt ${attempt + 1}/${maxRetries})...`);
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      channel.prefetch(1);

      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
      await channel.assertQueue(EMAIL_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'swiftdrop.events.dlx',
          'x-dead-letter-routing-key': 'email.dlq',
        },
      });
      await channel.assertQueue(SMS_QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'swiftdrop.events.dlx',
          'x-dead-letter-routing-key': 'sms.dlq',
        },
      });

      await channel.bindQueue(EMAIL_QUEUE, EXCHANGE_NAME, 'parcel.*');
      await channel.bindQueue(SMS_QUEUE, EXCHANGE_NAME, 'parcel.*');

      logger.info(' Connected to RabbitMQ!');
      isConsumerHealthy = true;

      // 1. Email Consumer
      channel.consume(EMAIL_QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          logger.info(`📧 [EMAIL-QUEUE] Received event: ${payload.event} for parcel: ${payload.trackingNumber}`);
          await sendEmailNotification(payload);

          // Push live event to frontend browsers over SSE!
          broadcastSse({
            type: 'PARCEL_NOTIFICATION',
            event: payload.event || (payload.newStatus ? 'parcel.status_changed' : 'parcel.created'),
            trackingNumber: payload.trackingNumber,
            recipientEmail: payload.recipientEmail,
            newStatus: payload.newStatus || 'CREATED',
            note: payload.note,
            failureReason: payload.failureReason,
            courierName: payload.courierName,
            timestamp: payload.timestamp || new Date().toISOString()
          });

          channel.ack(msg);
        } catch (err) {
          logger.error(`❌ [EMAIL-QUEUE] Failed to process message: ${err.message}`);
          channel.nack(msg, false, !msg.fields.redelivered);
        }
      });

      // 2. SMS Consumer
      channel.consume(SMS_QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          logger.info(`📱 [SMS-QUEUE] Received event: ${payload.event} for parcel: ${payload.trackingNumber}`);
          await sendSmsNotification(payload);
          channel.ack(msg);
        } catch (err) {
          logger.error(`❌ [SMS-QUEUE] Failed to process SMS: ${err.message}`);
          channel.nack(msg, false, !msg.fields.redelivered);
        }
      });

      connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
        isConsumerHealthy = false;
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Attempting reconnect in 5 seconds...');
        isConsumerHealthy = false;
        setTimeout(startRabbitMqConsumer, 5000);
      });

      return;
    } catch (err) {
      attempt++;
      isConsumerHealthy = false;
      logger.warn(`RabbitMQ connection attempt ${attempt} failed (${err.message}). Retrying in 5s...`);
      if (attempt >= maxRetries) {
        logger.error('Max retry attempts reached. Exiting process.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function bootstrap() {
  startHttpServer();
  await initTransport();
  await startRabbitMqConsumer();
}

bootstrap().catch((err) => {
  logger.error('Fatal initialization error:', err);
  process.exit(1);
});
