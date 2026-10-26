const logger = require('../config/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Validation failed', 422, details);
  }
}

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this value already exists';
    details = { field: err.meta?.target };
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log internal errors
  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${message}`, {
      path: req.path,
      method: req.method,
      // DO NOT log request body (may contain passwords/PII)
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  } else {
    logger.debug(`[${statusCode}] ${message}`, { path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    // Never expose stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { AppError, ValidationError, notFoundHandler, errorHandler };
