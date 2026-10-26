const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { AppError } = require('./errorHandler');
const logger = require('../config/logger');

// Cache for API key lookups (simple in-memory, Redis in production)
const apiKeyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return next(new AppError('API key required. Provide X-API-Key header.', 401));
    }

    // Check cache
    const cached = apiKeyCache.get(apiKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      req.merchant = cached.merchant;
      req.user = cached.merchant.user;
      return next();
    }

    // Find merchant by checking all API keys (in production, use a prefix lookup)
    // API keys are stored as hashes; we search by finding the right merchant
    // For scalability, we'd store a prefix of the key unhashed for lookup
    const merchants = await prisma.merchant.findMany({
      where: { isApproved: true },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });

    let merchant = null;
    for (const m of merchants) {
      // Compare provided key with stored key (unhashed for lookup)
      if (m.apiKey === apiKey) {
        merchant = m;
        break;
      }
    }

    if (!merchant) {
      logger.warn(`Invalid API key attempt from IP: ${req.ip}`);
      return next(new AppError('Invalid API key', 401));
    }

    // Cache successful lookup
    apiKeyCache.set(apiKey, { merchant, cachedAt: Date.now() });

    req.merchant = merchant;
    req.user = merchant.user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { apiKeyAuth };
