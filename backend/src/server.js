require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./config/logger');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { setupSocketIO } = require('./config/socket');
const { setupPassport } = require('./config/passport');

// Route modules
const authRoutes = require('./modules/auth/auth.routes');
const parcelRoutes = require('./modules/parcels/parcel.routes');
const courierRoutes = require('./modules/couriers/courier.routes');
const merchantRoutes = require('./modules/merchants/merchant.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const zoneRoutes = require('./modules/zones/zone.routes');
const uploadRoutes = require('./modules/uploads/upload.routes');

// Error handler
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();
const httpServer = http.createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible to route handlers
app.set('io', io);

// Security middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Passport setup
setupPassport(app);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'swiftdrop-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/parcels', parcelRoutes);
app.use('/api/v1/couriers', courierRoutes);
app.use('/api/v1/merchants', merchantRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/zones', zoneRoutes);
app.use('/api/v1/uploads', uploadRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Socket.io
setupSocketIO(io);

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('✅ RabbitMQ connected');

    httpServer.listen(PORT, () => {
      logger.info(`🚀 SwiftDrop API running on port ${PORT}`);
      logger.info(`📡 Socket.io ready`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, httpServer };
