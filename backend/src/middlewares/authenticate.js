const passport = require('passport');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

// JWT Authentication middleware
const authenticate = passport.authenticate('jwt', { session: false });

// Flexible auth - allows unauthenticated but enriches request if token present
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (user && user.isActive) req.user = user;
    next();
  } catch {
    next();
  }
};

module.exports = { authenticate, optionalAuthenticate };
