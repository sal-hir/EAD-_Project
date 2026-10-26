const logger = require('./logger');
const { verifyToken } = require('../modules/auth/auth.service');

function setupSocketIO(io) {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (token) {
        const user = await verifyToken(token);
        socket.user = user;
      }
      next();
    } catch (err) {
      // Allow unauthenticated connections (for public tracking)
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // Join a parcel tracking room
    socket.on('track:join', (trackingNumber) => {
      if (trackingNumber) {
        socket.join(`parcel:${trackingNumber}`);
        logger.debug(`Socket ${socket.id} joined room parcel:${trackingNumber}`);
      }
    });

    // Leave a parcel tracking room
    socket.on('track:leave', (trackingNumber) => {
      if (trackingNumber) {
        socket.leave(`parcel:${trackingNumber}`);
      }
    });

    // Courier location update (only couriers)
    socket.on('courier:location', (data) => {
      if (socket.user && socket.user.role === 'COURIER') {
        io.emit('courier:location:update', { courierId: socket.user.id, ...data });
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });
}

// Helper to emit status update to a parcel room
function emitParcelStatusUpdate(io, trackingNumber, data) {
  io.to(`parcel:${trackingNumber}`).emit('status:update', {
    trackingNumber,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { setupSocketIO, emitParcelStatusUpdate };
